import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildStripePeriodGrantKey,
  canPlanAccessMarketplace,
  isConfirmedStripePayment,
  publicationIncreasesActivePropertyCount,
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

test("publicar DRAFT já contabilizado não consome outra vaga", () => {
  assert.equal(publicationIncreasesActivePropertyCount("DRAFT"), false)
  assert.equal(publicationIncreasesActivePropertyCount("PUBLISHED"), false)
  assert.equal(publicationIncreasesActivePropertyCount("PAUSED"), false)
  assert.equal(publicationIncreasesActivePropertyCount("ARCHIVED"), true)
})

test("constraints de banco protegem fulfillment e grants concorrentes", async () => {
  const [schema, lifecycleMigration, entitlementMigration] = await Promise.all([
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
})
