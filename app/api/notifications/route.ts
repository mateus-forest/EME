import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { serializePaymentNotification } from "@/lib/notification-contract"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    })

    return NextResponse.json({
      notifications: notifications.map(serializePaymentNotification),
    })
  } catch (caughtError) {
    console.error("[api][notifications] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de notificações está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar notificações." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)

    if (body?.action !== "read-all") {
      return NextResponse.json({ error: "Ação inválida para notificações." }, { status: 400 })
    }

    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        archivedAt: null,
      },
      data: {
        read: true,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (caughtError) {
    console.error("[api][notifications] mark all failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de notificações está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar notificações." }, { status: 500 })
  }
}
