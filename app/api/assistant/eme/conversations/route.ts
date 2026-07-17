import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { DEFAULT_COS_CONVERSATION_TITLE } from "@/lib/cos-conversations"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

function serializeConversation(document: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  const lastInteractionAt = document.updatedAt.toISOString()

  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    lastInteractionAt,
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })

  try {
    const conversations = await prisma.brokerDocument.findMany({
      where: {
        brokerId: user.broker.id,
        type: "cos_conversation",
        status: { not: "archived" },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ conversations: conversations.map(serializeConversation) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de conversas indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel carregar o historico do COS." }, { status: 500 })
  }
}

export async function POST() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })

  try {
    const conversation = await prisma.brokerDocument.create({
      data: {
        brokerId: user.broker.id,
        type: "cos_conversation",
        title: DEFAULT_COS_CONVERSATION_TITLE,
        content: "",
        status: "active",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ conversation: serializeConversation(conversation) }, { status: 201 })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de conversas indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel criar a conversa." }, { status: 500 })
  }
}
