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
  generateAssessorText,
  getAssessorActionErrorResponse,
  getPendingAssessorContext,
  resolveAssessorInputWithContext,
  runAssessorAction,
  type AssessorAction,
} from "@/lib/eme-backend"
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

function getVisualActionLabel(action: AssessorAction) {
  if (action === "createLead") return "Lead cadastrado"
  if (action === "searchProperties") return "Busca de imoveis"
  if (action === "getFinancialSummary") return "Consulta financeira"
  if (action === "getCatalogSummary") return "Resumo do catalogo"
  if (action === "getLeadsSummary") return "Resumo de leads"
  if (action === "createPropertyDraft") return "Rascunho de imovel"
  if (action === "improvePropertyDescription") return "Descricao melhorada"
  if (action === "summarizeLead") return "Resumo de leads"
  if (action === "analyzeCatalog") return "Catalogo analisado"
  if (action === "getAnalyticsSummary") return "Consulta de analytics"
  if (action === "CREATE_AGENDA_EVENT") return "Compromisso criado"
  if (action === "LIST_AGENDA_EVENTS") return "Consulta de agenda"
  if (action === "MARK_AGENDA_DONE") return "Compromisso concluido"
  if (action === "CREATE_PROPOSAL") return "Proposta gerada"
  if (action === "CREATE_CONTRACT") return "Contrato gerado"
  if (action === "LIST_DOCUMENTS") return "Consulta de documentos"
  if (action === "GET_DOCUMENT") return "Documento consultado"
  if (action === "LIST_CONTRACTS") return "Consulta de contratos"
  if (action === "GET_CONTRACT") return "Contrato consultado"
  return "Acao do Assessor"
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
    "CREATE_CONTRACT",
    "LIST_DOCUMENTS",
    "GET_DOCUMENT",
    "LIST_CONTRACTS",
    "GET_CONTRACT",
    "getFinancialSummary",
    "getAnalyticsSummary",
    "getCatalogSummary",
    "getLeadsSummary",
    "createInternalNotification",
    "analyzeCatalog",
    "summarizeLead",
  ].includes(action)
}

const COS_HOME_ALLOWED_ACTIONS: AssessorAction[] = [
  "general",
  "searchProperties",
  "createPropertyDraft",
  "createLead",
  "CREATE_PROPOSAL",
  "CREATE_CONTRACT",
  "CREATE_AGENDA_EVENT",
  "LIST_AGENDA_EVENTS",
  "LIST_CONTRACTS",
  "GET_CONTRACT",
  "getLeadsSummary",
  "summarizeLead",
  "getAnalyticsSummary",
  "getCatalogSummary",
  "analyzeCatalog",
  "getFinancialSummary",
  "createInternalNotification",
]

const COS_HOME_MUTATING_ACTIONS: AssessorAction[] = [
  "createPropertyDraft",
  "createLead",
  "CREATE_PROPOSAL",
  "CREATE_CONTRACT",
  "CREATE_AGENDA_EVENT",
]

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
  if (action === "createPropertyDraft") return "Encontrei um pedido para cadastrar um imovel em rascunho. Deseja confirmar?"
  if (action === "createLead") return "Posso cadastrar ou atualizar este cliente agora. Deseja confirmar?"
  if (action === "CREATE_PROPOSAL") return "Posso gerar esta proposta agora e salvar em Documentos. Deseja confirmar?"
  if (action === "CREATE_CONTRACT") return "Posso gerar este contrato agora, salvar em Documentos e deixar como rascunho para revisao. Deseja confirmar?"
  if (action === "CREATE_AGENDA_EVENT") return "Posso criar este compromisso agora na sua agenda. Deseja confirmar?"
  return `Posso executar "${getVisualActionLabel(action)}" agora. Deseja confirmar?`
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
    const resolvedInput = resolveAssessorInputWithContext({
      message,
      requestedAction: cleanText(body?.action ?? body?.actionType, 80),
      pendingContext,
    })
    const action = resolvedInput.action as AssessorAction

    if (isCancellation && fromCosHome) {
      const responseText = "Tudo bem. Nao executei a alteracao."
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getVisualActionLabel(action),
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

    if (fromCosHome && !COS_HOME_ALLOWED_ACTIONS.includes(action)) {
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

    if (fromCosHome && COS_HOME_MUTATING_ACTIONS.includes(action) && !body?.confirm) {
      const responseText = buildCosHomeConfirmationResponse(action)
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getVisualActionLabel(action),
        confirmationRequired: true,
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
          description: `Assessor EME: ${getVisualActionLabel(action)}`,
          metadata: {
            source: "api/assistant/eme",
            action,
          },
        })
      }

      responseText = shouldReturnActionResponse(action)
        ? actionResult.response
        : await generateAssessorText(message, action, actionResult.response)

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
      visualAction: getVisualActionLabel(action),
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
