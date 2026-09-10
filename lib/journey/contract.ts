export const JOURNEY_EVENTS = [
  "landing_view", "page_view", "signup_started", "signup_step_completed", "signup_failed", "signup_completed", "login_completed", "login_failed",
  "marketplace_view", "marketplace_search", "marketplace_result_opened", "catalog_view", "catalog_property_opened", "lead_created",
  "property_created", "property_published", "proposal_created", "contract_generated", "cos_message_sent", "cos_action_completed", "cos_action_failed",
  "studio_generation_started", "studio_generation_completed", "studio_generation_failed", "checkout_started", "checkout_completed", "checkout_failed", "error_occurred",
] as const
export type JourneyEventName = typeof JOURNEY_EVENTS[number]
export const BROWSER_EVENTS: readonly JourneyEventName[] = ["landing_view", "page_view", "signup_started", "signup_step_completed", "signup_failed", "marketplace_view", "marketplace_search", "marketplace_result_opened", "catalog_view", "catalog_property_opened", "error_occurred"]
export const MODULES = ["landing", "auth", "marketplace", "catalog", "properties", "clients", "proposals", "contracts", "cos", "studio", "billing", "agenda", "admin", "other"] as const
export type JourneyModule = typeof MODULES[number]
export type JourneyEvent = {
  eventId: string; eventName: JourneyEventName; schemaVersion: 1; occurredAt: string; producer: "browser" | "server"
  userId: string | null; anonymousId: string | null; sessionId: string | null
  pathname: string; route: string; referrer: string | null; device: "desktop" | "mobile" | "tablet" | "bot" | "unknown"
  module: JourneyModule; step: string | null; outcome: "started" | "completed" | "failed" | "viewed" | null
  requestId: string | null; correlationId: string | null; brokerId: string | null; propertyId: string | null; catalogId: string | null
  errorCode: string | null; metadata: Record<string, string | number | boolean>
}
export const ANONYMOUS_COOKIE = "eme_journey_anonymous"
export const SESSION_COOKIE = "eme_journey_session"
export const SESSION_IDLE_MS = 30 * 60 * 1000
export const ADMIN_ANALYTICS_TIME_ZONE = "America/Sao_Paulo"
export function journeyId(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value) ? value : null
}
export function journeyCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : null
}
const segments = new Set("api auth login register logout me cadastro corretor imobiliaria admin usuarios catalogo catalog imoveis imovel corretores regioes comprar alugar busca comparar sobre properties agency publish marketplace leads clients brokers documents contracts contract-instances pdf file pdf-credit proposals propostas contratos clientes agenda compromissos studio studio-ia prepare-property video visualize-project sell-property construction instagram owners buyers campaigns assets render images audio import xml ad confirm preview extract stripe billing webhook create-checkout customer-portal assistant eme cos cos-launch conversas conversas device pin biometric verify options security conta plano planos dashboard financeiro favoritos termos-de-uso privacidade assinatura assinaturas".split(" "))
for (const segment of "documentos novo-imovel corretor-eme corretor-m suporte historico notificacoes analytics desempenho biblioteca preparar-imovel visualizar-projeto vender-este-imovel transformar-obra-em-imovel-pronto criar-video-do-imovel criar-campanha-instagram captar-proprietarios campanha campanhas settings financial accounts rentals conversations reviews locations".split(" ")) segments.add(segment)
/** Preserve route structure, never tokens, personal slugs, arbitrary query strings or fragments. */
export function journeyRoute(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/unknown"
  return "/" + value.split(/[?#]/)[0].split("/").filter(Boolean).slice(0, 10).map((segment) => segments.has(segment) ? segment : ":id").join("/")
}
export function journeyModule(path: string): JourneyModule {
  if (path === "/") return "landing"
  if (path.includes("/catalogo")) return "catalog"
  if (path.startsWith("/imoveis") || path.includes("marketplace")) return "marketplace"
  if (/auth|cadastro|login/.test(path)) return "auth"
  if (/studio/.test(path)) return "studio"
  if (path === "/corretor" || /assistant|cos|corretor-eme|corretor-m/.test(path)) return "cos"
  if (/stripe|billing|plano|assinatura/.test(path)) return "billing"
  if (/contracts|contract-instances|contratos/.test(path)) return "contracts"
  if (/documents|documentos|propostas/.test(path)) return "proposals"
  if (/properties|imoveis/.test(path)) return "properties"
  if (/leads|clients|clientes/.test(path)) return "clients"
  if (/agenda|compromissos/.test(path)) return "agenda"
  return path.startsWith("/admin") ? "admin" : "other"
}
export function journeyDevice(userAgent: string): JourneyEvent["device"] {
  if (/bot|crawler|spider|headless/i.test(userAgent)) return "bot"
  if (/ipad|tablet/i.test(userAgent)) return "tablet"
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile"
  return userAgent ? "desktop" : "unknown"
}
export function journeyReferrer(value: unknown): string | null {
  if (typeof value === "string" && /^[a-z0-9.-]{1,180}$/i.test(value) && !value.startsWith(".")) return value.toLowerCase()
  try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol) ? url.hostname.slice(0, 180) : null } catch { return null }
}
function entityRef(value: unknown) { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null }
const metaNumbers = new Set(["resultCount", "filterCount", "queryLength", "httpStatus", "durationMs", "itemCount"])
const metaIds = new Set(["searchId", "operationId", "documentId", "leadId", "checkoutId", "legacyRecordId"])
const metaEnums: Record<string, readonly string[]> = {
  surface: ["landing_modal", "auth_page", "signup_page", "marketplace", "catalog", "portal", "webhook"],
  channel: ["marketplace", "catalog", "manual", "cos", "import", "other"],
  method: ["password", "pin", "biometric"], plan: ["free", "pro", "scale"],
  paymentStatus: ["paid", "unpaid", "no_payment_required"],
  errorKind: ["frontend", "api", "upload", "publication", "auth", "stripe", "cos", "studio"],
  legacySource: ["CatalogEvent", "SearchEvent", "AiOperationTelemetry"],
  utmSource: ["google", "facebook", "instagram", "whatsapp", "linkedin", "email", "direct", "other"],
  utmMedium: ["organic", "cpc", "paid", "social", "referral", "email", "other"],
}
export function journeyMetadata(value: unknown): JourneyEvent["metadata"] {
  const output: JourneyEvent["metadata"] = {}
  if (!value || typeof value !== "object" || Array.isArray(value)) return output
  for (const [key, item] of Object.entries(value)) {
    if (metaNumbers.has(key) && typeof item === "number" && Number.isFinite(item) && item >= 0) output[key] = Math.min(Math.round(item), 86_400_000)
    else if (metaIds.has(key) && journeyId(item)) output[key] = item as string
    else if (Object.hasOwn(metaEnums, key) && metaEnums[key].includes(item as string)) output[key] = item as string
    else if (["draft", "reused"].includes(key) && typeof item === "boolean") output[key] = item
  }
  return output
}
export function normalizeJourneyEvent(value: unknown, producer: JourneyEvent["producer"], actorId: string | null = null, now = Date.now()): JourneyEvent | null {
  if (!value || typeof value !== "object") return null
  const input = value as Record<string, unknown>
  const name = input.eventName as JourneyEventName
  if (!JOURNEY_EVENTS.includes(name) || (producer === "browser" && !BROWSER_EVENTS.includes(name)) || !journeyId(input.eventId)) return null
  const occurred = new Date(String(input.occurredAt)).getTime()
  if (!Number.isFinite(occurred) || occurred > now + 300_000 || (producer === "browser" && occurred < now - 86_400_000)) return null
  if (producer === "browser" && (!journeyId(input.anonymousId) || !journeyId(input.sessionId))) return null
  const route = journeyRoute(input.route ?? input.pathname)
  const metadata = journeyMetadata(input.metadata)
  if (producer === "browser" && name === "signup_failed" && input.step !== "client_validation") return null
  return {
    eventId: input.eventId as string, eventName: name, schemaVersion: 1, occurredAt: new Date(occurred).toISOString(), producer,
    userId: journeyId(actorId), anonymousId: journeyId(input.anonymousId), sessionId: journeyId(input.sessionId),
    pathname: journeyRoute(input.pathname), route, referrer: journeyReferrer(input.referrer),
    device: ["desktop", "mobile", "tablet", "bot", "unknown"].includes(String(input.device)) ? input.device as JourneyEvent["device"] : "unknown",
    module: MODULES.includes(input.module as JourneyModule) ? input.module as JourneyModule : journeyModule(route),
    step: ["form_opened", "identity", "credentials", "client_validation", "submitted", "server_validation", "payment", "generation", "action"].includes(String(input.step)) ? input.step as string : null,
    outcome: ["started", "completed", "failed", "viewed"].includes(String(input.outcome)) ? input.outcome as JourneyEvent["outcome"] : null,
    requestId: journeyId(input.requestId), correlationId: journeyId(input.correlationId), brokerId: entityRef(input.brokerId), propertyId: entityRef(input.propertyId), catalogId: entityRef(input.catalogId),
    errorCode: journeyCode(input.errorCode), metadata,
  }
}
