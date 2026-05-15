import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { serializePaymentNotification } from "@/lib/notification-contract"
import { prisma } from "@/lib/prisma"

async function getOwnedNotification(id: string, userId: string) {
  return prisma.notification.findFirst({
    where: {
      id,
      userId,
    },
  })
}

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { id } = await params
    const notification = await getOwnedNotification(id, user.id)

    if (!notification) {
      return NextResponse.json({ error: "Notificação não encontrada para este usuário." }, { status: 404 })
    }

    const updated = await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        read: true,
      },
    })

    const response = NextResponse.json({ notification: serializePaymentNotification(updated) })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][notifications][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de notificações está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar notificação." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const { id } = await params
    const notification = await getOwnedNotification(id, user.id)

    if (!notification) {
      return NextResponse.json({ error: "Notificação não encontrada para este usuário." }, { status: 404 })
    }

    const updated = await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        read: true,
        archivedAt: new Date(),
      },
    })

    const response = NextResponse.json({ notification: serializePaymentNotification(updated) })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][notifications][id] archive failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de notificações está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao arquivar notificação." }, { status: 500 })
  }
}
