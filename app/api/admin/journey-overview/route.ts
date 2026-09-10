import { NextResponse } from "next/server"
import { getAuthenticatedUser, ensureRole } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { resolveOverviewPeriod } from "@/lib/admin-journey-contract"
import { getAdminJourneyOverview } from "@/lib/admin-journey-overview"

export async function GET(request: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden
  let period
  try { period = resolveOverviewPeriod(new URL(request.url).searchParams) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Período inválido." }, { status: 400 }) }
  return NextResponse.json({ overview: await getAdminJourneyOverview(period) }, { headers: { "Cache-Control": "private, no-store" } })
}
