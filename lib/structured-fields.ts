export type StructuredInputKind =
  | "currency"
  | "date"
  | "cpf"
  | "cnpj"
  | "cpf-cnpj"
  | "phone"
  | "cep"
  | "percent"
  | "decimal"
  | "quantity"

export function onlyDigits(value: unknown, maxLength?: number) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits
}

export function formatCurrencyBRLFromCents(value: number, options?: { showCents?: boolean }) {
  const safeValue = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: options?.showCents === false ? 0 : 2,
    maximumFractionDigits: options?.showCents === false ? 0 : 2,
  }).format(safeValue / 100)
}

export function parseCurrencyInputToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }

  if (typeof value !== "string") return null
  const normalized = value.trim()
  const digits = onlyDigits(normalized)
  if (!digits) return null

  // A comma indicates a value that has already been formatted/entered with decimal places.
  // Plain digits represent reais, matching the property forms ("5000" => R$ 5.000,00).
  return normalized.includes(",") ? Number(digits) : Number(digits) * 100
}

export function formatCurrencyInput(value: string) {
  const cents = parseCurrencyInputToCents(value)
  return cents === null ? "" : formatCurrencyBRLFromCents(cents)
}

export function formatCpf(value: unknown) {
  const digits = onlyDigits(value, 11)
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

export function formatCnpj(value: unknown) {
  const digits = onlyDigits(value, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\/\d{4})(\d)/, "$1-$2")
}

export function formatCpfCnpj(value: unknown) {
  const digits = onlyDigits(value, 14)
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits)
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value)
}

export function isValidCpf(value: unknown) {
  const digits = onlyDigits(value)
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false
  const calculateDigit = (length: number) => {
    const sum = digits.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10])
}

export function isValidCnpj(value: unknown) {
  const digits = onlyDigits(value)
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false
  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calculateDigit(`${digits.slice(0, 12)}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(digits[12]) && second === Number(digits[13])
}

export function isValidCpfCnpj(value: unknown) {
  const digits = onlyDigits(value)
  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits)
}

export function normalizeCpfCnpj(value: unknown) {
  return onlyDigits(value, 14)
}

export function formatPhone(value: unknown) {
  const rawDigits = onlyDigits(value)
  const digits = (rawDigits.length === 12 || rawDigits.length === 13) && rawDigits.startsWith("55")
    ? rawDigits.slice(2, 13)
    : rawDigits.slice(0, 11)
  if (!digits) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function normalizePhone(value: unknown) {
  const digits = onlyDigits(value)
  return ((digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits).slice(0, 11)
}

export function isValidPhone(value: unknown) {
  const digits = normalizePhone(value)
  return (digits.length === 10 || digits.length === 11) && !hasRepeatedDigits(digits)
}

export function formatCep(value: unknown) {
  const digits = onlyDigits(value, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function normalizeCep(value: unknown) {
  return onlyDigits(value, 8)
}

export function isValidCep(value: unknown) {
  return normalizeCep(value).length === 8
}

export function maskDateInput(value: unknown) {
  const digits = onlyDigits(value, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function parseBrazilianDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== "string") return null
  const normalized = value.trim()
  const brMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/)
  const parts = brMatch
    ? { day: Number(brMatch[1]), month: Number(brMatch[2]), year: Number(brMatch[3]) }
    : isoMatch
      ? { day: Number(isoMatch[3]), month: Number(isoMatch[2]), year: Number(isoMatch[1]) }
      : null
  if (!parts) return null
  const date = new Date(parts.year, parts.month - 1, parts.day)
  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day
  ) return null
  return date
}

export function parseBrazilianDateToIso(value: unknown) {
  const date = parseBrazilianDate(value)
  if (!date) return null
  const year = String(date.getFullYear()).padStart(4, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isValidBrazilianDate(value: unknown) {
  return parseBrazilianDate(value) !== null
}

export function formatDateBR(value: unknown, fallback = "") {
  const date = parseBrazilianDate(value)
  if (date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date)
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(parsed)
    }
  }
  return fallback
}

export function parseDecimalInput(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^\d.-]/g, "")
  if (!normalized || normalized === "-" || normalized === ".") return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatDecimalInput(value: unknown, maximumFractionDigits = 2) {
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(/(?!^)-/g, "")
    const separatorIndex = Math.max(cleaned.indexOf(","), cleaned.indexOf("."))
    if (separatorIndex >= 0) {
      const integer = onlyDigits(cleaned.slice(0, separatorIndex)) || "0"
      const fraction = onlyDigits(cleaned.slice(separatorIndex + 1), maximumFractionDigits)
      return `${integer},${fraction}`
    }
    return onlyDigits(cleaned)
  }
  const parsed = parseDecimalInput(value)
  return parsed === null ? "" : parsed.toLocaleString("pt-BR", { maximumFractionDigits })
}

export function parsePercentInput(value: unknown) {
  const parsed = parseDecimalInput(value)
  return parsed === null ? null : Math.min(100, Math.max(0, parsed))
}

export function formatPercentInput(value: unknown, options?: { suffix?: boolean }) {
  const parsed = parsePercentInput(value)
  if (parsed === null) return ""
  const formatted = parsed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  return options?.suffix === false ? formatted : `${formatted}%`
}

export function formatArea(value: unknown, options?: { suffix?: boolean }) {
  const parsed = parseDecimalInput(value)
  if (parsed === null) return ""
  const formatted = parsed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  return options?.suffix === false ? formatted : `${formatted} m²`
}

export function formatPositiveArea(value: unknown) {
  const parsed = parseDecimalInput(value)
  return parsed !== null && parsed > 0 ? formatArea(parsed) : ""
}

export function formatCountLabel(value: unknown, singular: string, plural: string) {
  const parsed = parseDecimalInput(value)
  if (parsed === null || parsed < 0) return ""
  const formatted = parsed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  return `${formatted} ${parsed === 1 ? singular : plural}`
}

export function formatPositiveCountLabel(value: unknown, singular: string, plural: string) {
  const parsed = parseDecimalInput(value)
  return parsed !== null && parsed > 0 ? formatCountLabel(parsed, singular, plural) : ""
}

export function formatLocation(city: unknown, state: unknown, separator = " - ") {
  return [city, state]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(separator)
}

export function formatQuantityInput(value: unknown) {
  const digits = onlyDigits(value, 4)
  return digits ? String(Math.max(0, Number(digits))) : ""
}

export function parseQuantity(value: unknown) {
  const normalized = formatQuantityInput(value)
  return normalized ? Number(normalized) : null
}

export function formatRg(value: unknown) {
  // RGs are issued by different states and may contain letters/check digits. Keep them intact;
  // a state-aware formatter can be layered on later when the issuing UF is known.
  return String(value ?? "").replace(/[^\p{L}\p{N}.\-/ ]/gu, "").slice(0, 30)
}

export function formatStructuredInput(kind: StructuredInputKind, value: string) {
  switch (kind) {
    case "currency": return formatCurrencyInput(value)
    case "date": return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) ? formatDateBR(value) : maskDateInput(value)
    case "cpf": return formatCpf(value)
    case "cnpj": return formatCnpj(value)
    case "cpf-cnpj": return formatCpfCnpj(value)
    case "phone": return formatPhone(value)
    case "cep": return formatCep(value)
    case "percent": return formatPercentInput(value)
    case "decimal": return formatDecimalInput(value)
    case "quantity": return formatQuantityInput(value)
  }
}

export function normalizeStructuredInput(kind: StructuredInputKind, value: string) {
  switch (kind) {
    case "currency": return parseCurrencyInputToCents(value)
    case "date": return parseBrazilianDateToIso(value)
    case "cpf":
    case "cnpj":
    case "cpf-cnpj": return normalizeCpfCnpj(value)
    case "phone": return normalizePhone(value)
    case "cep": return normalizeCep(value)
    case "percent": return parsePercentInput(value)
    case "decimal": return parseDecimalInput(value)
    case "quantity": return parseQuantity(value)
  }
}
