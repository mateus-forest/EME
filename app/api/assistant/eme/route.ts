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
  cancelWorkflow,
  createWorkflowFromExecutionPlan,
  formatCosExecutionPlanResponse,
  formatWorkflowOperationDetails,
  getActiveWorkflow,
  getConversationMemory,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityLabel,
  isCosCapabilityAvailableOnSurface,
  planCosExecution,
  rebuildExecutionPlanFromWorkflow,
  resumeWorkflowExecution,
  resumeWorkflowState,
  sanitizeWorkspaceContext,
  shouldConfirmWorkflowMessage,
  shouldResumeWorkflow,
  stringifyConversationWorkflowContent,
  updateWorkflowFromExecutionResult,
  type CosWorkflow,
} from "@/lib/cos"
import { analyzeCosAttachments, mapAttachmentDraftToPendingPropertyData } from "@/lib/cos/attachment-analysis"
import {
  consumeBrokerAiCredits,
  createInsufficientCreditsPayload,
  getBrokerAiCreditBalance,
  getCosInteractionCreditCost,
} from "@/lib/eme-plan-service"
import { getEmeCreditCost } from "@/lib/eme-plans"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
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
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
}

type CosIncomingAttachment = {
  id: string
  name: string
  type: string
  size: number
  category: "image" | "document" | "video" | "files"
  dataUrl?: string
  textContent?: string
}

// Base64 inflates raw bytes by ~4/3; this comfortably covers the largest file the
// composer will inline (8MB image / 5MB PDF) without truncating (and corrupting) it.
const MAX_INCOMING_ATTACHMENT_DATA_URL_LENGTH = 12_000_000

function sanitizeIncomingAttachmentDataUrl(value: unknown) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_INCOMING_ATTACHMENT_DATA_URL_LENGTH) return undefined
  return trimmed
}

function sanitizeIncomingAttachments(value: unknown) {
  if (!Array.isArray(value)) return [] as CosIncomingAttachment[]

  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      id: cleanText(item.id, 80) || crypto.randomUUID(),
      name: cleanText(item.name, 240),
      type: cleanText(item.type, 120) || "application/octet-stream",
      size: typeof item.size === "number" ? item.size : 0,
      category: (cleanText(item.category, 20) as CosIncomingAttachment["category"]) || "files",
      dataUrl: sanitizeIncomingAttachmentDataUrl(item.dataUrl),
      textContent: cleanText(item.textContent, 120_000) || undefined,
    }))
    .filter((item) => item.name)
}

async function persistConversationWorkflow(
  conversationId: string,
  workflow: CosWorkflow | null,
  memory?: import("@/lib/cos").CosConversationMemory | null,
) {
  return prisma.brokerDocument.update({
    where: { id: conversationId },
    data: { content: stringifyConversationWorkflowContent(workflow, memory) },
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
}

type CosResponseOption = {
  id: string
  label: string
  description?: string
}

function workflowMetadata(workflow: CosWorkflow | null) {
  return workflow
    ? {
        id: workflow.id,
        status: workflow.status,
        currentStep: workflow.currentStep,
        pendingInput: workflow.pendingInput,
        totalPausedMs: workflow.totalPausedMs,
        startedAt: workflow.startedAt,
        updatedAt: workflow.updatedAt,
        completedAt: workflow.completedAt,
      }
    : null
}

function buildWorkflowDetailOptions(workflow: CosWorkflow | null): CosResponseOption[] | null {
  if (!workflow) return null

  if (workflow.pendingInput?.type === "selection") {
    const rawOptions = workflow.pendingInput.parsedData?.options
    if (Array.isArray(rawOptions)) {
      const options = rawOptions
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .filter((item) => typeof item.id === "string" && typeof item.label === "string")
        .map((item) => ({
          id: item.id as string,
          label: item.label as string,
          description: typeof item.description === "string" ? item.description : undefined,
        }))
      return options.length > 0 ? options : null
    }
  }

  return null
}

function buildNextStepOptions(action: AssessorAction, metadata: Prisma.InputJsonObject): CosResponseOption[] | null {
  const propertyId = typeof metadata.propertyId === "string" ? metadata.propertyId : null
  const leadId = typeof metadata.leadId === "string" ? metadata.leadId : null

  if (action === "createPropertyDraft" || action === "PUBLISH_PROPERTY" || action === "searchProperties") {
    return [
      { id: "next_campaign", label: "Gerar campanha" },
      { id: "next_catalog", label: "Compartilhar catÃ¡logo" },
      { id: "next_proposal", label: "Criar proposta" },
    ]
  }

  if (action === "createLead" || action === "FIND_LEAD" || action === "UPDATE_LEAD" || Boolean(leadId)) {
    return [
      { id: "next_find_property", label: "Buscar imÃ³veis" },
      { id: "next_create_proposal", label: "Criar proposta" },
      { id: "next_client_timeline", label: "Ver histÃ³rico" },
    ]
  }

  if (action === "CREATE_PROPOSAL") {
    return [
      { id: "next_create_contract", label: "Criar contrato" },
      { id: "next_share_catalog", label: "Compartilhar catÃ¡logo" },
    ]
  }

  if (propertyId) {
    return [
      { id: "next_campaign_property", label: "Gerar campanha" },
      { id: "next_contract_property", label: "Criar contrato" },
      { id: "next_catalog_property", label: "Compartilhar catÃ¡logo" },
    ]
  }

  return null
}

function buildConversationMemory(input: {
  current: import("@/lib/cos").CosConversationMemory | null
  workflow?: CosWorkflow | null
  action: AssessorAction
  message: string
  result?: string | null
  leadId?: string | null
  propertyId?: string | null
  documentId?: string | null
  campaignId?: string | null
  extractedEntities?: Record<string, unknown> | null
  attachments?: CosIncomingAttachment[]
}) {
  const images = (input.attachments ?? []).filter((item) => item.category === "image")
  const documents = (input.attachments ?? []).filter((item) => item.category === "document")
  const videos = (input.attachments ?? []).filter((item) => item.category === "video")
  const pendingInput = input.workflow?.pendingInput ?? null
  return {
    ...input.current,
    workflowId: input.workflow?.id ?? input.current?.workflowId ?? null,
    workflowType: input.workflow?.executionPlan.requestedAction ?? input.action,
    currentStep: input.workflow?.currentStep ?? input.current?.currentStep ?? null,
    pendingAction: pendingInput?.action ?? null,
    pendingEntity: pendingInput?.entity ?? null,
    awaitingConfirmation: pendingInput?.field === "confirmation",
    awaitingSelection: pendingInput?.type === "selection",
    awaitingUpload: pendingInput?.field === "attachments" || pendingInput?.field === "document" || pendingInput?.field === "imageUrls",
    lastAction: input.action,
    lastUserMessage: input.message,
    lastResult: input.result ?? input.current?.lastResult ?? null,
    leadId: input.leadId ?? input.current?.leadId ?? null,
    propertyId: input.propertyId ?? input.current?.propertyId ?? null,
    documentId: input.documentId ?? input.current?.documentId ?? null,
    contractId: input.documentId ?? input.current?.contractId ?? null,
    proposalId: input.documentId ?? input.current?.proposalId ?? null,
    campaignId: input.campaignId ?? input.current?.campaignId ?? null,
    selectedClient:
      input.leadId
        ? { id: input.leadId, label: input.current?.selectedClient?.label ?? null }
        : (input.current?.selectedClient ?? null),
    selectedProperty:
      input.propertyId
        ? { id: input.propertyId, label: input.current?.selectedProperty?.label ?? null }
        : (input.current?.selectedProperty ?? null),
    selectedContract:
      input.documentId
        ? { id: input.documentId, label: input.current?.selectedContract?.label ?? null }
        : (input.current?.selectedContract ?? null),
    selectedProposal:
      input.documentId
        ? { id: input.documentId, label: input.current?.selectedProposal?.label ?? null }
        : (input.current?.selectedProposal ?? null),
    attachments: input.attachments && input.attachments.length > 0 ? input.attachments : (input.current?.attachments ?? []),
    uploadedImages: images.length > 0 ? images : (input.current?.uploadedImages ?? []),
    uploadedDocuments: documents.length > 0 ? documents : (input.current?.uploadedDocuments ?? []),
    uploadedVideos: videos.length > 0 ? videos : (input.current?.uploadedVideos ?? []),
    extractedEntities: input.extractedEntities ?? input.current?.extractedEntities ?? {},
    updatedAt: new Date().toISOString(),
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
    return NextResponse.json({ error: "Nao foi possivel carregar o Assessor EME." }, { status: 500 })
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
    return NextResponse.json({ error: "Nao foi possivel atualizar o Assessor EME." }, { status: 500 })
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
  const source = cleanText(body?.source, 80)
  const conversationIdFromBody = cleanText(body?.conversationId, 80)
  const displayMessage = cleanText(body?.displayMessage, 3000) || message
  const isCancellation = Boolean(body?.cancel)
  const requestedAction = cleanText(body?.action ?? body?.actionType, 80)
  const isWorkflowDetailsRequest =
    requestedAction === "workflow_details" ||
    displayMessage.toLowerCase().includes("ver detalhes da opera")
  const attachments = sanitizeIncomingAttachments(body?.attachments)
  // Pre-flight estimate used only to gate on balance before the real plan is known. Defaults to 1
  // like before for the vast majority of messages (no requestedAction at all). When a known free
  // action is requested (the 7 COS help capabilities), this must be 0 too — otherwise a broker at
  // 0 credit balance would be blocked from even asking for help, contradicting "conversar com o
  // COS é ilimitado".
  let creditsUsed: number = isWorkflowDetailsRequest ? 0 : requestedAction ? getEmeCreditCost(requestedAction) : 1

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para o Assessor EME." }, { status: 400 })
  }

  try {
    const fromCosHome = isCosHomeSource(source)
    const metadataSource = fromCosHome ? "portal_cos_home" : "portal"
    const surface = fromCosHome ? "cos_home" : "portal"
    const workspace = sanitizeWorkspaceContext(body?.workspace, surface)

    let conversationDocument:
      | {
          id: string
          title: string
          content: string
          createdAt: Date
          updatedAt: Date
        }
      | null = null

    if (conversationIdFromBody) {
      conversationDocument = await resolveCosConversation(user.broker.id, conversationIdFromBody)
      if (!conversationDocument) {
        return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 })
      }
    } else {
      conversationDocument = await prisma.brokerDocument.create({
        data: {
          brokerId: user.broker.id,
          type: "cos_conversation",
          title: DEFAULT_COS_CONVERSATION_TITLE,
          content: stringifyConversationWorkflowContent(null),
          status: "active",
        },
        select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
      })
    }

    const brokerState = await prisma.broker.findUnique({
      where: { id: user.broker.id },
      select: { aiAssistantEnabled: true, aiCreditsBalance: true },
    })

    if (!brokerState) {
      return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
    }

    if (!brokerState.aiAssistantEnabled && !isCancellation) {
      return NextResponse.json({ error: "Seu Assessor EME esta desativado no momento." }, { status: 403 })
    }

    if (brokerState.aiCreditsBalance < creditsUsed && !isCancellation) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          ...createInsufficientCreditsPayload({
            availableCredits: brokerState.aiCreditsBalance,
            requiredCredits: creditsUsed,
          }),
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }

    const conversationMemory = conversationDocument ? getConversationMemory(conversationDocument.content) : null
    const activeWorkflow = conversationDocument ? getActiveWorkflow(conversationDocument.content) : null
    const resumableWorkflow = shouldResumeWorkflow(activeWorkflow) ? activeWorkflow : null

    if (isWorkflowDetailsRequest) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      const workflowAction = resumableWorkflow?.steps[resumableWorkflow.currentStep]?.action ?? "general"
      const workflowDetailsResponse = resumableWorkflow
        ? formatWorkflowOperationDetails({
            workflow: resumableWorkflow,
            memory: conversationMemory,
            creditsRequired: getCosInteractionCreditCost(
              resumableWorkflow.steps
                .slice(resumableWorkflow.currentStep)
                .map((step) => step.action),
            ),
          })
        : "NÃ£o existe nenhuma operaÃ§Ã£o em andamento no momento.\n\nVocÃª pode iniciar uma nova operaÃ§Ã£o digitando um comando ou utilizando os atalhos rÃ¡pidos."
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: workflowAction,
        actionName: workflowAction,
        brokerId: user.broker.id,
        visualAction: "Detalhes da operaÃ§Ã£o",
        workflow: workflowMetadata(resumableWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        options: buildWorkflowDetailOptions(resumableWorkflow),
      } as Prisma.InputJsonObject

      const [updatedConversation] = await Promise.all([
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: message,
            response: workflowDetailsResponse,
            actionType: "general",
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: "general",
            actionStatus: resumableWorkflow ? "success" : "idle",
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
            response: workflowDetailsResponse,
            detectedIntent: "general",
            actionType: "general",
            actionStatus: resumableWorkflow ? "success" : "idle",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: workflowDetailsResponse,
        action: workflowAction,
        actionStatus: resumableWorkflow ? "success" : "idle",
        metadata: interactionMetadata,
        creditsUsed: 0,
        confirmRequired: resumableWorkflow?.pendingInput?.field === "confirmation",
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    const effectiveAttachments = attachments.length > 0 ? attachments : (conversationMemory?.attachments ?? [])
    const executionPayload = {
      ...(conversationMemory?.leadId ? { leadId: conversationMemory.leadId } : {}),
      ...(conversationMemory?.propertyId ? { propertyId: conversationMemory.propertyId } : {}),
      ...(conversationMemory?.documentId ? { documentId: conversationMemory.documentId } : {}),
      ...(effectiveAttachments.length > 0 ? { attachments: effectiveAttachments } : {}),
    }
    const attachmentAnalysis = resumableWorkflow
      ? {
          executionMessage: message,
          propertyDrafts: [],
          primaryPropertyDraft: null,
          propertyConfirmationText: null,
          imageUrl: null,
        }
      : await analyzeCosAttachments({
          message,
          attachments,
        })
    const executionMessage = attachmentAnalysis.executionMessage
    const pendingContext = resumableWorkflow ? null : await getPendingAssessorContext(user.broker.id, conversationDocument?.id)
    const executionPlanBase = resumableWorkflow
      ? null
      : await runWithAiOperationContext(
          {
            route: "/api/assistant/eme",
            source: metadataSource,
            userId: user.id,
            brokerId: user.broker!.id,
            planKey: user.plan ?? null,
            conversationId: conversationDocument?.id ?? null,
            workflowId: activeWorkflow?.id ?? null,
          },
          () =>
            planCosExecution({
              message: executionMessage,
              requestedAction,
              pendingContext,
              surface,
              workspace,
              activeWorkflow: activeWorkflow ?? null,
            }),
        )
    const executionPlan =
      executionPlanBase && attachmentAnalysis.primaryPropertyDraft && executionPlanBase.primaryStep.action === "createPropertyDraft"
        ? {
            ...executionPlanBase,
            confirmationMessage: attachmentAnalysis.propertyConfirmationText ?? executionPlanBase.confirmationMessage,
          }
        : executionPlanBase
    const action = (resumableWorkflow?.steps[resumableWorkflow.currentStep]?.action ?? executionPlan?.primaryStep.action ?? "general") as AssessorAction

    if (isCancellation) {
      const cancelledWorkflow = resumableWorkflow ? cancelWorkflow(resumableWorkflow) : null
      const responseText = cancelledWorkflow ? "Tudo bem. Nao vou continuar com isso." : "Tudo bem. Nao executei a alteracao."
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        planner: executionPlan?.telemetry ?? null,
        workflow: workflowMetadata(cancelledWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        attachments: effectiveAttachments,
      } as Prisma.InputJsonObject

      const [updatedBroker, persistedConversation, touchedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        cancelledWorkflow && conversationDocument
          ? persistConversationWorkflow(conversationDocument.id, cancelledWorkflow, conversationMemory)
          : Promise.resolve(conversationDocument),
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker!.id,
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
            brokerId: user.broker!.id,
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
        conversation: serializeConversation(touchedConversation ?? persistedConversation ?? conversationDocument ?? {
          id: "",
          title: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    if (fromCosHome && executionPlan && !isCosCapabilityAvailableOnSurface(action, "cos_home")) {
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

    if (resumableWorkflow?.pendingInput?.field === "confirmation" && !shouldConfirmWorkflowMessage(message, Boolean(body?.confirm))) {
      const responseText = buildCosHomeConfirmationResponse(action)
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        confirmationRequired: true,
        workflow: workflowMetadata(resumableWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        attachments: effectiveAttachments,
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

    if (executionPlan?.requiresConfirmation && !body?.confirm) {
      const pendingWorkflow = createWorkflowFromExecutionPlan({
        conversationId: conversationDocument?.id ?? "ephemeral",
        plan: executionPlan,
      })
      if (pendingWorkflow.pendingInput?.action === "createPropertyDraft" && attachmentAnalysis.primaryPropertyDraft) {
        pendingWorkflow.pendingInput = {
          ...pendingWorkflow.pendingInput,
          parsedData: mapAttachmentDraftToPendingPropertyData(attachmentAnalysis.primaryPropertyDraft, message, attachmentAnalysis.imageUrl),
        }
      }
      const responseText = executionPlan.confirmationMessage ?? buildCosHomeConfirmationResponse(action)
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: action,
        actionName: action,
        brokerId: user.broker.id,
        visualAction: getCosCapabilityLabel(action),
        confirmationRequired: true,
        planner: executionPlan.telemetry,
        attachmentAnalysis: attachmentAnalysis.primaryPropertyDraft
          ? {
              propertyDrafts: attachmentAnalysis.propertyDrafts.length,
              primaryPropertyDraft: mapAttachmentDraftToPendingPropertyData(attachmentAnalysis.primaryPropertyDraft, message, attachmentAnalysis.imageUrl),
            }
          : null,
        workflow: workflowMetadata(pendingWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        attachments: effectiveAttachments,
      } as Prisma.InputJsonObject

      const [updatedBroker, _persistedConversation, updatedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
        conversationDocument
          ? persistConversationWorkflow(
              conversationDocument.id,
              pendingWorkflow,
              buildConversationMemory({
                current: conversationMemory,
                workflow: pendingWorkflow,
                action,
                message: displayMessage || message,
                attachments: effectiveAttachments,
              }),
            )
          : Promise.resolve(conversationDocument),
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

    const workflow = resumableWorkflow
      ? resumeWorkflowState(resumableWorkflow)
      : createWorkflowFromExecutionPlan({
          conversationId: conversationDocument?.id ?? "ephemeral",
          plan: executionPlan!,
        })

    creditsUsed = getCosInteractionCreditCost(workflow.steps.map((step) => step.action))

    if (brokerState.aiCreditsBalance < creditsUsed) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          ...createInsufficientCreditsPayload({
            availableCredits: brokerState.aiCreditsBalance,
            requiredCredits: creditsUsed,
          }),
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        },
        { status: 402 },
      )
    }

    let responseText = ""
    let actionStatus = "processing"
    let errorMessage: string | null = null
    let finalCreditsUsed = 0
    const actionStartedAt = Date.now()
    let executionResult = null
    let updatedWorkflow = workflow

    try {
      executionResult = await runWithAiOperationContext(
        {
          route: "/api/assistant/eme",
          source: metadataSource,
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          conversationId: conversationDocument?.id ?? null,
          workflowId: workflow.id,
          creditsConsumed: creditsUsed,
        },
        () =>
          resumeWorkflowExecution({
            workflow,
            brokerId: user.broker!.id,
            userId: user.id,
            message: executionMessage,
            confirm: shouldConfirmWorkflowMessage(message, Boolean(body?.confirm)),
            workspace,
            payload: executionPayload,
          }),
      )

      updatedWorkflow = updateWorkflowFromExecutionResult({
        workflow,
        result: executionResult,
      })

      actionStatus =
        updatedWorkflow.status === "awaiting_input"
          ? "processing"
          : updatedWorkflow.status === "failed"
            ? "error"
            : "success"

      finalCreditsUsed = getCosInteractionCreditCost(
        executionResult.executedSteps
          .filter((step) => (step.result?.metadata as { noCharge?: boolean } | undefined)?.noCharge !== true)
          .map((step) => step.action),
      )

      if (finalCreditsUsed > 0) {
        await consumeBrokerAiCredits({
          brokerId: user.broker.id,
          amount: finalCreditsUsed,
          actionType: action,
          description:
            workflow.steps.length > 1
              ? `Assessor EME: workflow ${workflow.steps.map((step) => getCosCapabilityLabel(step.action)).join(" + ")}`
              : `Assessor EME: ${getCosCapabilityLabel(action)}`,
          metadata: {
            source: "api/assistant/eme",
            action,
            planId: workflow.id,
            steps: workflow.steps.map((step) => step.action),
          },
        })
      }

      const planForFormatting = executionPlan ?? rebuildExecutionPlanFromWorkflow(workflow)
      responseText = await formatCosExecutionPlanResponse({
        message: executionMessage,
        plan: planForFormatting,
        result: executionResult,
      })

      console.info("[cos][workflow]", {
        workflowId: updatedWorkflow.id,
        status: updatedWorkflow.status,
        currentStep: updatedWorkflow.currentStep,
        pendingInput: updatedWorkflow.pendingInput?.field ?? null,
        stepCount: updatedWorkflow.steps.length,
        totalPausedMs: updatedWorkflow.totalPausedMs,
        durationMs: Date.now() - actionStartedAt,
      })
    } catch (caughtActionError) {
      actionStatus = "error"
      errorMessage = caughtActionError instanceof Error ? caughtActionError.message : "Erro na acao interna."
      responseText = getAssessorActionErrorResponse(action)
      finalCreditsUsed = 0
      updatedWorkflow = {
        ...workflow,
        status: "failed",
        pendingInput: null,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }

      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Erro no Assessor EME",
          message: errorMessage,
          read: false,
        },
      })
    }

    const actionMetadata = (executionResult?.metadata ?? {}) as Prisma.InputJsonObject
    const nextConversationMemory = buildConversationMemory({
      current: conversationMemory,
      workflow: updatedWorkflow,
      action,
      message: displayMessage || message,
      result: responseText,
      leadId: executionResult?.leadId ?? null,
      propertyId: executionResult?.propertyId ?? null,
      documentId: typeof actionMetadata.documentId === "string" ? actionMetadata.documentId : null,
      campaignId: typeof actionMetadata.campaignId === "string" ? actionMetadata.campaignId : null,
      extractedEntities:
        actionMetadata.parsedData && typeof actionMetadata.parsedData === "object"
          ? (actionMetadata.parsedData as Record<string, unknown>)
          : null,
      attachments: effectiveAttachments,
    })
    const responseOptions =
      buildWorkflowDetailOptions(updatedWorkflow) ??
      (actionStatus === "success" && updatedWorkflow.status !== "awaiting_input"
        ? buildNextStepOptions(action, actionMetadata)
        : null)
    const plannedCapabilities = (executionPlan?.steps ?? workflow.steps).map((step) => step.capabilityId)
    const executedCapabilities = executionResult?.executedSteps.map((step) => step.capabilityId) ?? []
    const skippedCapabilities = plannedCapabilities.filter((capabilityId) => !executedCapabilities.includes(capabilityId))
    const interactionMetadata = {
      ...actionMetadata,
      source: metadataSource,
      parsedIntent: action,
      actionName: action,
      brokerId: user.broker.id,
      durationMs: Date.now() - actionStartedAt,
      visualAction: getCosCapabilityLabel(action),
      planner: executionPlan?.telemetry ?? null,
      planningAudit: {
        planner: executionPlan?.telemetry.planner ?? "deterministic",
        source: executionPlan?.source ?? workflow.executionPlan.source,
        plannedCapabilities,
        executedCapabilities,
        skippedCapabilities,
        aiOrchestrator: executionPlan?.telemetry.orchestrator ?? null,
      },
      attachmentAnalysis: attachmentAnalysis.primaryPropertyDraft
        ? {
            propertyDrafts: attachmentAnalysis.propertyDrafts.length,
            primaryPropertyDraft: mapAttachmentDraftToPendingPropertyData(attachmentAnalysis.primaryPropertyDraft, message, attachmentAnalysis.imageUrl),
          }
        : null,
      workflow: workflowMetadata(updatedWorkflow),
      conversationId: conversationDocument?.id ?? conversationIdFromBody,
      displayMessage,
      attachments: effectiveAttachments,
      options: responseOptions,
    } as Prisma.InputJsonObject

    const [updatedBroker, _persistedConversation, touchedConversation] = await Promise.all([
      getBrokerCredits(user.broker.id),
      conversationDocument ? persistConversationWorkflow(conversationDocument.id, updatedWorkflow, nextConversationMemory) : Promise.resolve(conversationDocument),
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
          leadId: executionResult?.leadId ?? null,
          propertyId: executionResult?.propertyId ?? null,
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
          leadId: executionResult?.leadId ?? null,
          propertyId: executionResult?.propertyId ?? null,
        },
      }),
    ])

    return NextResponse.json({
      response: responseText,
      action,
      actionStatus,
      metadata: interactionMetadata,
      creditsUsed: finalCreditsUsed,
      confirmRequired: updatedWorkflow.pendingInput?.field === "confirmation",
      conversation: touchedConversation ? serializeConversation(touchedConversation) : null,
      ...(updatedBroker ? creditsResponse(updatedBroker) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
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
