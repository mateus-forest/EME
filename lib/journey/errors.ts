import { journeyCode } from "@/lib/journey/contract"

/** Coarse, stable classifications. The diagnostic text is discarded, never persisted. */
export function journeyErrorCode(route: string, status: number, body: unknown): string {
  const input = body && typeof body === "object" ? body as { code?: unknown; error?: unknown } : {}
  const code = journeyCode(input.code)
  if (code) return code
  const message = typeof input.error === "string" ? input.error.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : ""
  if (route.includes("/auth/")) {
    if (/email.*(cadastrad|utilizad|existe)|conta.*existe/.test(message)) return "EMAIL_ALREADY_REGISTERED"
    if (/creci/.test(message)) return "CRECI_INVALID"
    if (/senha|credencia|pin.*incorret/.test(message)) return "INVALID_CREDENTIALS"
    if (/obrigatori|informe|invalid/.test(message)) return "AUTH_VALIDATION_FAILED"
    if (status === 429) return "AUTH_RATE_LIMITED"
  }
  if (status === 402) return "INSUFFICIENT_CREDITS"
  return `HTTP_${status}`
}
