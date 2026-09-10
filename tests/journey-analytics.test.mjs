import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { AsyncLocalStorage } from "node:async_hooks"
import ts from "typescript"
import process from "node:process"

const { Request, Response } = globalThis

const nativeRequire = createRequire(import.meta.url)
// Deliberately rejects undeclared dependencies: these tests cannot reach DB, Stripe or providers.
function load(file, dependencies = {}) {
  const source = readFileSync(new globalThis.URL(`../${file}`, import.meta.url), "utf8")
  const exports = {}
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  new Function("require", "exports", outputText)(name => {
    if (name.startsWith("node:")) return nativeRequire(name)
    if (name === "server-only") return {}
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}
const contract = load("lib/journey/contract.ts")
const errors = load("lib/journey/errors.ts", { "@/lib/journey/contract": contract })
const now = Date.now()
const event = (fields = {}) => ({ eventId: "event_12345678", eventName: "page_view", occurredAt: new Date(now).toISOString(), anonymousId: "anonymous_123", sessionId: "session_12345", pathname: "/", ...fields })
function harness({ storageFails = false, afterFails = false } = {}) {
  const pending = [], saved = []
  const after = fn => { if (afterFails) throw Error("after unavailable"); const run = AsyncLocalStorage.snapshot(); pending.push(() => run(fn)) }
  const server = load("lib/journey/server.ts", {
    "next/server": { after }, "@/lib/journey/contract": contract, "@/lib/journey/errors": errors,
    "@/lib/journey/persistence": { persistJourneyEvents: async events => { if (!storageFails) saved.push(...events) } },
  })
  const business = load("lib/journey/business.ts", { "@/lib/journey/server": server })
  const stripe = load("lib/journey/stripe.ts", { "@/lib/journey/server": server, "@/lib/journey/contract": contract })
  const drain = async () => { while (pending.length) await pending.shift()() }
  return { server, business, stripe, saved, pending, drain, after }
}
const request = (route = "/api/properties", requestId = "request_12345") => new Request(`http://localhost${route}`, { headers: { cookie: "eme_journey_anonymous=anonymous_123; eme_journey_session=session_12345", "x-eme-pathname": "/corretor/imoveis?email=private@example.test", "x-eme-request-id": requestId, "x-eme-correlation-id": requestId, "user-agent": "iPhone Mobile" } })
test.before(() => { process.env.JOURNEY_ANALYTICS_ENABLED = "true" })
test.after(() => { delete process.env.JOURNEY_ANALYTICS_ENABLED })

test("all required events have one versioned contract; browser cannot forge business success", () => {
  assert.equal(contract.JOURNEY_EVENTS.length, 28)
  for (const eventName of contract.JOURNEY_EVENTS) {
    const candidate = event({ eventName, step: "client_validation" })
    assert.ok(contract.normalizeJourneyEvent(candidate, "server"))
    assert.equal(Boolean(contract.normalizeJourneyEvent(candidate, "browser")), contract.BROWSER_EVENTS.includes(eventName), eventName)
  }
})
test("drops sensitive metadata, query strings, slugs, tokens and untrusted actor", () => {
  const parsed = contract.normalizeJourneyEvent(event({ userId: "owner_broker", brokerId: "broker_owner", pathname: "/catalogo/personal-slug?token=secret#private", referrer: "https://search.example/path?email=private@example.test", metadata: { email: "private@example.test", password: "secret", query: "personal address", prompt: "private", stack: "private", resultCount: 0, errorKind: "api", nested: { token: "secret" } } }), "browser", "visitor_user")
  assert.equal(parsed.pathname, "/catalogo/:id")
  assert.equal(parsed.userId, "visitor_user")
  assert.equal(parsed.referrer, "search.example")
  assert.deepEqual(parsed.metadata, { resultCount: 0, errorKind: "api" })
  assert.doesNotMatch(JSON.stringify(parsed), /secret|private|personal|owner_broker/)
})
test("browser validation is distinct from server signup failure", () => {
  assert.equal(contract.normalizeJourneyEvent(event({ eventName: "signup_failed", step: "server_validation" }), "browser"), null)
  assert.ok(contract.normalizeJourneyEvent(event({ eventName: "signup_failed", step: "client_validation" }), "browser"))
})
test("untrusted metadata cannot walk the enum registry prototype", () => {
  const parsed = contract.normalizeJourneyEvent(event({ metadata: JSON.parse('{"__proto__":{"secret":"private"},"constructor":"private","toString":"private","resultCount":2}') }), "browser")
  assert.deepEqual(parsed.metadata, { resultCount: 2 })
})
test("UTC timestamps, late webhooks and invalid/future browser clocks", () => {
  assert.equal(contract.normalizeJourneyEvent(event({ occurredAt: "2026-09-10T10:00:00-03:00" }), "server", null, Date.parse("2026-09-10T15:00Z")).occurredAt, "2026-09-10T13:00:00.000Z")
  assert.equal(contract.normalizeJourneyEvent(event({ occurredAt: "invalid" }), "browser"), null)
  assert.equal(contract.normalizeJourneyEvent(event({ occurredAt: new Date(now + 600_000).toISOString() }), "browser"), null)
  assert.equal(contract.normalizeJourneyEvent(event({ occurredAt: new Date(now - 172_800_000).toISOString() }), "browser"), null)
  assert.ok(contract.normalizeJourneyEvent(event({ occurredAt: "2020-01-01T00:00:00Z" }), "server"))
})
test("product modules and public modules keep their meaning after route redaction", () => {
  for (const [path, module] of [["/corretor", "cos"], ["/corretor/catalogo", "catalog"], ["/corretor/documentos", "proposals"], ["/corretor/documentos/contratos", "contracts"], ["/corretor/imoveis/private", "properties"], ["/imoveis/imovel/private", "marketplace"], ["/corretor/studio-ia/preparar-imovel", "studio"]]) assert.equal(contract.journeyModule(contract.journeyRoute(path)), module)
})
test("error classification never includes the original diagnostic", () => {
  assert.equal(errors.journeyErrorCode("/api/auth/register", 409, { error: "Email private@example.test já cadastrado" }), "EMAIL_ALREADY_REGISTERED")
  assert.equal(errors.journeyErrorCode("/api/auth/login", 401, { error: "Senha incorreta" }), "INVALID_CREDENTIALS")
  assert.equal(errors.journeyErrorCode("/api/properties/abc/images", 422, { code: "IMAGE_INVALID", error: "s3 secret" }), "IMAGE_INVALID")
})
test("response is returned before storage, with authenticated actor and correlation", async () => {
  const h = harness()
  const response = new Response("created", { status: 201 })
  const route = h.server.withJourneyRoute("/api/properties", async () => { h.server.setJourneyActor("user_12345678"); h.business.propertyCreatedJourney({ id: "property_123", brokerId: "broker_12345" }); return response })
  assert.equal(await route(request()), response)
  assert.equal(h.saved.length, 0)
  await h.drain()
  assert.equal(h.saved[0].userId, "user_12345678")
  assert.equal(h.saved[0].sessionId, "session_12345")
  assert.equal(h.saved[0].correlationId, "request_12345")
  assert.equal(h.saved[0].pathname, "/corretor/imoveis")
})
test("concurrent requests never exchange actors", async () => {
  const h = harness()
  const route = h.server.withJourneyRoute("/api/properties", async req => { const id = req.headers.get("x-eme-request-id"); h.server.setJourneyActor(id); await Promise.resolve(); h.business.propertyCreatedJourney({ id }); return new Response() })
  await Promise.all([route(request("/api/properties", "user_request_a")), route(request("/api/properties", "user_request_b"))])
  await h.drain()
  for (const e of h.saved) assert.equal(e.propertyId, e.userId)
})
test("public lead is attributed to visitor session, never recipient broker", async () => {
  const h = harness()
  await h.server.withJourneyRoute("/api/leads", async () => { h.business.leadCreatedJourney({ id: "lead_12345678", brokerId: "owner_1234567", catalogSlug: "catalog-one" }, "catalog"); return new Response() })(request("/api/leads"))
  await h.drain()
  assert.equal(h.saved[0].userId, null)
  assert.equal(h.saved[0].brokerId, "owner_1234567")
  assert.equal(h.saved[0].sessionId, "session_12345")
})
for (const fail of [{ storageFails: true }, { afterFails: true }]) test(`analytics failure preserves successful business response ${JSON.stringify(fail)}`, async () => {
  const h = harness(fail), response = new Response("business-ok")
  assert.equal(await h.server.withJourneyRoute("/api/properties", async () => { h.business.propertyCreatedJourney({ id: "property_123" }); return response })(request()), response)
  await h.drain()
})
test("failed business operation preserves exception and cannot create success", async () => {
  const h = harness(), failure = new Error("private DB credential")
  await assert.rejects(h.server.withJourneyRoute("/api/properties", async () => { throw failure })(request()), e => e === failure)
  await h.drain()
  assert.deepEqual(h.saved.map(e => e.eventName), ["error_occurred"])
  assert.doesNotMatch(JSON.stringify(h.saved), /credential/)
  h.server.captureJourneyRequestError(failure, { path: "/api/properties", headers: {} }, "/api/properties")
  await h.drain()
  assert.equal(h.saved.length, 1)
})
for (const [route, status, body, expected] of [
  ["/api/auth/register", 201, { user: { id: "user_12345678", brokerId: "broker_12345", email: "private@example.test" } }, "signup_completed"],
  ["/api/auth/login", 200, { user: { id: "user_12345678" } }, "login_completed"],
  ["/api/auth/device/pin", 200, { user: { id: "user_12345678" } }, "login_completed"],
  ["/api/auth/device/biometric/verify", 200, { user: { id: "user_12345678" } }, "login_completed"],
  ["/api/auth/register", 409, { error: "Email já cadastrado" }, "signup_failed"],
  ["/api/auth/login", 401, { error: "Senha incorreta" }, "login_failed"],
]) test(`${route} ${status} produces ${expected} after real response`, async () => {
  const h = harness()
  await h.server.withJourneyRoute(route, async () => Response.json(body, { status }))(request(route))
  await h.drain()
  const found = h.saved.find(e => e.eventName === expected)
  assert.ok(found)
  assert.equal(found.userId, body.user?.id ?? null)
  assert.doesNotMatch(JSON.stringify(h.saved), /private@example/)
})
test("logout rotates session without changing business body", async () => {
  const h = harness()
  const res = await h.server.withJourneyRoute("/api/auth/logout", async () => new Response("ok"))(request("/api/auth/logout"))
  assert.match(res.headers.get("set-cookie"), /eme_journey_session=/)
  assert.doesNotMatch(res.headers.get("set-cookie"), /session_12345/)
  assert.equal(await res.text(), "ok")
})
test("anonymous session probe is not counted as an authentication error", async () => {
  const h = harness()
  await h.server.withJourneyRoute("/api/auth/me", async () => Response.json({ error: "Not authenticated" }, { status: 401 }))(request("/api/auth/me"))
  await h.drain()
  assert.equal(h.saved.length, 0)
})
test("publication counts transitions and republishing, not repeated PATCH or unpublishing", async () => {
  const h = harness(), property = { id: "property_123", published: true, marketplacePublished: true, updatedAt: "2026-09-10T00:00Z" }
  await h.server.withJourneyRoute("/api/properties/:id/publish", async () => {
    h.business.propertyPublishedJourney({}, property)
    h.business.propertyPublishedJourney(property, property)
    h.business.propertyPublishedJourney(property, { ...property, published: false, marketplacePublished: false })
    h.business.propertyPublishedJourney({}, { ...property, updatedAt: "2026-09-11T00:00Z" })
    return new Response()
  })(request())
  await h.drain()
  assert.equal(h.saved.length, 4)
  assert.equal(new Set(h.saved.map(e => e.eventId)).size, 4)
})
test("proposal means persisted proposal, not draft contract or video job", async () => {
  const h = harness()
  for (const type of ["proposal", "contract", "studio_ia_video_job"]) h.business.documentCreatedJourney({ id: "document_1234", type })
  await h.drain()
  assert.deepEqual(h.saved.map(e => e.eventName), ["proposal_created"])
})
test("logical Studio lifecycle and retries use stable operation IDs; failure emits central error once", async () => {
  const h = harness()
  await h.server.withJourneyRoute("/api/studio-ia/instagram", async () => { h.business.startStudioJourney(); h.business.startStudioJourney(); h.business.failStudioJourney(); return Response.json({ error: "provider private detail" }, { status: 502 }) })(request())
  await h.drain()
  assert.equal(h.saved.filter(e => e.eventName === "studio_generation_started").length, 1)
  assert.equal(h.saved.filter(e => e.eventName === "studio_generation_failed").length, 1)
  assert.equal(h.saved.filter(e => e.eventName === "error_occurred").length, 1)
  assert.equal(h.saved.filter(e => e.eventName === "studio_generation_completed").length, 0)
})
test("failure after accepting a Studio campaign closes its generation; failure after completion does not rewrite success", async () => {
  for (const completed of [false, true]) {
    const h = harness()
    await h.server.withJourneyRoute("/api/studio-ia/video", async () => {
      h.business.studioJourney("campaign_1234", "started")
      if (completed) h.business.studioJourney("campaign_1234", "completed")
      return Response.json({ code: "DOCUMENT_WRITE_FAILED" }, { status: 500 })
    })(request("/api/studio-ia/video"))
    await h.drain()
    assert.equal(h.saved.some(e => e.eventName === "studio_generation_failed"), !completed)
    assert.equal(h.saved.some(e => e.eventName === "studio_generation_completed"), completed)
  }
})
test("checkout retries share ID across webhook deliveries and restore anonymous context", async () => {
  const h = harness(), session = { id: "cs_checkout_123", payment_status: "paid", metadata: { userId: "user_12345678", journey_anonymousId: "anonymous_123", journey_sessionId: "session_12345", journey_correlationId: "checkout_correlation" } }
  for (let i = 0; i < 2; i++) await h.server.withJourneyRoute("/api/stripe/webhook", async () => { h.stripe.checkoutJourney(session, "completed"); return new Response() })(request("/api/stripe/webhook", `request_webhook_${i}`))
  await h.drain()
  assert.equal(h.saved[0].eventId, h.saved[1].eventId)
  assert.equal(h.saved[0].sessionId, "session_12345")
  assert.equal(h.saved[0].correlationId, "checkout_correlation")
})
test("persistence is parameterized, idempotent, links only authenticated sessions and tolerates outage", async () => {
  let query
  globalThis.journeyPool = { query: async input => { query = input; throw Error("database unavailable") } }
  const originalUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = "postgresql://fixture.invalid/no-network"
  const { persistJourneyEvents } = load("lib/journey/persistence.ts", { pg: {} })
  const warn = globalThis.console.warn
  globalThis.console.warn = () => {}
  try {
    await assert.doesNotReject(persistJourneyEvents([contract.normalizeJourneyEvent(event(), "browser")]))
    assert.match(query.text, /ON CONFLICT \("eventId"\) DO NOTHING/)
    assert.match(query.text, /'signup_completed','login_completed'/)
    assert.match(query.text, /GROUP BY "anonymousId","sessionId","userId"/)
    assert.equal(query.values.length, 1)
    assert.equal(JSON.parse(query.values[0]).length, 1)
    assert.equal(globalThis.journeyWrites, 0)
  } finally { globalThis.console.warn = warn; delete globalThis.journeyPool; if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl }
})

class MockNextRequest extends Request {
  get nextUrl() { return new globalThis.URL(this.url) }
  get cookies() { return { get: key => { const value = (this.headers.get("cookie") ?? "").split(";").map(v => v.trim()).find(v => v.startsWith(`${key}=`))?.slice(key.length + 1); return value ? { value } : undefined } } }
}
test("collector validates actor, rejects forged business events, drops stale-session actor and rejects cross-origin/oversize", async () => {
  const h = harness(), persisted = []
  const { POST } = load("app/api/journey/events/route.ts", {
    "next/server": { after: h.after, NextResponse: Response }, "@/lib/journey/contract": contract,
    "@/lib/auth": { AUTH_COOKIE_NAME: "eme_auth", verifyAuthToken: async () => ({ userId: "authenticated_user" }) },
    "@/lib/journey/persistence": { persistJourneyEvents: async values => persisted.push(...values) },
  })
  const send = (events, headers = {}) => POST(new MockNextRequest("http://localhost/api/journey/events", { method: "POST", body: JSON.stringify({ events }), headers: { origin: "http://localhost", cookie: "eme_auth=fixture; eme_journey_anonymous=anonymous_123; eme_journey_session=session_12345", ...headers } }))
  assert.equal((await send([event({ userId: "forged_user" }), event({ eventName: "checkout_completed" }), event({ eventId: "event_oldsession", sessionId: "old_session_123" })])).status, 202)
  await h.drain()
  assert.equal(persisted.length, 2)
  assert.equal(persisted[0].userId, "authenticated_user")
  assert.equal(persisted[1].userId, null)
  assert.equal((await send([event()], { origin: "https://attacker.invalid" })).status, 403)
  assert.equal((await send([event()], { "content-length": "32769" })).status, 413)
  assert.equal((await send(Array.from({ length: 21 }, () => event()))).status, 400)
})

for (const [paymentStatus, subscriptionStatus, syncSucceeds, expected] of [["paid", "active", true, 1], ["unpaid", "incomplete", true, 0], ["no_payment_required", "trialing", true, 1], ["paid", "active", false, 0]]) test(`real webhook: ${paymentStatus}/${subscriptionStatus}/linked=${syncSucceeds} confirms ${expected} checkout`, async () => {
  const h = harness()
  const session = { id: "cs_session_123", subscription: "sub_subscription", payment_status: paymentStatus, metadata: { userId: "user_12345678", journey_sessionId: "session_12345", journey_anonymousId: "anonymous_123" } }
  const stripeEvent = { id: "evt_event_123", type: "checkout.session.completed", created: Math.floor(now / 1000), data: { object: session } }
  const subscription = { id: "sub_subscription", status: subscriptionStatus, metadata: { userId: "user_12345678" } }
  const { POST } = load("app/api/stripe/webhook/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/journey/server": h.server, "@/lib/journey/stripe": h.stripe,
    "@/lib/billing": { syncBillingFromStripeSubscription: async () => syncSucceeds ? { id: "user_12345678" } : null },
    "@/lib/env.server": { getStripeEnv: () => ({ enabled: true, webhookSecret: "fixture" }) },
    "@/lib/billing-lifecycle-policy": { isConfirmedStripePayment: value => value === "paid" },
    "@/lib/billing-notifications": {}, "@/lib/eme-plans": { EME_EXTRA_PACKAGES: {} }, "@/lib/eme-plan-service": {},
    "@/lib/prisma": { prisma: { user: { findFirst: async () => null } } }, "@/lib/prisma-enums": {},
    "@/lib/stripe-server": { getStripeClient: () => ({ webhooks: { constructEvent: () => stripeEvent }, subscriptions: { retrieve: async () => subscription } }) },
  })
  const result = await POST(new MockNextRequest("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture" }, body: "fixture" }))
  assert.equal(result.status, 200)
  await h.drain()
  assert.equal(h.saved.filter(e => e.eventName === "checkout_completed").length, expected)
  if (!syncSucceeds) assert.ok(h.saved.some(e => e.eventName === "error_occurred" && e.errorCode === "STRIPE_BILLING_UNRESOLVED"))
  // Duplicate signed delivery has the same fact ID.
  await POST(new MockNextRequest("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture" }, body: "fixture" }))
  await h.drain()
  assert.equal(new Set(h.saved.filter(e => e.eventName === "checkout_completed").map(e => e.eventId)).size, expected)
})
test("real Studio persistence: video preview never completes generation; final video does", async () => {
  const h = harness()
  let campaign = { id: "campaign_1234", createdByUserId: "user_12345678", brokerId: "broker_12345", propertyId: null, kind: "VIDEO", status: "PENDING_REVIEW", assets: [{ id: "asset_preview", type: "IMAGE", fileUrl: "https://fixture.invalid/preview.jpg", status: "PENDING_REVIEW", createdAt: new Date(), updatedAt: new Date() }], createdAt: new Date(), updatedAt: new Date() }
  const studio = load("lib/studio-campaigns.ts", {
    "@/lib/journey/server": h.server, "@/lib/journey/business": h.business,
    "@/lib/property-storage": {}, "@/lib/prisma-enums": { UserRole: { BROKER: "BROKER" } }, "@/lib/public-catalog-url": {},
    "@/lib/prisma": { prisma: { studioCampaign: { update: async () => campaign } } },
  })
  await studio.updateStudioCampaignById({ campaignId: campaign.id, status: "PENDING_REVIEW" })
  await h.drain()
  assert.equal(h.saved.length, 0)
  campaign = { ...campaign, assets: [...campaign.assets, { ...campaign.assets[0], id: "asset_video", type: "VIDEO", fileUrl: "https://fixture.invalid/final.mp4" }] }
  await studio.updateStudioCampaignById({ campaignId: campaign.id, status: "PENDING_REVIEW" })
  await h.drain()
  assert.equal(h.saved.filter(e => e.eventName === "studio_generation_completed").length, 1)
})
test("COS finance validation emits failure without changing response or writing business data", async () => {
  const h = harness()
  const finance = load("lib/cos-launch/finance.ts", { "@/lib/journey/server": h.server, "@/lib/broker-finance": {}, "@/lib/prisma": { prisma: {} }, "@/lib/structured-fields": {} })
  const response = await h.server.withJourneyRoute("/api/cos-launch", async () => Response.json(await finance.createCosLaunchFinancialRecord({ kind: "financial_income", userId: "user_12345678", brokerId: "broker_12345", payload: {} })))(request("/api/cos-launch"))
  assert.deepEqual(await response.json(), { message: "Informe uma data válida para o lançamento." })
  await h.drain()
  assert.equal(h.saved.filter(e => e.eventName === "cos_action_failed").length, 1)
  assert.equal(h.saved.filter(e => e.eventName === "cos_action_completed").length, 0)
  assert.equal(h.saved.find(e => e.eventName === "error_occurred").errorCode, "COS_FINANCE_INVALID_DATE")
})
