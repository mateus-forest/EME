import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  cleanText,
  generateAssessorText,
  inferAssessorAction,
  runAssessorAction,
  type AssessorAction,
} from "@/lib/eme-backend"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function creditsResponse(broker: { aiCreditsBalance: number; aiCreditsUsedThisMonth: number }) {
  return {
    credits: {
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
    },
  }
}

async function getBrokerCredits(brokerId: string) {
  return prisma.broker.findUnique({
    where: { id: brokerId },
    select: {
      aiCreditsBalance: true,
      aiCreditsUsedThisMonth: true,
    },
  })
}

function serializeAssessorConfig(config: {
  officialNumber: string | null
  displayName: string | null
  status: string
  internalInstructions: string | null
  webhookStatus: string
} | null) {
  return {
    officialNumber: config?.officialNumber ?? "",
    displayName: config?.displayName ?? "",
    status: config?.status ?? "IN_PREPARATION",
    internalInstructions: config?.internalInstructions ?? "",
    webhookStatus: config?.webhookStatus ?? "NOT_CONFIGURED",
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  try {
    const brokerCredits = await getBrokerCredits(user.broker.id)
    const [history, assessorConfig] = await Promise.all([
      prisma.emeMessage.findMany({
        where: { brokerId: user.broker.id, channel: "assessor_eme" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          message: true,
          response: true,
          detectedIntent: true,
          actionType: true,
          actionStatus: true,
          createdAt: true,
        },
      }),
      prisma.assessorEmeConfig.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          officialNumber: true,
          displayName: true,
          status: true,
          internalInstructions: true,
          webhookStatus: true,
        },
      }),
    ])

    return NextResponse.json({
      ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 } }),
      assessorConfig: serializeAssessorConfig(assessorConfig),
      history: history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Assessor EME está indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível carregar o Assessor EME." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const message = cleanText(body?.message ?? body?.prompt, 3000)
  const action = inferAssessorAction(message, cleanText(body?.action ?? body?.actionType, 80)) as AssessorAction
  const creditsUsed = 1

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para o Assessor EME." }, { status: 400 })
  }

  try {
    const reserved = await prisma.broker.updateMany({
      where: {
        id: user.broker.id,
        aiCreditsBalance: { gte: creditsUsed },
      },
      data: {
        aiCreditsBalance: { decrement: creditsUsed },
        aiCreditsUsedThisMonth: { increment: creditsUsed },
      },
    })

    if (reserved.count === 0) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          error: "Créditos insuficientes para usar o Assessor EME.",
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 } }),
        },
        { status: 402 },
      )
    }

    let actionResult: Awaited<ReturnType<typeof runAssessorAction>> = { response: "", metadata: {} }
    let responseText = ""
    let actionStatus = "completed"
    let errorMessage: string | null = null

    try {
      actionResult = await runAssessorAction({
        brokerId: user.broker.id,
        userId: user.id,
        message,
        action,
        confirm: Boolean(body?.confirm),
        payload: typeof body?.payload === "object" && body.payload ? body.payload : {},
      })
      actionStatus = actionResult.response.includes("preciso de confirmação") || actionResult.response.includes("preciso de confirmação") ? "needs_confirmation" : "completed"
      responseText = await generateAssessorText(message, action, actionResult.response)
    } catch (caughtActionError) {
      actionStatus = "error"
      errorMessage = caughtActionError instanceof Error ? caughtActionError.message : "Erro na ação interna."
      responseText = "Não consegui concluir essa ação agora. Registrei o erro para acompanhamento interno."
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Erro no Assessor EME",
          message: errorMessage,
          read: false,
        },
      })
    }

    const [updatedBroker] = await Promise.all([
      getBrokerCredits(user.broker.id),
      prisma.aiAssistantInteraction.create({
        data: {
          userId: user.id,
          brokerId: user.broker.id,
          prompt: message,
          response: responseText,
          actionType: action,
          creditsUsed,
          channel: "assessor_eme",
          intent: action,
          actionStatus,
          metadata: actionResult.metadata,
          errorMessage,
          leadId: actionResult.leadId ?? null,
          propertyId: actionResult.propertyId ?? null,
        },
      }),
      prisma.emeMessage.create({
        data: {
          userId: user.id,
          brokerId: user.broker.id,
          channel: "assessor_eme",
          direction: "broker_to_ai",
          message,
          response: responseText,
          detectedIntent: action,
          actionType: action,
          actionStatus,
          metadata: actionResult.metadata,
          errorMessage,
          creditsUsed,
          leadId: actionResult.leadId ?? null,
          propertyId: actionResult.propertyId ?? null,
        },
      }),
    ])

    return NextResponse.json({
      response: responseText,
      action,
      actionStatus,
      metadata: actionResult.metadata,
      creditsUsed,
      ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 } }),
    })
  } catch (caughtError) {
    console.error("[api][assistant][eme] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Assessor EME está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível acionar o Assessor EME agora." }, { status: 500 })
  }
}
