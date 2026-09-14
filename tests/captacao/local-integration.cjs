// Real HTTP authentication and PostgreSQL persistence. Explicit synthetic listings only.
// Opt-in runner: EME_CAPTACAO_LOCAL_ACCESS must point outside the repo to new local credentials.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict")
const { randomUUID } = require("node:crypto")
const { loader } = require("./load.cjs")
const fixtures = require("./fixtures.cjs")
if (!process.env.EME_CAPTACAO_LOCAL_ACCESS)
  throw Error(
    "Set EME_CAPTACAO_LOCAL_ACCESS for the isolated local test environment",
  )
const access = JSON.parse(
  fs
    .readFileSync(process.env.EME_CAPTACAO_LOCAL_ACCESS, "utf8")
    .replace(/^\uFEFF/, ""),
)
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.local"),
  quiet: true,
})
const dbUrl = new URL(process.env.DATABASE_URL)
if (
  dbUrl.hostname !== "127.0.0.1" ||
  dbUrl.port !== "55449" ||
  dbUrl.pathname !== "/captacao_preview"
)
  throw Error("Refusing non-local test database")
const base = "http://localhost:3116"
const load = loader()
const service = load("lib/captacao/service.ts"),
  gecko = load("lib/captacao/gecko.ts"),
  contract = load("lib/captacao/contract.ts")
const { prisma } = load("lib/prisma.ts")
let checks = 0
const report = []
function ok(label) {
  checks++
  report.push(label)
  console.log("OK " + label)
}
async function api(url, body, cookie, method = "POST") {
  const r = await fetch(base + url, {
    method: body === undefined ? "GET" : method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: base,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { r, data: await r.json() }
}
;(async () => {
  let a = await api("/api/brokers/captacao")
  assert.equal(a.r.status, 401)
  ok("anonymous denied")
  a = await api("/api/auth/login", { email: access.email, password: "invalid" })
  assert.equal(a.r.status, 401)
  ok("wrong password denied")
  const auth = await api("/api/auth/login", {
    email: access.email,
    password: access.password,
  })
  assert.equal(auth.r.status, 200)
  const cookie = auth.r.headers.get("set-cookie").split(";")[0]
  assert.match(auth.r.headers.get("set-cookie"), /HttpOnly/i)
  ok("real login and HttpOnly cookie")
  const bAuth = await api("/api/auth/login", {
    email: "captacao.outro@example.invalid",
    password: access.password,
  })
  assert.equal(bAuth.r.status, 200)
  const bCookie = bAuth.r.headers.get("set-cookie").split(";")[0]
  const broker = await prisma.broker.findFirst({
    where: { user: { email: access.email } },
  })
  const other = await prisma.broker.findFirst({
    where: { user: { email: "captacao.outro@example.invalid" } },
  })
  a = await api(
    "/api/brokers/captacao/search",
    { filters: fixtures.filters, sources: ["olx"], page: 1 },
    cookie,
  )
  assert.equal(a.data.code, "NOT_CONFIGURED")
  ok("normal app reports unconfigured, no fake search")
  const beforeProperties = await prisma.property.count({
      where: { brokerId: broker.id },
    }),
    beforeLeads = await prisma.lead.count({ where: { brokerId: broker.id } }),
    beforeContacts = await prisma.captacaoActivity.count({
      where: { captacao: { brokerId: broker.id }, action: "CONTACT" },
    }),
    beforeConfirmed = await prisma.captacao.count({
      where: { brokerId: broker.id, stage: "CONFIRMED" },
    })
  const unique = String(Date.now())
  const raw = {
    ...fixtures.items.chavesnamao,
    id: unique,
    url: fixtures.urls.chavesnamao.replace("991100", unique),
  }
  const listing = gecko.normalizeListing(
    "chavesnamao",
    raw,
    new Date().toISOString(),
  )
  listing.matches = contract.matchFacts(listing, fixtures.filters)
  const token = service.receipt(listing, broker.id)
  const [first, repeated] = await Promise.all([
    api("/api/brokers/captacao", { receipt: token }, cookie),
    api("/api/brokers/captacao", { receipt: token }, cookie),
  ])
  assert.equal(first.r.status, 200)
  assert.equal(repeated.r.status, 200, JSON.stringify(repeated.data))
  assert.equal(repeated.data.capture.id, first.data.capture.id)
  const id = first.data.capture.id
  assert.equal(
    await prisma.captacaoActivity.count({
      where: { captacaoId: id, action: "SAVED" },
    }),
    1,
  )
  ok("save concurrency/idempotency and real persistence")
  assert.equal(
    await prisma.property.count({ where: { brokerId: broker.id } }),
    beforeProperties,
  )
  assert.equal(
    await prisma.lead.count({ where: { brokerId: broker.id } }),
    beforeLeads,
  )
  ok("saving creates neither client nor property")
  a = await api("/api/brokers/captacao/" + id, undefined, bCookie)
  assert.equal(a.r.status, 404)
  a = await api("/api/brokers/captacao", { receipt: token }, bCookie)
  assert.equal(a.r.status, 403)
  a = await api(
    "/api/brokers/captacao/" + id,
    { action: "note", note: "other", operationKey: randomUUID() },
    bCookie,
    "PATCH",
  )
  assert.equal(a.r.status, 404)
  ok("cross-broker receipt/read/write isolation")
  a = await api("/api/brokers/captacao", { receipt: token + "invalid" }, cookie)
  assert.equal(a.r.status, 400)
  ok("tampered receipt rejected")
  async function mutate(body) {
    return api(
      "/api/brokers/captacao/" + id,
      { operationKey: randomUUID(), ...body },
      cookie,
      "PATCH",
    )
  }
  a = await mutate({ action: "stage", stage: "CONTACTED" })
  assert.equal(a.r.status, 400)
  const op = randomUUID()
  a = await mutate({
    action: "contact",
    note: "FIXTURE · Contato efetivamente registrado no teste.",
    operationKey: op,
  })
  assert.equal(a.data.capture.stage, "CONTACTED")
  a = await mutate({
    action: "contact",
    note: "FIXTURE · Contato efetivamente registrado no teste.",
    operationKey: op,
  })
  assert.equal(
    a.data.capture.activities.filter((x) => x.action === "CONTACT").length,
    1,
  )
  ok("contact explicit, recorded once")
  a = await mutate({
    action: "privacy",
    doNotContact: true,
    note: "FIXTURE · Solicitou não receber contato.",
  })
  assert.equal(a.data.capture.doNotContact, true)
  a = await mutate({ action: "contact", note: "new attempt" })
  assert.equal(a.r.status, 409)
  a = await api("/api/brokers/captacao/details", { receipt: token }, cookie)
  assert.equal(a.data.capture.doNotContact, true)
  ok("do-not-contact persists and survives reopening search")
  await mutate({
    action: "privacy",
    doNotContact: false,
    note: "FIXTURE · Autorização explicitamente registrada.",
  })
  const dueAt = new Date(Date.now() + 86400000).toISOString()
  a = await mutate({
    action: "schedule",
    nextAction: "FIXTURE · Visita",
    dueAt,
    stage: "VISIT",
  })
  assert.equal(a.r.status, 200)
  const eventId = a.data.capture.agendaEventId
  a = await mutate({
    action: "schedule",
    nextAction: "FIXTURE · Visita remarcada",
    dueAt: new Date(Date.now() + 172800000).toISOString(),
    stage: "VISIT",
  })
  assert.equal(a.data.capture.agendaEventId, eventId)
  assert.equal(await prisma.agendaEvent.count({ where: { id: eventId } }), 1)
  const agenda = await api("/api/brokers/agenda?filter=all", undefined, cookie)
  assert.ok(agenda.data.events.some((e) => e.id === eventId))
  ok("next action uses existing Agenda, no duplicate on reschedule")
  a = await mutate({
    action: "stage",
    stage: "CONFIRMED",
    note: "FIXTURE · Captação confirmada com autorização para intermediação.",
  })
  assert.equal(a.data.capture.stage, "CONFIRMED")
  a = await api(
    "/api/brokers/leads",
    {
      name: "FIXTURE · Contato revisado",
      phone: "119" + String(Date.now()).slice(-8),
    },
    cookie,
  )
  assert.equal(a.r.status, 201)
  const leadId = a.data.lead.id
  const otherLead = await prisma.lead.create({
    data: {
      brokerId: other.id,
      name: "FIXTURE outro",
      source: "CAPTACAO_TEST",
    },
  })
  a = await mutate({ action: "lead", leadId: otherLead.id })
  assert.equal(a.r.status, 400)
  a = await mutate({ action: "lead", leadId })
  assert.equal(a.r.status, 200)
  ok("conscious client creation, association ownership checked")
  const property = {
    title: "FIXTURE · Imóvel revisado",
    description: "Texto próprio escrito para o teste.",
    price: 500000,
    city: "São Paulo",
    neighborhood: "Centro",
    type: "Apartamento",
    purpose: "Venda",
    status: "Rascunho",
    images: [],
    captureId: id,
    captureReviewed: true,
    duplicatesReviewed: true,
  }
  a = await api(
    "/api/properties",
    { ...property, captureReviewed: false },
    cookie,
  )
  assert.equal(a.r.status, 400)
  a = await api("/api/properties", { ...property, status: "Publicado" }, cookie)
  assert.ok(a.r.status >= 400)
  ok("unreviewed and publishing capture blocked")
  a = await api("/api/properties", property, cookie)
  assert.equal(a.r.status, 201, JSON.stringify(a.data))
  const propertyId = a.data.property.id
  const p = await prisma.property.findUnique({ where: { id: propertyId } })
  assert.equal(p.status, "DRAFT")
  assert.equal(p.published, false)
  assert.equal(p.marketplacePublished, false)
  assert.deepEqual(p.imageUrls, [])
  assert.equal(p.description, property.description)
  assert.ok(p.legalData.legalNotes.includes(listing.url))
  const again = await api("/api/properties", property, cookie)
  assert.equal(again.data.property.id, propertyId)
  assert.equal(
    await prisma.property.count({ where: { brokerId: broker.id } }),
    beforeProperties + 1,
  )
  ok(
    "reviewed inventory persists draft, provenance, no third party media, idempotent",
  )
  // Real service and DB limits, with only provider transport replaced by identified fixtures.
  process.env.GECKO_API_KEY = "fixture-only-in-test-process"
  let calls = 0
  const uniqueFilters = {
    ...fixtures.filters,
    priceMax: 600000 + Math.floor(Math.random() * 500),
  }
  const [q1, q2] = await Promise.allSettled([
    service.runQuery(
      broker.id,
      "olx",
      uniqueFilters,
      1,
      undefined,
      async () => {
        calls++
        await new Promise((r) => setTimeout(r, 100))
        return fixtures.response("olx")
      },
    ),
    service.runQuery(
      broker.id,
      "olx",
      uniqueFilters,
      1,
      undefined,
      async () => {
        calls++
        return fixtures.response("olx")
      },
    ),
  ])
  assert.equal(calls, 1)
  assert.ok([q1, q2].some((r) => r.status === "fulfilled"))
  const cached = await service.runQuery(
    broker.id,
    "olx",
    uniqueFilters,
    1,
    undefined,
    async () => {
      throw Error("must not call")
    },
  )
  assert.equal(cached.cached, true)
  ok(
    "shared database guard prevents concurrent paid duplication and reuses recent response",
  )
  const fingerprint = "limit-fixture-" + randomUUID()
  await prisma.captacaoQuery.createMany({
    data: Array.from({ length: 20 }, () => ({
      brokerId: other.id,
      source: "olx",
      fingerprint,
      completedAt: new Date(),
      errorCode: "FIXTURE",
    })),
  })
  await assert.rejects(
    () =>
      service.runQuery(
        other.id,
        "vivareal",
        uniqueFilters,
        1,
        undefined,
        async () => {
          throw Error("must not call")
        },
      ),
    { code: "USAGE_LIMIT" },
  )
  ok("per-broker query safety limit enforced before provider")
  a = await api("/api/brokers/captacao", undefined, cookie)
  assert.equal(a.data.metrics.contacts, beforeContacts + 1)
  assert.equal(a.data.metrics.confirmed, beforeConfirmed + 1)
  ok("metrics reflect saved actions rather than search volume")
  const sample = Object.fromEntries(
    contract.sources.map((source) => {
      const r = gecko.normalizeResponse(
        source,
        fixtures.response(source),
        new Date().toISOString(),
        fixtures.filters,
      )
      return [
        source,
        {
          ...r,
          source,
          status: "ok",
          items: r.items.map((l) => ({
            ...l,
            receipt: service.receipt(l, broker.id),
          })),
        },
      ]
    }),
  )
  fs.writeFileSync(
    path.join(
      path.dirname(process.env.EME_CAPTACAO_LOCAL_ACCESS),
      "browser-fixtures.json",
    ),
    JSON.stringify(
      { sources: sample, captureId: id, propertyId, checks, report },
      null,
      2,
    ),
  )
  console.log(
    "PASS " + checks + " real local checks. Credentials never printed.",
  )
  await prisma.$disconnect()
})().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exitCode = 1
})
