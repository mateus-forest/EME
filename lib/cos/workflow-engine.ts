import { executeCosExecutionPlan } from "@/lib/cos/executor"
import { createStepPlanForCapability } from "@/lib/cos/execution-planner"
import type { Prisma } from "@prisma/client"
import type {
  CosConversationMemory,
  CosExecutionPlan,
  CosExecutionPlanResult,
  CosExecutionStep,
  CosPendingInput,
  CosPendingInputType,
  CosWorkflow,
  CosWorkflowStatus,
  CosWorkspaceContext,
} from "@/lib/cos/types"
import type { PendingAssessorContext } from "@/lib/eme-backend"

type ConversationEnvelope = {
  workflow: CosWorkflow | null
  memory?: CosConversationMemory | null
}

function emptyEnvelope(): ConversationEnvelope {
  return { workflow: null, memory: null }
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return recordValue(value) as Prisma.InputJsonObject
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function isAffirmativeMessage(message: string) {
  return /^(sim|s|ok|pode|confirmar|confirma|pode seguir|seguir)$/i.test(normalizeText(message))
}

function mapPendingInputType(field: string): CosPendingInputType {
  if (field === "phone") return "phone"
  if (field === "price") return "currency"
  if (field === "time") return "time"
  if (field === "lead" || field === "propertyChoice" || field === "property") return "selection"
  if (field === "confirmation") return "confirmation"
  return "text"
}

function mapPendingInputLabel(field: string, action: string) {
  if (field === "name") return "Nome do lead"
  if (field === "phone") return "Telefone do lead"
  if (field === "price") return action === "createPropertyDraft" ? "Preço do imóvel" : "Preço"
  if (field === "time") return "Horário"
  if (field === "lead") return "Cliente"
  if (field === "propertyChoice" || field === "property") return "Imóvel"
  if (field === "confirmation") return "Confirmação"
  return field
}

function buildPendingInput(input: {
  field: string
  action: string
  entity: string
  parsedData?: Record<string, unknown>
}): CosPendingInput {
  return {
    field: input.field,
    label: mapPendingInputLabel(input.field, input.action),
    type: mapPendingInputType(input.field),
    required: true,
    entity: input.entity as CosPendingInput["entity"],
    action: input.action as CosPendingInput["action"],
    parsedData: input.parsedData ?? {},
  }
}

function buildPendingContextFromWorkflow(workflow: CosWorkflow): PendingAssessorContext | null {
  if (!workflow.pendingInput) return null
  return {
    action: workflow.pendingInput.action,
    missingField: workflow.pendingInput.field,
    parsedData: workflow.pendingInput.parsedData,
    createdAt: new Date(workflow.updatedAt),
  }
}

function buildResumePayload(input: {
  workflow: CosWorkflow
  message: string
  workspace: CosWorkspaceContext | null
}) {
  const payload: Record<string, unknown> = {}
  const pendingContext = buildPendingContextFromWorkflow(input.workflow)
  if (pendingContext) payload.pendingContext = pendingContext
  if (input.workspace) payload.workspace = input.workspace

  const pendingInput = input.workflow.pendingInput
  if (!pendingInput) return payload

  if (pendingInput.action === "createLead") {
    if (pendingInput.field === "name") {
      payload.name = input.message.trim()
    } else if (pendingInput.field === "phone") {
      payload.phone = input.message.trim()
      const extractedName = typeof pendingInput.parsedData.extractedName === "string" ? pendingInput.parsedData.extractedName : ""
      if (extractedName) payload.name = extractedName
    }
  }

  if (pendingInput.action === "createPropertyDraft" && pendingInput.field === "price") {
    payload.price = input.message.trim()
  }

  return payload
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
    leadId: step.result?.leadId,
    propertyId: step.result?.propertyId,
  }
}

function hydrateStep(step: CosWorkflow["steps"][number], workflow: CosWorkflow): CosExecutionStep {
  const rebuilt = createStepPlanForCapability({
    capabilityId: step.capabilityId,
    message: workflow.executionPlan.message,
    requestedAction: workflow.executionPlan.requestedAction,
    pendingContext: buildPendingContextFromWorkflow(workflow),
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
    result: step.resultResponse || step.resultMetadata
      ? {
          response: step.resultResponse ?? "",
          metadata: jsonObject(step.resultMetadata),
          leadId: step.leadId,
          propertyId: step.propertyId,
        }
      : null,
  }
}

export function parseConversationWorkflowContent(content: string | null | undefined) {
  if (!content) return emptyEnvelope()

  try {
    const parsed = JSON.parse(content) as Partial<ConversationEnvelope>
    const workflow = parsed?.workflow && typeof parsed.workflow === "object" ? (parsed.workflow as CosWorkflow) : null
    const memory = parsed?.memory && typeof parsed.memory === "object" ? (parsed.memory as CosConversationMemory) : null
    return { workflow, memory }
  } catch {
    return emptyEnvelope()
  }
}

export function stringifyConversationWorkflowContent(workflow: CosWorkflow | null, memory?: CosConversationMemory | null) {
  return JSON.stringify({ workflow, memory: memory ?? null })
}

export function getActiveWorkflow(content: string | null | undefined) {
  const envelope = parseConversationWorkflowContent(content)
  if (!envelope.workflow) return null
  if (["completed", "failed", "cancelled"].includes(envelope.workflow.status)) return null
  return envelope.workflow
}

export function getConversationMemory(content: string | null | undefined) {
  return parseConversationWorkflowContent(content).memory ?? null
}

export function createWorkflowFromExecutionPlan(input: {
  conversationId: string
  plan: CosExecutionPlan
}): CosWorkflow {
  const now = new Date().toISOString()
  return {
    id: input.plan.id,
    conversationId: input.conversationId,
    status: input.plan.requiresConfirmation ? "awaiting_input" : "running",
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
    pendingInput: input.plan.requiresConfirmation
      ? buildPendingInput({
          field: "confirmation",
          action: input.plan.primaryStep.action,
          entity: input.plan.primaryStep.entity,
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
    pendingContext: buildPendingContextFromWorkflow(workflow),
    primaryStep,
    steps,
    unresolvedGoals: workflow.executionPlan.unresolvedGoals,
    requiresConfirmation: workflow.pendingInput?.field === "confirmation",
    confirmationMessage: workflow.pendingInput?.field === "confirmation" ? "Deseja confirmar?" : null,
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
  confirm?: boolean
  workspace: CosWorkspaceContext | null
  payload?: Record<string, unknown>
}) {
  const plan = rebuildExecutionPlanFromWorkflow(input.workflow)
  const payload = buildResumePayload({
    workflow: input.workflow,
    message: input.message,
    workspace: input.workspace,
  })
  Object.assign(payload, input.payload ?? {})

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
  const pendingField =
    interruptedStep && interruptedStep.result
      ? Array.isArray(interruptedStep.result.metadata?.required)
        ? typeof interruptedStep.result.metadata.required[0] === "string"
          ? interruptedStep.result.metadata.required[0]
          : ""
        : ""
      : ""
  const pendingParsedData = recordValue(interruptedStep?.result?.metadata?.parsedData)
  const fallbackParsedData = recordValue(interruptedStep?.result?.metadata)
  const parsedData =
    Object.keys(pendingParsedData).length > 0
      ? pendingParsedData
      : interruptedStep?.result?.metadata && "extractedName" in interruptedStep.result.metadata
        ? fallbackParsedData
        : {}

  const pendingInput =
    input.result.status === "awaiting_input" && interruptedStep
      ? buildPendingInput({
          field: pendingField || "input",
          action: interruptedStep.action,
          entity: interruptedStep.entity,
          parsedData,
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

export function resumeWorkflowState(workflow: CosWorkflow) {
  if (!workflow.pausedAt) return workflow
  const pausedMs = Date.now() - new Date(workflow.pausedAt).getTime()
  return {
    ...workflow,
    status: "running" as CosWorkflowStatus,
    pausedAt: null,
    totalPausedMs: workflow.totalPausedMs + Math.max(0, pausedMs),
    updatedAt: new Date().toISOString(),
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
    return `Workflow concluido.\n${total} etapas executadas.`
  }
  return `Etapa ${current} de ${total}`
}

export function shouldResumeWorkflow(workflow: CosWorkflow | null) {
  if (!workflow) return false
  return workflow.status === "awaiting_input" || workflow.status === "paused" || workflow.status === "running"
}

export function shouldConfirmWorkflowMessage(message: string, confirm?: boolean) {
  return Boolean(confirm) || isAffirmativeMessage(message)
}
