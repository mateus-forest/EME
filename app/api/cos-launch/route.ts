import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth-route"
import { generateCosConversationTitle, isDefaultCosConversationTitle } from "@/lib/cos-conversations"
import { routeCosLaunch } from "@/lib/cos-launch/router"
import type { CosLaunchRequest } from "@/lib/cos-launch/types"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function payload(value: unknown): CosLaunchRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  return {
    conversationId: typeof input.conversationId === "string" ? input.conversationId.trim().slice(0, 100) : undefined,
    message: typeof input.message === "string" ? input.message.slice(0, 3000) : undefined,
    action: typeof input.action === "string" ? input.action.slice(0, 80) : undefined,
    payload: input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? input.payload as Record<string, unknown>
      : undefined,
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser()
  if (auth.error || !auth.user) return auth.error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  if (!auth.user.broker) return NextResponse.json({ error: "Perfil de corretor não encontrado." }, { status: 403 })

  try {
    const input = payload(await request.json())
    if (!input.conversationId) {
      return NextResponse.json({ error: "Conversa não informada." }, { status: 400 })
    }

    const conversation = await prisma.brokerDocument.findFirst({
      where: {
        id: input.conversationId,
        brokerId: auth.user.broker.id,
        type: "cos_conversation",
        status: { not: "archived" },
      },
      select: { id: true, title: true },
    })
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada.", code: "COS_CONVERSATION_NOT_FOUND" },
        { status: 404 },
      )
    }

    const result = await routeCosLaunch({
      brokerId: auth.user.broker.id,
      userId: auth.user.id,
      request: input,
    })
    const displayMessage = input.message?.trim() || "Ação no COS"
    const nextTitle = isDefaultCosConversationTitle(conversation.title)
      ? generateCosConversationTitle(displayMessage)
      : conversation.title
    const actionType = input.action?.trim() || null

    await prisma.$transaction([
      prisma.emeMessage.create({
        data: {
          userId: auth.user.id,
          brokerId: auth.user.broker.id,
          channel: "assessor_eme",
          direction: "broker_to_ai",
          message: displayMessage,
          response: result.message,
          detectedIntent: actionType,
          actionType,
          actionStatus: "success",
          metadata: { conversationId: conversation.id, cosLaunch: true },
        },
      }),
      prisma.brokerDocument.update({
        where: { id: conversation.id },
        data: { title: nextTitle },
      }),
    ])

    return NextResponse.json(result)
  } catch (error) {
    console.error("[cos-launch] request failed", { brokerId: auth.user.broker.id, error })
    return NextResponse.json({ error: "Não foi possível concluir esta operação agora. Tente novamente." }, { status: 500 })
  }
}
