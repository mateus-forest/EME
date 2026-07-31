import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaSchemaMismatch, isPrismaUnavailable, prismaSchemaMismatchResponse } from "@/lib/auth-route"
import { getAdminMonetizationReport } from "@/lib/admin-monetization"
import { UserRole } from "@/lib/prisma-enums"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const report = await getAdminMonetizationReport()
    return NextResponse.json({ report })
  } catch (caughtError) {
    console.error("[api][admin][monetization] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O dashboard de monetização está indisponível no momento. Verifique a conexão com o banco." },
        { status: 503 },
      )
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Dashboard de monetizacao")
    }

    return NextResponse.json({ error: "Erro interno ao carregar o estudo de monetização." }, { status: 500 })
  }
}
