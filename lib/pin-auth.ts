import { compare, hash } from "bcryptjs"

export const PIN_LENGTH = 6
export const PIN_MAX_FAILURES = 3

export function normalizePin(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, PIN_LENGTH) : ""
}

export function isValidPin(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

export async function hashPin(pin: string) {
  return hash(pin, 10)
}

export async function comparePin(pin: string, pinHash: string | null | undefined) {
  if (!pinHash) return false
  return compare(pin, pinHash)
}
