export type BillingLifecyclePlanKey = "free" | "pro" | "scale"

export type SubscriptionChangeMode =
  | "checkout"
  | "update_existing"
  | "invalid"

const ACTIVE_PROPERTY_STATUSES = new Set(["DRAFT", "PUBLISHED", "PAUSED"])

export function resolveSubscriptionChangeMode(
  currentPlan: BillingLifecyclePlanKey,
  targetPlan: BillingLifecyclePlanKey,
): SubscriptionChangeMode {
  if (currentPlan === targetPlan || targetPlan === "free") return "invalid"
  if (currentPlan === "scale") return "invalid"
  if (currentPlan === "pro") {
    return targetPlan === "scale" ? "update_existing" : "invalid"
  }
  return "checkout"
}

export function isConfirmedStripePayment(paymentStatus: string | null | undefined) {
  return paymentStatus === "paid"
}

export function canPlanAccessMarketplace(planKey: BillingLifecyclePlanKey) {
  return planKey === "pro" || planKey === "scale"
}

export function publicationIncreasesActivePropertyCount(status: string) {
  return !ACTIVE_PROPERTY_STATUSES.has(status)
}

export function resolveStrictStripePlanKey(
  priceId: string | null | undefined,
  prices: { pro: string | null | undefined; scale: string | null | undefined },
): Extract<BillingLifecyclePlanKey, "pro" | "scale"> | null {
  if (!priceId) return null
  if (prices.pro && priceId === prices.pro) return "pro"
  if (prices.scale && priceId === prices.scale) return "scale"
  return null
}

export function buildStripePeriodGrantKey(input: {
  brokerId: string
  subscriptionId: string
  periodStart: Date
  planKey: Extract<BillingLifecyclePlanKey, "pro" | "scale">
}) {
  return [
    "stripe-period",
    input.brokerId,
    input.subscriptionId,
    input.periodStart.toISOString(),
    input.planKey,
  ].join(":")
}

export function shouldGrantStripePaidPeriod(input: {
  eventType: string
  subscriptionStatus: string
  planKey: BillingLifecyclePlanKey | null
}) {
  const isPaidEvent =
    input.eventType === "invoice.paid" ||
    input.eventType === "invoice.payment_succeeded"
  return (
    isPaidEvent &&
    input.subscriptionStatus === "active" &&
    (input.planKey === "pro" || input.planKey === "scale")
  )
}
