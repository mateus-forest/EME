export function formatCurrencyBRLFromCents(value: number, options?: { showCents?: boolean }) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: options?.showCents === false ? 0 : 2,
    maximumFractionDigits: options?.showCents === false ? 0 : 2,
  }).format(value / 100)
}

export function parseCurrencyInputToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }

  if (typeof value !== "string") return null

  const normalized = value.trim()
  const digits = normalized.replace(/\D/g, "")
  if (!digits) return null

  if (normalized.includes(",")) {
    return Number(digits)
  }

  return Number(digits) * 100
}

export function formatCurrencyInput(value: string) {
  const cents = parseCurrencyInputToCents(value)
  return cents === null ? "" : formatCurrencyBRLFromCents(cents)
}
