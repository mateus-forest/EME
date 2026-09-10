import type { BillingResolution, BillingResolutionInput } from "@/lib/billing-resolution"
import type { StripeBillingEvidence } from "@/lib/stripe-billing-reader"

export type AdminStripeBillingReport = {
  userId: string
  local: {
    userPlan: string; accountPlan: string | null; userStatus: string; subscriptionStatus: string | null
    customerId: string | null; subscriptionId: string | null; accountSubscriptionId: string | null
  }
  localResolution: BillingResolution
  resolution: BillingResolution
  evidence: StripeBillingEvidence
}

export function billingComparisonLocal(input: BillingResolutionInput): AdminStripeBillingReport["local"] {
  return {
    userPlan: input.user.plan, accountPlan: input.planAccount?.planKey ?? null,
    userStatus: input.user.subscriptionStatus, subscriptionStatus: input.subscription?.status ?? null,
    customerId: input.user.stripeCustomerId, subscriptionId: input.user.stripeSubscriptionId,
    accountSubscriptionId: input.planAccount?.currentStripeSubscriptionId ?? null,
  }
}
