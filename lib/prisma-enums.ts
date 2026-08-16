export type UserRole = "BROKER" | "AGENCY" | "ADMIN"
export type PropertyStatus = "DRAFT" | "PUBLISHED" | "PAUSED"
export type PropertyType = "APARTMENT" | "HOUSE" | "COMMERCIAL" | "LAND" | "OFFICE" | "STORE" | "PENTHOUSE"
export type CatalogOwnerType = "BROKER" | "AGENCY"
export type SubscriptionOwnerType = "BROKER" | "AGENCY"
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"
export type BillingPlan = "NONE" | "BROKER" | "AGENCY"
export type BillingUserSubscriptionStatus = "INACTIVE" | "ACTIVE"
export type BrokerAccountStatus = "PENDING" | "ACTIVE" | "INACTIVE"
export type CreciValidationStatus = "VERIFIED" | "REJECTED" | "REVIEW_REQUIRED" | "PENDING"
export type CreciValidationProvider = "IMOBISEC"
export type LeadStatus = "NEW" | "CONTACTED" | "NEGOTIATING" | "WON" | "LOST" | "ARCHIVED"

export const USER_ROLE = {
  BROKER: "BROKER",
  AGENCY: "AGENCY",
  ADMIN: "ADMIN",
} as const satisfies Record<UserRole, UserRole>

export const PROPERTY_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
} as const satisfies Record<PropertyStatus, PropertyStatus>

export const PROPERTY_TYPE = {
  APARTMENT: "APARTMENT",
  HOUSE: "HOUSE",
  COMMERCIAL: "COMMERCIAL",
  LAND: "LAND",
  OFFICE: "OFFICE",
  STORE: "STORE",
  PENTHOUSE: "PENTHOUSE",
} as const satisfies Record<PropertyType, PropertyType>

export const CATALOG_OWNER_TYPE = {
  BROKER: "BROKER",
  AGENCY: "AGENCY",
} as const satisfies Record<CatalogOwnerType, CatalogOwnerType>

export const SUBSCRIPTION_OWNER_TYPE = {
  BROKER: "BROKER",
  AGENCY: "AGENCY",
} as const satisfies Record<SubscriptionOwnerType, SubscriptionOwnerType>

export const SUBSCRIPTION_STATUS = {
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELED: "CANCELED",
} as const satisfies Record<SubscriptionStatus, SubscriptionStatus>

export const BILLING_PLAN = {
  NONE: "NONE",
  BROKER: "BROKER",
  AGENCY: "AGENCY",
} as const satisfies Record<BillingPlan, BillingPlan>

export const BILLING_USER_SUBSCRIPTION_STATUS = {
  INACTIVE: "INACTIVE",
  ACTIVE: "ACTIVE",
} as const satisfies Record<BillingUserSubscriptionStatus, BillingUserSubscriptionStatus>

export const BROKER_ACCOUNT_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const satisfies Record<BrokerAccountStatus, BrokerAccountStatus>

export const CRECI_VALIDATION_STATUS = {
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  PENDING: "PENDING",
} as const satisfies Record<CreciValidationStatus, CreciValidationStatus>

export const CRECI_VALIDATION_PROVIDER = {
  IMOBISEC: "IMOBISEC",
} as const satisfies Record<CreciValidationProvider, CreciValidationProvider>

export const LEAD_STATUS = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  NEGOTIATING: "NEGOTIATING",
  WON: "WON",
  LOST: "LOST",
  ARCHIVED: "ARCHIVED",
} as const satisfies Record<LeadStatus, LeadStatus>

export const UserRole = USER_ROLE
export const PropertyStatus = PROPERTY_STATUS
export const PropertyType = PROPERTY_TYPE
export const CatalogOwnerType = CATALOG_OWNER_TYPE
export const SubscriptionOwnerType = SUBSCRIPTION_OWNER_TYPE
export const SubscriptionStatus = SUBSCRIPTION_STATUS
export const BillingPlan = BILLING_PLAN
export const BillingUserSubscriptionStatus = BILLING_USER_SUBSCRIPTION_STATUS
export const BrokerAccountStatus = BROKER_ACCOUNT_STATUS
export const CreciValidationStatus = CRECI_VALIDATION_STATUS
export const CreciValidationProvider = CRECI_VALIDATION_PROVIDER
export const LeadStatus = LEAD_STATUS
