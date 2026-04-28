export function isBillingEnforcementEnabled() {
  const rawValue =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_BILLING_ENFORCEMENT ?? process.env.BILLING_ENFORCEMENT
      : undefined

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false
    }
  }

  return true
}

export function isBillingBypassEnabled() {
  return !isBillingEnforcementEnabled()
}
