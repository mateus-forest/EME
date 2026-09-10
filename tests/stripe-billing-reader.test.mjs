import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import { readStripeBillingEvidence } from "../lib/stripe-billing-reader.ts"
import { resolveAccountBilling } from "../lib/billing-resolution.ts"
import * as resolutionModule from "../lib/billing-resolution.ts"
import * as readerModule from "../lib/stripe-billing-reader.ts"

const start = 1788220800
const end = 1790812800
const iso = (value) => new Date(value * 1000).toISOString()
const config = { pricePlans: { price_pro: "pro", price_scale: "scale" }, addonPriceIds: ["price_capacity"], livemode: false }
const page = (data, has_more = false) => ({ data, has_more })
function fixture(status = "active", plan = "pro") {
  const localStatus = ["active", "trialing"].includes(status) ? "ACTIVE" : ["past_due", "unpaid", "incomplete"].includes(status) ? "PAST_DUE" : "CANCELED"
  const input = {
    user: { id: "u1", role: "BROKER", plan: plan === "pro" ? "BROKER" : "AGENCY", subscriptionStatus: localStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
    planAccount: { planKey: status === "canceled" ? "free" : plan, currentStripeSubscriptionId: "sub_1" },
    subscription: { status: localStatus, createdAt: iso(start), nextBillingAt: iso(end), cancelAtPeriodEnd: false, cancelAt: null },
    brokerId: "b1", now: new Date("2026-09-10T00:00:00Z"),
  }
  const customer = { id: "cus_1", livemode: false, metadata: { userId: "u1", private_note: "DO_NOT_EXPOSE" } }
  const subscription = { id: "sub_1", customer: "cus_1", status, livemode: false,
    metadata: { userId: "u1", plan: plan.toUpperCase(), priceId: `price_${plan}` },
    start_date: start, trial_start: status === "trialing" ? start : null, trial_end: status === "trialing" ? end : null,
    cancel_at_period_end: false, cancel_at: null, canceled_at: status === "canceled" ? start : null, pause_collection: null }
  const item = { id: "si_1", subscription: "sub_1", quantity: 1, price: { id: `price_${plan}` }, current_period_start: start, current_period_end: end, metadata: {} }
  const price = { id: `price_${plan}`, livemode: false, recurring: { interval: "month", interval_count: 1 }, currency: "brl", unit_amount: plan === "pro" ? 12900 : 38900, active: true, metadata: {} }
  const calls = []
  const client = {
    customer: async (id) => { calls.push(["customer", id]); return customer },
    subscription: async (id) => { calls.push(["subscription", id]); return subscription },
    subscriptions: async (id, cursor) => { calls.push(["subscriptions", id, cursor]); return page([subscription]) },
    items: async (id, cursor) => { calls.push(["items", id, cursor]); return page([item]) },
    price: async (id) => { calls.push(["price", id]); return price },
  }
  return { input, customer, subscription, item, price, client, calls }
}
async function check(f) {
  const evidence = await readStripeBillingEvidence(f.input, f.client, config)
  const resolution = resolveAccountBilling({ ...f.input, stripe: evidence.snapshot ?? undefined, pricePlans: config.pricePlans,
    stripeCheck: { status: evidence.status, checkedAt: evidence.checkedAt, issues: evidence.issues } })
  return { evidence, resolution }
}
const has = (result, code) => result.resolution.conflicts.some((item) => item.code === code)

test("Free sem Stripe não faz nenhuma chamada e não alega verificação remota", async () => {
  const f = fixture()
  f.input.user = { ...f.input.user, plan: "NONE", subscriptionStatus: "INACTIVE", stripeCustomerId: null, stripeSubscriptionId: null }
  f.input.planAccount = null
  f.input.subscription = null
  const { evidence, resolution } = await check(f)
  assert.equal(resolution.presentationStatus, "Free")
  assert.equal(evidence.status, "not_needed")
  assert.equal(resolution.stripeObservedAt, null)
  assert.equal(resolution.lastReconciledAt, null)
  assert.deepEqual(f.calls, [])
})

for (const plan of ["pro", "scale"]) {
  test(`${plan} ativo: Customer, Subscription, itens, Prices, metadata e datas reais do snapshot`, async () => {
    const f = fixture("active", plan)
    const before = globalThis.structuredClone(f.input)
    const { evidence, resolution } = await check(f)
    assert.equal(evidence.status, "verified")
    assert.equal(resolution.contractedPlan, plan)
    assert.equal(resolution.originalStatus, "active")
    assert.equal(resolution.presentationStatus, "Ativa")
    assert.equal(resolution.financialStatus, "unknown")
    assert.deepEqual(resolution.currentPeriod, { startedAt: iso(start), endsAt: iso(end) })
    assert.equal(resolution.lastReconciledAt, null)
    assert.ok(resolution.lastCheckedAt)
    assert.ok(resolution.stripeObservedAt)
    assert.deepEqual(f.calls.map((call) => call[0]), ["subscription", "customer", "subscriptions", "items", "price"])
    assert.deepEqual(evidence.customer.metadata, { userId: "u1" })
    assert.deepEqual(f.input, before)
  })
}

for (const [status, presentation, finance] of [["trialing", "Trial", "trial"], ["past_due", "Inadimplente", "delinquent"], ["incomplete", "Pendente de conciliação", "payment_pending"], ["canceled", "Cancelada", "unknown"]]) {
  test(`preserva ${status} separadamente do espelho local`, async () => {
    const { evidence, resolution } = await check(fixture(status))
    assert.equal(evidence.status, "verified")
    assert.equal(resolution.originalStatus, status)
    assert.equal(resolution.presentationStatus, presentation)
    assert.equal(resolution.financialStatus, finance)
    if (status === "trialing") assert.equal(resolution.trial.endsAt, iso(end))
    if (status === "canceled") assert.equal(resolution.cancellation.canceledAt, iso(start))
  })
}

test("cancel_at_period_end mantém plano e data final sem anunciar renovação", async () => {
  const f = fixture()
  f.subscription.cancel_at_period_end = true
  f.input.subscription.cancelAtPeriodEnd = true
  const { resolution } = await check(f)
  assert.equal(resolution.presentationStatus, "Cancelando")
  assert.equal(resolution.effectivePlan, "pro")
  assert.equal(resolution.cancellation.scheduledAt, iso(end))
  assert.equal(resolution.renewalAt, null)
})

test("Price desconhecido nunca vira Free nem usa metadata como fallback", async () => {
  const f = fixture()
  f.price.id = f.item.price.id = "price_unknown"
  const result = await check(f)
  assert.ok(has(result, "UNKNOWN_STRIPE_PRICE"))
  assert.equal(result.resolution.contractedPlan, null)
  assert.equal(result.resolution.presentationStatus, "Pendente de conciliação")
  assert.equal(result.resolution.effectivePlan, "pro")
})

for (const [method, code] of [["customer", "STRIPE_CUSTOMER_NOT_FOUND"], ["subscription", "STRIPE_SUBSCRIPTION_NOT_FOUND"]]) {
  test(`${method} ausente: pendência explícita sem corrigir vínculo`, async () => {
    const f = fixture()
    f.client[method] = async () => { throw Object.assign(new Error("Missing"), { code: "resource_missing" }) }
    const result = await check(f)
    assert.ok(has(result, code))
    assert.equal(result.resolution.presentationStatus, "Pendente de conciliação")
    assert.equal(result.resolution.contractedPlan, "pro")
    assert.equal(result.evidence.snapshot, null)
  })
}

test("Customer excluído não valida a assinatura", async () => {
  const f = fixture()
  f.client.customer = async () => ({ id: "cus_1", deleted: true })
  const result = await check(f)
  assert.ok(has(result, "STRIPE_CUSTOMER_DELETED"))
  assert.equal(result.evidence.snapshot, null)
})

test("Customer sem vínculo local é observado via Subscription, sem recuperação automática", async () => {
  const f = fixture()
  f.input.user.stripeCustomerId = null
  const result = await check(f)
  assert.equal(result.evidence.customer.id, "cus_1")
  assert.ok(has(result, "STRIPE_CUSTOMER_UNLINKED"))
  assert.equal(result.evidence.snapshot, null)
  assert.equal(f.input.user.stripeCustomerId, null)
})

test("Subscription descoberta no Customer não é vinculada automaticamente", async () => {
  const f = fixture()
  f.input.user.stripeSubscriptionId = null
  f.input.planAccount.currentStripeSubscriptionId = null
  const result = await check(f)
  assert.ok(has(result, "STRIPE_SUBSCRIPTION_UNLINKED"))
  assert.equal(result.resolution.presentationStatus, "Pendente de conciliação")
  assert.equal(f.input.user.stripeSubscriptionId, null)
})

test("divergência de plano e status conserva acesso local e evidencia Stripe", async () => {
  const f = fixture("past_due", "scale")
  f.input.planAccount.planKey = "pro"
  f.input.user.plan = "BROKER"
  f.input.subscription.status = "ACTIVE"
  f.input.user.subscriptionStatus = "ACTIVE"
  const result = await check(f)
  assert.equal(result.resolution.contractedPlan, "scale")
  assert.equal(result.resolution.effectivePlan, "pro")
  assert.ok(has(result, "ACCOUNT_PLAN_MISMATCH"))
  assert.ok(has(result, "STRIPE_STATUS_MISMATCH"))
})

test("datas divergentes são diagnosticadas sem regravar nextBillingAt", async () => {
  const f = fixture()
  f.input.subscription.nextBillingAt = iso(start)
  const result = await check(f)
  assert.ok(has(result, "RENEWAL_DATE_MISMATCH"))
  assert.equal(f.input.subscription.nextBillingAt, iso(start))
})

test("assinatura encerrada vinculada não esconde outra assinatura ativa", async () => {
  const f = fixture("canceled")
  f.client.subscriptions = async () => page([f.subscription, { ...f.subscription, id: "sub_new", status: "active" }])
  const result = await check(f)
  assert.ok(has(result, "STRIPE_OTHER_CURRENT_SUBSCRIPTION"))
  assert.equal(result.evidence.snapshot, null)
  assert.equal(result.resolution.presentationStatus, "Pendente de conciliação")
})

test("múltiplas assinaturas ativas exigem seleção manual", async () => {
  const f = fixture()
  f.client.subscriptions = async () => page([f.subscription, { ...f.subscription, id: "sub_other" }])
  const result = await check(f)
  assert.ok(has(result, "STRIPE_MULTIPLE_SUBSCRIPTIONS"))
  assert.equal(result.evidence.snapshot, null)
})

test("paginação completa encontra conflito na segunda página", async () => {
  const f = fixture()
  const cursors = []
  f.client.subscriptions = async (_, cursor) => { cursors.push(cursor); return cursor ? page([{ ...f.subscription, id: "sub_other" }]) : page([f.subscription], true) }
  const result = await check(f)
  assert.deepEqual(cursors, [undefined, "sub_1"])
  assert.ok(has(result, "STRIPE_MULTIPLE_SUBSCRIPTIONS"))
})

test("resultado truncado não é declarado conciliado", async () => {
  const f = fixture()
  let count = 0
  f.client.subscriptions = async () => page([{ ...f.subscription, id: `sub_${count++}`, status: "canceled" }], true)
  const result = await check(f)
  assert.equal(count, 3)
  assert.ok(has(result, "STRIPE_RESULTS_TRUNCATED"))
  assert.equal(result.evidence.snapshot, null)
})

test("adicional não determina plano nem período do plano base", async () => {
  const f = fixture()
  const addon = { ...f.item, id: "si_extra", price: { id: "price_capacity" }, current_period_end: end + 1000 }
  f.client.items = async (_, cursor) => cursor ? page([f.item]) : page([addon], true)
  f.client.price = async (id) => ({ ...f.price, id })
  const result = await check(f)
  assert.equal(result.evidence.status, "verified")
  assert.equal(result.resolution.contractedPlan, "pro")
  assert.equal(result.resolution.currentPeriod.endsAt, iso(end))
  assert.equal(result.evidence.items[0].kind, "addon")
})

test("dois itens de plano base não são resolvidos escolhendo o primeiro", async () => {
  const f = fixture()
  f.client.items = async () => page([f.item, { ...f.item, id: "si_other", price: { id: "price_scale" } }])
  f.client.price = async (id) => ({ ...f.price, id })
  const result = await check(f)
  assert.ok(has(result, "STRIPE_BASE_ITEM_UNRESOLVED"))
  assert.equal(result.resolution.contractedPlan, null)
})

for (const [name, mutate, code] of [
  ["metadata de outro usuário", (f) => { f.customer.metadata.userId = "u_other" }, "STRIPE_METADATA_MISMATCH"],
  ["Customer diferente", (f) => { f.subscription.customer = "cus_other" }, "STRIPE_CUSTOMER_MISMATCH"],
  ["ambiente diferente", (f) => { f.price.livemode = true }, "STRIPE_MODE_MISMATCH"],
]) {
  test(`${name} invalida evidência para resolução`, async () => {
    const f = fixture()
    mutate(f)
    const result = await check(f)
    assert.ok(has(result, code))
    assert.equal(result.evidence.snapshot, null)
  })
}

test("indisponibilidade não converte plano pago em Free", async () => {
  const f = fixture()
  f.client.price = async () => { throw new Error("Timeout with private provider detail") }
  const result = await check(f)
  assert.equal(result.evidence.status, "unavailable")
  assert.equal(result.resolution.presentationStatus, "Pendente de conciliação")
  assert.equal(result.resolution.contractedPlan, "pro")
  assert.equal(result.evidence.snapshot, null)
  assert.ok(!JSON.stringify(result).includes("private provider detail"))
})

test("Stripe não configurado mantém pendência", async () => {
  const f = fixture()
  f.client = null
  const result = await check(f)
  assert.ok(has(result, "STRIPE_UNAVAILABLE"))
  assert.equal(result.resolution.presentationStatus, "Pendente de conciliação")
})

async function loadModule(path, dependencies) {
  const source = await readFile(new globalThis.URL(path, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const exports = {}
  new Function("require", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}

test("adaptador SDK só expõe retrieve/list, status all, timeout e sem retries", async () => {
  const calls = []
  const retrieve = async (...args) => { calls.push(args); return {} }
  const { getStripeBillingReadDependencies } = await loadModule("../lib/stripe-billing-read-client.ts", {
    "server-only": {},
    "@/lib/env.server": { getStripeEnv: () => ({ proPriceId: "price_pro", scalePriceId: "price_scale", property50PriceId: "price_capacity", secretKey: "rk_test_fixture" }) },
    "@/lib/stripe-server": { getStripeClient: () => ({ customers: { retrieve }, subscriptions: { retrieve, list: retrieve }, subscriptionItems: { list: retrieve }, prices: { retrieve } }) },
  })
  const { client } = getStripeBillingReadDependencies()
  assert.deepEqual(Object.keys(client), ["customer", "subscription", "subscriptions", "items", "price"])
  await client.customer("cus_1")
  await client.subscription("sub_1")
  await client.subscriptions("cus_1", "sub_prev")
  await client.items("sub_1", "si_prev")
  await client.price("price_pro")
  assert.equal(calls[2][0].status, "all")
  assert.equal(calls[2][0].starting_after, "sub_prev")
  assert.ok(calls.every((call) => call.at(-1).timeout === 5000 && call.at(-1).maxNetworkRetries === 0))
})

test("endpoint é exclusivo do Admin e não armazena cache", async () => {
  let role = "BROKER"
  let reads = 0
  const { GET } = await loadModule("../app/api/admin/users/[id]/billing/route.ts", {
    "next/server": { NextResponse: globalThis.Response },
    "@/lib/auth-route": {
      getAuthenticatedUser: async () => ({ user: { role } }),
      ensureRole: (current) => current === "ADMIN" ? null : globalThis.Response.json({}, { status: 403 }),
    },
    "@/lib/admin-stripe-billing": { getAdminStripeBillingReport: async () => { reads++; return { userId: "u1" } } },
  })
  const context = { params: Promise.resolve({ id: "u1" }) }
  assert.equal((await GET(null, context)).status, 403)
  assert.equal(reads, 0)
  role = "ADMIN"
  const response = await GET(null, context)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.equal(reads, 1)
})

test("serviço consulta registros reais via find, detecta vínculo compartilhado e não escreve", async () => {
  const f = fixture()
  let duplicate = false
  const user = { ...f.input.user, broker: { id: "b1", planAccount: f.input.planAccount }, ownedAgency: null }
  const contract = await loadModule("../lib/admin-stripe-billing-contract.ts", {})
  const { getAdminStripeBillingReport } = await loadModule("../lib/admin-stripe-billing.ts", {
    "server-only": {}, "@/lib/admin-billing": { adminBillingPlanSelect: { planKey: true, currentStripeSubscriptionId: true } },
    "@/lib/billing-resolution": resolutionModule, "@/lib/stripe-billing-reader": readerModule,
    "@/lib/stripe-billing-read-client": { getStripeBillingReadDependencies: () => ({ client: f.client, config }) },
    "@/lib/admin-stripe-billing-contract": contract,
    "@/lib/prisma": { prisma: { user: { findUnique: async () => user, findFirst: async () => duplicate ? { id: "u_other" } : null }, subscription: { findUnique: async () => f.input.subscription } } },
  })
  assert.equal((await getAdminStripeBillingReport("u1")).resolution.contractedPlan, "pro")
  duplicate = true
  const report = await getAdminStripeBillingReport("u1")
  assert.ok(report.resolution.conflicts.some((item) => item.code === "STRIPE_SHARED_LOCAL_LINK"))
  assert.equal(report.evidence.snapshot, null)
  assert.equal(report.resolution.presentationStatus, "Pendente de conciliação")
})
