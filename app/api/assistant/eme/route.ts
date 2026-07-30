import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  DEFAULT_COS_CONVERSATION_TITLE,
  generateCosConversationTitle,
  isDefaultCosConversationTitle,
} from "@/lib/cos-conversations"
import {
  cleanText,
  getAssessorActionErrorResponse,
  getPendingAssessorContext,
  type AssessorAction,
} from "@/lib/eme-backend"
import {
  doesCosCapabilityMutateData,
  executeCosCapability,
  formatCosCapabilityResponse,
  getCosCapabilityActionsForSurface,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityLabel,
  isCosCapabilityAvailableOnSurface,
  planCosCapability,
  type CosActionResult,
} from "@/lib/cos"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, getBrokerAiCreditBalance } from "@/lib/eme-plan-service"
import { getEmeCreditCost } from "@/lib/eme-plans"
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
  const [broker, credits] = await Promise.all([
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: { aiAssistantEnabled: true },
    }),
    getBrokerAiCreditBalance(brokerId),
  ])

  return broker
    ? {
        aiCreditsBalance: credits.balance,
        aiAssistantEnabled: broker.aiAssistantEnabled,
        aiCreditsUsedThisMonth: credits.usedThisMonth,
      }
    : null
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

function serializeConversation(document: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  const iso = document.updatedAt.toISOString()

  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt.toISOString(),
    updatedAt: iso,
    lastInteractionAt: iso,
  }
}

function isCosHomeSource(source: string) {
  return source === "cos_home"
}

function buildCosHomeUnsupportedResponse() {
  return [
    "Na Home do COS eu posso ajudar com:",
    "buscar imovel, cadastrar imovel, cadastrar cliente, criar proposta, criar contrato, abrir contratos, agendar ou consultar compromissos, analisar clientes, consultar desempenho, analisar financeiro e consultar notificacoes.",
  ].join("\n")
}

function buildCosHomeConfirmationResponse(action: AssessorAction) {
  return getCosCapabilityConfirmationMessage(action)
}

async function touchCosConversation(input: {
  conversation: { id: string; title: string } | null
  message: string
}) {
  if (!input.conversation) return null

  const shouldPromoteTitle = isDefaultCosConversationTitle(input.conversation.title)

  return prisma.brokerDocument.update({
    where: { id: input.conversation.id },
    data: shouldPromoteTitle ? { title: generateCosConversationTitle(input.message) } : {},
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })
}

async function resolveCosConversation(brokerId: string, conversationId: string) {
  return prisma.brokerDocument.findFirst({
    where: {
      id: conversationId,
      brokerId,
      type: "cos_conversation",
      status: { not: "archived" },
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
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
      return NextResponse.json({ error: "O servico do Assessor EME esta indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel carregar o Assessor EME." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
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
      return NextResponse.json({ error: "O servico do Assessor EME esta indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel atualizar o Assessor EME." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const message = cleanText(body?.message ?? body?.prompt, 3000)
  const source = cleanText(body?.source, 80)
  const conversationIdFromBody = cleanText(body?.conversationId, 80)
  const displayMessage = cleanText(body?.displayMessage, 3000) || message
  const isCancellation = Boolean(body?.cancel)
  let creditsUsed = 1

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para o Assessor EME." }, { status: 400 })
  }

  try {
    const fromCosHome = isCosHomeSource(source)
    const metadataSource = fromCosHome ? "portal_cos_home" : "portal"
    let conversationDocument:
      | {
          id: string
          title: string
          createdAt: Date
          updatedAt: Date
        }
      | null = null

    if (fromCosHome) {
      if (conversationIdFromBody) {
        conversationDocument = await resolveCosConversation(user.broker.id, conversationIdFromBody)
        if (!conversationDocument) {
          return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
        }
      } else {
        conversationDocument = await prisma.brokerDocument.create({
          data: {
            brokerId: user.broker.id,
            type: "cos_conversation",
            title: DEFAULT_COS_CONVERSATION_TITLE,
            content: "",
            status: "active",
          },
          select: { id: true, title: true, createdAt: true, updatedAt: true },
        })
      }
    }

    const brokerState = await prisma.broker.findUnique({
      where: { id: user.broker.id },
      select: { aiAssistantEnabled: true, aiCreditsBalance: true },
    })

    if (!brokerState) {
      return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })
    }

    if (!brokerState?.aiAssistantEnabled && !isCancellation) {
      return NextResponse.json({ error: "Seu Assessor EME esta desativado no momento." }, { status: 403 })
    }

    if (brokerState.aiCreditsBalance < creditsUsed && !isCancellation) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          error: "Voce atingiu o limite de creditos do Assessor EME do seu plano. Adquira creditos adicionais no painel para continuar utilizando.",
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }

    const pendingContext = await getPendingAssessorContext(user.broker.id, conversationDocument?.id)
    const plan = planCosCapability({
      message,
      requestedAction: cleanText(body?.action ?? body?.actionType, 80),
      pendingContext,
      surface: fromCosHome ? "cos_home" : "portal",
    })
    const action = plan.action as AssessorAction

    if (isCancellation && fromCosHome) {
      const responseText = "Tudo bem. Nao executei a alteracao."
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        planner: plan.telemetry,
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
      } as Prisma.InputJsonObject

      const [updatedBroker, updatedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: displayMessage || "Cancelar",
            response: responseText,
            actionType: action,
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: action,
            actionStatus: "cancelled",
            metadata: interactionMetadata,
            errorMessage: null,
          },
        }),
        prisma.emeMessage.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            channel: "assessor_eme",
            direction: "broker_to_ai",
            message: displayMessage || "Cancelar",
            response: responseText,
            detectedIntent: action,
            actionType: action,
            actionStatus: "cancelled",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: responseText,
        action,
        actionStatus: "cancelled",
        metadata: interactionMetadata,
        creditsUsed: 0,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    if (fromCosHome && !isCosCapabilityAvailableOnSurface(action, "cos_home")) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json({
        response: buildCosHomeUnsupportedResponse(),
        action,
        actionStatus: "unsupported",
        creditsUsed: 0,
        conversation: conversationDocument ? serializeConversation(conversationDocument) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    if (fromCosHome && doesCosCapabilityMutateData(action) && !body?.confirm) {
      const responseText = buildCosHomeConfirmationResponse(action)
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        confirmationRequired: true,
        planner: plan.telemetry,
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
      } as Prisma.InputJsonObject

      const [updatedBroker, updatedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: message,
            response: responseText,
            actionType: action,
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: action,
            actionStatus: "needs_confirmation",
            metadata: interactionMetadata,
            errorMessage: null,
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
            actionStatus: "needs_confirmation",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: responseText,
        action,
        actionStatus: "needs_confirmation",
        metadata: interactionMetadata,
        creditsUsed: 0,
        confirmRequired: true,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    creditsUsed = getEmeCreditCost(action)

    if (brokerState.aiCreditsBalance < creditsUsed) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          ...createInsufficientCreditsPayload(),
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }

    let actionResult: CosActionResult = { response: "", metadata: {} }
    let responseText = ""
    let actionStatus = "processing"
    let errorMessage: string | null = null
    let finalCreditsUsed = creditsUsed
    const actionStartedAt = Date.now()

    try {
      actionResult = await executeCosCapability({
        plan,
        brokerId: user.broker.id,
        userId: user.id,
        message,
        confirm: Boolean(body?.confirm),
        payload: typeof body?.payload === "object" && body.payload ? (body.payload as Record<string, unknown>) : {},
      })

      actionStatus =
        Array.isArray(actionResult.metadata?.required) && actionResult.metadata.required.length > 0
          ? "processing"
          : actionResult.response.includes("preciso de confirmacao") || actionResult.response.includes("confirmacao")
            ? "processing"
            : "success"

      if ((actionResult.metadata as { noCharge?: boolean } | undefined)?.noCharge === true) {
        finalCreditsUsed = 0
      }

      if (finalCreditsUsed > 0) {
        await consumeBrokerAiCredits({
          brokerId: user.broker.id,
          amount: finalCreditsUsed,
          actionType: action,
          description: `Assessor EME: ${getCosCapabilityLabel(action)}`,
          metadata: {
            source: "api/assistant/eme",
            action,
          },
        })
      }

      responseText = await formatCosCapabilityResponse({
        message,
        action,
        capability: plan.capability,
        actionResponse: actionResult.response,
      })

      console.info("[api][assistant][eme][action]", {
        detectedIntent: action,
        executedAction: action,
        capabilityId: plan.capabilityId,
        plannerEntity: plan.entity,
        plannerSource: plan.source,
        plannerConfidence: plan.confidence,
        plannerFallbackUsed: plan.telemetry.fallbackUsed,
        actionStatus,
        brokerId: user.broker.id,
        leadId: actionResult.leadId ?? null,
        propertySearchFilters: actionResult.metadata?.propertySearchFilters ?? null,
        visualAction: getCosCapabilityLabel(action),
        durationMs: Date.now() - actionStartedAt,
      })
    } catch (caughtActionError) {
      actionStatus = "error"
      errorMessage = caughtActionError instanceof Error ? caughtActionError.message : "Erro na acao interna."
      responseText = getAssessorActionErrorResponse(action)
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
      source: metadataSource,
      parsedIntent: action,
      actionName: action,
      brokerId: user.broker.id,
      durationMs: Date.now() - actionStartedAt,
      visualAction: getCosCapabilityLabel(action),
      planner: plan.telemetry,
      conversationId: conversationDocument?.id ?? conversationIdFromBody,
      displayMessage,
    } as Prisma.InputJsonObject

    const [updatedBroker, updatedConversation] = await Promise.all([
      getBrokerCredits(user.broker.id),
      touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
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
      conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
      ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 } }),
    })
  } catch (caughtError) {
    console.error("[api][assistant][eme] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O servico do Assessor EME esta indisponivel no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel acionar o Assessor EME agora." }, { status: 500 })
  }
}
