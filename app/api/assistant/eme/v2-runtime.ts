import "server-only"

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  DEFAULT_COS_CONVERSATION_TITLE,
  generateCosConversationTitle,
  isDefaultCosConversationTitle,
} from "@/lib/cos-conversations"
import { cleanText, type AssessorAction } from "@/lib/eme-backend"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import {
  consumeBrokerAiCredits,
  createInsufficientCreditsPayload,
  getBrokerAiCreditBalance,
  getCosInteractionCreditCost,
} from "@/lib/eme-plan-service"
import { getSafeFirstName } from "@/lib/cos/conversation"
import { buildCosConversationSnapshot, updateCosConversationSnapshot, COS_RECENT_MESSAGE_LIMIT } from "@/lib/cos/conversation-snapshot"
import { createCosNormalizedContext } from "@/lib/cos/context"
import { executeCosExecutionPlan } from "@/lib/cos/executor"
import { getCosCapabilityLabel, doesCosCapabilityMutateData } from "@/lib/cos/capability-catalog"
import { normalizeCosAttachments } from "@/lib/cos/attachment-pipeline"
import { sanitizeWorkspaceContext } from "@/lib/cos/workspace-context"
import {
  cancelWorkflow,
  createWorkflowFromExecutionPlan,
  getActiveWorkflow,
  getConversationMemory,
  getConversationSnapshot,
  rebuildExecutionPlanFromWorkflow,
  resumeWorkflowExecution,
  resumeWorkflowState,
  stringifyConversationWorkflowContent,
  updateWorkflowFromExecutionResult,
} from "@/lib/cos/workflow-engine"
import type {
  CosConversationMemory,
  CosConversationSnapshot,
  CosExecutionPlan,
  CosExecutionPlanResult,
  CosResponseViewModel,
  CosWorkflow,
  CosWorkspaceContext,
} from "@/lib/cos"
import { buildCosKnowledgeAudit } from "@/lib/cos/knowledge/retrieval"
import { buildCosV2CompactContext } from "@/lib/cos-v2/context"
import { listCosV2Capabilities, resolveCosV2Capability, validateCosV2Interpretation } from "@/lib/cos-v2/capabilities"
import { buildCosV2ExecutionPlan } from "@/lib/cos-v2/execution"
import { interpretCosV2Turn } from "@/lib/cos-v2/interpreter"
import { retrieveCosV2Knowledge } from "@/lib/cos-v2/knowledge"
import {
  buildCosV2Answer,
  buildCosV2CancelledResponse,
  buildCosV2ConfirmationResponse,
  buildCosV2ContextResponse,
  buildCosV2ExecutionResponse,
  buildCosV2ValidationResponse,
} from "@/lib/cos-v2/response"
import type { CosV2Domain, CosV2Interpretation } from "@/lib/cos-v2/types"

const COS_V2_PROCESSING_LEASE_MS = 30 * 60 * 1000

type ConversationDocument = {
  id: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

function asJson(value: unknown) {
  return value as Prisma.InputJsonObject
}

function serializeConversation(document: Pick<ConversationDocument, "id" | "title" | "createdAt" | "updatedAt">) {
  const updatedAt = document.updatedAt.toISOString()
  return {
    id: document.id,
    title: document.title,
    createdAt: document.createdAt.toISOString(),
    updatedAt,
    lastInteractionAt: updatedAt,
  }
}

function workflowMetadata(workflow: CosWorkflow | null) {
  return workflow ? {
    id: workflow.id,
    status: workflow.status,
    currentStep: workflow.currentStep,
    pendingInput: workflow.pendingInput,
    totalPausedMs: workflow.totalPausedMs,
    startedAt: workflow.startedAt,
    updatedAt: workflow.updatedAt,
    completedAt: workflow.completedAt,
  } : null
}

async function brokerCredits(brokerId: string) {
  const [broker, credits] = await Promise.all([
    prisma.broker.findUnique({ where: { id: brokerId }, select: { aiAssistantEnabled: true } }),
    getBrokerAiCreditBalance(brokerId),
  ])
  return {
    credits: { balance: credits.balance, usedThisMonth: credits.usedThisMonth },
    aiAssistantEnabled: broker?.aiAssistantEnabled ?? false,
  }
}

async function resolveConversation(brokerId: string, conversationId: string) {
  return prisma.brokerDocument.findFirst({
    where: { id: conversationId, brokerId, type: "cos_conversation", status: { not: "archived" } },
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
}

async function persistConversationState(input: {
  conversation: ConversationDocument
  brokerId: string
  expectedContent: string
  workflow: CosWorkflow | null
  memory: CosConversationMemory | null
  snapshot: CosConversationSnapshot | null
}) {
  const content = stringifyConversationWorkflowContent(input.workflow, input.memory, input.snapshot)
  const updated = await prisma.brokerDocument.updateMany({
    where: {
      id: input.conversation.id,
      brokerId: input.brokerId,
      type: "cos_conversation",
      status: { not: "archived" },
      content: input.expectedContent,
    },
    data: { content },
  })
  if (updated.count !== 1) throw new Error("COS_V2_CONVERSATION_CONFLICT")
  const conversation = await resolveConversation(input.brokerId, input.conversation.id)
  if (!conversation) throw new Error("COS_V2_CONVERSATION_NOT_FOUND")
  return { conversation, content }
}

async function touchConversation(conversation: ConversationDocument, message: string) {
  return prisma.brokerDocument.update({
    where: { id: conversation.id },
    data: isDefaultCosConversationTitle(conversation.title) ? { title: generateCosConversationTitle(message) } : {},
    select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
  })
}

function pickConfirmationData(payload: Record<string, unknown>) {
  const frozen: Record<string, string> = {}
  for (const field of ["leadId", "propertyId", "documentId", "proposalId", "agendaEventId"] as const) {
    const value = cleanText(payload[field], 191)
    if (value) frozen[field] = value
  }
  return frozen
}

function buildMemory(input: {
  current: CosConversationMemory | null
  workflow: CosWorkflow | null
  action: AssessorAction
  message: string
  response: string
  result?: CosExecutionPlanResult | null
  attachments: ReturnType<typeof normalizeCosAttachments>
}) {
  const lastStep = input.result?.executedSteps.at(-1)
  const metadata = (lastStep?.result?.metadata ?? {}) as Record<string, unknown>
  const documentId = typeof metadata.documentId === "string" ? metadata.documentId : null
  const agendaEventId = typeof metadata.agendaEventId === "string" ? metadata.agendaEventId : null
  const leadId = input.result?.leadId ?? input.current?.leadId ?? null
  const propertyId = input.result?.propertyId ?? input.current?.propertyId ?? null
  const pending = input.workflow?.pendingInput ?? null
  const images = input.attachments.filter((item) => item.category === "image")
  const documents = input.attachments.filter((item) => item.category === "document")
  const videos = input.attachments.filter((item) => item.category === "video")
  return {
    ...input.current,
    workflowId: input.workflow?.id ?? null,
    workflowType: input.workflow?.executionPlan.requestedAction ?? input.action,
    currentStep: input.workflow?.currentStep ?? null,
    pendingAction: pending?.action ?? null,
    pendingEntity: pending?.entity ?? null,
    awaitingConfirmation: pending?.field === "confirmation",
    awaitingSelection: pending?.type === "selection",
    awaitingUpload: pending?.field === "attachments" || pending?.field === "document" || pending?.field === "imageUrls",
    lastAction: input.action,
    lastUserMessage: input.message,
    lastResult: input.response,
    leadId,
    propertyId,
    documentId: documentId ?? input.current?.documentId ?? null,
    contractId: input.current?.contractId ?? null,
    proposalId: documentId ?? input.current?.proposalId ?? null,
    campaignId: input.current?.campaignId ?? null,
    selectedClient: leadId ? { id: leadId, label: input.current?.selectedClient?.label ?? null } : input.current?.selectedClient ?? null,
    selectedProperty: propertyId ? { id: propertyId, label: input.current?.selectedProperty?.label ?? null } : input.current?.selectedProperty ?? null,
    selectedContract: input.current?.selectedContract ?? null,
    selectedProposal: documentId ? { id: documentId, label: input.current?.selectedProposal?.label ?? null } : input.current?.selectedProposal ?? null,
    attachments: input.attachments.length > 0 ? input.attachments : input.current?.attachments ?? [],
    uploadedImages: images.length > 0 ? images : input.current?.uploadedImages ?? [],
    uploadedDocuments: documents.length > 0 ? documents : input.current?.uploadedDocuments ?? [],
    uploadedVideos: videos.length > 0 ? videos : input.current?.uploadedVideos ?? [],
    extractedEntities: {
      ...(input.current?.extractedEntities ?? {}),
      ...(agendaEventId ? { agendaEventId } : {}),
      ...(metadata.parsedData && typeof metadata.parsedData === "object" ? metadata.parsedData as Record<string, unknown> : {}),
    },
    updatedAt: new Date().toISOString(),
  } satisfies CosConversationMemory
}

function snapshotDomain(domain: CosV2Domain) {
  if (domain === "clients") return "lead" as const
  if (domain === "properties") return "property" as const
  if (domain === "proposals") return "proposal" as const
  if (domain === "agenda") return "agenda" as const
  return "general" as const
}

function updateSnapshotForResponse(input: {
  snapshot: CosConversationSnapshot
  interpretation: CosV2Interpretation
  workflow: CosWorkflow | null
}) {
  const now = new Date().toISOString()
  const domain = snapshotDomain(input.interpretation.primaryDomain)
  const currentTopic = domain === "general" ? input.snapshot.currentTopic : {
    id: `topic:v2:${domain}:${Date.now()}`,
    domain,
    label: input.interpretation.objective.summary.slice(0, 120),
    entityType: domain,
    selectionSetId: null,
    startedAt: now,
    lastMentionedAt: now,
  }
  return {
    ...input.snapshot,
    activeWorkflow: input.workflow,
    pendingInput: input.workflow?.pendingInput ?? null,
    currentTopic,
    recentTopics: currentTopic && input.snapshot.currentTopic?.id !== currentTopic.id
      ? [input.snapshot.currentTopic, ...input.snapshot.recentTopics].filter((topic): topic is NonNullable<typeof topic> => Boolean(topic)).slice(0, 6)
      : input.snapshot.recentTopics,
    updatedAt: now,
  } satisfies CosConversationSnapshot
}

function domainFromWorkspace(workspace: CosWorkspaceContext | null): CosV2Domain {
  if (workspace?.entity === "lead") return "clients"
  if (workspace?.entity === "property") return "properties"
  if (workspace?.entity === "proposal" || workspace?.entity === "document") return "proposals"
  if (workspace?.entity === "agenda") return "agenda"
  return "general"
}

function selectionMessage(workflow: CosWorkflow | null, selectedOptionId: string | null, fallback: string) {
  if (!workflow?.pendingInput || !selectedOptionId) return fallback
  return workflow.pendingInput.options?.find((option) => option.id === selectedOptionId)?.label ?? fallback
}

function responseOptions(workflow: CosWorkflow | null) {
  if (workflow?.pendingInput?.type !== "selection") return null
  return (workflow.pendingInput.options ?? []).map((option) => ({
    id: option.id,
    actionId: `cos_v2_selection:${workflow.id}:${option.id}`,
    selectedOptionId: option.id,
    label: option.label,
    description: option.description,
    message: option.label,
    action: workflow.pendingInput?.action,
  }))
}

async function finishTurn(input: {
  userId: string
  brokerId: string
  conversation: ConversationDocument
  message: string
  displayMessage: string
  responseView: CosResponseViewModel
  interpretation: CosV2Interpretation
  interpretationAudit: Record<string, unknown>
  validation: { accepted: boolean; errors: string[]; evidence: string[]; capabilityIds: string[] }
  knowledge: Awaited<ReturnType<typeof retrieveCosV2Knowledge>>
  workflow: CosWorkflow | null
  action: AssessorAction | null
  actionStatus: string
  creditsUsed: number
  result?: CosExecutionPlanResult | null
  errorMessage?: string | null
  confirmRequired?: boolean
}) {
  const metadata = asJson({
    runtimeVersion: "v2",
    responseView: input.responseView,
    interactionType: input.responseView.interactionType,
    conversationId: input.conversation.id,
    displayMessage: input.displayMessage,
    workflow: workflowMetadata(input.workflow),
    options: responseOptions(input.workflow),
    interpretation: input.interpretation,
    interpretationAudit: input.interpretationAudit,
    validation: input.validation,
    knowledge: buildCosKnowledgeAudit(input.knowledge),
    plannedCapabilities: input.validation.capabilityIds,
    executedCapabilities: input.result?.executedSteps.map((step) => step.capabilityId) ?? [],
    confirmationPrompt: input.responseView.confirmation?.prompt,
    confirmationConfirmLabel: input.responseView.confirmation?.confirmLabel,
    confirmationCancelLabel: input.responseView.confirmation?.cancelLabel,
  })
  const internalAction = input.action ?? "general"
  const touched = await touchConversation(input.conversation, input.displayMessage || input.message)
  await Promise.all([
    prisma.aiAssistantInteraction.create({
      data: {
        userId: input.userId,
        brokerId: input.brokerId,
        prompt: input.message,
        response: input.responseView.text,
        actionType: internalAction,
        creditsUsed: input.creditsUsed,
        channel: "assessor_eme",
        intent: internalAction,
        actionStatus: input.actionStatus,
        metadata,
        errorMessage: input.errorMessage ?? null,
        leadId: input.result?.leadId ?? null,
        propertyId: input.result?.propertyId ?? null,
      },
    }),
    prisma.emeMessage.create({
      data: {
        userId: input.userId,
        brokerId: input.brokerId,
        channel: "assessor_eme",
        direction: "broker_to_ai",
        message: input.message,
        response: input.responseView.text,
        detectedIntent: internalAction,
        actionType: internalAction,
        actionStatus: input.actionStatus,
        metadata,
        errorMessage: input.errorMessage ?? null,
        creditsUsed: input.creditsUsed,
        leadId: input.result?.leadId ?? null,
        propertyId: input.result?.propertyId ?? null,
      },
    }),
  ])
  const credits = await brokerCredits(input.brokerId)
  return NextResponse.json({
    response: input.responseView.text,
    responseView: input.responseView,
    action: input.action,
    actionStatus: input.actionStatus,
    metadata,
    creditsUsed: input.creditsUsed,
    confirmRequired: Boolean(input.confirmRequired),
    conversation: serializeConversation(touched),
    runtimeVersion: "v2",
    ...credits,
  })
}

export async function handleCosV2Post(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })

  const body = await request.json().catch(() => null)
  const message = cleanText(body?.message ?? body?.prompt, 3000)
  const displayMessage = cleanText(body?.displayMessage, 3000) || message
  const conversationId = cleanText(body?.conversationId, 80)
  const source = cleanText(body?.source, 80)
  const structuredAction = cleanText(body?.intent ?? body?.action ?? body?.actionType, 120)
  const optionActionId = cleanText(body?.optionActionId, 200)
  const selectedOptionId = cleanText(body?.selectedOptionId, 191)
  const confirm = Boolean(body?.confirm)
  const cancel = Boolean(body?.cancel)
  const attachments = normalizeCosAttachments(body?.attachments)
  if (!message) return NextResponse.json({ error: "Digite uma mensagem para o COS." }, { status: 400 })

  try {
    const surface = source === "cos_home" ? "cos_home" as const : "portal" as const
    const workspace = sanitizeWorkspaceContext(body?.workspace, surface)
    let conversation = conversationId
      ? await resolveConversation(user.broker.id, conversationId)
      : await prisma.brokerDocument.create({
          data: {
            brokerId: user.broker.id,
            type: "cos_conversation",
            title: DEFAULT_COS_CONVERSATION_TITLE,
            content: stringifyConversationWorkflowContent(null),
            status: "active",
          },
          select: { id: true, title: true, content: true, createdAt: true, updatedAt: true },
        })
    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 })

    let activeWorkflow = getActiveWorkflow(conversation.content)
    const memory = getConversationMemory(conversation.content)
    if (activeWorkflow?.status === "processing" && !activeWorkflow.pendingInput) {
      const age = Date.now() - Date.parse(activeWorkflow.updatedAt)
      if (!Number.isFinite(age) || age <= COS_V2_PROCESSING_LEASE_MS) {
        return NextResponse.json({ error: "Esta ação já está em processamento." }, { status: 409 })
      }
      const now = new Date().toISOString()
      const failedWorkflow: CosWorkflow = { ...activeWorkflow, status: "failed", pendingInput: null, updatedAt: now, completedAt: now }
      const persisted = await persistConversationState({
        conversation,
        brokerId: user.broker.id,
        expectedContent: conversation.content,
        workflow: failedWorkflow,
        memory,
        snapshot: getConversationSnapshot(conversation.content),
      })
      conversation = persisted.conversation
      activeWorkflow = null
    }

    const pendingDescriptor = activeWorkflow?.pendingInput
      ? resolveCosV2Capability(activeWorkflow.pendingInput.capabilityId ?? activeWorkflow.pendingInput.action, surface)
      : null
    const requestedDescriptor = resolveCosV2Capability(structuredAction, surface)
    if (confirm && (!activeWorkflow?.pendingInput || activeWorkflow.pendingInput.field !== "confirmation" || !requestedDescriptor || requestedDescriptor.id !== pendingDescriptor?.id)) {
      return NextResponse.json({ error: "Esta confirmação não corresponde mais à ação pendente." }, { status: 409 })
    }
    if (cancel && (!activeWorkflow?.pendingInput || !requestedDescriptor || requestedDescriptor.id !== pendingDescriptor?.id)) {
      return NextResponse.json({ error: "Esta ação pendente não está mais ativa." }, { status: 409 })
    }

    const brokerState = await prisma.broker.findUnique({
      where: { id: user.broker.id },
      select: { aiAssistantEnabled: true, aiCreditsBalance: true },
    })
    if (!brokerState) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
    if (!brokerState.aiAssistantEnabled && !cancel) return NextResponse.json({ error: "O COS está desativado no momento." }, { status: 403 })

    const recentMessages = await prisma.emeMessage.findMany({
      where: {
        brokerId: user.broker.id,
        channel: "assessor_eme",
        metadata: { path: ["conversationId"], equals: conversation.id },
      },
      orderBy: { createdAt: "desc" },
      take: COS_RECENT_MESSAGE_LIMIT,
      select: { id: true, message: true, response: true, actionType: true, actionStatus: true, leadId: true, propertyId: true, metadata: true, createdAt: true },
    }).then((items) => items.reverse())
    const snapshot = buildCosConversationSnapshot({
      conversationId: conversation.id,
      message,
      recentMessages,
      activeWorkflow,
      memory,
      persistedSnapshot: getConversationSnapshot(conversation.content),
      workspace,
    })
    const effectiveAttachments = attachments.length > 0 ? attachments : activeWorkflow ? memory?.attachments ?? [] : []
    const initialKnowledge = await retrieveCosV2Knowledge({ message, domain: domainFromWorkspace(workspace) })
    const compactContext = buildCosV2CompactContext({
      message,
      snapshot,
      pendingInput: activeWorkflow?.pendingInput ?? null,
      workspace,
      attachments: effectiveAttachments,
      knowledge: initialKnowledge,
    })
    const interpretationResult = await runWithAiOperationContext(
      {
        route: "/api/assistant/eme",
        source: surface === "cos_home" ? "portal_cos_home" : "portal",
        userId: user.id,
        brokerId: user.broker.id,
        planKey: user.plan ?? null,
        conversationId: conversation.id,
        workflowId: activeWorkflow?.id ?? null,
        metadata: { runtimeVersion: "v2" },
      },
      () => interpretCosV2Turn({
        message,
        structuredAction,
        optionActionId,
        selectedOptionId,
        confirm,
        cancel,
        surface,
        workspace,
        snapshot,
        pendingInput: activeWorkflow?.pendingInput ?? null,
        attachments: effectiveAttachments,
        knowledge: initialKnowledge,
      }, compactContext),
    )
    const interpretation = interpretationResult.interpretation
    const validation = validateCosV2Interpretation({
      message,
      interpretation,
      surface,
      snapshot,
      workspace,
      attachments: effectiveAttachments,
    })
    const targetKnowledge = await retrieveCosV2Knowledge({
      message,
      domain: validation.interpretation.primaryDomain,
      secondaryDomains: validation.interpretation.secondaryDomains,
      turnType: validation.interpretation.turnType,
      capabilityId: validation.capabilityIds[0] ?? validation.referencedCapabilityId,
    })
    const audit = interpretationResult.audit as unknown as Record<string, unknown>
    const validationAudit = {
      accepted: validation.accepted,
      errors: validation.errors,
      evidence: validation.evidence,
      capabilityIds: validation.capabilityIds,
    }

    if (validation.interpretation.turnType === "cancellation") {
      const cancelled = activeWorkflow ? cancelWorkflow(activeWorkflow) : null
      const nextSnapshot = updateSnapshotForResponse({ snapshot, interpretation: validation.interpretation, workflow: cancelled })
      const persisted = await persistConversationState({
        conversation,
        brokerId: user.broker.id,
        expectedContent: conversation.content,
        workflow: cancelled,
        memory,
        snapshot: nextSnapshot,
      })
      return finishTurn({
        userId: user.id,
        brokerId: user.broker.id,
        conversation: persisted.conversation,
        message,
        displayMessage,
        responseView: buildCosV2CancelledResponse(Boolean(activeWorkflow)),
        interpretation: validation.interpretation,
        interpretationAudit: audit,
        validation: validationAudit,
        knowledge: targetKnowledge,
        workflow: cancelled,
        action: pendingDescriptor?.action ?? null,
        actionStatus: "cancelled",
        creditsUsed: 0,
      })
    }

    if (!validation.accepted) {
      const responseView = buildCosV2ValidationResponse(validation.interpretation, validation.errors)
      const nextSnapshot = updateSnapshotForResponse({ snapshot, interpretation: validation.interpretation, workflow: activeWorkflow })
      const persisted = await persistConversationState({ conversation, brokerId: user.broker.id, expectedContent: conversation.content, workflow: activeWorkflow, memory, snapshot: nextSnapshot })
      return finishTurn({
        userId: user.id, brokerId: user.broker.id, conversation: persisted.conversation, message, displayMessage,
        responseView, interpretation: validation.interpretation, interpretationAudit: audit, validation: validationAudit,
        knowledge: targetKnowledge, workflow: activeWorkflow, action: validation.referencedCapabilityId ? resolveCosV2Capability(validation.referencedCapabilityId, surface)?.action ?? null : null,
        actionStatus: "needs_clarification", creditsUsed: 0, confirmRequired: activeWorkflow?.pendingInput?.field === "confirmation",
      })
    }

    if (validation.interpretation.objective.kind === "answer") {
      const responseView = await buildCosV2Answer({
        message,
        interpretation: validation.interpretation,
        knowledge: targetKnowledge,
        capabilityTitles: listCosV2Capabilities(surface)
          .filter((capability) => capability.id.startsWith(`${snapshotDomain(validation.interpretation.primaryDomain)}.`))
          .map((capability) => capability.title),
      })
      const nextSnapshot = updateSnapshotForResponse({ snapshot, interpretation: validation.interpretation, workflow: activeWorkflow })
      const persisted = await persistConversationState({ conversation, brokerId: user.broker.id, expectedContent: conversation.content, workflow: activeWorkflow, memory, snapshot: nextSnapshot })
      const referencedAction = validation.referencedCapabilityId ? resolveCosV2Capability(validation.referencedCapabilityId, surface)?.action ?? null : null
      return finishTurn({
        userId: user.id, brokerId: user.broker.id, conversation: persisted.conversation, message, displayMessage,
        responseView, interpretation: validation.interpretation, interpretationAudit: audit, validation: validationAudit,
        knowledge: targetKnowledge, workflow: activeWorkflow, action: referencedAction, actionStatus: "success", creditsUsed: 0,
        confirmRequired: activeWorkflow?.pendingInput?.field === "confirmation",
      })
    }

    if (validation.interpretation.objective.kind === "context" || validation.capabilityIds.length === 0) {
      const responseView = buildCosV2ContextResponse(validation.interpretation)
      const nextSnapshot = updateSnapshotForResponse({ snapshot, interpretation: validation.interpretation, workflow: activeWorkflow })
      const persisted = await persistConversationState({ conversation, brokerId: user.broker.id, expectedContent: conversation.content, workflow: activeWorkflow, memory, snapshot: nextSnapshot })
      return finishTurn({
        userId: user.id, brokerId: user.broker.id, conversation: persisted.conversation, message, displayMessage,
        responseView, interpretation: validation.interpretation, interpretationAudit: audit, validation: validationAudit,
        knowledge: targetKnowledge, workflow: activeWorkflow, action: null,
        actionStatus: responseView.kind === "awaiting_input" ? "needs_clarification" : "success", creditsUsed: 0,
        confirmRequired: activeWorkflow?.pendingInput?.field === "confirmation",
      })
    }

    const requestedCapabilityId = validation.capabilityIds[0]
    const continuesWorkflow = Boolean(activeWorkflow && pendingDescriptor?.id === requestedCapabilityId)
    const requestedCapability = resolveCosV2Capability(requestedCapabilityId, surface)!
    if (activeWorkflow && !continuesWorkflow && requestedCapability.mutatesData) {
      const interruptedInterpretation: CosV2Interpretation = {
        ...validation.interpretation,
        objective: { kind: "context", summary: "Resolver a operação pendente antes de iniciar outra alteração." },
        missingData: ["pending_operation"],
        clarificationQuestion: "Há uma ação em andamento. Cancele ou conclua essa ação antes de começar a nova.",
      }
      const responseView = buildCosV2ContextResponse(interruptedInterpretation)
      const nextSnapshot = updateSnapshotForResponse({ snapshot, interpretation: interruptedInterpretation, workflow: activeWorkflow })
      const persisted = await persistConversationState({ conversation, brokerId: user.broker.id, expectedContent: conversation.content, workflow: activeWorkflow, memory, snapshot: nextSnapshot })
      return finishTurn({
        userId: user.id, brokerId: user.broker.id, conversation: persisted.conversation, message, displayMessage,
        responseView, interpretation: interruptedInterpretation, interpretationAudit: audit, validation: validationAudit,
        knowledge: targetKnowledge, workflow: activeWorkflow, action: requestedCapability.action,
        actionStatus: "needs_clarification", creditsUsed: 0, confirmRequired: activeWorkflow.pendingInput?.field === "confirmation",
      })
    }

    const normalizedContext = createCosNormalizedContext({
      brokerId: user.broker.id,
      userId: user.id,
      actor: { firstName: getSafeFirstName(user.name) },
      surface,
      message,
      workspace,
      workflow: continuesWorkflow ? activeWorkflow : null,
      memory,
      snapshot,
      decision: null,
      knowledge: targetKnowledge,
      attachments: effectiveAttachments,
    })
    const executionPayload = {
      ...validation.payload,
      ...(effectiveAttachments.length > 0 ? { attachments: effectiveAttachments } : {}),
      context: normalizedContext,
    }
    const plan = continuesWorkflow
      ? rebuildExecutionPlanFromWorkflow(activeWorkflow!)
      : buildCosV2ExecutionPlan({
          message,
          capabilityIds: validation.capabilityIds,
          payload: executionPayload,
          context: normalizedContext,
          surface,
          workspace,
          confidence: validation.interpretation.confidence,
          reason: validation.interpretation.objective.summary,
        })
    const action = plan.primaryStep.action
    const plannedCredits = getCosInteractionCreditCost(plan.steps.map((step) => step.action))
    if (brokerState.aiCreditsBalance < plannedCredits) {
      const credits = await brokerCredits(user.broker.id)
      return NextResponse.json({
        ...createInsufficientCreditsPayload({ availableCredits: brokerState.aiCreditsBalance, requiredCredits: plannedCredits }),
        ...credits,
      }, { status: 402 })
    }

    if (!continuesWorkflow && plan.requiresConfirmation) {
      const pendingWorkflow = createWorkflowFromExecutionPlan({ conversationId: conversation.id, plan, confirmationData: pickConfirmationData(executionPayload) })
      const nextSnapshot = updateSnapshotForResponse({ snapshot, interpretation: validation.interpretation, workflow: pendingWorkflow })
      const persisted = await persistConversationState({ conversation, brokerId: user.broker.id, expectedContent: conversation.content, workflow: pendingWorkflow, memory, snapshot: nextSnapshot })
      return finishTurn({
        userId: user.id, brokerId: user.broker.id, conversation: persisted.conversation, message, displayMessage,
        responseView: buildCosV2ConfirmationResponse(plan), interpretation: validation.interpretation, interpretationAudit: audit,
        validation: validationAudit, knowledge: targetKnowledge, workflow: pendingWorkflow, action,
        actionStatus: "needs_confirmation", creditsUsed: 0, confirmRequired: true,
      })
    }

    const workflow = continuesWorkflow ? resumeWorkflowState(activeWorkflow!) : createWorkflowFromExecutionPlan({ conversationId: conversation.id, plan })
    const preservesPreviousWorkflow = Boolean(activeWorkflow && !continuesWorkflow && !requestedCapability.mutatesData)
    const executionMutates = workflow.steps.slice(workflow.currentStep).some((step) => doesCosCapabilityMutateData(step.action))
    let expectedContent = conversation.content
    if (executionMutates && !preservesPreviousWorkflow) {
      const now = new Date().toISOString()
      const claimed: CosWorkflow = { ...workflow, status: "processing", pendingInput: null, pausedAt: null, updatedAt: now }
      const persisted = await persistConversationState({
        conversation,
        brokerId: user.broker.id,
        expectedContent,
        workflow: claimed,
        memory,
        snapshot: { ...snapshot, activeWorkflow: claimed, pendingInput: null, updatedAt: now },
      })
      conversation = persisted.conversation
      expectedContent = persisted.content
    }

    const resumeMessage = selectionMessage(activeWorkflow, selectedOptionId, message)
    let result: CosExecutionPlanResult
    try {
      result = await runWithAiOperationContext(
        {
          route: "/api/assistant/eme",
          source: surface === "cos_home" ? "portal_cos_home" : "portal",
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          conversationId: conversation.id,
          workflowId: workflow.id,
          creditsConsumed: plannedCredits,
          metadata: { runtimeVersion: "v2" },
        },
        () => continuesWorkflow
          ? resumeWorkflowExecution({
              workflow,
              brokerId: user.broker!.id,
              userId: user.id,
              message: validation.interpretation.turnType === "confirmation" ? workflow.executionPlan.message : resumeMessage,
              pendingReplyMessage: resumeMessage,
              confirm: validation.interpretation.turnType === "confirmation",
              workspace,
              payload: executionPayload,
            })
          : executeCosExecutionPlan({
              plan,
              brokerId: user.broker!.id,
              userId: user.id,
              message,
              confirm: false,
              payload: executionPayload,
            }),
      )
    } catch (caughtError) {
      console.error("[cos-v2][execution-error]", { error: caughtError instanceof Error ? caughtError.message : "unknown", capabilityId: requestedCapabilityId })
      throw caughtError
    }
    const updatedWorkflow = updateWorkflowFromExecutionResult({ workflow, result })
    const completedActions = result.executedSteps
      .filter((step) => step.status === "completed")
      .filter((step) => (step.result?.metadata as { noCharge?: boolean } | undefined)?.noCharge !== true)
      .map((step) => step.action)
    const creditsUsed = getCosInteractionCreditCost(completedActions)
    if (creditsUsed > 0) {
      await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType: action,
        description: plan.steps.length > 1 ? `COS V2: ${plan.steps.map((step) => getCosCapabilityLabel(step.action)).join(" + ")}` : `COS V2: ${getCosCapabilityLabel(action)}`,
        metadata: asJson({ source: "api/assistant/eme", runtimeVersion: "v2", planId: workflow.id, steps: plan.steps.map((step) => step.action) }),
      })
    }
    const responseView = buildCosV2ExecutionResponse({
      message,
      plan,
      result,
      objectiveKind: validation.interpretation.objective.kind,
    })
    const workflowToPersist = preservesPreviousWorkflow ? activeWorkflow : updatedWorkflow
    const memoryToPersist = buildMemory({ current: memory, workflow: workflowToPersist, action, message: displayMessage, response: responseView.text, result, attachments: effectiveAttachments })
    const executionSnapshot = updateCosConversationSnapshot({
      snapshot,
      message: displayMessage,
      workflow: updatedWorkflow,
      result,
      status: result.status === "failed" ? "error" : updatedWorkflow.status === "awaiting_input" ? "awaiting_input" : "success",
    })
    const snapshotToPersist = preservesPreviousWorkflow
      ? { ...executionSnapshot, activeWorkflow, pendingInput: activeWorkflow?.pendingInput ?? null }
      : executionSnapshot
    const persisted = await persistConversationState({
      conversation,
      brokerId: user.broker.id,
      expectedContent,
      workflow: workflowToPersist,
      memory: memoryToPersist,
      snapshot: snapshotToPersist,
    })
    const actionStatus = result.status === "failed" ? "error" : updatedWorkflow.status === "awaiting_input" ? "processing" : "success"
    const errorMessage = result.status === "failed"
      ? result.interruptedStep?.result?.status === "error"
        ? result.interruptedStep.result.errorCode
        : result.interruptedStep?.errorMessage ?? "COS_V2_EXECUTION_FAILED"
      : null
    return finishTurn({
      userId: user.id, brokerId: user.broker.id, conversation: persisted.conversation, message, displayMessage,
      responseView, interpretation: validation.interpretation, interpretationAudit: audit, validation: validationAudit,
      knowledge: targetKnowledge, workflow: workflowToPersist, action, actionStatus, creditsUsed, result, errorMessage,
      confirmRequired: workflowToPersist?.pendingInput?.field === "confirmation",
    })
  } catch (caughtError) {
    console.error("[cos-v2][request-error]", { error: caughtError instanceof Error ? caughtError.message : "unknown" })
    if (isPrismaUnavailable(caughtError)) return NextResponse.json({ error: "O serviço do COS está indisponível no momento." }, { status: 503 })
    if (caughtError instanceof Error && caughtError.message === "INSUFFICIENT_AI_CREDITS") {
      const credits = await brokerCredits(user.broker.id)
      return NextResponse.json({ ...createInsufficientCreditsPayload(), ...credits }, { status: 402 })
    }
    if (caughtError instanceof Error && caughtError.message.includes("CONVERSATION_CONFLICT")) {
      return NextResponse.json({ error: "A conversa mudou enquanto a ação era processada. Atualize e tente novamente." }, { status: 409 })
    }
    return NextResponse.json({ error: "Não foi possível concluir essa conversa agora." }, { status: 500 })
  }
}
