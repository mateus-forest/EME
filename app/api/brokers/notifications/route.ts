import { NextRequest, NextResponse } from "next/server"
import { UserRole, type Notification } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(notification.createdAt),
    financialStatus: "notificacao-recebida",
    category: "aviso-administrativo",
    lida: notification.read,
    priority: "media",
    contextMessage: notification.message,
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    })

    return NextResponse.json({
      notifications: notifications.map(serializeNotification),
    })
  } catch (caughtError) {
    console.error("[api][brokers][notifications] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de notificações está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar notificações do corretor." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => null)
    const id = typeof body?.id === "string" ? body.id : ""

    if (!id) {
      return NextResponse.json({ error: "Notificação não informada." }, { status: 400 })
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!notification) {
      return NextResponse.json({ error: "Notificação não encontrada para este corretor." }, { status: 404 })
    }

    const updated = await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        read: true,
      },
    })

    return NextResponse.json({ notification: serializeNotification(updated) })
  } catch (caughtError) {
    console.error("[api][brokers][notifications] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de notificações está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar notificação do corretor." }, { status: 500 })
  }
}
