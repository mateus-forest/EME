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
  applyCosAiDialogueInterpretation,
  buildCosConversationSnapshot,
  cancelWorkflow,
  classifyCosPendingReply,
  buildCosConfirmationResponseViewModel,
  buildCosExecutionResponseViewModel,
  buildCosSimpleResponseViewModel,
  createCosNormalizedContext,
  createWorkflowFromExecutionPlan,
  doesCosCapabilityMutateData,
  evaluateCosAiDialogueInterpretationTrigger,
  formatWorkflowOperationDetails,
  getActiveWorkflow,
  getConversationMemory,
  getConversationSnapshot,
  generateCosAiDialogueInterpretation,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityLabel,
  hasCosPendingRejectionFollowUp,
  isCosCapabilityAvailableOnSurface,
  normalizeCosAttachments,
  planCosExecution,
  rebuildExecutionPlanFromWorkflow,
  resolveCosDialogueDecision,
  resolveCosContextualTurn,
  resumeWorkflowExecution,
  resumeWorkflowState,
  runCosAttachmentPipeline,
  sanitizeWorkspaceContext,
  shouldConfirmWorkflowMessage,
  shouldPreserveCosPendingWorkflow,
  shouldResumeWorkflow,
  stringifyConversationWorkflowContent,
  updateWorkflowFromExecutionResult,
  updateCosConversationSnapshot,
  COS_RECENT_MESSAGE_LIMIT,
  type CosAttachmentInput as CosIncomingAttachment,
  type CosDialogueDecision,
  type CosKnowledgeContext,
  type CosResponseViewModel,
  type CosWorkflow,
} from "@/lib/cos"
import { mapAttachmentDraftToPendingPropertyData } from "@/lib/cos/attachment-analysis"
import { getCosCapabilityDescriptorByAliasOrAction } from "@/lib/cos/capability-catalog"
import { classifyCosSocialIntent, getSafeFirstName } from "@/lib/cos/conversation"
import { resolveFastCosAction } from "@/lib/cos/fast-action-resolver"
import { resolveCosIntent } from "@/lib/cos/intent-resolver"
import { buildCosKnowledgeAudit, retrieveCosKnowledge } from "@/lib/cos/knowledge/retrieval"
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
import { isCosV2RuntimeEnabled } from "@/lib/cos-v2/runtime-flag"
import { handleCosV2Post } from "@/app/api/assistant/eme/v2-runtime"

export const dynamic = "force-dynamic"
const COS_PROCESSING_LEASE_MS = 30 * 60 * 1000

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

function pickConfirmationData(payload: Record<string, unknown>) {
  const frozen: Record<string, string> = {}
  for (const field of ["leadId", "propertyId", "contractId", "documentId", "proposalId", "agendaEventId", "eventId", "campaignId"] as const) {
    const value = cleanText(payload[field], 191)
    if (value) frozen[field] = value
  }
  return frozen
}

class CosConversationConflictError extends Error {
  constructor(message = "Esta conversa mudou enquanto a ação era processada.") {
    super(message)
    this.name = "CosConversationConflictError"
  }
}

async function persistConversationWorkflow(
  input: {
    conversationId: string
    brokerId: string
    expectedContent: string
    workflow: CosWorkflow | null
    memory?: import("@/lib/cos").CosConversationMemory | null
    snapshot?: import("@/lib/cos").CosConversationSnapshot | null
  },
) {
  const content = stringifyConversationWorkflowContent(input.workflow, input.memory, input.snapshot)
  const updated = await prisma.brokerDocument.updateMany({
    where: {
      id: input.conversationId,
      brokerId: input.brokerId,
      type: "cos_conversation",
      status: { not: "archived" },
      content: input.expectedContent,
    },
    data: { content },
  })
  if (updated.count !== 1) throw new CosConversationConflictError()

  const conversation = await prisma.brokerDocument.findFirst({
    where: {
      id: input.conversationId,
      brokerId: input.brokerId,
      type: "cos_conversation",
      status: { not: "archived" },
    },
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
  if (!conversation) throw new CosConversationConflictError("Esta conversa não está mais disponível.")
  return { conversation, content }
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

// Opções fornecidas pela capability só chegam à apresentação quando representam uma escolha
// explicitamente solicitada. Seleções necessárias do workflow são tratadas separadamente.
function parseCapabilityProvidedOptions(value: unknown): CosResponseOption[] | null {
  if (!Array.isArray(value)) return null

  const options = value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.id === "string" && typeof item.label === "string")
    .map((item) =>
      buildStructuredOption({
        id: item.id as string,
        actionId: typeof item.actionId === "string" ? item.actionId : (item.id as string),
        selectedOptionId: typeof item.selectedOptionId === "string" ? item.selectedOptionId : undefined,
        label: item.label as string,
        message: typeof item.message === "string" ? item.message : (item.label as string),
        description: typeof item.description === "string" ? item.description : undefined,
        action: typeof item.action === "string" ? item.action : null,
        href: typeof item.href === "string" ? item.href : undefined,
      }),
    )

  return options.length > 0 ? options : null
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
  dialogueDecision?: CosDialogueDecision | null
  knowledgeContext?: CosKnowledgeContext | null
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
    dialogue:
      input.dialogueDecision
        ? {
            act: input.dialogueDecision.dialogueAct,
            confidence: input.dialogueDecision.dialogueActConfidence,
            evidence: input.dialogueDecision.dialogueActEvidence,
            primaryDomain: input.dialogueDecision.primaryDomain,
            secondaryDomains: input.dialogueDecision.secondaryDomains,
            reference: {
              type: input.dialogueDecision.reference.type,
              id: input.dialogueDecision.reference.id,
              reason: input.dialogueDecision.reference.reason,
              ambiguousIds: input.dialogueDecision.reference.ambiguousIds,
            },
            objective: input.dialogueDecision.objective,
            selectedCapability: input.dialogueDecision.selectedCapabilityId,
            selectedAction: input.dialogueDecision.selectedAction,
            candidateCapabilities: input.dialogueDecision.candidateCapabilities.map((candidate) => ({
              capabilityId: candidate.capabilityId,
              action: candidate.action,
              confidence: candidate.confidence,
              evidence: candidate.evidence,
            })),
            workflowDecision: input.dialogueDecision.workflowDecision,
            clarificationReason: input.dialogueDecision.clarificationReason,
            source: input.dialogueDecision.source,
            semanticInterpretation: input.dialogueDecision.semanticInterpretation ?? null,
          }
        : null,
    knowledge: buildCosKnowledgeAudit(input.knowledgeContext),
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

function buildNaturalClarificationResponse(input: {
  reason: string | null
  primaryDomain: CosDialogueDecision["primaryDomain"]
  hasActiveLead: boolean
  semanticQuestion?: string | null
}) {
  if (input.semanticQuestion?.trim()) return input.semanticQuestion.trim()
  switch (input.reason) {
    case "property_search_context_incomplete":
    case "property_search_location_missing":
      return input.hasActiveLead
        ? "Qual cidade ou região devo considerar na busca?"
        : "Que tipo de imóvel você procura e em qual cidade ou região?"
    case "required_entity_unresolved":
      if (input.primaryDomain === "lead") return "Qual cliente você quer usar? Pode informar o nome."
      if (input.primaryDomain === "property") return "Qual imóvel você quer usar? Pode informar o título ou endereço."
      if (input.primaryDomain === "proposal") return "Qual proposta você quer usar?"
      if (input.primaryDomain === "contract") return "Qual contrato você quer usar?"
      if (input.primaryDomain === "studio") return "Qual imóvel você quer usar no Studio IA?"
      return "Qual item você quer usar para continuar?"
    case "entity_reference_ambiguous":
    case "lead_target_ambiguous":
      return "Encontrei mais de uma possibilidade. Qual delas você quer usar?"
    case "studio_parameters_missing":
      return "Qual imóvel e qual formato de campanha você quer criar?"
    case "property_draft_data_missing":
      return "Envie o endereço e os dados principais do imóvel para eu continuar o cadastro."
    case "agenda_time_missing":
    case "temporal_input_ambiguous":
      return "Qual é o dia e o horário do compromisso?"
    case "proposal_property_missing":
      return "Qual imóvel deve entrar na proposta?"
    case "performance_metric_ambiguous":
      return "Você quer comparar visualizações, contatos, conversões ou propostas?"
    case "semantic_capability_unavailable":
      return "Entendi o objetivo, mas essa ação ainda não está disponível no COS. Quer seguir por uma operação existente?"
    case "semantic_confidence_below_risk_threshold":
      return "Só para confirmar: qual ação você quer fazer?"
    default:
      return "O que você quer fazer e com qual item?"
  }
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
      return NextResponse.json({ error: "O serviço do COS está indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível carregar o COS." }, { status: 500 })
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
    return NextResponse.json({ error: "Informe o status do COS." }, { status: 400 })
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
      return NextResponse.json({ error: "O serviço do COS está indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível atualizar o COS." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (isCosV2RuntimeEnabled()) return handleCosV2Post(request)

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
  const optionActionId = cleanText(body?.optionActionId, 200)
  let isCancellation = Boolean(body?.cancel)
  const rawRequestedAction = cleanText(body?.action ?? body?.actionType, 80)
  const requestedDescriptor = getCosCapabilityDescriptorByAliasOrAction(rawRequestedAction)
  const requestedAction = rawRequestedAction === "workflow_details"
    ? rawRequestedAction
    : requestedDescriptor?.action ?? rawRequestedAction
  const isWorkflowDetailsRequest = requestedAction === "workflow_details"
  const attachments = sanitizeIncomingAttachments(body?.attachments)
  const socialIntent = classifyCosSocialIntent(message)
  // Pre-flight estimate used only to gate on balance before the real plan is known. Defaults to 1
  // like before for the vast majority of messages (no requestedAction at all). Conversa social,
  // general.chat e as capabilities gratuitas precisam começar em 0 — caso contrário um corretor
  // sem saldo é bloqueado antes de o roteamento descobrir que conversar com o COS é ilimitado.
  // Cancelamentos também devem ser 0 sem consultar a tabela: cancelar nunca cobra
  // crédito, e getEmeCreditCost lança em dev para actions ainda não cadastradas (ex.: CANCEL_CONTRACT),
  // o que quebrava o botão "Cancelar ação" com 500 antes mesmo de processar o cancelamento.
  let creditsUsed: number = isWorkflowDetailsRequest || isCancellation || socialIntent || requestedAction === "general"
    ? 0
    : requestedAction
      ? getEmeCreditCost(requestedAction)
      : 1

  if (!message) {
    return NextResponse.json({ error: "Digite uma mensagem para o COS." }, { status: 400 })
  }

  if (optionActionId && rawRequestedAction && !requestedDescriptor && rawRequestedAction !== "workflow_details") {
    return NextResponse.json({ error: "Esta opção não está mais disponível. Escolha uma ação atualizada." }, { status: 409 })
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

    const conversationMemory = conversationDocument ? getConversationMemory(conversationDocument.content) : null
    const activeWorkflow = conversationDocument ? getActiveWorkflow(conversationDocument.content) : null
    if (activeWorkflow?.status === "processing" && !activeWorkflow.pendingInput) {
      const processingAge = Date.now() - Date.parse(activeWorkflow.updatedAt)
      if (conversationDocument && Number.isFinite(processingAge) && processingAge > COS_PROCESSING_LEASE_MS) {
        const expiredAt = new Date().toISOString()
        const expiredWorkflow: CosWorkflow = {
          ...activeWorkflow,
          status: "failed",
          steps: activeWorkflow.steps.map((step, index) => index === activeWorkflow.currentStep
            ? { ...step, status: "failed", errorMessage: "COS_WORKFLOW_LEASE_EXPIRED" }
            : step),
          pendingInput: null,
          updatedAt: expiredAt,
          completedAt: expiredAt,
        }
        const persistedSnapshot = getConversationSnapshot(conversationDocument.content)
        await persistConversationWorkflow({
          conversationId: conversationDocument.id,
          brokerId: user.broker.id,
          expectedContent: conversationDocument.content,
          workflow: expiredWorkflow,
          memory: conversationMemory,
          snapshot: persistedSnapshot
            ? { ...persistedSnapshot, activeWorkflow: expiredWorkflow, pendingInput: null, updatedAt: expiredAt }
            : null,
        })
        return NextResponse.json({ error: "A execução anterior expirou. Verifique o resultado antes de repetir a ação." }, { status: 409 })
      }
      return NextResponse.json({ error: "Esta ação já está em processamento." }, { status: 409 })
    }
    const activePendingAction = activeWorkflow?.pendingInput?.action ?? activeWorkflow?.steps[activeWorkflow.currentStep]?.action ?? null
    const isBoundPendingConfirmationResponse = Boolean(
      body?.confirm &&
      activeWorkflow?.pendingInput?.field === "confirmation" &&
      Boolean(requestedAction) &&
      requestedAction === activePendingAction,
    )
    if (body?.confirm && !isBoundPendingConfirmationResponse) {
      return NextResponse.json({ error: "Esta confirmação não corresponde mais à ação pendente." }, { status: 409 })
    }
    if (body?.cancel && (!activeWorkflow?.pendingInput || !requestedAction || requestedAction !== activePendingAction)) {
      return NextResponse.json({ error: "Esta ação pendente não está mais ativa." }, { status: 409 })
    }
    const decisionMessage = body?.confirm ? "confirmar" : body?.cancel ? "cancelar" : message
    const pendingReply = activeWorkflow?.pendingInput ? classifyCosPendingReply(decisionMessage) : "answer"
    const rejectionHasFollowUp = pendingReply === "reject" && hasCosPendingRejectionFollowUp(message)
    if (pendingReply === "cancel" || pendingReply === "reject") creditsUsed = 0
    if (pendingReply === "cancel" || (pendingReply === "reject" && !rejectionHasFollowUp)) {
      isCancellation = true
    }
    const preflightDialogueDecision = resolveCosDialogueDecision({
      message: decisionMessage,
      requestedAction,
      surface,
      workspace,
      snapshot: getConversationSnapshot(conversationDocument?.content),
      activeWorkflow,
      memory: conversationMemory,
      attachments,
    })
    if (["social", "explain", "capability_question", "context"].includes(preflightDialogueDecision.dialogueAct)) {
      creditsUsed = 0
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

    const recentMessageRows = conversationDocument
      ? await prisma.emeMessage.findMany({
          where: {
            brokerId: user.broker.id,
            channel: "assessor_eme",
            metadata: { path: ["conversationId"], equals: conversationDocument.id },
          },
          orderBy: { createdAt: "desc" },
          take: COS_RECENT_MESSAGE_LIMIT,
          select: {
            id: true,
            message: true,
            response: true,
            actionType: true,
            actionStatus: true,
            leadId: true,
            propertyId: true,
            metadata: true,
            createdAt: true,
          },
        }).then((messages) => messages.reverse())
      : []
    const conversationSnapshot = buildCosConversationSnapshot({
      conversationId: conversationDocument?.id ?? conversationIdFromBody,
      message,
      recentMessages: recentMessageRows,
      activeWorkflow,
      memory: conversationMemory,
      persistedSnapshot: getConversationSnapshot(conversationDocument?.content),
      workspace,
    })
    const contextualTurn = resolveCosContextualTurn({
      message,
      snapshot: conversationSnapshot,
      activeWorkflow,
    })
    const contextualActiveWorkflow = contextualTurn.workflow
    const structuredSelectionMessage = resolveStructuredSelectionMessage(contextualActiveWorkflow, selectedOptionId)
    const structuredSelectionAction =
      structuredSelectionMessage &&
      selectedOptionId &&
      contextualActiveWorkflow &&
      optionActionId === `workflow_selection:${contextualActiveWorkflow.id}:${selectedOptionId}`
        ? contextualActiveWorkflow.pendingInput?.action ??
          contextualActiveWorkflow.steps[contextualActiveWorkflow.currentStep]?.action ??
          contextualActiveWorkflow.executionPlan.requestedAction ??
          null
        : null
    const runtimeRequestedAction = structuredSelectionAction ?? requestedAction
    // Anexos pertencem ao turno que os enviou ou ao workflow ainda ativo. Depois que o fluxo
    // termina, não reaproveite arquivos antigos em uma nova intenção: isso evitava que um PDF,
    // vídeo ou imagem mudasse silenciosamente o domínio de mensagens posteriores.
    const effectiveAttachments = attachments.length > 0
      ? attachments
      : contextualActiveWorkflow
        ? conversationMemory?.attachments ?? []
        : []
    let dialogueDecision = resolveCosDialogueDecision({
      message: structuredSelectionMessage ?? decisionMessage,
      requestedAction: runtimeRequestedAction,
      surface,
      workspace,
      snapshot: conversationSnapshot,
      activeWorkflow: contextualActiveWorkflow,
      memory: conversationMemory,
      attachments: effectiveAttachments,
    })
    const semanticTrigger = evaluateCosAiDialogueInterpretationTrigger({
      message: structuredSelectionMessage ?? decisionMessage,
      requestedAction: runtimeRequestedAction,
      structuredInteraction: Boolean(optionActionId || selectedOptionId || body?.confirm || body?.cancel),
      pendingInput: contextualActiveWorkflow?.pendingInput ?? conversationSnapshot.pendingInput,
      decision: dialogueDecision,
      attachments: effectiveAttachments,
    })
    if (semanticTrigger.shouldTry) {
      const semanticResult = await runWithAiOperationContext(
        {
          route: "/api/assistant/eme",
          source: metadataSource,
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          conversationId: conversationDocument?.id ?? null,
          workflowId: contextualActiveWorkflow?.id ?? null,
        },
        () => generateCosAiDialogueInterpretation({
          message: structuredSelectionMessage ?? decisionMessage,
          surface,
          workspace,
          snapshot: conversationSnapshot,
          activeWorkflow: contextualActiveWorkflow,
          pendingInput: contextualActiveWorkflow?.pendingInput ?? conversationSnapshot.pendingInput,
          attachments: effectiveAttachments,
          baselineDecision: dialogueDecision,
          triggerReason: semanticTrigger.triggerReason ?? "semantic_context",
        }),
      )
      if (semanticResult.accepted) {
        const validated = applyCosAiDialogueInterpretation({
          baseline: dialogueDecision,
          interpretation: semanticResult.data,
          surface,
          workspace,
          snapshot: conversationSnapshot,
          activeWorkflow: contextualActiveWorkflow,
        })
        if (validated.accepted) dialogueDecision = validated.decision
        console.info("[cos][semantic-interpreter]", {
          status: validated.accepted ? "accepted" : "rejected",
          triggerReason: semanticTrigger.triggerReason,
          model: semanticResult.audit.model,
          confidence: semanticResult.audit.confidence,
          validationErrors: validated.validationErrors,
          selectedCapabilityId: dialogueDecision.selectedCapabilityId,
          source: dialogueDecision.source,
        })
      } else {
        console.info("[cos][semantic-interpreter]", {
          status: semanticResult.audit.status,
          triggerReason: semanticTrigger.triggerReason,
          fallbackReason: semanticResult.audit.fallbackReason,
          validationErrors: semanticResult.audit.validationErrors,
        })
      }
    }
    const normalizedContext = createCosNormalizedContext({
      brokerId: user.broker.id,
      userId: user.id,
      actor: {
        firstName: getSafeFirstName(user.name),
      },
      surface,
      message: structuredSelectionMessage ?? message,
      workspace,
      workflow: contextualActiveWorkflow,
      memory: conversationMemory,
      snapshot: conversationSnapshot,
      decision: dialogueDecision,
      attachments: effectiveAttachments,
    })
    const contextualActionIsReadOnly = Boolean(
      contextualTurn.requestedAction && !doesCosCapabilityMutateData(contextualTurn.requestedAction),
    )
    const contextualRequestedAction =
      (["query", "select", "return_topic"].includes(dialogueDecision.dialogueAct) && contextualActionIsReadOnly) ||
      (contextualTurn.reason === "active_lead_contact_followup" && dialogueDecision.dialogueAct === "execute")
        ? contextualTurn.requestedAction
        : null
    const decisionAllowsFastFallback = !dialogueDecision.selectedAction ||
      (dialogueDecision.source === "fallback" && dialogueDecision.selectedAction === "general")
    const fastAction =
      !runtimeRequestedAction &&
      !contextualRequestedAction &&
      decisionAllowsFastFallback &&
      !isCancellation &&
      !socialIntent &&
      dialogueDecision.dialogueAct === "unknown" &&
      !["explain", "capability_question", "correct", "confirm", "reject", "cancel", "provide_input"].includes(dialogueDecision.dialogueAct)
        ? resolveFastCosAction({
            message,
            workspace,
            context: normalizedContext,
          })
        : { kind: "none" as const, confidence: 0 }
    const decisionSelectedAction =
      dialogueDecision.source === "fallback" && dialogueDecision.selectedAction === "general"
        ? null
        : dialogueDecision.selectedAction
    const effectiveRequestedAction =
      runtimeRequestedAction ||
      decisionSelectedAction ||
      contextualRequestedAction ||
      (fastAction.kind === "workflow_action" || fastAction.kind === "workflow_details" ? fastAction.action : null) ||
      dialogueDecision.selectedAction ||
      (socialIntent ? "general" : null)

    if (fastAction.kind === "clarify") {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      const responseView = buildCosSimpleResponseViewModel({
        kind: "awaiting_input",
        text: fastAction.reply,
      })
      const responseText = responseView.text
      const interactionMetadata = {
        responseView: responseView as unknown as Prisma.InputJsonObject,
        interactionType: responseView.interactionType,
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
        options: null,
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction: null,
          dialogueDecision,
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
            response: responseText,
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
            response: responseText,
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
        response: responseText,
        responseView,
        action: "general",
        actionStatus: "needs_clarification",
        metadata: interactionMetadata,
        creditsUsed: 0,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
    }

    const intentResolution = resolveCosIntent({
      message: structuredSelectionMessage ?? decisionMessage,
      requestedAction: effectiveRequestedAction,
      attachments: effectiveAttachments,
      workspace,
      activeWorkflow: contextualActiveWorkflow,
      memory: conversationMemory,
      context: normalizedContext,
      decision: dialogueDecision,
      isExplicitAction: Boolean(runtimeRequestedAction),
    })
    dialogueDecision = intentResolution.dialogueDecision
    const knowledgeContext = await retrieveCosKnowledge({
      message: structuredSelectionMessage ?? message,
      decision: dialogueDecision,
    })
    const decisionContext = {
      ...normalizedContext,
      decision: dialogueDecision,
      knowledge: knowledgeContext,
    }
    const resolvedRequestedAction = intentResolution.requestedAction ?? effectiveRequestedAction
    const activeWorkflowAction =
      contextualActiveWorkflow?.steps[contextualActiveWorkflow.currentStep]?.action ??
      contextualActiveWorkflow?.executionPlan.requestedAction ??
      null
    const structuredOptionContinuesWorkflow = Boolean(
      optionActionId && activeWorkflowAction && resolvedRequestedAction === activeWorkflowAction,
    )
    const naturalWorkflowContinuation = Boolean(
      contextualActiveWorkflow?.pendingInput &&
      !requestedAction &&
      ["provide_input", "correct", "confirm", "select"].includes(dialogueDecision.dialogueAct),
    )
    const rejectionStartsNewAction = Boolean(
      rejectionHasFollowUp &&
      dialogueDecision.workflowDecision === "start_new" &&
      resolvedRequestedAction &&
      resolvedRequestedAction !== activeWorkflowAction,
    )
    if (pendingReply === "reject" && !rejectionStartsNewAction) isCancellation = true
    const hasExplicitNewAction =
      Boolean(effectiveRequestedAction) &&
      effectiveRequestedAction !== "workflow_details" &&
      !isCancellation
    const workflowDomainsCompatible =
      !hasExplicitNewAction ||
      !activeWorkflowAction ||
      getCosActionDomain(activeWorkflowAction) === getCosActionDomain(effectiveRequestedAction)
    const resumableWorkflow =
      (isBoundPendingConfirmationResponse || structuredOptionContinuesWorkflow || naturalWorkflowContinuation || shouldResumeWorkflow(contextualActiveWorkflow, message)) &&
      (intentResolution.workflowDecision !== "start_new" || structuredOptionContinuesWorkflow || naturalWorkflowContinuation) &&
      workflowDomainsCompatible
        ? contextualActiveWorkflow
        : null

    const propertyHandlerWillResolveClient = Boolean(
      resolvedRequestedAction === "searchProperties" &&
      dialogueDecision.secondaryDomains.includes("lead") &&
      !conversationSnapshot.activeEntities.lead?.id &&
      workspace?.entity !== "lead",
    )
    const runtimeClarificationReason = dialogueDecision.clarificationReason
    const shouldClarifyBeforeExecution = !propertyHandlerWillResolveClient && (
      intentResolution.confidence < 0.6 || dialogueDecision.needsClarification
    )

    if (!isCancellation && !isBoundPendingConfirmationResponse && shouldClarifyBeforeExecution) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      const clarificationText = runtimeClarificationReason === "selection_context_missing"
        ? "Preciso saber a qual item você está se referindo. Mostre a lista novamente ou informe o nome do cliente, imóvel, proposta ou contrato."
        : runtimeClarificationReason === "return_topic_not_found"
          ? "Não encontrei esse assunto entre os tópicos recentes. Diga qual cliente, imóvel, proposta ou contrato você quer retomar."
          : buildNaturalClarificationResponse({
              reason: runtimeClarificationReason,
              primaryDomain: dialogueDecision.primaryDomain,
              hasActiveLead: Boolean(conversationSnapshot.activeEntities.lead?.id || workspace?.entity === "lead"),
              semanticQuestion: dialogueDecision.semanticInterpretation?.clarificationQuestion,
            })
      const responseView = buildCosSimpleResponseViewModel({ kind: "awaiting_input", text: clarificationText })
      const clarificationResponse = responseView.text
      const interactionMetadata = {
        responseView: responseView as unknown as Prisma.InputJsonObject,
        interactionType: responseView.interactionType,
        source: metadataSource,
        parsedIntent: "general",
        actionName: "general",
        brokerId: user.broker.id,
        visualAction: "Aclaracao de intencao",
        intentResolution,
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        options: null,
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction,
          dialogueDecision,
          knowledgeContext,
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
        responseView,
        action: "general",
        actionStatus: "needs_clarification",
        metadata: interactionMetadata,
        creditsUsed: 0,
        conversation: updatedConversation ? serializeConversation(updatedConversation) : null,
        ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 }, aiAssistantEnabled: true }),
      })
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
        : "Não existe nenhuma operação em andamento no momento.\n\nVocê pode iniciar uma nova operação digitando um comando ou utilizando os atalhos rápidos."
      const interactionMetadata = {
        source: metadataSource,
        parsedIntent: workflowAction,
        actionName: workflowAction,
        brokerId: user.broker.id,
        visualAction: "Detalhes da operação",
        workflow: workflowMetadata(resumableWorkflow),
        conversationId: conversationDocument?.id ?? conversationIdFromBody,
        displayMessage,
        options: buildWorkflowDetailOptions(resumableWorkflow),
        decisionAudit: buildDecisionAudit({
          fastAction,
          requestedAction,
          effectiveRequestedAction,
          resolvedRequestedAction,
          dialogueDecision,
          knowledgeContext,
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
      ...(conversationMemory?.campaignId ? { campaignId: conversationMemory.campaignId } : {}),
      ...(conversationSnapshot.activeEntities.lead?.id ? { leadId: conversationSnapshot.activeEntities.lead.id } : {}),
      ...(conversationSnapshot.activeEntities.property?.id ? { propertyId: conversationSnapshot.activeEntities.property.id } : {}),
      ...(conversationSnapshot.activeEntities.contract?.id ? { contractId: conversationSnapshot.activeEntities.contract.id } : {}),
      ...(conversationSnapshot.activeEntities.proposal?.id ? { documentId: conversationSnapshot.activeEntities.proposal.id } : {}),
      ...(conversationSnapshot.activeEntities.agenda?.id ? { agendaEventId: conversationSnapshot.activeEntities.agenda.id } : {}),
      ...contextualTurn.payload,
      ...(effectiveAttachments.length > 0 ? { attachments: effectiveAttachments } : {}),
      context: decisionContext,
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
                isExplicitAction: Boolean(
                  requestedAction ||
                  fastAction.kind === "workflow_action" ||
                  fastAction.kind === "workflow_details"
                ),
                pendingInput,
                context: {
                  ...decisionContext,
                  message: executionMessage,
                },
              intentConfidence: intentResolution.confidence,
              intentReason: intentResolution.reason,
              surface,
              workspace,
              activeWorkflow: contextualActiveWorkflow ?? null,
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
      const responseView = buildCosSimpleResponseViewModel({
        kind: "cancelled",
        text: cancelledWorkflow ? "Tudo bem. Não vou continuar com isso." : "Tudo bem. Não executei a alteração.",
      })
      const responseText = responseView.text
      const interactionMetadata = {
        responseView: responseView as unknown as Prisma.InputJsonObject,
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
          dialogueDecision,
          knowledgeContext,
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

      let persistedConversation = conversationDocument
      if (cancelledWorkflow && conversationDocument) {
        const persisted = await persistConversationWorkflow({
          conversationId: conversationDocument.id,
          brokerId: user.broker.id,
          expectedContent: conversationDocument.content,
          workflow: cancelledWorkflow,
          memory: conversationMemory,
          snapshot: updateCosConversationSnapshot({
            snapshot: conversationSnapshot,
            message,
            workflow: cancelledWorkflow,
            result: null,
            status: "cancelled",
          }),
        })
        persistedConversation = persisted.conversation
      }

      const [updatedBroker, touchedConversation] = await Promise.all([
        getBrokerCredits(user.broker.id),
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
        responseView,
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
      const responseView = buildCosConfirmationResponseViewModel({
        action,
        capabilityTitle: getCosCapabilityLabel(action),
        prompt: buildCosHomeConfirmationResponse(action),
      })
      const responseText = responseView.text
      const interactionMetadata = {
        responseView: responseView as unknown as Prisma.InputJsonObject,
        interactionType: responseView.interactionType,
        confirmationPrompt: responseView.confirmation?.prompt,
        confirmationConfirmLabel: responseView.confirmation?.confirmLabel,
        confirmationCancelLabel: responseView.confirmation?.cancelLabel,
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
          dialogueDecision,
          knowledgeContext,
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
        responseView,
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
        confirmationData: pickConfirmationData(executionPayload),
      })
      if (pendingWorkflow.pendingInput?.action === "createPropertyDraft" && attachmentAnalysis.primaryPropertyDraft) {
        pendingWorkflow.pendingInput = {
          ...pendingWorkflow.pendingInput,
          parsedData: mapAttachmentDraftToPendingPropertyData(attachmentAnalysis.primaryPropertyDraft, message, attachmentAnalysis.imageUrl),
        }
      }
      const responseView = buildCosConfirmationResponseViewModel({
        action,
        capabilityTitle: getCosCapabilityLabel(action),
        prompt: executionPlan.confirmationMessage ?? buildCosHomeConfirmationResponse(action),
      })
      const responseText = responseView.text
      const interactionMetadata = {
        responseView: responseView as unknown as Prisma.InputJsonObject,
        interactionType: responseView.interactionType,
        confirmationPrompt: responseView.confirmation?.prompt,
        confirmationConfirmLabel: responseView.confirmation?.confirmLabel,
        confirmationCancelLabel: responseView.confirmation?.cancelLabel,
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

      if (conversationDocument) {
        await persistConversationWorkflow({
          conversationId: conversationDocument.id,
          brokerId: user.broker.id,
          expectedContent: conversationDocument.content,
          workflow: pendingWorkflow,
          memory: buildConversationMemory({
            current: conversationMemory,
            workflow: pendingWorkflow,
            action,
            message: displayMessage || message,
            attachments: effectiveAttachments,
          }),
          snapshot: updateCosConversationSnapshot({
            snapshot: conversationSnapshot,
            message,
            workflow: pendingWorkflow,
            result: null,
            status: "awaiting_input",
          }),
        })
      }

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
        responseView,
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
    const isConfirmedPendingWorkflow = Boolean(
      resumableWorkflow?.pendingInput?.field === "confirmation" &&
      shouldConfirmWorkflowMessage(decisionMessage, Boolean(body?.confirm)),
    )
    const executionMutatesData = workflow.steps
      .slice(workflow.currentStep)
      .some((step) => doesCosCapabilityMutateData(step.action))

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

    let workflowContentVersion = conversationDocument?.content ?? null
    if (executionMutatesData && conversationDocument) {
      const claimedAt = new Date().toISOString()
      const claimedWorkflow: CosWorkflow = {
        ...workflow,
        status: "processing",
        pendingInput: null,
        pausedAt: null,
        updatedAt: claimedAt,
      }
      const claimed = await persistConversationWorkflow({
        conversationId: conversationDocument.id,
        brokerId: user.broker.id,
        expectedContent: conversationDocument.content,
        workflow: claimedWorkflow,
        memory: conversationMemory,
        snapshot: {
          ...conversationSnapshot,
          activeWorkflow: claimedWorkflow,
          pendingInput: null,
          updatedAt: claimedAt,
        },
      })
      workflowContentVersion = claimed.content
    }

    let responseText = ""
    let responseView: CosResponseViewModel | null = null
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
            message: isConfirmedPendingWorkflow && resumableWorkflow
              ? resumableWorkflow.executionPlan.message
              : executionMessage,
            pendingReplyMessage: isConfirmedPendingWorkflow ? decisionMessage : undefined,
            confirm: shouldConfirmWorkflowMessage(message, Boolean(body?.confirm)),
            workspace,
            payload: {
              ...executionPayload,
              context: {
                ...decisionContext,
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
      if (updatedWorkflow.status === "failed") {
        errorMessage = executionResult.interruptedStep?.result?.status === "error"
          ? executionResult.interruptedStep.result.errorCode
          : executionResult.interruptedStep?.errorMessage ?? "COS_EXECUTION_FAILED"
      }

      finalCreditsUsed = getCosInteractionCreditCost(
        executionResult.executedSteps
          .filter((step) => step.status === "completed")
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
              ? `COS: workflow ${workflow.steps.map((step) => getCosCapabilityLabel(step.action)).join(" + ")}`
              : `COS: ${getCosCapabilityLabel(action)}`,
          metadata: {
            source: "api/assistant/eme",
            action,
            planId: workflow.id,
            steps: workflow.steps.map((step) => step.action),
          },
        })
      }

      const planForFormatting = executionPlan ?? rebuildExecutionPlanFromWorkflow(workflow)
      responseView = buildCosExecutionResponseViewModel({
        message: executionMessage,
        plan: planForFormatting,
        result: executionResult,
        decision: dialogueDecision,
      })
      responseText = responseView.text

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
      errorMessage = caughtActionError instanceof Error ? caughtActionError.message : "Erro na ação interna."
      responseView = buildCosSimpleResponseViewModel({
        kind: "error",
        text: getAssessorActionErrorResponse(action),
        title: "Não foi possível concluir",
      })
      responseText = responseView.text
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
    // Consultas e explicações podem interromper um pending sem destruir a operação transacional.
    // O resultado consultado entra no snapshot/topic stack, enquanto o workflow mutável permanece
    // disponível para uma retomada explícita e segura.
    const explicitlyDefersActiveWorkflow = /\b(?:depois eu|mais tarde|deixa(?: isso| essa| esse| a| o)? (?:pra|para) depois|fica (?:pra|para) depois)\b/i.test(message)
    const preservesActiveWorkflow = shouldPreserveCosPendingWorkflow({
      hasActiveWorkflow: Boolean(activeWorkflow),
      workflowDecision: dialogueDecision.workflowDecision,
      dialogueAct: dialogueDecision.dialogueAct,
      actionMutatesData: doesCosCapabilityMutateData(action),
      rejectionStartsNewAction,
      explicitlyDefersActiveWorkflow,
    })
    const isSocialTurn = dialogueDecision.dialogueAct === "social"
    const workflowToPersist = (
      isSocialTurn || (preservesActiveWorkflow && updatedWorkflow.status !== "awaiting_input")
    ) && activeWorkflow ? activeWorkflow : updatedWorkflow
    const nextConversationMemory = buildConversationMemory({
      current: conversationMemory,
      workflow: workflowToPersist,
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
    const nextConversationSnapshot = isSocialTurn
      ? {
          ...conversationSnapshot,
          activeWorkflow: workflowToPersist,
          pendingInput: workflowToPersist.pendingInput,
        }
      : updateCosConversationSnapshot({
          snapshot: conversationSnapshot,
          message: displayMessage || message,
          workflow: workflowToPersist,
          result: executionResult,
          status: actionStatus === "error" ? "error" : workflowToPersist.status === "awaiting_input" ? "awaiting_input" : "success",
        })
    // Apenas escolhas solicitadas pela capability e seleções necessárias do workflow viram opções.
    // Sugestões genéricas de próximo passo ficam no texto quando forem realmente úteis.
    const primaryStepMetadata = (executionResult?.executedSteps.at(-1)?.result?.metadata ?? {}) as Prisma.InputJsonObject
    const responseOptions =
      parseCapabilityProvidedOptions(primaryStepMetadata.options) ??
      buildWorkflowDetailOptions(updatedWorkflow)
    const plannedCapabilities = (executionPlan?.steps ?? workflow.steps).map((step) => step.capabilityId)
    const executedCapabilities = executionResult?.executedSteps.map((step) => step.capabilityId) ?? []
    const skippedCapabilities = plannedCapabilities.filter((capabilityId) => !executedCapabilities.includes(capabilityId))
    const interactionMetadata = {
      ...actionMetadata,
      responseView: responseView as unknown as Prisma.InputJsonObject,
      interactionType: responseView?.interactionType ?? "result",
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
      workflow: workflowMetadata(workflowToPersist),
      conversationSnapshot: {
        schemaVersion: nextConversationSnapshot.schemaVersion,
        currentTopic: nextConversationSnapshot.currentTopic,
        activeEntities: nextConversationSnapshot.activeEntities,
        selectionSetIds: nextConversationSnapshot.selectionSets.map((set) => set.id),
      },
      conversationId: conversationDocument?.id ?? conversationIdFromBody,
      displayMessage,
      attachments: effectiveAttachments,
      options: responseOptions,
      decisionAudit: buildDecisionAudit({
        fastAction,
        requestedAction,
        effectiveRequestedAction,
        resolvedRequestedAction,
        dialogueDecision,
        knowledgeContext,
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

    if (conversationDocument && workflowContentVersion !== null) {
      await persistConversationWorkflow({
        conversationId: conversationDocument.id,
        brokerId: user.broker.id,
        expectedContent: workflowContentVersion,
        workflow: workflowToPersist,
        memory: nextConversationMemory,
        snapshot: nextConversationSnapshot,
      })
    }

    const [updatedBroker, touchedConversation] = await Promise.all([
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
      responseView,
      action,
      actionStatus,
      metadata: interactionMetadata,
      creditsUsed: finalCreditsUsed,
      confirmRequired: workflowToPersist.pendingInput?.field === "confirmation",
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

    if (caughtError instanceof CosConversationConflictError) {
      return NextResponse.json({ error: caughtError.message }, { status: 409 })
    }

    return NextResponse.json({ error: "Não consegui concluir sua ação agora. Tente novamente em instantes." }, { status: 500 })
  }
}
