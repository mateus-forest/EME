export type BillingPlan = "NONE" | "BROKER" | "AGENCY"
export type BillingUserSubscriptionStatus = "INACTIVE" | "ACTIVE"

export const BILLING_PLAN = {
  NONE: "NONE",
  BROKER: "BROKER",
  AGENCY: "AGENCY",
} as const satisfies Record<BillingPlan, BillingPlan>

export const BILLING_USER_SUBSCRIPTION_STATUS = {
  INACTIVE: "INACTIVE",
  ACTIVE: "ACTIVE",
} as const satisfies Record<BillingUserSubscriptionStatus, BillingUserSubscriptionStatus>
