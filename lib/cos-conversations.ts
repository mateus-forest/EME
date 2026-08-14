export const DEFAULT_COS_CONVERSATION_TITLE = "Nova conversa"

export const COS_CONVERSATION_CATEGORIES = [
  { id: "clients", label: "Clientes" },
  { id: "properties", label: "Imóveis" },
  { id: "proposals", label: "Propostas" },
  { id: "contracts", label: "Contratos" },
  { id: "agenda", label: "Agenda/Compromissos" },
  { id: "studio", label: "Studio" },
  { id: "queries", label: "Consultas" },
  { id: "general", label: "Conversas gerais" },
] as const

export type CosConversationCategoryId = (typeof COS_CONVERSATION_CATEGORIES)[number]["id"]

type CosConversationCategoryInput = {
  action?: unknown
  capabilityId?: unknown
  entity?: unknown
  title?: unknown
}

export function getCosConversationCategoryLabel(categoryId: CosConversationCategoryId) {
  return COS_CONVERSATION_CATEGORIES.find((category) => category.id === categoryId)?.label ?? "Conversas gerais"
}

export function resolveCosConversationCategory(input: CosConversationCategoryInput): CosConversationCategoryId {
  const metadataSignal = [input.entity, input.capabilityId, input.action]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map((value) => value.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .join(" ")
    .toLowerCase()
    .replace(/[_:.-]+/g, " ")

  if (/\b(lead|client)/.test(metadataSignal)) return "clients"
  if (/\bproposal/.test(metadataSignal)) return "proposals"
  if (/\b(contract|document)/.test(metadataSignal)) return "contracts"
  if (/\bagenda\b/.test(metadataSignal)) return "agenda"
  if (/\bstudio/.test(metadataSignal)) return "studio"
  if (/\b(property|properties)/.test(metadataSignal)) return "properties"
  if (/\b(finance|financial|analytics|operation|insight|catalog|help)/.test(metadataSignal)) return "queries"

  const normalizedTitle = normalizeConversationCategoryText(input.title)
  if (/\b(cliente|clientes|lead|leads)\b/.test(normalizedTitle)) return "clients"
  if (/\b(proposta|propostas)\b/.test(normalizedTitle)) return "proposals"
  if (/\b(contrato|contratos|documento|documentos)\b/.test(normalizedTitle)) return "contracts"
  if (/\b(agenda|agendar|compromisso|compromissos|visita|visitas)\b/.test(normalizedTitle)) return "agenda"
  if (/\b(studio|campanha|instagram|facebook|story|video)\b/.test(normalizedTitle)) return "studio"
  if (/\b(imovel|imoveis|propriedade|propriedades|catalogo)\b/.test(normalizedTitle)) return "properties"
  if (/\b(consulta|consultar|resumo|financeiro|financeira|analytics|desempenho|operacao)\b/.test(normalizedTitle)) return "queries"

  return "general"
}

export function cleanCosConversationTitle(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export function isDefaultCosConversationTitle(value: unknown) {
  return cleanCosConversationTitle(value) === DEFAULT_COS_CONVERSATION_TITLE
}

export function generateCosConversationTitle(message: string) {
  const normalized = message
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) return DEFAULT_COS_CONVERSATION_TITLE
  if (normalized.length <= 60) return normalized

  return `${normalized.slice(0, 57).trimEnd()}...`
}

function normalizeConversationCategoryText(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    : ""
}
