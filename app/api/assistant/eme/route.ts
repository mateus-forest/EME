import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  cleanText,
  generateAssessorText,
  getPendingAssessorContext,
  resolveAssessorInputWithContext,
  runAssessorAction,
  type AssessorAction,
} from "@/lib/eme-backend"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function creditsResponse(broker: { aiCreditsBalance: number; aiAssistantEnabled: boolean; aiCreditsUsedThisMonth: number }) {
  return {
    credits: {
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
    },
    aiAssistantEnabled: broker.aiAssistantEnabled,
  }
}

async function getBrokerCredits(brokerId: string) {
  return prisma.broker.findUnique({
    where: { id: brokerId },
    select: {
      aiCreditsBalance: true,
      aiAssistantEnabled: true,
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

function getVisualActionLabel(action: AssessorAction) {
  if (action === "createLead") return "Lead cadastrado"
  if (action === "searchProperties") return "Busca de imóveis"
  if (action === "getFinancialSummary") return "Consulta financeira"
  if (action === "getCatalogSummary") return "Resumo do catálogo"
  if (action === "getLeadsSummary") return "Resumo de leads"
  if (action === "createPropertyDraft") return "Rascunho de imóvel"
  if (action === "improvePropertyDescription") return "Descrição melhorada"
  if (action === "summarizeLead") return "Resumo de leads"
  if (action === "analyzeCatalog") return "Catálogo analisado"
  if (action === "getAnalyticsSummary") return "Consulta de analytics"
  if (action === "CREATE_AGENDA_EVENT") return "Compromisso criado"
  if (action === "LIST_AGENDA_EVENTS") return "Consulta de agenda"
  if (action === "MARK_AGENDA_DONE") return "Compromisso concluído"
  if (action === "CREATE_PROPOSAL") return "Proposta gerada"
  if (action === "LIST_DOCUMENTS") return "Consulta de documentos"
  if (action === "GET_DOCUMENT") return "Documento consultado"
  return "Ação do Assessor"
}

function shouldReturnActionResponse(action: AssessorAction) {
  return [
    "createLead",
    "searchProperties",
    "createPropertyDraft",
    "CREATE_AGENDA_EVENT",
    "LIST_AGENDA_EVENTS",
    "MARK_AGENDA_DONE",
    "CREATE_PROPOSAL",
    "LIST_DOCUMENTS",
    "GET_DOCUMENT",
    "getFinancialSummary",
    "getAnalyticsSummary",
    "getCatalogSummary",
    "getLeadsSummary",
    "analyzeCatalog",
    "summarizeLead",
  ].includes(action)
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
          creditsUsed: true,
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
      ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: false }),
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

export async function PATCH(request: NextRequest) {
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
  if (typeof body?.aiAssistantEnabled !== "boolean") {
    return NextResponse.json({ error: "Informe o status do Assessor EME." }, { status: 400 })
  }

  try {
    const broker = await prisma.broker.update({
      where: { id: user.broker.id },
      data: { aiAssistantEnabled: body.aiAssistantEnabled },
      select: {
        aiCreditsBalance: true,
        aiAssistantEnabled: true,
        aiCreditsUsedThisMonth: true,
      },
    })

    return NextResponse.json(creditsResponse(broker))
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Assessor EME está indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível atualizar o Assessor EME." }, { status: 500 })
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
  const creditsUsed = 1

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para o Assessor EME." }, { status: 400 })
  }

  try {
    const brokerState = await prisma.broker.findUnique({
      where: { id: user.broker.id },
      select: { aiAssistantEnabled: true, aiCreditsBalance: true },
    })

    if (!brokerState?.aiAssistantEnabled) {
      return NextResponse.json({ error: "Seu Assessor EME está desativado no momento." }, { status: 403 })
    }

    if (brokerState.aiCreditsBalance < creditsUsed) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          error: "Você atingiu o limite de créditos do Assessor EME do seu plano. Adquira créditos adicionais no painel para continuar utilizando.",
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }
    const pendingContext = await getPendingAssessorContext(user.broker.id)
    const resolvedInput = resolveAssessorInputWithContext({
      message,
      requestedAction: cleanText(body?.action ?? body?.actionType, 80),
      pendingContext,
    })
    const action = resolvedInput.action as AssessorAction

    let actionResult: Awaited<ReturnType<typeof runAssessorAction>> = { response: "", metadata: {} }
    let responseText = ""
    let actionStatus = "processing"
    let errorMessage: string | null = null
    let finalCreditsUsed = creditsUsed
    const actionStartedAt = Date.now()

    try {
      actionResult = await runAssessorAction({
        brokerId: user.broker.id,
        userId: user.id,
        message,
        action,
        confirm: Boolean(body?.confirm),
        payload: {
          ...(typeof body?.payload === "object" && body.payload ? body.payload : {}),
          ...resolvedInput.payload,
        },
      })
      actionStatus =
        Array.isArray(actionResult.metadata?.required) && actionResult.metadata.required.length > 0
          ? "processing"
          : actionResult.response.includes("preciso de confirmação") || actionResult.response.includes("confirmação")
            ? "processing"
            : "success"
      if ((actionResult.metadata as { noCharge?: boolean } | undefined)?.noCharge === true) {
        finalCreditsUsed = 0
      }
      if (finalCreditsUsed > 0) {
        await prisma.broker.update({
          where: { id: user.broker.id },
          data: {
            aiCreditsBalance: { decrement: finalCreditsUsed },
            aiCreditsUsedThisMonth: { increment: finalCreditsUsed },
            aiMonthlyUsage: { increment: finalCreditsUsed },
            aiLastInteractionAt: new Date(),
          },
        })
      }
      responseText = shouldReturnActionResponse(action) ? actionResult.response : await generateAssessorText(message, action, actionResult.response)
      console.info("[api][assistant][eme][action]", {
        detectedIntent: action,
        executedAction: action,
        actionStatus,
        brokerId: user.broker.id,
        leadId: actionResult.leadId ?? null,
        propertySearchFilters: actionResult.metadata?.propertySearchFilters ?? null,
        visualAction: getVisualActionLabel(action),
        durationMs: Date.now() - actionStartedAt,
      })
    } catch (caughtActionError) {
      actionStatus = "error"
      errorMessage = caughtActionError instanceof Error ? caughtActionError.message : "Erro na ação interna."
      responseText = "Não consegui concluir essa ação agora. Registrei o erro para acompanhamento interno."
      finalCreditsUsed = 0
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Erro no Assessor EME",
          message: errorMessage,
          read: false,
        },
      })
    }

    const actionMetadata = (actionResult.metadata ?? {}) as Prisma.InputJsonObject
    const interactionMetadata = {
      ...actionMetadata,
      source: "portal",
      parsedIntent: action,
      actionName: action,
      brokerId: user.broker.id,
      durationMs: Date.now() - actionStartedAt,
      visualAction: getVisualActionLabel(action),
    } as Prisma.InputJsonObject

    const [updatedBroker] = await Promise.all([
      getBrokerCredits(user.broker.id),
      prisma.aiAssistantInteraction.create({
        data: {
          userId: user.id,
          brokerId: user.broker.id,
          prompt: message,
          response: responseText,
          actionType: action,
          creditsUsed: finalCreditsUsed,
          channel: "assessor_eme",
          intent: action,
          actionStatus,
          metadata: interactionMetadata,
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
          metadata: interactionMetadata,
          errorMessage,
          creditsUsed: finalCreditsUsed,
          leadId: actionResult.leadId ?? null,
          propertyId: actionResult.propertyId ?? null,
        },
      }),
    ])

    return NextResponse.json({
      response: responseText,
      action,
      actionStatus,
      metadata: interactionMetadata,
      creditsUsed: finalCreditsUsed,
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
