import { NextResponse } from "next/server"

import { getAdminRevenueReport } from "@/lib/admin-revenue"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden
  try {
    return NextResponse.json({ report: await getAdminRevenueReport() })
  } catch (error) {
    console.error("[api][admin][revenue] failed", { message: error instanceof Error ? error.message : "unknown" })
    const stripeUnavailable = error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED"
    return NextResponse.json({ error: stripeUnavailable ? "O Stripe não está configurado neste ambiente." : "Não foi possível consolidar as cobranças reais." }, { status: stripeUnavailable || isPrismaUnavailable(error) ? 503 : 502 })
  }
}
