import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  AdminInsightsDatabaseUnavailableError,
  assertAdminInsightsDatabaseReady,
  getAdminMasterInsights,
} from "@/lib/admin-master-insights"
import { UserRole } from "@/lib/prisma-enums"

export async function GET() {
  const requestStartedAt = Date.now()
  try {
    await assertAdminInsightsDatabaseReady()
  } catch (databaseError) {
    console.error("[api][admin][insights][database-unavailable]", {
      durationMs: Date.now() - requestStartedAt,
      message: databaseError instanceof Error ? databaseError.message : "unknown",
    })
    return NextResponse.json(
      { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
      { status: 503 },
    )
  }

  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const insights = await getAdminMasterInsights()
    console.info("[api][admin][insights][completed]", {
      durationMs: Date.now() - requestStartedAt,
      unavailableBlocks: insights.alerts.items
        .filter((item) => item.id === "dashboard-partial-data")
        .map((item) => item.description),
    })
    const unavailableBlocks = insights.alerts.items
      .filter((item) => item.id === "dashboard-partial-data")
      .map((item) => item.description)
    return NextResponse.json({
      insights,
      diagnostics: {
        partial: unavailableBlocks.length > 0,
        unavailableBlocks,
        durationMs: Date.now() - requestStartedAt,
      },
    })
  } catch (caughtError) {
    console.error("[api][admin][insights] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (caughtError instanceof AdminInsightsDatabaseUnavailableError || isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao carregar os dashboards administrativos." }, { status: 500 })
  }
}
