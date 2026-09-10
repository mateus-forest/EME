import { ADMIN_ANALYTICS_TIME_ZONE } from "@/lib/journey/contract"

export const OVERVIEW_TIME_ZONE = ADMIN_ANALYTICS_TIME_ZONE
export type OverviewPeriodKey = "today" | "7d" | "30d" | "custom"
export type OverviewPeriod = { key: OverviewPeriodKey; from: string; to: string; start: string; end: string; timeZone: string }
export type SourceState = { status: "available" | "partial" | "unavailable"; note: string }
export type CountRow = { label: string; count: number }
export type OverviewTraffic = {
  visitors: number; sessions: number; pageViews: number; signupStarted: number; signupCompleted: number
  landingViews: number; marketplaceViews: number; catalogViews: number; leads: number; errors: number
}
export type JourneyOverviewData = {
  totals: OverviewTraffic
  sources: CountRow[]; devices: CountRow[]
  funnel: Array<{ event: string; count: number; total: number }>
  modules: Array<{ label: string; count: number; users: number }>
  actions: CountRow[]; commerce: CountRow[]
  errors: { users: number; sessions: number; latest: string | null; codes: CountRow[]; routes: CountRow[] }
  routes: Array<{ label: string; count: number; visitors: number; sessions: number }>
  series: Array<{ bucket: string; views: number; visitors: number; sessions: number }>
  quality: { firstReceivedAt: string | null; lastReceivedAt: string | null; missingPageIdentity: number; unlinkedConversions: number }
}
export type AdminJourneyOverview = {
  generatedAt: string; period: OverviewPeriod
  journey: { state: SourceState; data: JourneyOverviewData | null }
  registrations: { state: SourceState; count: number | null }
  subscribers: { state: SourceState; count: number | null; pending: number | null; trial: number | null; asOf: string }
}

export function overviewLocalDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: OVERVIEW_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
  const value = (kind: string) => parts.find(part => part.type === kind)!.value
  return `${value("year")}-${value("month")}-${value("day")}`
}
function shiftDay(day: string, days: number) { return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10) }
function isDay(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value }
/** Resolve local midnight through Intl instead of depending on the host process timezone. */
export function overviewDayStart(day: string): Date {
  const target = Date.parse(`${day}T00:00:00Z`)
  let instant = target
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: OVERVIEW_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant))
    const n = (kind: string) => Number(parts.find(part => part.type === kind)!.value)
    const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"))
    if (local === target) return new Date(instant)
    instant += target - local
  }
  throw new Error("Data local não suportada. Escolha outro intervalo.")
}
export function resolveOverviewPeriod(params: URLSearchParams, now = new Date()): OverviewPeriod {
  const key = params.get("period") ?? "7d"
  if (!["today", "7d", "30d", "custom"].includes(key)) throw new Error("Período inválido.")
  const today = overviewLocalDay(now)
  const to = key === "custom" ? params.get("to") ?? "" : today
  const from = key === "custom" ? params.get("from") ?? "" : shiftDay(today, key === "30d" ? -29 : key === "7d" ? -6 : 0)
  if (!isDay(from) || !isDay(to) || from > to || to > today || Date.parse(to) - Date.parse(from) > 365 * 86_400_000) throw new Error("Escolha datas válidas, sem dias futuros, em um intervalo de até 366 dias.")
  return { key: key as OverviewPeriodKey, from, to, start: overviewDayStart(from).toISOString(), end: to === today ? now.toISOString() : overviewDayStart(shiftDay(to, 1)).toISOString(), timeZone: OVERVIEW_TIME_ZONE }
}
export function overviewRate(count: number, previous: number): number | null { return previous > 0 ? Math.round(count / previous * 1000) / 10 : null }
export function journeySourceState(data: JourneyOverviewData, period: OverviewPeriod, enabled: boolean): SourceState {
  const notes: string[] = []
  if (!enabled) notes.push("Gravação desativada neste servidor; exibindo apenas os eventos já recebidos.")
  if (!data.quality.firstReceivedAt) notes.push("Ainda não há eventos recebidos para comprovar cobertura.")
  else if (Date.parse(data.quality.firstReceivedAt) > Date.parse(period.start)) notes.push("O período começa antes do primeiro evento recebido; não há histórico retroativo.")
  if (data.quality.missingPageIdentity) notes.push(`${data.quality.missingPageIdentity} page views sem identidade completa.`)
  if (data.quality.unlinkedConversions) notes.push(`${data.quality.unlinkedConversions} conversões sem sessão, fora do funil.`)
  return { status: notes.length ? "partial" : "available", note: notes.join(" ") || "Eventos recebidos no período. Coleta best effort, sujeita a bloqueadores e perdas." }
}

export const OVERVIEW_MODULE_LABELS: Record<string, string> = { landing: "Landing", auth: "Autenticação", marketplace: "Marketplace", catalog: "Catálogo", properties: "Imóveis", clients: "Clientes", proposals: "Propostas", contracts: "Contratos", cos: "COS", studio: "Studio IA", billing: "Plano e pagamento", agenda: "Compromissos", other: "Outros" }
export const OVERVIEW_EVENT_LABELS: Record<string, string> = {
  landing_view: "Visita à landing", signup_started: "Cadastro iniciado", signup_completed: "Cadastro concluído", checkout_started: "Checkout iniciado", checkout_completed: "Checkout concluído",
  marketplace_view: "Visitas ao Marketplace", marketplace_search: "Buscas no Marketplace", marketplace_result_opened: "Imóveis abertos no Marketplace", catalog_view: "Visitas aos catálogos", catalog_property_opened: "Imóveis abertos nos catálogos", lead_created: "Leads gerados",
  property_created: "Imóveis criados", property_published: "Publicações de imóveis", proposal_created: "Propostas criadas", contract_generated: "Contratos gerados", cos_message_sent: "Mensagens ao COS", cos_action_completed: "Ações do COS", studio_generation_completed: "Gerações do Studio",
}
