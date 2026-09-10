import { resolveOverviewPeriod, type CountRow, type OverviewPeriod, type SourceState } from "@/lib/admin-journey-contract"

export const TRAFFIC_SURFACES = { all: "Todas as superfícies", landing: "Landing", marketplace: "Marketplace", catalog: "Catálogos", portal: "Portal autenticado", other: "Outras / autenticação" } as const
export type TrafficSurface = keyof typeof TRAFFIC_SURFACES
export type TrafficFilters = { period: OverviewPeriod; surface: TrafficSurface; route: string | null }
export type TrafficVolume = { views: number; visitors: number; sessions: number }
export type TrafficRoute = TrafficVolume & { label: string; entries: number; exits: number }
export type TrafficCatalog = { label: string; views: number; visitors: number; sessions: number; opened: number; leads: number; owner: string | null; ownerType: "BROKER" | "AGENCY" | null }
export type TrafficData = {
  totals: TrafficVolume & { pagesPerSession: number | null; newVisitors: number; returningVisitors: number; entries: number }
  series: Array<TrafficVolume & { bucket: string }>
  surfaces: Array<TrafficRoute>
  routes: TrafficRoute[]
  devices: CountRow[]
  acquisition: Array<{ label: string; source: string; medium: string; referrer: string; sessions: number }>
  marketplace: { views: number; searches: number; opened: number; leads: number; linkedSearches: number; convertedSearches: number; searchRate: number | null; unlinkedOpens: number }
  catalogs: TrafficCatalog[]
  catalogTotals: { views: number; opened: number; leads: number }
  quality: { firstReceivedAt: string | null; lastReceivedAt: string | null; missingPageIdentity: number; missingCatalogId: number; missingSearchIdentity: number; routes: number; catalogs: number; acquisition: number }
}
export type AdminTraffic = { generatedAt: string; filters: TrafficFilters; state: SourceState; ownersState: SourceState; data: TrafficData | null }

export function resolveTrafficFilters(params: URLSearchParams, now = new Date()): TrafficFilters {
  const surface = params.get("surface") ?? "all"
  if (!Object.hasOwn(TRAFFIC_SURFACES, surface)) throw new Error("Superfície inválida.")
  const route = params.get("route") || null
  // Accept only the normalized path shape already stored by Journey, never SQL fragments or query strings.
  if (route && (route.length > 240 || !/^(?:\/|\/(?:[a-z0-9-]+|:id)(?:\/(?:[a-z0-9-]+|:id))*)$/.test(route))) throw new Error("Rota inválida.")
  return { period: resolveOverviewPeriod(params, now), surface: surface as TrafficSurface, route }
}

export function trafficSourceState(data: TrafficData, filters: TrafficFilters, enabled: boolean): SourceState {
  const notes: string[] = []
  if (!enabled) notes.push("Coleta desativada neste servidor; exibindo o histórico recebido.")
  if (!data.quality.firstReceivedAt) notes.push("Ainda não há evidência de cobertura da coleta.")
  else if (Date.parse(data.quality.firstReceivedAt) > Date.parse(filters.period.start)) notes.push("O intervalo começa antes do primeiro evento recebido; não há histórico retroativo.")
  if (data.quality.missingPageIdentity) notes.push(`${data.quality.missingPageIdentity} page views sem identidade completa.`)
  if (data.quality.missingCatalogId) notes.push(`${data.quality.missingCatalogId} eventos de catálogo sem identificador, fora do ranking.`)
  if (data.quality.missingSearchIdentity) notes.push(`${data.quality.missingSearchIdentity} buscas sem vínculo completo, fora da taxa.`)
  return { status: notes.length ? "partial" : "available", note: notes.join(" ") || "Somente Journey Analytics. Coleta best effort, sujeita a bloqueadores e perdas." }
}
