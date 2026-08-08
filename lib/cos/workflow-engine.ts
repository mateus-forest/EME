import { executeCosExecutionPlan } from "@/lib/cos/executor"
import { getCosCapabilityLabel } from "@/lib/cos/capability-catalog"
import { createStepPlanForCapability } from "@/lib/cos/execution-planner"
import { createPendingInput, extractPendingInputFromMetadata, normalizeWorkflowStatus } from "@/lib/cos/pending-input"
import type { Prisma } from "@prisma/client"
import type {
  CosConversationMemory,
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

function getWorkflowStatusLabel(workflow: CosWorkflow) {
  const status = normalizeWorkflowStatus(workflow.status)
  if (status === "completed") return "ConcluÃƒÂ­da"
  if (status === "cancelled") return "Cancelada"
  if (status === "failed") return "Erro"
  if (workflow.pendingInput?.field === "confirmation") return "Aguardando confirmaÃƒÂ§ÃƒÂ£o"
  if (workflow.pendingInput?.type === "selection") return "Aguardando seleÃƒÂ§ÃƒÂ£o"
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
}): CosPendingInput {
  return createPendingInput({
    field: input.field,
    action: input.action as CosPendingInput["action"],
    entity: input.entity as CosPendingInput["entity"],
    parsedData: input.parsedData ?? {},
  })
}

function buildResumePayload(input: {
  workflow: CosWorkflow
  message: string
  workspace: CosWorkspaceContext | null
}) {
  const payload: Record<string, unknown> = {}
  if (input.workspace) payload.workspace = input.workspace

  const pendingInput = input.workflow.pendingInput
  if (!pendingInput) return payload

  if (pendingInput.type === "confirmation") {
    payload.confirmation = input.message.trim()
    return payload
  }

  if (pendingInput.type === "selection") {
    payload.selection = input.message.trim()
  }

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
    // parsePropertyDraftData roda de novo sobre esta mensagem de resposta (ex: "850 mil"), que nao
    // tem cidade/bairro/quartos/etc — sem repassar o que ja foi extraido no primeiro turno via
    // parsedData, esses campos eram perdidos e voltavam a aparecer como pendencia mesmo tendo sido
    // informados corretamente antes.
    const preservedDraftFields = ["city", "neighborhood", "bedrooms", "bathrooms", "parkingSpots", "area"]
    for (const field of preservedDraftFields) {
      if (pendingInput.parsedData[field] !== undefined) {
        payload[field] = pendingInput.parsedData[field]
      }
    }
  }

  if (pendingInput.type === "text" || pendingInput.type === "currency" || pendingInput.type === "time") {
    payload[pendingInput.field] = input.message.trim()
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
  const normalizedStatus = normalizeWorkflowStatus(envelope.workflow.status)
  if (["completed", "failed", "cancelled"].includes(normalizedStatus)) return null
  return {
    ...envelope.workflow,
    status: normalizedStatus,
  }
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
    confirmationMessage: workflow.pendingInput?.field === "confirmation" ? "Confirma esta aÃƒÂ§ÃƒÂ£o?" : null,
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
  const pendingInput =
    input.result.status === "awaiting_input" && interruptedStep
      ? extractPendingInputFromMetadata({
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

export function resumeWorkflowState(workflow: CosWorkflow) {
  if (!workflow.pausedAt) return workflow
  const pausedMs = Date.now() - new Date(workflow.pausedAt).getTime()
  return {
    ...workflow,
    status: "processing" as CosWorkflowStatus,
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
    return "NÃƒÂ£o existe nenhuma operaÃƒÂ§ÃƒÂ£o em andamento no momento."
  }

  const lines = [
    "OperaÃƒÂ§ÃƒÂ£o em andamento",
    "",
    `Nome da operaÃƒÂ§ÃƒÂ£o: ${getWorkflowStepLabel(operationStep)}`,
    `Status: ${getWorkflowStatusLabel(workflow)}`,
    "",
    "Etapas:",
    ...workflow.steps.map((step, index) => {
      const prefix =
        step.status === "completed"
          ? "Ã¢Å“â€"
          : step.status === "failed"
            ? "Ã¢Å¡Â "
            : index === currentStepIndex || step.status === "running" || step.status === "awaiting_input"
              ? "Ã¢ÂÂ³"
              : "Ã¢Â¬Å“"
      return `${prefix} ${getWorkflowStepLabel(step)}`
    }),
  ]

  if (memory?.selectedClient?.label || memory?.leadId) {
    lines.push(`Cliente selecionado: ${memory?.selectedClient?.label ?? memory?.leadId}`)
  }
  if (memory?.selectedProperty?.label || memory?.propertyId) {
    lines.push(`ImÃƒÂ³vel selecionado: ${memory?.selectedProperty?.label ?? memory?.propertyId}`)
  }
  if ((memory?.uploadedDocuments?.length ?? 0) > 0) {
    lines.push(`Documento anexado: ${memory?.uploadedDocuments?.[0]?.name}`)
  }
  if ((memory?.attachments?.length ?? 0) > 0) {
    lines.push(`Arquivos enviados: ${memory?.attachments?.map((attachment) => attachment.name).join(", ")}`)
  }
  if (creditsRequired > 0) {
    lines.push(`CrÃƒÂ©ditos que serÃƒÂ£o consumidos: ${creditsRequired}`)
  }
  if (workflow.pendingInput?.label) {
    lines.push(`PrÃƒÂ³xima aÃƒÂ§ÃƒÂ£o esperada: ${workflow.pendingInput.label}`)
  }

  return lines.join("\n")
}

export function shouldResumeWorkflow(workflow: CosWorkflow | null) {
  if (!workflow) return false
  const status = normalizeWorkflowStatus(workflow.status)
  return status === "awaiting_input" || status === "paused" || status === "processing"
}

export function shouldConfirmWorkflowMessage(message: string, confirm?: boolean) {
  return Boolean(confirm) || isAffirmativeMessage(message)
}
