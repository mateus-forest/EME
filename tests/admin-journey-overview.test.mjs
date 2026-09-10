import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { URL, URLSearchParams } from "node:url"
import console from "node:console"
import ts from "typescript"

const { Request, Response } = globalThis
const requireNative = createRequire(import.meta.url)
function load(path, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "exports", code)(name => {
    if (name.startsWith("node:")) return requireNative(name)
    if (name === "server-only") return {}
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}
const contract = load("lib/admin-journey-contract.ts", { "@/lib/journey/contract": { ADMIN_ANALYTICS_TIME_ZONE: "America/Sao_Paulo" } })
const resolver = load("lib/billing-resolution.ts")
const overview = load("lib/admin-journey-overview.ts", { pg: {}, "@/lib/prisma": {}, "@/lib/admin-billing": {}, "@/lib/admin-journey-sql": {}, "@/lib/admin-journey-contract": contract })
const now = new Date("2026-09-10T02:30:00Z")
const period = contract.resolveOverviewPeriod(new URLSearchParams("period=7d"), now)
const facts = { quality: { firstReceivedAt: "2026-09-01T12:00:00Z", lastReceivedAt: now.toISOString(), missingPageIdentity: 0, unlinkedConversions: 0 } }

test("today/7/30 days use Sao Paulo calendar days, not process timezone or rolling UTC hours", () => {
  assert.equal(contract.resolveOverviewPeriod(new URLSearchParams("period=today"), now).start, "2026-09-09T03:00:00.000Z")
  assert.equal(period.from, "2026-09-03")
  assert.equal(period.start, "2026-09-03T03:00:00.000Z")
  assert.equal(period.end, now.toISOString())
  assert.equal(contract.resolveOverviewPeriod(new URLSearchParams("period=30d"), now).from, "2026-08-11")
})
test("custom end date is inclusive; query boundary is next local midnight exclusive", () => {
  const selected = contract.resolveOverviewPeriod(new URLSearchParams("period=custom&from=2026-09-01&to=2026-09-02"), now)
  assert.equal(selected.start, "2026-09-01T03:00:00.000Z")
  assert.equal(selected.end, "2026-09-03T03:00:00.000Z")
  for (const query of ["period=bad", "period=custom&from=2026-02-30&to=2026-03-02", "period=custom&from=2026-09-11&to=2026-09-12", "period=custom&from=2026-09-02&to=2026-09-01", "period=custom&from=2020-01-01&to=2026-09-01"]) assert.throws(() => contract.resolveOverviewPeriod(new URLSearchParams(query), now))
})
test("missing denominator is unknown, distinct from observed zero conversion", () => {
  assert.equal(contract.overviewRate(0, 0), null)
  assert.equal(contract.overviewRate(0, 10), 0)
  assert.equal(contract.overviewRate(1, 3), 33.3)
})
test("coverage and disabled collection are explicitly partial", () => {
  assert.equal(contract.journeySourceState(facts, period, true).status, "available")
  assert.equal(contract.journeySourceState(facts, period, false).status, "partial")
  for (const quality of [{ ...facts.quality, firstReceivedAt: null }, { ...facts.quality, firstReceivedAt: now.toISOString() }, { ...facts.quality, missingPageIdentity: 1 }, { ...facts.quality, unlinkedConversions: 1 }]) assert.equal(contract.journeySourceState({ quality }, period, true).status, "partial")
})
test("failed sources remain null and cannot zero out the independent successful sources", async () => {
  const warn = console.warn; console.warn = () => {}
  try {
    const result = await overview.getAdminJourneyOverview(period, { journey: async () => { throw Error("storage down") }, registrations: async () => 5, subscribers: async () => { throw Error("billing read down") } })
    assert.equal(result.journey.data, null)
    assert.equal(result.journey.state.status, "unavailable")
    assert.equal(result.registrations.count, 5)
    assert.equal(result.subscribers.count, null)
    assert.equal(result.subscribers.pending, null)
    const empty = await overview.getAdminJourneyOverview(period, { journey: async () => facts, registrations: async () => 0, subscribers: async () => [] })
    assert.equal(empty.registrations.count, 0)
    assert.equal(empty.subscribers.count, 0)
    assert.ok(Date.parse(empty.generatedAt) > Date.parse(period.end))
  } finally { console.warn = warn }
})
test("active subscribers reuse the domain resolver: paid active/canceling count; trial, conflicts and arrears do not", () => {
  const input = { user: { id: "user_fixture", role: "BROKER", plan: "BROKER", subscriptionStatus: "ACTIVE", stripeCustomerId: "cus_fixture", stripeSubscriptionId: "sub_fixture" }, planAccount: { planKey: "pro", currentStripeSubscriptionId: "sub_fixture" }, subscription: { status: "ACTIVE", createdAt: null, nextBillingAt: null, cancelAtPeriodEnd: false, cancelAt: null } }
  const active = resolver.resolveAccountBilling(input)
  const canceling = resolver.resolveAccountBilling({ ...input, subscription: { ...input.subscription, cancelAtPeriodEnd: true } })
  const conflict = resolver.resolveAccountBilling({ ...input, user: { ...input.user, plan: "NONE" } })
  const delinquent = resolver.resolveAccountBilling({ ...input, user: { ...input.user, subscriptionStatus: "INACTIVE" }, subscription: { ...input.subscription, status: "PAST_DUE" } })
  const free = resolver.resolveAccountBilling({ ...input, user: { ...input.user, plan: "NONE", subscriptionStatus: "INACTIVE", stripeCustomerId: null, stripeSubscriptionId: null }, planAccount: { planKey: "free", currentStripeSubscriptionId: null }, subscription: null })
  assert.deepEqual(overview.summarizeOverviewSubscribers([active, canceling, conflict, delinquent, free, { ...active, presentationStatus: "Trial", trial: { kind: "stripe" } }]), { count: 2, pending: 1, trial: 1 })
})
test("endpoint rejects anonymous/non-admin before aggregation; invalid ranges are 400 and partial data stays usable", async () => {
  let user = null, reads = 0
  const route = load("app/api/admin/journey-overview/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/prisma-enums": { UserRole: { ADMIN: "ADMIN" } },
    "@/lib/auth-route": { getAuthenticatedUser: async () => ({ user }), ensureRole: role => role === "ADMIN" ? null : new Response(null, { status: 403 }) },
    "@/lib/admin-journey-contract": contract, "@/lib/admin-journey-overview": { getAdminJourneyOverview: async selected => { reads++; return { period: selected, journey: { data: null } } } },
  })
  const request = query => new Request(`http://localhost/api/admin/journey-overview?${query}`)
  assert.equal((await route.GET(request("period=7d"))).status, 401)
  user = { role: "BROKER" }; assert.equal((await route.GET(request("period=7d"))).status, 403)
  assert.equal(reads, 0)
  user = { role: "ADMIN" }; assert.equal((await route.GET(request("period=invalid"))).status, 400)
  const result = await route.GET(request("period=7d"))
  assert.equal(result.status, 200)
  assert.equal(result.headers.get("cache-control"), "private, no-store")
  assert.equal((await result.json()).overview.journey.data, null)
  assert.equal(reads, 1)
})
