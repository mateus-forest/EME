import { NextRequest, NextResponse } from "next/server"

import { getAdminAiOperationsReport } from "@/lib/admin-ai-operations"
import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  const requestedPeriod = Number(request.nextUrl.searchParams.get("period") || 365)
  const period = [7, 30, 90, 365].includes(requestedPeriod) ? requestedPeriod : 365

  try {
    return NextResponse.json(await getAdminAiOperationsReport(period))
  } catch (error) {
    console.error("[admin][ai-operations] failed", error)
    return NextResponse.json({ error: "Não foi possível carregar a telemetria de IA." }, { status: 500 })
  }
}
