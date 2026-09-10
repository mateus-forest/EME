import "server-only"
import { Pool } from "pg"
import { prisma } from "@/lib/prisma"
import { adminBillingPlanSelect, loadAdminUserBillings } from "@/lib/admin-billing"
import { ADMIN_JOURNEY_SQL } from "@/lib/admin-journey-sql"
import { journeySourceState, type AdminJourneyOverview, type JourneyOverviewData, type OverviewPeriod } from "@/lib/admin-journey-contract"
import type { BillingResolution } from "@/lib/billing-resolution"

const state = globalThis as unknown as { adminJourneyReadPool?: Pool }
function readPool() {
  if (!process.env.DATABASE_URL) throw new Error("Overview storage unavailable")
  if (!state.adminJourneyReadPool) {
    state.adminJourneyReadPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 4000, idleTimeoutMillis: 30000, statement_timeout: 8000, query_timeout: 10000, allowExitOnIdle: true })
    state.adminJourneyReadPool.on("error", () => console.warn("[admin-journey] read connection unavailable"))
  }
  return state.adminJourneyReadPool
}
export async function readJourneyOverview(period: OverviewPeriod): Promise<JourneyOverviewData> {
  const result = await readPool().query(ADMIN_JOURNEY_SQL, [period.start, period.end, period.key === "today" ? "hour" : "day"])
  if (!result.rows[0]?.data) throw new Error("Overview returned no aggregate")
  return result.rows[0].data
}
async function readRegistrations(period: OverviewPeriod): Promise<number> {
  const result = await readPool().query(`SELECT count(*)::int AS count FROM "User" WHERE role IN ('BROKER','AGENCY') AND "createdAt">=($1::timestamptz AT TIME ZONE 'UTC') AND "createdAt"<($2::timestamptz AT TIME ZONE 'UTC')`, [period.start, period.end])
  return result.rows[0].count
}
async function readSubscriberResolutions() {
  const users = await prisma.user.findMany({ where: { role: { in: ["BROKER", "AGENCY"] } }, select: {
    id: true, role: true, plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true,
    broker: { select: { id: true, planAccount: { select: adminBillingPlanSelect } } }, ownedAgency: { select: { id: true } },
  } })
  return [...(await loadAdminUserBillings(users)).values()]
}
export function summarizeOverviewSubscribers(resolutions: readonly BillingResolution[]) {
  const pending = resolutions.filter(r => r.presentationStatus === "Pendente de conciliação").length
  const count = resolutions.filter(r => (r.contractedPlan === "pro" || r.contractedPlan === "scale") && ["Ativa", "Cancelando"].includes(r.presentationStatus) && !r.trial.kind && r.originalStatus?.toLowerCase() === "active").length
  const trial = resolutions.filter(r => r.presentationStatus === "Trial").length
  return { count, pending, trial }
}
type OverviewReaders = {
  journey: (period: OverviewPeriod) => Promise<JourneyOverviewData>
  registrations: (period: OverviewPeriod) => Promise<number>
  subscribers: () => Promise<readonly BillingResolution[]>
}
/** Failures stay isolated by source. Never substitute zero for a failed read. */
export async function getAdminJourneyOverview(period: OverviewPeriod, readers: OverviewReaders = { journey: readJourneyOverview, registrations: readRegistrations, subscribers: readSubscriberResolutions }): Promise<AdminJourneyOverview> {
  const generatedAt = new Date().toISOString()
  const results = await Promise.allSettled([readers.journey(period), readers.registrations(period), readers.subscribers()])
  const [journey, registrations, subscribers] = results
  const subscriberCounts = subscribers.status === "fulfilled" ? summarizeOverviewSubscribers(subscribers.value) : null
  for (const [index, result] of results.entries()) if (result.status === "rejected") console.warn("[admin-journey] source unavailable", { source: ["journey", "registrations", "subscribers"][index] })
  const asOf = new Date().toISOString()
  return {
    generatedAt, period,
    journey: journey.status === "fulfilled" ? { state: journeySourceState(journey.value, period, process.env.JOURNEY_ANALYTICS_ENABLED === "true"), data: journey.value } : { state: { status: "unavailable", note: "Journey indisponível. Os totais não puderam ser consultados." }, data: null },
    registrations: registrations.status === "fulfilled" ? { state: { status: "available", note: "Contas de corretor/imobiliária criadas no banco durante o período, independentemente da coleta." }, count: registrations.value } : { state: { status: "unavailable", note: "Não foi possível consultar as contas criadas." }, count: null },
    subscribers: subscriberCounts ? { ...subscriberCounts, asOf, state: { status: subscriberCounts.pending ? "partial" : "available", note: `Estimativa do estado local atual pelo resolvedor existente, sem consulta Stripe ao vivo. ${subscriberCounts.pending} contas pendentes de conciliação ficam fora do total; ${subscriberCounts.trial} em trial também ficam fora. Não é uma série histórica de assinaturas.` } } : { count: null, pending: null, trial: null, asOf, state: { status: "unavailable", note: "Resolvedor de assinaturas indisponível nesta leitura." } },
  }
}
