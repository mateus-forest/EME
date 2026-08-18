import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { serializePaymentNotification } from "@/lib/notification-contract"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const includeArchived = request.nextUrl.searchParams.get("history") === "1"
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: includeArchived ? 200 : 50,
    })

    const response = NextResponse.json({
      notifications: notifications.map(serializePaymentNotification),
    })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
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

    const response = NextResponse.json({ ok: true })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
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

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "Solicitação registrada"
    const message = typeof body?.message === "string" && body.message.trim() ? body.message.trim().slice(0, 400) : "Solicitação registrada no portal EME."

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title,
        message,
        read: false,
      },
    })

    return NextResponse.json({ notification: serializePaymentNotification(notification) }, { status: 201 })
  } catch (caughtError) {
    console.error("[api][notifications] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço de notificações está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Erro interno ao criar notificação." }, { status: 500 })
  }
}
