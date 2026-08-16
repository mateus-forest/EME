export const CRECI_UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const

export type CreciUf = (typeof CRECI_UF_OPTIONS)[number]
export type CreciValidationStatus = "VERIFIED" | "REJECTED" | "REVIEW_REQUIRED" | "PENDING"
export type CreciValidationProvider = "IMOBISEC"

export type CreciValidationReason =
  | "ACTIVE"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "INACTIVE"
  | "NAME_MISMATCH"
  | "AMBIGUOUS_RESPONSE"
  | "TIMEOUT"
  | "CONFIGURATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "PAYMENT_REQUIRED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"

export type CreciValidationResult = {
  status: CreciValidationStatus
  reason: CreciValidationReason
  creci: string
  state: CreciUf | null
  provider: CreciValidationProvider
  officialName: string | null
  providerStatus: string | null
  checkedAt: Date
  nameMismatch: boolean
}

const IGNORED_NAME_TOKENS = new Set(["DA", "DAS", "DE", "DO", "DOS", "E"])

export function normalizeCreciUf(value: unknown): CreciUf | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  return CRECI_UF_OPTIONS.includes(normalized as CreciUf) ? (normalized as CreciUf) : null
}

export function normalizeCreciNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null
  const digits = String(value).trim()
  if (!/^\d+$/.test(digits)) return null

  const parsed = Number(digits)
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null
  return String(parsed)
}

function normalizeNameTokens(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !IGNORED_NAME_TOKENS.has(token))
}

export function hasRelevantCreciNameMismatch(informedName: string, officialName: string) {
  const informedTokens = normalizeNameTokens(informedName)
  const officialTokens = normalizeNameTokens(officialName)

  if (informedTokens.length === 0 || officialTokens.length === 0) return false

  const informed = new Set(informedTokens)
  const official = new Set(officialTokens)
  let overlap = 0

  for (const token of informed) {
    if (official.has(token)) overlap += 1
  }

  return overlap / Math.min(informed.size, official.size) < 0.67
}

export function isOfficiallyInactiveCreciStatus(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()

  return normalized === "INATIVO" || normalized === "SUSPENSO" || normalized === "CANCELADO"
}

export function isOfficiallyActiveCreciStatus(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase() === "ATIVO"
  )
}
