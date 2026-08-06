import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { cleanCosConversationTitle, DEFAULT_COS_CONVERSATION_TITLE } from "@/lib/cos-conversations"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ConversationMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  state: "ready" | "error"
  action?: string | null
  actionStatus?: string | null
  confirmRequired?: boolean
  options?: Array<{ id: string; actionId?: string; label: string; description?: string; action?: string; message?: string; selectedOptionId?: string; href?: string }>
  attachments?: PendingConfirmationAttachment[]
  sourceMessage?: string
  sourceInteractionId?: string
  createdAt: string
}

type PendingConfirmationAttachment = {
  id: string
  name: string
  type: string
  size: number
  category: "image" | "document" | "video" | "files"
  dataUrl?: string
  textContent?: string
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  return typeof metadata[key] === "string" ? metadata[key] as string : ""
}

function metadataBoolean(metadata: Record<string, unknown>, key: string) {
  return metadata[key] === true
}

function metadataAttachments(metadata: Record<string, unknown>) {
  const value = metadata.attachments
  if (!Array.isArray(value)) return [] as PendingConfirmationAttachment[]

  return value
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item): PendingConfirmationAttachment => {
      const category =
        item.category === "image" || item.category === "document" || item.category === "video" || item.category === "files"
          ? item.category
          : "files"

      return {
        id: typeof item.id === "string" ? item.id : "",
        name: typeof item.name === "string" ? item.name : "",
        type: typeof item.type === "string" ? item.type : "application/octet-stream",
        size: typeof item.size === "number" ? item.size : 0,
        category,
        dataUrl: typeof item.dataUrl === "string" ? item.dataUrl : undefined,
        textContent: typeof item.textContent === "string" ? item.textContent : undefined,
      }
    })
    .filter((item) => item.id && item.name)
}

function metadataOptions(metadata: Record<string, unknown>) {
  const directValue = metadata.options
  const parsedData = metadataRecord(metadata.parsedData)
  const value = Array.isArray(directValue) ? directValue : parsedData.options
  if (!Array.isArray(value)) {
    return [] as Array<{ id: string; actionId?: string; label: string; description?: string; action?: string; message?: string; selectedOptionId?: string; href?: string }>
  }

  return value
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      actionId: typeof item.actionId === "string" ? item.actionId : undefined,
      label: typeof item.label === "string" ? item.label : "",
      description: typeof item.description === "string" ? item.description : undefined,
      action: typeof item.action === "string" ? item.action : undefined,
      message: typeof item.message === "string" ? item.message : undefined,
      selectedOptionId: typeof item.selectedOptionId === "string" ? item.selectedOptionId : undefined,
      href: typeof item.href === "string" ? item.href : undefined,
    }))
    .filter((item) => item.id && item.label)
}

function serializeConversation(document: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    lastInteractionAt: document.updatedAt.toISOString(),
  }
}

function mapConversationMessages(rows: Array<{
  id: string
  message: string
  response: string | null
  actionType: string | null
  actionStatus: string | null
  metadata: unknown
  createdAt: Date
}>): {
  messages: ConversationMessage[]
  pendingConfirmation: {
    action: string
    sourceMessage: string
    sourceInteractionId: string
    attachments?: PendingConfirmationAttachment[]
    options?: Array<{ id: string; actionId?: string; label: string; description?: string; action?: string; message?: string; selectedOptionId?: string; href?: string }>
  } | null
} {
  const messages: ConversationMessage[] = []
  let pendingConfirmation: {
    action: string
    sourceMessage: string
    sourceInteractionId: string
    attachments?: PendingConfirmationAttachment[]
    options?: Array<{ id: string; actionId?: string; label: string; description?: string; action?: string; message?: string; selectedOptionId?: string; href?: string }>
  } | null = null

  for (const row of rows) {
    const metadata = metadataRecord(row.metadata)
    const displayMessage = metadataText(metadata, "displayMessage") || row.message
    const confirmRequired = metadataBoolean(metadata, "confirmationRequired") && row.actionStatus === "needs_confirmation"
    const attachments = metadataAttachments(metadata)
    const options = metadataOptions(metadata)
    const createdAt = row.createdAt.toISOString()

    if (displayMessage) {
      messages.push({
        id: `${row.id}:user`,
        role: "user",
        content: displayMessage,
        state: "ready",
        attachments,
        createdAt,
      })
    }

    if (row.response) {
      messages.push({
        id: `${row.id}:assistant`,
        role: "assistant",
        content: row.response,
        state: row.actionStatus === "error" ? "error" : "ready",
        action: row.actionType,
        actionStatus: row.actionStatus,
        confirmRequired,
        options,
        sourceMessage: row.message,
        sourceInteractionId: row.id,
        createdAt,
      })
    }

    if (confirmRequired && row.actionType) {
      pendingConfirmation = {
        action: row.actionType,
        sourceMessage: row.message,
        sourceInteractionId: row.id,
        attachments,
        options,
      }
    }

    if (row.actionStatus === "cancelled" || row.actionStatus === "success" || row.actionStatus === "error") {
      pendingConfirmation = null
    }
  }

  return { messages, pendingConfirmation }
}

async function getConversationOrError(id: string) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { error: error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 }), user: null, conversation: null }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return { error: forbidden, user: null, conversation: null }
  if (!user.broker) return { error: NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 }), user: null, conversation: null }

  const conversation = await prisma.brokerDocument.findFirst({
    where: {
      id,
      brokerId: user.broker.id,
      type: "cos_conversation",
      status: { not: "archived" },
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })

  if (!conversation) {
    return { error: NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 }), user: null, conversation: null }
  }

  return { error: null, user, conversation }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    const resolved = await getConversationOrError(id)
    if (resolved.error) return resolved.error
    if (!resolved.conversation || !resolved.user?.broker) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 })
    }

    const rows = await prisma.emeMessage.findMany({
      where: {
        brokerId: resolved.user.broker.id,
        channel: "assessor_eme",
        metadata: {
          path: ["conversationId"],
          equals: id,
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        message: true,
        response: true,
        actionType: true,
        actionStatus: true,
        metadata: true,
        createdAt: true,
      },
    })

    const mapped = mapConversationMessages(rows)

    return NextResponse.json({
      conversation: serializeConversation(resolved.conversation),
      messages: mapped.messages,
      pendingConfirmation: mapped.pendingConfirmation,
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de conversas indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível abrir a conversa." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    const resolved = await getConversationOrError(id)
    if (resolved.error) return resolved.error
    if (!resolved.conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const title = cleanCosConversationTitle(body?.title)

    if (!title) {
      return NextResponse.json({ error: "Informe um título para a conversa." }, { status: 400 })
    }

    const conversation = await prisma.brokerDocument.update({
      where: { id: resolved.conversation.id },
      data: { title: title || DEFAULT_COS_CONVERSATION_TITLE },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json({ conversation: serializeConversation(conversation) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de conversas indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível renomear a conversa." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  try {
    const resolved = await getConversationOrError(id)
    if (resolved.error) return resolved.error
    if (!resolved.conversation || !resolved.user?.broker) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.emeMessage.deleteMany({
        where: {
          brokerId: resolved.user.broker.id,
          channel: "assessor_eme",
          metadata: {
            path: ["conversationId"],
            equals: id,
          },
        },
      }),
      prisma.aiAssistantInteraction.deleteMany({
        where: {
          brokerId: resolved.user.broker.id,
          channel: "assessor_eme",
          metadata: {
            path: ["conversationId"],
            equals: id,
          },
        },
      }),
      prisma.brokerDocument.delete({
        where: { id: resolved.conversation.id },
      }),
    ])

    return NextResponse.json({ deleted: true })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de conversas indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível excluir a conversa." }, { status: 500 })
  }
}
