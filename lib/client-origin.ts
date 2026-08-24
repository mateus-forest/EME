export type ClientOrigin = "manual" | "catalog" | "marketplace" | "cos"

export const CLIENT_ORIGIN_OPTIONS: ReadonlyArray<{ value: ClientOrigin; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "catalog", label: "Catálogo" },
  { value: "marketplace", label: "Marketplace" },
  { value: "cos", label: "COS" },
]

const CLIENT_ORIGIN_LABELS: Record<ClientOrigin, string> = {
  manual: "Manual",
  catalog: "Catálogo",
  marketplace: "Marketplace",
  cos: "COS",
}

function searchableSource(value: unknown) {
  if (typeof value !== "string") return ""
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function normalizeClientOrigin(value: unknown): ClientOrigin | null {
  const source = searchableSource(value)
  if (!source) return null

  // Specific acquisition channels take precedence over historical fallback
  // labels such as "catalogo · manual".
  if (source.includes("marketplace")) return "marketplace"
  if (source.includes("catalog")) return "catalog"
  if (source.includes("assessor") || /(^|[^a-z])cos([^a-z]|$)/.test(source)) return "cos"
  if (
    source.includes("manual") ||
    source.includes("corretor_eme") ||
    source.includes("dashboard") ||
    source === "portal"
  ) {
    return "manual"
  }

  return null
}

export function getClientOriginLabel(value: unknown) {
  const origin = normalizeClientOrigin(value)
  return origin ? CLIENT_ORIGIN_LABELS[origin] : "Não informada"
}
