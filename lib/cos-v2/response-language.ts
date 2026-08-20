import { sanitizeCosResponseText } from "@/lib/cos/response-view-model"

const INTERNAL_LABELS: Record<string, string> = {
  first_steps: "primeiros passos",
  using_cos: "uso do COS",
  registering_properties: "cadastro de imóveis",
  managing_clients: "gestão de clientes",
  marketplace_published: "publicação no Marketplace",
  pending_review: "em análise",
  review_required: "revisão necessária",
}

const INTERNAL_FIELDS: Record<string, string> = {
  published: "publicação no Catálogo",
  marketplacePublished: "publicação no Marketplace",
  marketplacePublishedAt: "data de publicação no Marketplace",
  brokerId: "corretor responsável",
  leadId: "cliente",
  propertyId: "imóvel",
  proposalId: "proposta",
  agendaEventId: "compromisso",
  documentsData: "documentos",
  legalData: "dados cadastrais",
  addressData: "endereço",
  createdAt: "data de criação",
  updatedAt: "última atualização",
}

const NATURAL_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bManaging[ _]clients\b/gi, "Gestão de clientes"],
  [/\bRegistering[ _]properties\b/gi, "Cadastro de imóveis"],
  [/\bFirst[ _]steps\b/gi, "Primeiros passos"],
  [/\bUsing[ _]COS\b/gi, "Uso do COS"],
  [/\bBrokerDocument\b/gi, "documento"],
  [/\bAgendaEvent\b/gi, "compromisso"],
  [/\bCatalogEvent\b/gi, "interação no Catálogo"],
  [/\bProperty\b/gi, "imóvel"],
  [/\bProperties\b/gi, "imóveis"],
  [/\bLead\b/gi, "cliente"],
  [/\bLeads\b/gi, "clientes"],
  [/\bcapabilit(?:y|ies)\b/gi, "recurso"],
  [/\bhandlers?\b/gi, "recurso"],
  [/\bworkflows?\b/gi, "fluxo"],
  [/\bpayload\b/gi, "dados"],
  [/\breadiness\b/gi, "requisitos de publicação"],
  [/\bpreview\b/gi, "prévia"],
  [/\bdrafts?\b/gi, "rascunho"],
  [/\bsource\b/gi, "origem"],
  [/\blanding\b/gi, "página de entrada"],
  [/\bknowledge\b/gi, ""],
  [/\bdiagnosis\b/gi, ""],
  [/\baction\b/gi, ""],
  [/\bAPI\b/g, "sistema"],
  [/\bURL\b/g, "link"],
]

const CAPABILITY_NAME = /\b(?:agenda|analytics|catalog|contract|document|general|help|lead|operation|property|proposal|studio)\.[A-Za-z][\w.]*\b/gi
const SNAKE_CASE = /\b[\p{L}\d]+(?:_[\p{L}\d]+)+\b/gu
const CAMEL_CASE = /\b[a-zà-ÿ]+(?:[A-Z][A-Za-zÀ-ÿ0-9]*)+\b/g
const IDENTIFIER = /\b(?:[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}|(?:lead|property|proposal|contract|agenda)-[a-z\d-]{4,})\b/gi
const INTERNAL_ENGLISH = /\b(?:managing|registering|properties|property|clients|client|handler|capability|workflow|payload|readiness|draft|published|unpublished|knowledge|diagnosis)\b/i
const SAFE_ACRONYMS = new Set(["COS", "EME", "IA", "PDF", "CPF", "CNPJ", "CRECI", "RG"])
const VISIBLE_TEXT_KEYS = new Set([
  "text",
  "title",
  "label",
  "description",
  "message",
  "prompt",
  "detail",
  "details",
  "summary",
  "caption",
  "capabilityTitle",
  "statusLabel",
  "entityLabel",
])

function containsTechnicalLeak(value: string) {
  CAPABILITY_NAME.lastIndex = 0
  SNAKE_CASE.lastIndex = 0
  CAMEL_CASE.lastIndex = 0
  IDENTIFIER.lastIndex = 0
  return CAPABILITY_NAME.test(value) || SNAKE_CASE.test(value) || CAMEL_CASE.test(value) || IDENTIFIER.test(value) || INTERNAL_ENGLISH.test(value)
}

function removeUnsafeParentheses(value: string) {
  return value.replace(/\(([^()]*)\)/g, (full, content: string) => containsTechnicalLeak(content) ? "" : full)
}

export function humanizeCosV2Text(value: string | null | undefined, fallback = "") {
  let text = sanitizeCosResponseText(value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(?:KNOWLEDGE|DIAGNOSIS|ACTION)]/gi, "")

  for (const [pattern, replacement] of NATURAL_TERM_REPLACEMENTS) text = text.replace(pattern, replacement)

  text = text
    .replace(CAPABILITY_NAME, "")
    .replace(IDENTIFIER, "")
    .replace(SNAKE_CASE, (token) => INTERNAL_LABELS[token.toLowerCase()] ?? "")
    .replace(CAMEL_CASE, (token) => INTERNAL_FIELDS[token] ?? "")
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, (token) => SAFE_ACRONYMS.has(token) ? token : "")

  text = removeUnsafeParentheses(text)
    .replace(/\b(?:recurso|ação|operações?)\s*(?:real|disponível|técnic[oa])?\s*:\s*(?=[,.;]|$)/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  const safeSentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence && !containsTechnicalLeak(sentence))
  return safeSentences.join(" ").trim() || fallback
}

function humanizeVisibleNode(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (!VISIBLE_TEXT_KEYS.has(key)) return value
    return humanizeCosV2Text(value, key === "text" ? "Posso ajudar com o próximo passo." : "")
  }
  if (Array.isArray(value)) return value.map((item) => humanizeVisibleNode(item, key)).filter((item) => item !== "")
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value).map(([itemKey, item]) => [itemKey, humanizeVisibleNode(item, itemKey)]))
}

export function humanizeCosV2Response<T>(response: T): T {
  return humanizeVisibleNode(response) as T
}
