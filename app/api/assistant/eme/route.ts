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
  type AssessorAction,
} from "@/lib/eme-backend"
import {
  cancelWorkflow,
  createCosNormalizedContext,
  createWorkflowFromExecutionPlan,
  formatCosExecutionPlanResponse,
  formatWorkflowOperationDetails,
  getActiveWorkflow,
  getConversationMemory,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityLabel,
  isCosCapabilityAvailableOnSurface,
  normalizeCosAttachments,
  planCosExecution,
  rebuildExecutionPlanFromWorkflow,
  resumeWorkflowExecution,
  resumeWorkflowState,
  runCosAttachmentPipeline,
  sanitizeWorkspaceContext,
  shouldConfirmWorkflowMessage,
  shouldResumeWorkflow,
  stringifyConversationWorkflowContent,
  updateWorkflowFromExecutionResult,
  type CosAttachmentInput as CosIncomingAttachment,
  type CosWorkflow,
} from "@/lib/cos"
import { mapAttachmentDraftToPendingPropertyData } from "@/lib/cos/attachment-analysis"
import { resolveFastCosAction } from "@/lib/cos/fast-action-resolver"
import { resolveCosIntent } from "@/lib/cos/intent-resolver"
import type { FastActionResolution } from "@/lib/cos/fast-action-resolver"
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

function sanitizeIncomingAttachments(value: unknown) {
  return normalizeCosAttachments(value)
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
  actionId?: string
  label: string
  description?: string
  message?: string
  action?: string
  selectedOptionId?: string
  href?: string
}

function buildStructuredOption(input: {
  id: string
  label: string
  description?: string
  actionId?: string
  message?: string
  action?: string | null
  selectedOptionId?: string
  href?: string
}): CosResponseOption {
  return {
    id: input.id,
    actionId: input.actionId ?? input.id,
    label: input.label,
    description: input.description,
    message: input.message,
    action: input.action ?? undefined,
    selectedOptionId: input.selectedOptionId,
    href: input.href,
  }
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
    const rawOptions =
      Array.isArray(workflow.pendingInput.options)
        ? workflow.pendingInput.options
        : workflow.pendingInput.parsedData?.options
    if (Array.isArray(rawOptions)) {
      const options = rawOptions
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .filter((item) => typeof item.id === "string" && typeof item.label === "string")
        .map((item) =>
          buildStructuredOption({
            id: item.id as string,
            actionId:
              typeof item.actionId === "string"
                ? item.actionId
                : `workflow_selection:${workflow.id}:${item.id as string}`,
            selectedOptionId: item.id as string,
            label: item.label as string,
            message: typeof item.message === "string" ? item.message : (item.label as string),
            description: typeof item.description === "string" ? item.description : undefined,
            action: typeof item.action === "string" ? item.action : null,
            href: typeof item.href === "string" ? item.href : undefined,
          }),
        )
      return options.length > 0 ? options : null
    }
  }

  return null
}

function buildIntentClarificationOptions(
  candidates:
    | Array<{
        action: AssessorAction
        confidence: number
        reason: string
      }>
    | undefined,
): CosResponseOption[] | null {
  if (!candidates?.length) return null

  const unique = new Map<string, CosResponseOption>()
  for (const candidate of candidates.slice(0, 3)) {
    if (!unique.has(candidate.action)) {
      unique.set(
        candidate.action,
        buildStructuredOption({
          id: candidate.action,
          actionId: `intent:${candidate.action}`,
          action: candidate.action,
          message: getCosCapabilityLabel(candidate.action),
          label: getCosCapabilityLabel(candidate.action),
        }),
      )
    }
  }

  const options = Array.from(unique.values())
  return options.length > 1 ? options : null
}

function buildDecisionAudit(input: {
  fastAction: FastActionResolution
  requestedAction: string | null
  effectiveRequestedAction: string | null
  resolvedRequestedAction: string | null
  intentResolution?: {
    confidence: number
    reason: string
    workflowDecision: string
    requestedAction: string | null
    candidates?: Array<{ action: string; confidence: number; reason: string }>
  } | null
  executionPlan?: {
    source: string
    reason: string
    requiresConfirmation: boolean
    primaryAction: string
    capabilityId: string
    plannerTelemetry: Prisma.InputJsonObject | null
  } | null
}) {
  return {
    fastAction:
      input.fastAction.kind === "none"
        ? null
        : {
            kind: input.fastAction.kind,
            confidence: input.fastAction.confidence,
            reason: input.fastAction.reason,
            action:
              input.fastAction.kind === "workflow_action" || input.fastAction.kind === "workflow_details"
                ? input.fastAction.action
                : null,
          },
    requestedAction: input.requestedAction,
    effectiveRequestedAction: input.effectiveRequestedAction,
    resolvedRequestedAction: input.resolvedRequestedAction,
    intent:
      input.intentResolution
        ? {
            requestedAction: input.intentResolution.requestedAction,
            confidence: input.intentResolution.confidence,
            reason: input.intentResolution.reason,
            workflowDecision: input.intentResolution.workflowDecision,
            candidates: input.intentResolution.candidates ?? [],
          }
        : null,
    workflow:
      input.executionPlan
        ? {
            source: input.executionPlan.source,
            reason: input.executionPlan.reason,
            requiresConfirmation: input.executionPlan.requiresConfirmation,
            primaryAction: input.executionPlan.primaryAction,
            capabilityId: input.executionPlan.capabilityId,
            plannerTelemetry: input.executionPlan.plannerTelemetry,
          }
        : null,
  } satisfies Prisma.InputJsonObject
}

function getCosActionDomain(action: string | null | undefined) {
  if (!action) return "general"

  if (action === "workflow_details") return "operation"
  if (action.startsWith("help_")) return "help"
  if (action.startsWith("STUDIO_")) return "studio"
  if (action.includes("LEAD") || action === "createLead") return "lead"
  if (action.includes("PROPERTY") || action === "createPropertyDraft" || action === "searchProperties") return "property"
  if (action.includes("CONTRACT")) return "contract"
  if (action.includes("PROPOSAL")) return "proposal"
  if (action.includes("AGENDA")) return "agenda"
  if (action.includes("CATALOG")) return "catalog"
  if (action.includes("FINANCIAL") || action.includes("FINANCE")) return "finance"
  if (action.includes("PERFORMANCE") || action.includes("ANALYTICS")) return "performance"

  return "general"
}

function buildNextStepOptions(action: AssessorAction, metadata: Prisma.InputJsonObject): CosResponseOption[] | null {
  const propertyId = typeof metadata.propertyId === "string" ? metadata.propertyId : null
  const leadId = typeof metadata.leadId === "string" ? metadata.leadId : null
  const propertyStatus = typeof metadata.propertyStatus === "string" ? metadata.propertyStatus : null
  const deleted = metadata.deleted === true

  if (deleted || action === "ARCHIVE_PROPERTY") {
    return [
      { id: "next_find_property_after_delete", label: "Buscar imóveis" },
      { id: "next_create_property_after_delete", label: "Criar imóvel" },
      { id: "next_campaign_after_delete", label: "Criar campanha para outro imóvel" },
    ]
  }

  if (action === "UNPUBLISH_PROPERTY" || propertyStatus === "PAUSED") {
    return [
      { id: "next_republish_property", label: "Publicar novamente" },
      { id: "next_edit_property", label: "Editar imóvel" },
      { id: "next_delete_property", label: "Excluir imóvel" },
    ]
  }

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

function buildStructuredFastActionOptions(options: Array<{ id: string; label: string }> | undefined): CosResponseOption[] | null {
  if (!options?.length) return null

  const normalized = options
    .filter((option) => option.id && option.label)
    .map((option) =>
      buildStructuredOption({
        id: option.id,
        actionId: `clarify:${option.id}`,
        selectedOptionId: option.id,
        message: option.label,
        label: option.label,
      }),
    )

  return normalized.length > 0 ? normalized : null
}

function buildStructuredNextStepOptions(action: AssessorAction, metadata: Prisma.InputJsonObject): CosResponseOption[] | null {
  const options = buildNextStepOptions(action, metadata)
  if (!options?.length) return null

  return options.map((option) => {
    switch (option.id) {
      case "next_find_property_after_delete":
      case "next_find_property":
        return buildStructuredOption({ ...option, actionId: "next:searchProperties", action: "searchProperties", message: option.message ?? option.label })
      case "next_create_property_after_delete":
      case "next_edit_property":
        return buildStructuredOption({ ...option, actionId: "next:createPropertyDraft", action: "createPropertyDraft", message: option.message ?? option.label })
      case "next_campaign_after_delete":
      case "next_campaign":
      case "next_campaign_property":
        return buildStructuredOption({ ...option, actionId: "next:STUDIO_GENERATE_CAMPAIGN", action: "STUDIO_GENERATE_CAMPAIGN", message: option.message ?? option.label })
      case "next_republish_property":
        return buildStructuredOption({ ...option, actionId: "next:PUBLISH_PROPERTY", action: "PUBLISH_PROPERTY", message: option.message ?? option.label })
      case "next_delete_property":
        return buildStructuredOption({ ...option, actionId: "next:ARCHIVE_PROPERTY", action: "ARCHIVE_PROPERTY", message: option.message ?? option.label })
      case "next_catalog":
      case "next_share_catalog":
      case "next_catalog_property":
        return buildStructuredOption({ ...option, actionId: "next:SHARE_CATALOG", action: "SHARE_CATALOG", message: option.message ?? option.label })
      case "next_proposal":
      case "next_create_proposal":
        return buildStructuredOption({ ...option, actionId: "next:CREATE_PROPOSAL", action: "CREATE_PROPOSAL", message: option.message ?? option.label })
      case "next_create_contract":
      case "next_contract_property":
        return buildStructuredOption({ ...option, actionId: "next:CREATE_CONTRACT", action: "CREATE_CONTRACT", message: option.message ?? option.label })
      case "next_client_timeline":
        return buildStructuredOption({ ...option, actionId: "next:open_history", message: option.message ?? option.label, href: "/corretor/historico" })
      default:
        return buildStructuredOption({ ...option, actionId: `next:${option.id}`, message: option.message ?? option.label })
    }
  })
}

function resolveStructuredSelectionMessage(workflow: CosWorkflow | null, selectedOptionId: string | null) {
  if (!workflow || workflow.pendingInput?.type !== "selection" || !selectedOptionId) return null

  const rawOptions =
    Array.isArray(workflow.pendingInput.options)
      ? workflow.pendingInput.options
      : workflow.pendingInput.parsedData?.options
  if (!Array.isArray(rawOptions)) return null

  const matched = rawOptions
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .find((item) => item && typeof item.id === "string" && item.id === selectedOptionId && typeof item.label === "string")

  return matched && typeof matched.label === "string" ? matched.label : null
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
  const selectedOptionId = cleanText(body?.selectedOptionId, 160)
  const isCancellation = Boolean(body?.cancel)
  const requestedAction = cleanText(body?.action ?? body?.actionType, 80)
  const isWorkflowDetailsRequest = requestedAction === "workflow_details"
  const attachments = sanitizeIncomingAttachments(body?.attachments)
  // Pre-flight estimate used only to gate on balance before the real plan is known. Defaults to 1
  // like before for the vast majority of messages (no requestedAction at all). When a known free
  // action is requested (the 7 COS help capabilities), this must be 0 too — otherwise a broker at
  // 0 credit balance would be blocked from even asking for help, contradicting "conversar com o
  // COS é ilimitado". Cancelamentos também devem ser 0 sem consultar a tabela: cancelar nunca cobra
  // crédito, e getEmeCreditCost lança em dev para actions ainda não cadastradas (ex.: CANCEL_CONTRACT),
  // o que quebrava o botão "Cancelar ação" com 500 antes mesmo de processar o cancelamento.
  let creditsUsed: number = isWorkflowDetailsRequest || isCancellation ? 0 : requestedAction ? getEmeCreditCost(requestedAction) : 1

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
      return NextResponse.json({ error: "O COS está desativado no momento." }, { status: 403 })
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
    const structuredSelectionMessage = resolveStructuredSelectionMessage(activeWorkflow, selectedOptionId)
    const effectiveAttachments = attachments.length > 0 ? attachments : (conversationMemory?.attachments ?? [])
    const normalizedContext = createCosNormalizedContext({
      brokerId: user.broker.id,
      userId: user.id,
      surface,
      message: structuredSelectionMessage ?? message,
      workspace,
      workflow: activeWorkflow,
      memory: conversationMemory,
      attachments: effectiveAttachments,
    })
    const fastAction =
      !requestedAction && !isCancellation
        ? resolveFastCosAction({
            message,
            workspace,
            context: normalizedContext,
          })
        : { kind: "none" as const, confidence: 0 }
    const effectiveRequestedAction =
      requestedAction ||
      (fastAction.kind === "workflow_action" || fastAction.kind === "workflow_details" ? fastAction.action : null)

    if (fastAction.kind === "clarify") {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: "general",
        actionName: "general",
        brokerId: user.broker.id,
        visualAction: "Aclaracao de comando",
        fastAction: {
          confidence: fastAction.confidence,
          reason: fastAction.reason,
        },
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        options: buildStructuredFastActionOptions(fastAction.options),
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction: null,
          intentResolution: null,
          executionPlan: null,
        }),
      } as Prisma.InputJsonObject

      const [updatedConversation] = await Promise.all([
        touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
        prisma.aiAssistantInteraction.create({
          data: {
            userId: user.id,
            brokerId: user.broker.id,
            prompt: message,
            response: fastAction.reply,
            actionType: "general",
            creditsUsed: 0,
            channel: "assessor_eme",
            intent: "general",
            actionStatus: "needs_clarification",
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
            response: fastAction.reply,
            detectedIntent: "general",
            actionType: "general",
            actionStatus: "needs_clarification",
            metadata: interactionMetadata,
            errorMessage: null,
            creditsUsed: 0,
          },
        }),
      ])

      return NextResponse.json({
        response: fastAction.reply,
        action: "general",
        actionStatus: "needs_clarification",
        metadata: interactionMetadata,
        creditsUsed: 0,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    const intentResolution = resolveCosIntent({
      message: structuredSelectionMessage ?? message,
      requestedAction: effectiveRequestedAction,
      attachments: effectiveAttachments,
      workspace,
      activeWorkflow,
      memory: conversationMemory,
      context: normalizedContext,
    })
    const resolvedRequestedAction = intentResolution.requestedAction ?? effectiveRequestedAction
    const activeWorkflowAction =
      activeWorkflow?.steps[activeWorkflow.currentStep]?.action ??
      activeWorkflow?.executionPlan.requestedAction ??
      null
    const hasExplicitNewAction =
      Boolean(effectiveRequestedAction) &&
      effectiveRequestedAction !== "workflow_details" &&
      !isCancellation
    const workflowDomainsCompatible =
      !hasExplicitNewAction ||
      !activeWorkflowAction ||
      getCosActionDomain(activeWorkflowAction) === getCosActionDomain(effectiveRequestedAction)
    const resumableWorkflow =
      shouldResumeWorkflow(activeWorkflow) &&
      intentResolution.workflowDecision !== "start_new" &&
      workflowDomainsCompatible
        ? activeWorkflow
        : null

    if (intentResolution.confidence < 0.6) {
      const clarificationOptions = buildIntentClarificationOptions(intentResolution.candidates)
      if (clarificationOptions) {
        const brokerCredits = await getBrokerCredits(user.broker.id)
        const clarificationResponse = "Quero ter certeza antes de seguir.\n\nVoce quis dizer uma destas acoes?"
        const interactionMetadata = {
          source: metadataSource,
          parsedIntent: "general",
          actionName: "general",
          brokerId: user.broker.id,
          visualAction: "Aclaracao de intencao",
          intentResolution,
          conversationId: conversationDocument?.id ?? conversationIdFromBody,
          displayMessage,
          options: clarificationOptions,
          decisionAudit: buildDecisionAudit({
            fastAction,
            requestedAction,
            effectiveRequestedAction,
            resolvedRequestedAction,
            intentResolution: {
              requestedAction: intentResolution.requestedAction,
              confidence: intentResolution.confidence,
              reason: intentResolution.reason,
              workflowDecision: intentResolution.workflowDecision,
              candidates: intentResolution.candidates,
            },
            executionPlan: null,
          }),
        } as Prisma.InputJsonObject

        const [updatedConversation] = await Promise.all([
          touchCosConversation({ conversation: conversationDocument, message: displayMessage || message }),
          prisma.aiAssistantInteraction.create({
            data: {
              userId: user.id,
              brokerId: user.broker.id,
              prompt: message,
              response: clarificationResponse,
              actionType: "general",
              creditsUsed: 0,
              channel: "assessor_eme",
              intent: "general",
              actionStatus: "needs_clarification",
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
              response: clarificationResponse,
              detectedIntent: "general",
              actionType: "general",
              actionStatus: "needs_clarification",
              metadata: interactionMetadata,
              errorMessage: null,
              creditsUsed: 0,
            },
          }),
        ])

        return NextResponse.json({
          response: clarificationResponse,
          action: "general",
          actionStatus: "needs_clarification",
          metadata: interactionMetadata,
          creditsUsed: 0,
          conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
        })
      }
    }

    if (isWorkflowDetailsRequest || effectiveRequestedAction === "workflow_details") {
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
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction,
          intentResolution: {
            requestedAction: intentResolution.requestedAction,
            confidence: intentResolution.confidence,
            reason: intentResolution.reason,
            workflowDecision: intentResolution.workflowDecision,
            candidates: intentResolution.candidates,
          },
          executionPlan: resumableWorkflow
            ? {
                source: resumableWorkflow.executionPlan.source,
                reason: resumableWorkflow.executionPlan.reason,
                requiresConfirmation: resumableWorkflow.pendingInput?.field === "confirmation",
                primaryAction: workflowAction,
                capabilityId: resumableWorkflow.steps[resumableWorkflow.currentStep]?.capabilityId ?? "general.chat",
                plannerTelemetry: null,
              }
            : null,
        }),
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
        confirmRequired: false,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    const executionPayload = {
      ...(conversationMemory?.leadId ? { leadId: conversationMemory.leadId } : {}),
      ...(conversationMemory?.propertyId ? { propertyId: conversationMemory.propertyId } : {}),
      ...(conversationMemory?.documentId ? { documentId: conversationMemory.documentId } : {}),
      ...(effectiveAttachments.length > 0 ? { attachments: effectiveAttachments } : {}),
      context: normalizedContext,
    }
    const attachmentAnalysis = resumableWorkflow
      ? {
          executionMessage: structuredSelectionMessage ?? message,
          propertyDrafts: [],
          primaryPropertyDraft: null,
          propertyConfirmationText: null,
          imageUrl: null,
        }
      : await runCosAttachmentPipeline({
          message: structuredSelectionMessage ?? message,
          attachments: effectiveAttachments,
          requestedAction: resolvedRequestedAction,
        })
    const executionMessage = attachmentAnalysis.executionMessage
      const pendingInput = null
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
                requestedAction: resolvedRequestedAction ?? undefined,
                pendingInput,
                context: {
                ...normalizedContext,
                message: executionMessage,
              },
              intentConfidence: intentResolution.confidence,
              intentReason: intentResolution.reason,
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
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction,
          intentResolution: {
            requestedAction: intentResolution.requestedAction,
            confidence: intentResolution.confidence,
            reason: intentResolution.reason,
            workflowDecision: intentResolution.workflowDecision,
            candidates: intentResolution.candidates,
          },
          executionPlan: executionPlan
            ? {
                source: executionPlan.source,
                reason: executionPlan.reason,
                requiresConfirmation: executionPlan.requiresConfirmation,
                primaryAction: executionPlan.primaryStep.action,
                capabilityId: executionPlan.primaryStep.capabilityId,
                plannerTelemetry: executionPlan.telemetry,
              }
            : null,
        }),
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
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction,
          intentResolution: {
            requestedAction: intentResolution.requestedAction,
            confidence: intentResolution.confidence,
            reason: intentResolution.reason,
            workflowDecision: intentResolution.workflowDecision,
            candidates: intentResolution.candidates,
          },
          executionPlan: resumableWorkflow
            ? {
                source: resumableWorkflow.executionPlan.source,
                reason: resumableWorkflow.executionPlan.reason,
                requiresConfirmation: true,
                primaryAction: action,
                capabilityId: resumableWorkflow.steps[resumableWorkflow.currentStep]?.capabilityId ?? "general.chat",
                plannerTelemetry: null,
              }
            : null,
        }),
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
        intentResolution,
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
            payload: {
              ...executionPayload,
              context: {
                ...normalizedContext,
                message: executionMessage,
                workflow,
              },
            },
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
          title: "Erro no COS",
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
        ? buildStructuredNextStepOptions(action, actionMetadata)
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
      intentResolution,
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
      decisionAudit: buildDecisionAudit({
        fastAction,
        requestedAction,
        effectiveRequestedAction,
        resolvedRequestedAction,
        intentResolution: {
          requestedAction: intentResolution.requestedAction,
          confidence: intentResolution.confidence,
          reason: intentResolution.reason,
          workflowDecision: intentResolution.workflowDecision,
          candidates: intentResolution.candidates,
        },
        executionPlan: {
          source: executionPlan?.source ?? workflow.executionPlan.source,
          reason: executionPlan?.reason ?? workflow.executionPlan.reason,
          requiresConfirmation: executionPlan?.requiresConfirmation ?? false,
          primaryAction: action,
          capabilityId: executionPlan?.primaryStep.capabilityId ?? workflow.steps[workflow.currentStep]?.capabilityId ?? "general.chat",
          plannerTelemetry: executionPlan?.telemetry ?? null,
        },
      }),
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
      return NextResponse.json({ error: "O COS está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não consegui concluir sua ação agora. Tente novamente em instantes." }, { status: 500 })
  }
}
