import "server-only"
import { Pool } from "pg"
import { ADMIN_TRAFFIC_SQL, ADMIN_TRAFFIC_OWNERS_SQL } from "@/lib/admin-traffic-sql"
import { trafficSourceState, type AdminTraffic, type TrafficData, type TrafficFilters } from "@/lib/admin-traffic-contract"

const state = globalThis as unknown as { adminTrafficPool?: Pool }
function readPool() {
  if (!process.env.DATABASE_URL) throw new Error("Traffic storage unavailable")
  if (!state.adminTrafficPool) {
    state.adminTrafficPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 4000, idleTimeoutMillis: 30000, statement_timeout: 8000, query_timeout: 10000, allowExitOnIdle: true })
    state.adminTrafficPool.on("error", () => console.warn("[admin-traffic] read connection unavailable"))
  }
  return state.adminTrafficPool
}
export async function readAdminTraffic(filters: TrafficFilters): Promise<TrafficData> {
  const { period, surface, route } = filters
  const result = await readPool().query(ADMIN_TRAFFIC_SQL, [period.start, period.end, period.from === period.to ? "hour" : "day", surface, route])
  if (!result.rows[0]?.data) throw new Error("Traffic returned no aggregate")
  return result.rows[0].data
}
type Owner = { slug: string; owner: string; ownerType: "BROKER" | "AGENCY" }
async function readOwners(slugs: string[]): Promise<Owner[]> {
  return slugs.length ? (await readPool().query(ADMIN_TRAFFIC_OWNERS_SQL, [slugs])).rows : []
}
type Readers = { traffic: (filters: TrafficFilters) => Promise<TrafficData>; owners: (slugs: string[]) => Promise<Owner[]> }
export async function getAdminTraffic(filters: TrafficFilters, readers: Readers = { traffic: readAdminTraffic, owners: readOwners }): Promise<AdminTraffic> {
  const generatedAt = new Date().toISOString()
  let data: TrafficData
  try { data = await readers.traffic(filters) }
  catch {
    console.warn("[admin-traffic] aggregates unavailable")
    return { generatedAt, filters, data: null, state: { status: "unavailable", note: "Não foi possível consultar Journey Analytics. Totais indisponíveis." }, ownersState: { status: "unavailable", note: "Identificação não consultada." } }
  }
  let ownersState: AdminTraffic["ownersState"] = { status: "available", note: "Proprietário atual do catálogo; não é o visitante nem o autor da atividade." }
  try {
    const owners = await readers.owners(data.catalogs.map(row => row.label))
    data = { ...data, catalogs: data.catalogs.map(row => {
      const matches = owners.filter(owner => owner.slug === row.label)
      // Ambiguous/deleted/renamed slug stays unassigned, never guess ownership.
      return { ...row, owner: matches.length === 1 ? matches[0].owner : null, ownerType: matches.length === 1 ? matches[0].ownerType : null }
    }) }
    if (data.catalogs.some(row => !row.owner)) ownersState = { status: "partial", note: "Alguns slugs não têm um proprietário atual inequívoco. Os eventos continuam no ranking." }
  } catch { ownersState = { status: "unavailable", note: "Identificação dos proprietários indisponível; os totais Journey continuam válidos." } }
  return { generatedAt, filters, data, state: trafficSourceState(data, filters, process.env.JOURNEY_ANALYTICS_ENABLED === "true"), ownersState }
}
