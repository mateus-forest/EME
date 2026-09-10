import { NextResponse } from "next/server"
import { getAuthenticatedUser, ensureRole } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { resolveTrafficFilters } from "@/lib/admin-traffic-contract"
import { getAdminTraffic } from "@/lib/admin-traffic"

export async function GET(request: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden
  let filters
  try { filters = resolveTrafficFilters(new URL(request.url).searchParams) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Filtros inválidos." }, { status: 400 }) }
  return NextResponse.json({ traffic: await getAdminTraffic(filters) }, { headers: { "Cache-Control": "private, no-store" } })
}
