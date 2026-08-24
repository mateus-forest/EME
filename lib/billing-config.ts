function parseBillingEnforcement(rawValue: string | undefined) {
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false
    }
  }

  return true
}

export function isBillingEnforcementEnabled() {
  const rawValue =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_BILLING_ENFORCEMENT ?? process.env.BILLING_ENFORCEMENT
      : undefined

  return parseBillingEnforcement(rawValue)
}

export function isServerBillingEnforcementEnabled() {
  const rawValue = typeof process !== "undefined" ? process.env.BILLING_ENFORCEMENT : undefined
  return parseBillingEnforcement(rawValue)
}

export function isBillingBypassEnabled() {
  return !isBillingEnforcementEnabled()
}

export function isServerBillingBypassEnabled() {
  return !isServerBillingEnforcementEnabled()
}
