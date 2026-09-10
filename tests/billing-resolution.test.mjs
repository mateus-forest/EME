import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import ts from "typescript"
import { billingPlanLabel, resolveAccountBilling } from "../lib/billing-resolution.ts"
import * as resolutionModule from "../lib/billing-resolution.ts"
import * as enums from "../lib/prisma-enums.ts"
import * as plans from "../lib/eme-plans.ts"

const now = new Date("2026-09-10T12:00:00Z")
const start = "2026-09-01T12:00:00.000Z"
const end = "2026-10-01T12:00:00.000Z"
const user = { id: "user_1", role: "BROKER", plan: "NONE", subscriptionStatus: "INACTIVE", stripeCustomerId: null, stripeSubscriptionId: null }
const subscription = { status: "ACTIVE", createdAt: start, nextBillingAt: end, cancelAtPeriodEnd: false, cancelAt: null }
const free = () => ({ user: { ...user }, planAccount: null, subscription: null, now })
const paid = (plan = "pro") => ({
  user: { ...user, plan: plan === "pro" ? "BROKER" : "AGENCY", subscriptionStatus: "ACTIVE", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
  planAccount: { planKey: plan, currentStripeSubscriptionId: "sub_1" },
  subscription: { ...subscription }, now,
})
const withStripe = (status = "active", plan = "pro") => {
  const input = paid(plan)
  input.subscription.status = ["active", "trialing"].includes(status) ? "ACTIVE" : ["past_due", "unpaid", "incomplete"].includes(status) ? "PAST_DUE" : "CANCELED"
  input.user.subscriptionStatus = input.subscription.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
  if (status === "canceled") input.planAccount.planKey = "free"
  return { ...input, pricePlans: { price_pro: "pro", price_scale: "scale" }, stripe: {
    id: "sub_1", customerId: "cus_1", status, priceId: `price_${plan}`,
    startedAt: start, trialStart: null, trialEnd: null, currentPeriodEnd: end,
    cancelAtPeriodEnd: false, cancelAt: null, canceledAt: null,
    observedAt: now, reconciledAt: null,
  } }
}
const codes = (result) => result.conflicts.map((conflict) => conflict.code)

test("Free confirmado não depende do papel da conta", () => {
  for (const role of ["BROKER", "AGENCY", "ADMIN"]) {
    const result = resolveAccountBilling({ ...free(), user: { ...user, role } })
    assert.equal(result.contractedPlan, "free")
    assert.equal(result.effectivePlan, "free")
    assert.equal(result.presentationStatus, "Free")
    assert.equal(result.financialStatus, "not_applicable")
    assert.deepEqual(result.conflicts, [])
  }
})

for (const plan of ["pro", "scale"]) {
  test(`${plan}: enum legado nunca vira falso Free`, () => {
    const result = resolveAccountBilling(paid(plan))
    assert.equal(result.contractedPlan, plan)
    assert.equal(result.effectivePlan, plan)
    assert.equal(result.presentationStatus, "Ativa")
    assert.equal(result.source, "broker_plan_account")
    assert.equal(result.financialStatus, "unknown")
    assert.equal(result.stripeStatus, null)
    assert.equal(result.originalStatus, "ACTIVE")
    assert.equal(result.originalStatusSource, "subscription")
    assert.equal(result.lastReconciledAt, null)
    assert.equal(result.startedAt, null)
  })
  test(`${plan}: fallback legado controlado sem inferir pelo papel`, () => {
    const result = resolveAccountBilling({ ...paid(plan), planAccount: null })
    assert.equal(result.contractedPlan, plan)
    assert.equal(result.source, "legacy")
    assert.ok(result.limitations.length)
    assert.deepEqual(result.conflicts, [])
  })
}

test("trial local é distinto do trial Stripe e não inventa renovação paga", () => {
  const result = resolveAccountBilling({ ...free(), subscription: { ...subscription, status: "TRIALING" } })
  assert.equal(result.presentationStatus, "Trial")
  assert.equal(result.trial.kind, "local")
  assert.equal(result.trial.startedAt, start)
  assert.equal(result.trial.endsAt, end)
  assert.equal(result.renewalAt, null)
  assert.equal(result.contractedPlan, "free")
  assert.equal(result.stripeStatus, null)
})

test("trial expirado exige conciliação, sem revogar acesso", () => {
  const result = resolveAccountBilling({ ...free(), subscription: { ...subscription, status: "TRIALING", nextBillingAt: start } })
  assert.equal(result.trial.expired, true)
  assert.equal(result.presentationStatus, "Pendente de conciliação")
  assert.ok(codes(result).includes("EXPIRED_TRIAL"))
})

test("trial Stripe preserva status e datas mesmo com espelho local ACTIVE", () => {
  const input = withStripe("trialing")
  input.stripe.trialStart = start
  input.stripe.trialEnd = end
  const result = resolveAccountBilling(input)
  assert.equal(result.presentationStatus, "Trial")
  assert.equal(result.trial.kind, "stripe")
  assert.equal(result.trial.endsAt, end)
  assert.equal(result.originalStatus, "trialing")
  assert.equal(result.financialStatus, "trial")
  assert.equal(result.contractedPlan, "pro")
})

test("active não é comprovante de pagamento nem data de conciliação", () => {
  const result = resolveAccountBilling(withStripe())
  assert.equal(result.presentationStatus, "Ativa")
  assert.equal(result.originalStatus, "active")
  assert.equal(result.originalStatusSource, "stripe")
  assert.equal(result.financialStatus, "unknown")
  assert.equal(result.source, "stripe_price")
  assert.equal(result.renewalAt, end)
  assert.equal(result.stripeObservedAt, now.toISOString())
  assert.equal(result.lastReconciledAt, null)
})

test("cancel_at_period_end preserva plano e suprime renovação antiga", () => {
  const input = withStripe()
  input.stripe.cancelAtPeriodEnd = true
  input.subscription.cancelAtPeriodEnd = true
  const result = resolveAccountBilling(input)
  assert.equal(result.presentationStatus, "Cancelando")
  assert.equal(result.effectivePlan, "pro")
  assert.equal(result.cancellation.scheduledAt, end)
  assert.equal(result.renewalAt, null)
})

test("cancelamento local programado também não anuncia nova cobrança", () => {
  const input = paid()
  input.subscription.cancelAtPeriodEnd = true
  input.subscription.cancelAt = end
  const result = resolveAccountBilling(input)
  assert.equal(result.presentationStatus, "Cancelando")
  assert.equal(result.cancellation.scheduledAt, end)
  assert.equal(result.renewalAt, null)
})

for (const status of ["past_due", "unpaid"]) {
  test(`${status}: inadimplência não modifica o acesso persistido`, () => {
    const result = resolveAccountBilling(withStripe(status))
    assert.equal(result.presentationStatus, "Inadimplente")
    assert.equal(result.effectivePlan, "pro")
    assert.equal(result.financialStatus, "delinquent")
    assert.equal(result.originalStatus, status)
  })
}

test("incomplete preserva pendência de pagamento sem chamá-la de atraso", () => {
  const result = resolveAccountBilling(withStripe("incomplete"))
  assert.equal(result.originalStatus, "incomplete")
  assert.equal(result.presentationStatus, "Pendente de conciliação")
  assert.equal(result.financialStatus, "payment_pending")
  assert.equal(result.effectivePlan, "pro")
})

test("canceled preserva o plano contratado e separa o acesso Free", () => {
  const input = withStripe("canceled")
  input.stripe.canceledAt = start
  const result = resolveAccountBilling(input)
  assert.equal(result.presentationStatus, "Cancelada")
  assert.equal(result.contractedPlan, "pro")
  assert.equal(result.effectivePlan, "free")
  assert.equal(result.renewalAt, null)
  assert.equal(result.cancellation.canceledAt, start)
})

test("canceled local não inventa data de término ou apaga plano anterior", () => {
  const input = paid("scale")
  input.subscription.status = "CANCELED"
  input.user.subscriptionStatus = "INACTIVE"
  input.planAccount.planKey = "free"
  const result = resolveAccountBilling(input)
  assert.equal(result.presentationStatus, "Cancelada")
  assert.equal(result.contractedPlan, "scale")
  assert.equal(result.cancellation.canceledAt, null)
})

test("Price desconhecido não recebe fallback Free nem Pro", () => {
  const input = withStripe()
  input.stripe.priceId = "price_unknown"
  const result = resolveAccountBilling(input)
  assert.equal(result.contractedPlan, null)
  assert.equal(result.effectivePlan, "pro")
  assert.equal(result.presentationStatus, "Pendente de conciliação")
  assert.ok(codes(result).includes("UNKNOWN_STRIPE_PRICE"))
  assert.equal(billingPlanLabel(result.contractedPlan), "Pendente de conciliação")
})

test("Price não fornecido não é tratado como Price desconhecido na leitura local", () => {
  const result = resolveAccountBilling(paid())
  assert.ok(!codes(result).includes("UNKNOWN_STRIPE_PRICE"))
  assert.ok(result.limitations.some((item) => item.includes("não foram consultados")))
})

for (const field of ["stripeCustomerId", "stripeSubscriptionId"]) {
  test(`vínculo ausente: ${field}`, () => {
    const input = paid()
    input.user[field] = null
    if (field === "stripeSubscriptionId") input.planAccount.currentStripeSubscriptionId = null
    const result = resolveAccountBilling(input)
    assert.equal(result.contractedPlan, "pro")
    assert.equal(result.presentationStatus, "Pendente de conciliação")
    assert.ok(codes(result).includes("MISSING_STRIPE_LINK"))
  })
}

test("Customer isolado não comprova assinatura nem Free", () => {
  const input = free()
  input.user.stripeCustomerId = "cus_1"
  const result = resolveAccountBilling(input)
  assert.equal(result.contractedPlan, null)
  assert.equal(result.presentationStatus, "Pendente de conciliação")
})

for (const [description, change, code] of [
  ["User diferente do plano comercial", (input) => { input.user.plan = "AGENCY" }, "LEGACY_PLAN_MISMATCH"],
  ["User NONE com plano pago", (input) => { input.user.plan = "NONE" }, "LEGACY_PLAN_MISMATCH"],
  ["BrokerPlanAccount Free com legado pago", (input) => { input.planAccount.planKey = "free" }, "ACCOUNT_PLAN_MISMATCH"],
  ["User inativo e Subscription ativa", (input) => { input.user.subscriptionStatus = "INACTIVE" }, "USER_SUBSCRIPTION_STATUS_MISMATCH"],
  ["Subscription ausente", (input) => { input.subscription = null }, "MISSING_LOCAL_SUBSCRIPTION"],
  ["IDs Stripe divergentes", (input) => { input.planAccount.currentStripeSubscriptionId = "sub_other" }, "LOCAL_STRIPE_LINK_MISMATCH"],
  ["plano comercial desconhecido", (input) => { input.planAccount.planKey = "enterprise" }, "UNKNOWN_ACCOUNT_PLAN"],
  ["cancelada com acesso pago", (input) => { input.subscription.status = "CANCELED"; input.user.subscriptionStatus = "INACTIVE" }, "CANCELED_WITH_PAID_ACCESS"],
]) {
  test(`conflito explícito: ${description}`, () => {
    const input = paid()
    change(input)
    const result = resolveAccountBilling(input)
    assert.equal(result.presentationStatus, "Pendente de conciliação")
    assert.ok(codes(result).includes(code), codes(result).join(", "))
    assert.notEqual(result.contractedPlan, "free")
  })
}

test("Price prevalece como contratado, sem reescrever acesso divergente", () => {
  const input = withStripe()
  input.stripe.priceId = "price_scale"
  const result = resolveAccountBilling(input)
  assert.equal(result.contractedPlan, "scale")
  assert.equal(result.effectivePlan, "pro")
  assert.ok(codes(result).includes("ACCOUNT_PLAN_MISMATCH"))
})

test("evidência Stripe de outro cliente é conflito explícito", () => {
  const input = withStripe()
  input.stripe.customerId = "cus_other"
  const result = resolveAccountBilling(input)
  assert.ok(codes(result).includes("STRIPE_LINK_MISMATCH"))
  assert.equal(result.contractedPlan, null)
  assert.equal(result.effectivePlan, "pro")
})

test("divergências de lifecycle e cancelamento são preservadas", () => {
  const input = withStripe("past_due")
  input.subscription.status = "ACTIVE"
  input.subscription.cancelAtPeriodEnd = true
  const result = resolveAccountBilling(input)
  assert.ok(codes(result).includes("STRIPE_STATUS_MISMATCH"))
  assert.ok(codes(result).includes("CANCELLATION_MISMATCH"))
  assert.equal(result.lifecycleStatus, "Inadimplente")
})

test("status desconhecido permanece visível e exige conciliação", () => {
  const result = resolveAccountBilling(withStripe("paused"))
  assert.equal(result.originalStatus, "paused")
  assert.equal(result.presentationStatus, "Pendente de conciliação")
  assert.ok(codes(result).includes("UNSUPPORTED_SUBSCRIPTION_STATUS"))
})

test("resolvedor não modifica suas entradas, inclusive em conflito", () => {
  const input = paid()
  input.user.plan = "AGENCY"
  const before = globalThis.structuredClone(input)
  Object.freeze(input.user)
  Object.freeze(input.planAccount)
  Object.freeze(input.subscription)
  Object.freeze(input)
  resolveAccountBilling(input)
  assert.deepEqual(input, before)
})

// Execute real adapters/serializers with explicitly injected dependencies; no DB/env/Stripe access.
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

test("lista em lote inclui BROKER/AGENCY e serializa o plano resolvido sem escrita", async () => {
  const inputs = [paid(), paid("scale"), free()]
  const users = inputs.map((input, index) => ({
    ...input.user, id: `user_${index}`, role: index === 1 ? "AGENCY" : "BROKER",
    name: "Teste", email: "test@example.invalid", phone: null, createdAt: now,
    broker: index === 1 ? null : { id: `broker_${index}`, phone: null, status: "ACTIVE", planAccount: input.planAccount },
    ownedAgency: index === 1 ? { id: "agency_1", phone: null } : null,
  }))
  let reads = 0
  const { loadAdminUserBillings } = await loadModule("../lib/admin-billing.ts", {
    "server-only": {}, "@/lib/billing-resolution": resolutionModule,
    "@/lib/prisma": { prisma: { subscription: { findMany: async (query) => {
      reads++
      assert.deepEqual(query.where.OR, [
        { ownerType: "BROKER", ownerId: "broker_0" }, { ownerType: "AGENCY", ownerId: "agency_1" }, { ownerType: "BROKER", ownerId: "broker_2" },
      ])
      return [
        { ...subscription, ownerType: "BROKER", ownerId: "broker_0" },
        { ...subscription, ownerType: "AGENCY", ownerId: "agency_1" },
      ]
    } } } },
  })
  const { serializeAdminUser } = await loadModule("../lib/admin-contract.ts", {
    "@/lib/billing-resolution": resolutionModule, "@/lib/prisma-enums": enums, "@/lib/eme-plans": plans,
  })
  const billings = await loadAdminUserBillings(users)
  const records = users.map((item) => serializeAdminUser(item, billings.get(item.id)))
  assert.equal(reads, 1)
  assert.deepEqual(records.map((item) => item.plan), ["Pro", "Scale", "Free"])
  assert.equal(records[1].type, "Operação")
  assert.equal(records[1].billing.source, "legacy")
  assert.equal(records[0].status, "Ativo")
  assert.ok(records.every((item) => item.billing))
})

test("falha na leitura não é convertida em Free", async () => {
  const { loadAdminUserBillings } = await loadModule("../lib/admin-billing.ts", {
    "server-only": {}, "@/lib/billing-resolution": resolutionModule,
    "@/lib/prisma": { prisma: { subscription: { findMany: async () => { throw new Error("DB unavailable") } } } },
  })
  const input = paid()
  await assert.rejects(loadAdminUserBillings([{ ...input.user, broker: { id: "b1", planAccount: input.planAccount }, ownedAgency: null }]), /DB unavailable/)
})

test("GET administrativo usa a resolução em lote e mantém autorização", async () => {
  const input = paid("scale")
  const row = { ...input.user, name: "Teste", email: "test@example.invalid", phone: null, createdAt: now,
    broker: { id: "broker_1", phone: null, status: "ACTIVE", planAccount: input.planAccount }, ownedAgency: null }
  let role = "BROKER"
  let reads = 0
  const prisma = {
    user: { findMany: async (query) => {
      reads++
      assert.equal(query.include.broker.include.planAccount.select.planKey, true)
      return [row]
    } },
    subscription: { findMany: async () => [{ ...subscription, ownerType: "BROKER", ownerId: "broker_1" }] },
  }
  const billing = await loadModule("../lib/admin-billing.ts", {
    "server-only": {}, "@/lib/billing-resolution": resolutionModule, "@/lib/prisma": { prisma },
  })
  const contract = await loadModule("../lib/admin-contract.ts", {
    "@/lib/billing-resolution": resolutionModule, "@/lib/prisma-enums": enums, "@/lib/eme-plans": plans,
  })
  const { GET } = await loadModule("../app/api/admin/users/route.ts", {
    "@/lib/admin-billing": billing, "@/lib/admin-contract": contract, "@/lib/prisma-enums": enums,
    "@/lib/prisma": { prisma }, "next/server": { NextResponse: globalThis.Response },
    "@/lib/auth-route": {
      getAuthenticatedUser: async () => ({ user: { role } }),
      ensureRole: (current, allowed) => allowed.includes(current) ? null : globalThis.Response.json({ error: "Forbidden" }, { status: 403 }),
      isPrismaUnavailable: () => false,
    },
  })
  assert.equal((await GET()).status, 403)
  assert.equal(reads, 0)
  role = "ADMIN"
  const response = await GET()
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.users[0].plan, "Scale")
  assert.equal(payload.users[0].billing.presentationStatus, "Ativa")
  assert.equal(payload.users[0].billing.lastReconciledAt, null)
  assert.equal(reads, 1)
})

test("detalhe de operação AGENCY usa a resolução e não o papel como plano", async () => {
  const input = free()
  const row = { ...input.user, role: "AGENCY", name: "Teste", email: "test@example.invalid", createdAt: now,
    trustedDevices: [], broker: null, ownedAgency: { id: "agency_1" } }
  const prisma = {
    user: { findUnique: async () => row },
    subscription: { findMany: async () => [] },
  }
  const billing = await loadModule("../lib/admin-billing.ts", {
    "server-only": {}, "@/lib/billing-resolution": resolutionModule, "@/lib/prisma": { prisma },
  })
  const { getAdminUserDetails } = await loadModule("../lib/admin-user-details.ts", {
    "server-only": {}, "@/lib/billing-resolution": resolutionModule, "@/lib/admin-billing": billing, "@/lib/prisma": { prisma },
  })
  const details = await getAdminUserDetails(row.id)
  assert.equal(details.account.plan, "Free")
  assert.equal(details.billing.subscriptionStatus, "Free")
  assert.equal(details.billing.resolution.identity.role, "AGENCY")
})
