import { NextRequest, NextResponse } from "next/server"
import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { getAdminStripeBillingReport } from "@/lib/admin-stripe-billing"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, ["ADMIN"])
  if (forbidden) return forbidden
  const headers = { "Cache-Control": "private, no-store" }
  try {
    const { id } = await context.params
    const report = await getAdminStripeBillingReport(id)
    if (!report) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404, headers })
    return NextResponse.json(report, { headers })
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir a verificação de billing. Nenhum registro foi alterado." }, { status: 503, headers })
  }
}
