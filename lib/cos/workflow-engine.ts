import { executeCosExecutionPlan } from "@/lib/cos/executor"
import { normalizeCosActionResult } from "@/lib/cos/action-result"
import { getCosCapabilityLabel } from "@/lib/cos/capability-catalog"
import { createStepPlanForCapability } from "@/lib/cos/execution-step"
import { buildCosPendingResumePayload, classifyCosPendingReply, createPendingInput, extractPendingInputFromMetadata, isCosPendingInputExpired, normalizeCosPendingInput, normalizeWorkflowStatus } from "@/lib/cos/pending-input"
import type { Prisma } from "@prisma/client"
import type {
  CosConversationMemory,
  CosConversationSnapshot,
  CosExecutionPlan,
  CosExecutionPlanResult,
  CosExecutionStep,
  CosPendingInput,
  CosWorkflow,
  CosWorkflowStatus,
  CosWorkspaceContext,
} from "@/lib/cos/types"

type ConversationEnvelope = {
  workflow: CosWorkflow | null
  memory?: CosConversationMemory | null
  snapshot?: CosConversationSnapshot | null
}

function emptyEnvelope(): ConversationEnvelope {
  return { workflow: null, memory: null, snapshot: null }
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return recordValue(value) as Prisma.InputJsonObject
}

function getWorkflowStatusLabel(workflow: CosWorkflow) {
  const status = normalizeWorkflowStatus(workflow.status)
  if (status === "completed") return "Concluída"
  if (status === "cancelled") return "Cancelada"
  if (status === "failed") return "Erro"
  if (workflow.pendingInput?.field === "confirmation") return "Aguardando confirmação"
  if (workflow.pendingInput?.type === "selection") return "Aguardando seleção"
  if (status === "awaiting_input") return "Em andamento"
  if (status === "processing") return "Processando"
  return "Em andamento"
}

function getWorkflowStepLabel(step: CosWorkflow["steps"][number]) {
  return getCosCapabilityLabel(step.action)
}

function buildPendingInput(input: {
  field: string
  action: string
  entity: string
  parsedData?: Record<string, unknown>
  capabilityId?: CosPendingInput["capabilityId"]
  source?: CosPendingInput["source"]
  reason?: string
}): CosPendingInput {
  return createPendingInput({
    field: input.field,
    action: input.action as CosPendingInput["action"],
    entity: input.entity as CosPendingInput["entity"],
    parsedData: input.parsedData ?? {},
    capabilityId: input.capabilityId,
    source: input.source,
    reason: input.reason,
  })
}

export function buildWorkflowResumePayload(input: {
  workflow: CosWorkflow
  message: string
  workspace: CosWorkspaceContext | null
  payload?: Record<string, unknown>
}) {
  const payload: Record<string, unknown> = { ...(input.payload ?? {}) }
  if (input.workspace) payload.workspace = input.workspace
  return buildCosPendingResumePayload({
    pendingInput: input.workflow.pendingInput,
    message: input.message,
    payload,
  })
}

function serializeStep(step: CosExecutionStep) {
  return {
    id: step.id,
    order: step.order,
    entity: step.entity,
    capabilityId: step.capabilityId,
    action: step.action,
    status: step.status,
    dependsOn: step.dependsOn,
    durationMs: step.durationMs,
    errorMessage: step.errorMessage,
    resultResponse: step.result?.response ?? null,
    resultMetadata: step.result?.metadata ? jsonObject(step.result.metadata) : null,
    resultStatus: step.result?.status ?? null,
    resultErrorCode: step.result?.status === "error" ? step.result.errorCode : null,
    leadId: step.result?.leadId,
    propertyId: step.result?.propertyId,
  }
}

function hydrateStep(step: CosWorkflow["steps"][number], workflow: CosWorkflow): CosExecutionStep {
  const rebuilt = createStepPlanForCapability({
    capabilityId: step.capabilityId,
    message: workflow.executionPlan.message,
    requestedAction: workflow.executionPlan.requestedAction,
    pendingInput: workflow.pendingInput,
    surface: workflow.executionPlan.surface,
    workspace: workflow.executionPlan.workspace,
    planId: workflow.executionPlan.id,
    order: step.order,
    reason: workflow.executionPlan.reason,
  })

  return {
    ...rebuilt,
    status: step.status,
    durationMs: step.durationMs,
    errorMessage: step.errorMessage,
    result:
      step.resultResponse || step.resultMetadata
        ? normalizeCosActionResult({
            result: step.resultStatus === "error"
              ? {
                  status: "error",
                  errorCode: step.resultErrorCode ?? "COS_PERSISTED_ERROR",
                  response: step.resultResponse ?? "",
                  metadata: jsonObject(step.resultMetadata),
                  leadId: step.leadId,
                  propertyId: step.propertyId,
                }
              : {
            response: step.resultResponse ?? "",
            metadata: jsonObject(step.resultMetadata),
            leadId: step.leadId,
            propertyId: step.propertyId,
                },
            action: step.action,
            entity: step.entity,
          })
        : null,
  }
}

export function parseConversationWorkflowContent(content: string | null | undefined) {
  if (!content) return emptyEnvelope()

  try {
    const parsed = JSON.parse(content) as Partial<ConversationEnvelope>
    const rawWorkflow = parsed?.workflow && typeof parsed.workflow === "object" ? (parsed.workflow as CosWorkflow) : null
    const currentStep = rawWorkflow?.steps[rawWorkflow.currentStep] ?? rawWorkflow?.steps[0]
    const normalizedPending = rawWorkflow?.pendingInput && currentStep
      ? normalizeCosPendingInput({
          pendingInput: rawWorkflow.pendingInput,
          fallbackAction: currentStep.action,
          fallbackEntity: currentStep.entity,
        })
      : null
    const workflow = rawWorkflow ? { ...rawWorkflow, pendingInput: normalizedPending } : null
    const memory = parsed?.memory && typeof parsed.memory === "object" ? (parsed.memory as CosConversationMemory) : null
    const snapshot = parsed?.snapshot && typeof parsed.snapshot === "object" ? (parsed.snapshot as CosConversationSnapshot) : null
    return { workflow, memory, snapshot }
  } catch {
    return emptyEnvelope()
  }
}

export function stringifyConversationWorkflowContent(
  workflow: CosWorkflow | null,
  memory?: CosConversationMemory | null,
  snapshot?: CosConversationSnapshot | null,
) {
  return JSON.stringify({ workflow, memory: memory ?? null, snapshot: snapshot ?? null })
}

export function getActiveWorkflow(content: string | null | undefined) {
  const envelope = parseConversationWorkflowContent(content)
  if (!envelope.workflow) return null
  const normalizedStatus = normalizeWorkflowStatus(envelope.workflow.status)
  if (["completed", "failed", "cancelled"].includes(normalizedStatus)) return null
  if (envelope.workflow.pendingInput && isCosPendingInputExpired(envelope.workflow.pendingInput)) return null
  return {
    ...envelope.workflow,
    status: normalizedStatus,
  }
}

export function getConversationMemory(content: string | null | undefined) {
  return parseConversationWorkflowContent(content).memory ?? null
}

export function getConversationSnapshot(content: string | null | undefined) {
  return parseConversationWorkflowContent(content).snapshot ?? null
}

export function createWorkflowFromExecutionPlan(input: {
  conversationId: string
  plan: CosExecutionPlan
  confirmationData?: Record<string, unknown>
}): CosWorkflow {
  const now = new Date().toISOString()
  return {
    id: input.plan.id,
    conversationId: input.conversationId,
    status: input.plan.requiresConfirmation ? "awaiting_input" : "processing",
    executionPlan: {
      id: input.plan.id,
      source: input.plan.source,
      reason: input.plan.reason,
      message: input.plan.message,
      requestedAction: input.plan.requestedAction,
      surface: input.plan.surface,
      workspace: input.plan.workspace,
      unresolvedGoals: input.plan.unresolvedGoals,
    },
    currentStep: 0,
    steps: input.plan.steps.map(serializeStep),
    pendingInput:
      input.plan.requiresConfirmation
        ? buildPendingInput({
            field: "confirmation",
            action: input.plan.primaryStep.action,
            entity: input.plan.primaryStep.entity,
            capabilityId: input.plan.primaryStep.capabilityId,
            source: "confirmation",
            reason: "capability_confirmation_required",
            parsedData: input.confirmationData,
          })
        : null,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    pausedAt: input.plan.requiresConfirmation ? now : null,
    totalPausedMs: 0,
  }
}

export function rebuildExecutionPlanFromWorkflow(workflow: CosWorkflow): CosExecutionPlan {
  const steps = workflow.steps.map((step) => hydrateStep(step, workflow))
  const primaryStep = steps[0]
  return {
    id: workflow.executionPlan.id,
    source: workflow.executionPlan.source,
    reason: workflow.executionPlan.reason,
    status: workflow.status === "completed" ? "completed" : workflow.pendingInput ? "awaiting_input" : "pending",
    message: workflow.executionPlan.message,
    requestedAction: workflow.executionPlan.requestedAction,
    surface: workflow.executionPlan.surface,
    workspace: workflow.executionPlan.workspace,
    pendingInput: workflow.pendingInput,
    context: null,
    primaryStep,
    steps,
    unresolvedGoals: workflow.executionPlan.unresolvedGoals,
    requiresConfirmation: workflow.pendingInput?.field === "confirmation",
    confirmationMessage: workflow.pendingInput?.field === "confirmation" ? "Confirma esta ação?" : null,
    telemetry: {
      planId: workflow.executionPlan.id,
      source: workflow.executionPlan.source,
      planner: workflow.executionPlan.source === "ai" ? "ai" : "deterministic",
      reason: workflow.executionPlan.reason,
      surface: workflow.executionPlan.surface,
      stepCount: steps.length,
      steps: steps.map((step) => ({
        id: step.id,
        capabilityId: step.capabilityId,
        action: step.action,
        entity: step.entity,
        source: step.plan.source,
        mutatesData: step.plan.capability.mutatesData,
        requiresConfirmation: step.plan.capability.requiresConfirmation,
      })),
      unresolvedGoals: workflow.executionPlan.unresolvedGoals,
      requestedAction: workflow.executionPlan.requestedAction?.trim() || null,
      messageLength: workflow.executionPlan.message.trim().length,
      workspaceReceived: Boolean(workflow.executionPlan.workspace),
      workspaceEntity: workflow.executionPlan.workspace?.entity ?? null,
      workspaceEntityId: workflow.executionPlan.workspace?.entityId ?? null,
      contextOrigin: workflow.executionPlan.workspace ? "workspace" : "catalog",
      resolutionMs: 0,
      orchestrator: null,
    },
  }
}

export async function resumeWorkflowExecution(input: {
  workflow: CosWorkflow
  brokerId: string
  userId: string
  message: string
  pendingReplyMessage?: string
  confirm?: boolean
  workspace: CosWorkspaceContext | null
  payload?: Record<string, unknown>
}) {
  const plan = rebuildExecutionPlanFromWorkflow(input.workflow)
  const payload = buildWorkflowResumePayload({
    workflow: input.workflow,
    message: input.pendingReplyMessage ?? input.message,
    workspace: input.workspace,
    payload: input.payload,
  })

  return executeCosExecutionPlan({
    plan,
    brokerId: input.brokerId,
    userId: input.userId,
    message: input.message,
    confirm: input.confirm,
    payload,
    startStepIndex: input.workflow.currentStep,
    existingSteps: plan.steps,
  })
}

export function updateWorkflowFromExecutionResult(input: {
  workflow: CosWorkflow
  result: CosExecutionPlanResult
}): CosWorkflow {
  const now = new Date().toISOString()
  const interruptedStep = input.result.interruptedStep
  const completedAt = input.result.status === "completed" ? now : null
  const pendingInput =
    input.result.status === "awaiting_input" && interruptedStep
      ? interruptedStep.result?.status === "awaiting_input"
        ? interruptedStep.result.pendingInput
        : extractPendingInputFromMetadata({
          metadata: interruptedStep.result?.metadata,
          action: interruptedStep.action,
          entity: interruptedStep.entity,
        })
      : null

  const nextStatus: CosWorkflowStatus =
    input.result.status === "completed"
      ? "completed"
      : input.result.status === "failed"
        ? "failed"
        : "awaiting_input"

  return {
    ...input.workflow,
    status: nextStatus,
    steps: input.result.steps.map(serializeStep),
    currentStep: interruptedStep ? interruptedStep.order : input.result.steps.length,
    pendingInput,
    updatedAt: now,
    completedAt,
    pausedAt: nextStatus === "awaiting_input" ? now : null,
    totalPausedMs: input.workflow.totalPausedMs,
  }
}

export function cancelWorkflow(workflow: CosWorkflow) {
  const now = new Date().toISOString()
  return {
    ...workflow,
    status: "cancelled" as CosWorkflowStatus,
    pendingInput: null,
    completedAt: now,
    updatedAt: now,
    pausedAt: null,
  }
}

export function formatWorkflowProgress(workflow: CosWorkflow) {
  const current = Math.min(workflow.currentStep + 1, workflow.steps.length)
  const total = workflow.steps.length
  if (workflow.status === "awaiting_input" && workflow.pendingInput) {
    return `Etapa ${current} de ${total}\nAguardando: ${workflow.pendingInput.label}.`
  }
  if (workflow.status === "completed") {
    return `Operação concluída.\n${total} etapas executadas.`
  }
  return `Etapa ${current} de ${total}`
}

export function formatWorkflowOperationDetails(input: {
  workflow: CosWorkflow
  memory?: CosConversationMemory | null
  creditsRequired?: number
}) {
  const { workflow, memory, creditsRequired = 0 } = input
  const currentStepIndex = Math.min(workflow.currentStep, Math.max(0, workflow.steps.length - 1))
  const currentStep = workflow.steps[currentStepIndex] ?? null
  const operationStep = currentStep ?? workflow.steps[0]

  if (!operationStep) {
    return "Não existe nenhuma operação em andamento no momento."
  }

  const lines = [
    "Operação em andamento",
    "",
    `Nome da operação: ${getWorkflowStepLabel(operationStep)}`,
    `Status: ${getWorkflowStatusLabel(workflow)}`,
    "",
    "Etapas:",
    ...workflow.steps.map((step, index) => {
      const prefix =
        step.status === "completed"
          ? "✓"
          : step.status === "failed"
            ? "⚠"
            : index === currentStepIndex || step.status === "running" || step.status === "awaiting_input"
              ? "⏳"
              : "⬜"
      return `${prefix} ${getWorkflowStepLabel(step)}`
    }),
  ]

  if (memory?.selectedClient?.label || memory?.leadId) {
    lines.push(`Cliente selecionado: ${memory?.selectedClient?.label ?? memory?.leadId}`)
  }
  if (memory?.selectedProperty?.label || memory?.propertyId) {
    lines.push(`Imóvel selecionado: ${memory?.selectedProperty?.label ?? memory?.propertyId}`)
  }
  if ((memory?.uploadedDocuments?.length ?? 0) > 0) {
    lines.push(`Documento anexado: ${memory?.uploadedDocuments?.[0]?.name}`)
  }
  if ((memory?.attachments?.length ?? 0) > 0) {
    lines.push(`Arquivos enviados: ${memory?.attachments?.map((attachment) => attachment.name).join(", ")}`)
  }
  if (creditsRequired > 0) {
    lines.push(`Créditos que serão consumidos: ${creditsRequired}`)
  }
  if (workflow.pendingInput?.label) {
    lines.push(`Próxima ação esperada: ${workflow.pendingInput.label}`)
  }

  return lines.join("\n")
}

export { resumeWorkflowState, shouldResumeWorkflow } from "@/lib/cos/workflow-recovery"

export function shouldConfirmWorkflowMessage(message: string, confirm?: boolean) {
  return Boolean(confirm) || classifyCosPendingReply(message) === "confirm"
}
