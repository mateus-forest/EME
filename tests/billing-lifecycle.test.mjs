import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildBillingNotificationId,
  buildRecurringCapacityItemChanges,
  buildStripePeriodGrantKey,
  canPlanAccessMarketplace,
  isConfirmedStripePayment,
  publicationIncreasesActivePropertyCount,
  resolvePropertyCapacityQuantity,
  resolveStripeSubscriptionCancellationState,
  resolveStrictStripePlanKey,
  resolveSubscriptionChangeMode,
  shouldGrantStripePaidPeriod,
} from "../lib/billing-lifecycle-policy.ts"
import { EME_PLANS } from "../lib/eme-plans.ts"

test("Free, Pro e Scale mantêm os créditos mensais contratados", () => {
  assert.equal(EME_PLANS.free.monthlyAiCredits, 30)
  assert.equal(EME_PLANS.pro.monthlyAiCredits, 500)
  assert.equal(EME_PLANS.scale.monthlyAiCredits, 2000)
})

test("Free usa Checkout e Pro para Scale atualiza a assinatura existente", () => {
  assert.equal(resolveSubscriptionChangeMode("free", "pro"), "checkout")
  assert.equal(
    resolveSubscriptionChangeMode("pro", "scale"),
    "update_existing",
  )
  assert.equal(resolveSubscriptionChangeMode("scale", "scale"), "invalid")
})

test("Marketplace é bloqueado no Free e permitido em Pro e Scale", () => {
  assert.equal(canPlanAccessMarketplace("free"), false)
  assert.equal(canPlanAccessMarketplace("pro"), true)
  assert.equal(canPlanAccessMarketplace("scale"), true)
})

test("pacotes só podem ser fulfilled após pagamento confirmado", () => {
  assert.equal(isConfirmedStripePayment("paid"), true)
  assert.equal(isConfirmedStripePayment("unpaid"), false)
  assert.equal(isConfirmedStripePayment("no_payment_required"), false)
  assert.equal(isConfirmedStripePayment(null), false)
})

test("invoice paga concede o período e falha/past_due não concede", () => {
  assert.equal(
    shouldGrantStripePaidPeriod({
      eventType: "invoice.paid",
      subscriptionStatus: "active",
      planKey: "pro",
    }),
    true,
  )
  assert.equal(
    shouldGrantStripePaidPeriod({
      eventType: "invoice.payment_failed",
      subscriptionStatus: "past_due",
      planKey: "pro",
    }),
    false,
  )
  assert.equal(
    shouldGrantStripePaidPeriod({
      eventType: "invoice.paid",
      subscriptionStatus: "past_due",
      planKey: "pro",
    }),
    false,
  )
})

test("cancelamento agendado mantém o período pago e remove a próxima renovação", () => {
  const scheduled = resolveStripeSubscriptionCancellationState({
    status: "active",
    cancelAtPeriodEnd: true,
    cancelAtUnix: null,
    periodEndUnix: 1_788_134_400,
  })
  assert.deepEqual(scheduled, {
    cancelAtPeriodEnd: true,
    cancelAtUnix: 1_788_134_400,
    nextBillingAtUnix: null,
  })

  const reverted = resolveStripeSubscriptionCancellationState({
    status: "active",
    cancelAtPeriodEnd: false,
    cancelAtUnix: null,
    periodEndUnix: 1_788_134_400,
  })
  assert.deepEqual(reverted, {
    cancelAtPeriodEnd: false,
    cancelAtUnix: null,
    nextBillingAtUnix: 1_788_134_400,
  })
})

test("notificações de billing usam chave idempotente por evento", () => {
  assert.equal(
    buildBillingNotificationId("payment_approved", "in_123"),
    buildBillingNotificationId("payment_approved", "in_123"),
  )
  assert.notEqual(
    buildBillingNotificationId("payment_approved", "in_123"),
    buildBillingNotificationId("payment_failed", "in_123"),
  )
})

test("reenvio do mesmo período produz a mesma chave e upgrade uma chave distinta", () => {
  const input = {
    brokerId: "broker_1",
    subscriptionId: "sub_1",
    periodStart: new Date("2026-08-22T00:00:00.000Z"),
    planKey: "pro",
  }
  const first = buildStripePeriodGrantKey(input)
  const replay = buildStripePeriodGrantKey(input)
  const upgrade = buildStripePeriodGrantKey({ ...input, planKey: "scale" })

  assert.equal(first, replay)
  assert.notEqual(first, upgrade)
})

test("Price ID desconhecido nunca recebe fallback para Pro", () => {
  const prices = { pro: "price_pro", scale: "price_scale" }
  assert.equal(resolveStrictStripePlanKey("price_pro", prices), "pro")
  assert.equal(resolveStrictStripePlanKey("price_scale", prices), "scale")
  assert.equal(resolveStrictStripePlanKey("price_unknown", prices), null)
  assert.equal(resolveStrictStripePlanKey(null, prices), null)
})

test("Prices recorrentes de capacidade mapeiam estritamente um Ãºnico entitlement", () => {
  const prices = {
    capacity100: "price_capacity_100",
    capacity250: "price_capacity_250",
    capacity500: "price_capacity_500",
  }

  assert.equal(resolvePropertyCapacityQuantity("price_capacity_100", prices), 100)
  assert.equal(resolvePropertyCapacityQuantity("price_capacity_250", prices), 250)
  assert.equal(resolvePropertyCapacityQuantity("price_capacity_500", prices), 500)
  assert.equal(resolvePropertyCapacityQuantity("price_unknown", prices), null)
  assert.equal(resolvePropertyCapacityQuantity(null, prices), null)
})

test("troca de capacidade preserva um Ãºnico item e remove duplicatas", () => {
  assert.deepEqual(buildRecurringCapacityItemChanges([], "price_capacity_100"), [
    { price: "price_capacity_100", quantity: 1 },
  ])
  assert.deepEqual(
    buildRecurringCapacityItemChanges(
      [{ id: "si_capacity", priceId: "price_capacity_100" }],
      "price_capacity_250",
    ),
    [{ id: "si_capacity", price: "price_capacity_250", quantity: 1 }],
  )
  assert.deepEqual(
    buildRecurringCapacityItemChanges(
      [
        { id: "si_capacity", priceId: "price_capacity_250" },
        { id: "si_duplicate", priceId: "price_capacity_100" },
      ],
      "price_capacity_500",
    ),
    [
      { id: "si_capacity", price: "price_capacity_500", quantity: 1 },
      { id: "si_duplicate", deleted: true },
    ],
  )
})

test("remoÃ§Ã£o da capacidade exclui todos os itens recorrentes sem alterar o plano", () => {
  assert.deepEqual(
    buildRecurringCapacityItemChanges(
      [{ id: "si_capacity", priceId: "price_capacity_500" }],
      null,
    ),
    [{ id: "si_capacity", deleted: true }],
  )
})

test("limites finais usam base Pro ou Scale mais um Ãºnico add-on ativo", () => {
  assert.equal(EME_PLANS.pro.propertyLimit + 100, 250)
  assert.equal(EME_PLANS.pro.propertyLimit + 250, 400)
  assert.equal(EME_PLANS.pro.propertyLimit + 500, 650)
  assert.equal(EME_PLANS.scale.propertyLimit + 500, 1500)
  assert.equal(EME_PLANS.scale.propertyLimit + 250, 1250)
})

test("publicar DRAFT já contabilizado não consome outra vaga", () => {
  assert.equal(publicationIncreasesActivePropertyCount("DRAFT"), false)
  assert.equal(publicationIncreasesActivePropertyCount("PUBLISHED"), false)
  assert.equal(publicationIncreasesActivePropertyCount("PAUSED"), false)
  assert.equal(publicationIncreasesActivePropertyCount("ARCHIVED"), true)
})

test("constraints de banco protegem fulfillment, grants e capacidade recorrente", async () => {
  const [schema, lifecycleMigration, entitlementMigration, capacityMigration, checkoutRoute, webhookRoute] = await Promise.all([
    readFile(new globalThis.URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new globalThis.URL(
        "../prisma/migrations/20260822180000_billing_stripe_lifecycle_integrity/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new globalThis.URL(
        "../prisma/migrations/20260822190000_billing_plan_entitlements/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new globalThis.URL(
        "../prisma/migrations/20260825090000_recurring_property_capacity_addons/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new globalThis.URL("../app/api/stripe/create-checkout/route.ts", import.meta.url), "utf8"),
    readFile(new globalThis.URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
  ])

  assert.match(schema, /stripeCheckoutSessionId\s+String\?\s+@unique/)
  assert.match(schema, /grantKey\s+String\?\s+@unique/)
  assert.match(
    lifecycleMigration,
    /ExtraPackagePurchase_stripeCheckoutSessionId_key/,
  )
  assert.match(entitlementMigration, /AiCreditTransaction_grantKey_key/)
  assert.match(entitlementMigration, /JOIN "Subscription" AS subscription/)
  assert.match(entitlementMigration, /subscription\."nextBillingAt"/)
  assert.doesNotMatch(entitlementMigration, /app_user\."nextBillingAt"/)
  assert.match(schema, /model BrokerPropertyCapacityAddon/)
  assert.match(schema, /stripeSubscriptionItemId\s+String\s+@unique/)
  assert.match(capacityMigration, /CREATE TABLE "BrokerPropertyCapacityAddon"/)
  assert.match(capacityMigration, /BrokerPropertyCapacityAddon_brokerId_key/)
  assert.match(capacityMigration, /BrokerPropertyCapacityAddon_stripeSubscriptionItemId_key/)
  assert.match(checkoutRoute, /stripe\.subscriptions\.update/)
  assert.match(checkoutRoute, /getStripePropertyCapacityItems/)
  assert.match(checkoutRoute, /capacityPrice\.recurring\?\.interval !== "month"/)
  assert.match(webhookRoute, /recurring_capacity_managed_by_subscription/)
})
