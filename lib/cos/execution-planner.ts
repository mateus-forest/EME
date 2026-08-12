import { randomUUID } from "crypto"

import type { AssessorAction } from "@/lib/eme-backend"

import { buildRejectedAiPlanGoal, evaluateAiOrchestratorTrigger, generateCosAiExecutionPlan, type CosAiOrchestratorAudit } from "@/lib/cos/ai-orchestrator"
import { findCosExecutionRecipe, type CosExecutionRecipe } from "@/lib/cos/execution-recipes"
import { getCosCapabilityByAction } from "@/lib/cos/capability-registry"
import { getCosCapabilityConfirmationMessage, getCosCapabilityDescriptorById, getCosEntityModuleIdByCapabilityId } from "@/lib/cos/capability-catalog"
import { planCosCapability } from "@/lib/cos/planner"
import type {
  CosCapabilityId,
  CosCapabilityPlan,
  CosCapabilityPlanSource,
  CosNormalizedContext,
  CosPendingInput,
  CosCapabilitySurface,
  CosEntityModuleId,
  CosExecutionPlan,
  CosExecutionPlanGap,
  CosExecutionPlanTelemetry,
  CosExecutionStep,
  CosWorkspaceContext,
  CosWorkspaceEntity,
  CosWorkflow,
} from "@/lib/cos/types"

type StepPlanSource = {
  source?: CosCapabilityPlanSource
  confidence?: number
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getWorkspaceSelectionItem(workspace: CosWorkspaceContext | null | undefined) {
  if (!workspace) return null
  return workspace.selection[0] ?? null
}

function getWorkspaceEntity(workspace: CosWorkspaceContext | null | undefined) {
  return workspace?.entity || getWorkspaceSelectionItem(workspace)?.entity || null
}

function getWorkspaceEntityId(workspace: CosWorkspaceContext | null | undefined) {
  return workspace?.entityId || getWorkspaceSelectionItem(workspace)?.entityId || null
}

function summarizeActiveWorkflow(workflow: CosWorkflow | null | undefined) {
  if (!workflow) return null
  return {
    id: workflow.id,
    status: workflow.status,
    currentStep: workflow.currentStep,
    pendingInput: workflow.pendingInput,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      capabilityId: step.capabilityId,
      status: step.status,
    })),
  }
}

const confirmationOnlyActions = new Set<AssessorAction>([
  "DELETE_LEAD",
  "PUBLISH_PROPERTY",
  "PUBLISH_CATALOG",
  "SEND_CONTRACT",
  "CANCEL_CONTRACT",
  "CANCEL_AGENDA_EVENT",
])

function shouldRequireConfirmation(action: AssessorAction) {
  return confirmationOnlyActions.has(action)
}

export function createStepPlanForCapability(input: {
  capabilityId: CosCapabilityId
  message: string
  requestedAction?: string
  pendingInput?: CosPendingInput | null
  context?: CosNormalizedContext | null
  surface: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
  planId: string
  order: number
  reason: string
  stepId?: string
  dependsOn?: string[]
  source?: CosCapabilityPlanSource
  confidence?: number
}): CosExecutionStep {
  const descriptor = getCosCapabilityDescriptorById(input.capabilityId)
  if (!descriptor) {
    throw new Error(`Capability ${input.capabilityId} nao encontrada no catalogo do COS.`)
  }

  const capability = getCosCapabilityByAction(descriptor.action)
  const entity = getCosEntityModuleIdByCapabilityId(capability.id) ?? ("general" as CosEntityModuleId)
  const workspaceEntityUsed = getWorkspaceEntity(input.workspace ?? null)
  const workspaceEntityIdUsed = getWorkspaceEntityId(input.workspace ?? null)
  const contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy" =
    workspaceEntityUsed
      ? "workspace"
      : input.pendingInput
        ? "pending_input"
        : input.source === "legacy"
          ? "legacy"
          : "catalog"
  const payload = {
    ...(input.workspace ? { workspace: input.workspace } : {}),
    ...(input.context ? { context: input.context } : {}),
  }
  const stepSource = input.source ?? "catalog"
  const stepConfidence = input.confidence ?? (stepSource === "ai" ? 0.82 : 0.92)
  const telemetry = {
    capabilityId: capability.id,
    entity,
    confidence: stepConfidence,
    source: stepSource,
    reason: `${input.reason} [step ${input.order + 1}]`,
    fallbackUsed: stepSource === "legacy",
    pendingInputUsed: Boolean(input.pendingInput),
    surface: input.surface,
    resolutionMs: 0,
    requestedAction: input.requestedAction?.trim() || null,
    contextOrigin,
    workspaceReceived: Boolean(input.workspace),
    workspacePage: input.workspace?.page ?? null,
    workspaceEntity: getWorkspaceEntity(input.workspace ?? null),
    workspaceEntityId: getWorkspaceEntityId(input.workspace ?? null),
    workspaceEntityUsed,
    workspaceEntityIdUsed,
  }

  const plan: CosCapabilityPlan = {
    action: descriptor.action,
    payload,
    pendingInput: input.pendingInput ?? null,
    context: input.context ?? null,
    workspace: input.workspace ?? null,
    capability,
    capabilityId: capability.id,
    entity,
    confidence: telemetry.confidence,
    source: stepSource,
    reason: telemetry.reason,
    contextOrigin,
    telemetry,
  }

  return {
    id: input.stepId ?? `${input.planId}:step:${input.order + 1}`,
    order: input.order,
    entity,
    capabilityId: capability.id,
    action: plan.action,
    status: "pending",
    dependsOn: input.dependsOn ?? (input.order === 0 ? [] : [`${input.planId}:step:${input.order}`]),
    durationMs: null,
    result: null,
    errorMessage: null,
    plan,
  }
}

function buildConfirmationMessage(steps: CosExecutionStep[]) {
  if (steps.length === 0) return null
  if (steps.length === 1) return getCosCapabilityConfirmationMessage(steps[0].action)

  const labels = steps.map((step) => `• ${step.plan.capability.title}`)
  return ["Antes de continuar, preciso da sua confirmaÃ§Ã£o para:", ...labels, "", "Confirma esta aÃ§Ã£o?"].join("\n")
}

function buildIntentConfirmationMessage(input: {
  capabilityPlan: CosCapabilityPlan
  intentReason?: string | null
}) {
  const title = input.capabilityPlan.capability.title
  return `Quero confirmar antes de continuar.\n\nVoce deseja seguir com ${title.toLowerCase()}?`
}

function buildTelemetry(input: {
  planId: string
  source: CosExecutionPlan["source"]
  planner: CosExecutionPlanTelemetry["planner"]
  reason: string
  surface: CosCapabilitySurface
  steps: CosExecutionStep[]
  unresolvedGoals: CosExecutionPlanGap[]
  requestedAction?: string
  message: string
  workspace: CosWorkspaceContext | null
  contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy"
  resolutionMs: number
  orchestrator: CosAiOrchestratorAudit | null
}): CosExecutionPlanTelemetry {
  return {
    planId: input.planId,
    source: input.source,
    planner: input.planner,
    reason: input.reason,
    surface: input.surface,
    stepCount: input.steps.length,
    steps: input.steps.map((step) => ({
      id: step.id,
      capabilityId: step.capabilityId,
      action: step.action,
      entity: step.entity,
      source: step.plan.source,
      mutatesData: step.plan.capability.mutatesData,
        requiresConfirmation: shouldRequireConfirmation(step.action),
    })),
    unresolvedGoals: input.unresolvedGoals,
    requestedAction: input.requestedAction?.trim() || null,
    messageLength: input.message.trim().length,
    workspaceReceived: Boolean(input.workspace),
    workspaceEntity: getWorkspaceEntity(input.workspace),
    workspaceEntityId: getWorkspaceEntityId(input.workspace),
    contextOrigin: input.contextOrigin,
    resolutionMs: input.resolutionMs,
    orchestrator: input.orchestrator ? (input.orchestrator as unknown as CosExecutionPlanTelemetry["orchestrator"]) : null,
  }
}

function buildSingleExecutionPlan(input: {
  capabilityPlan: CosCapabilityPlan
  message: string
  requestedAction?: string
  pendingInput?: CosPendingInput | null
  context?: CosNormalizedContext | null
  intentConfidence?: number | null
  intentReason?: string | null
  surface: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
  startedAt: number
  planner?: CosExecutionPlanTelemetry["planner"]
  orchestrator?: CosAiOrchestratorAudit | null
}): CosExecutionPlan {
  const planId = randomUUID()
  const step: CosExecutionStep = {
    id: `${planId}:step:1`,
    order: 0,
    entity: input.capabilityPlan.entity,
    capabilityId: input.capabilityPlan.capabilityId,
    action: input.capabilityPlan.action,
    status: "pending",
    dependsOn: [],
    durationMs: null,
    result: null,
    errorMessage: null,
    plan: input.capabilityPlan,
  }

  const resolutionMs = Date.now() - input.startedAt
  const requiresIntentConfirmation = Boolean(
    input.requestedAction &&
    typeof input.intentConfidence === "number" &&
    input.intentConfidence >= 0.6 &&
    input.intentConfidence < 0.8 &&
    !input.pendingInput,
  )
  const requiresConfirmation = shouldRequireConfirmation(step.action) || requiresIntentConfirmation
  return {
    id: planId,
    source: "single",
    reason: input.capabilityPlan.reason,
    status: requiresConfirmation ? "needs_confirmation" : "pending",
    message: input.message,
    requestedAction: input.requestedAction,
    surface: input.surface,
    workspace: input.workspace ?? null,
    pendingInput: input.pendingInput ?? null,
    context: input.context ?? null,
    primaryStep: step,
    steps: [step],
    unresolvedGoals: [],
    requiresConfirmation,
    confirmationMessage: requiresConfirmation
      ? requiresIntentConfirmation
        ? buildIntentConfirmationMessage({
            capabilityPlan: input.capabilityPlan,
            intentReason: input.intentReason,
          })
        : getCosCapabilityConfirmationMessage(input.capabilityPlan.action)
      : null,
    telemetry: buildTelemetry({
      planId,
      source: "single",
      planner: input.planner ?? "deterministic",
      reason: input.capabilityPlan.reason,
      surface: input.surface,
      steps: [step],
      unresolvedGoals: [],
      requestedAction: input.requestedAction,
      message: input.message,
      workspace: input.workspace ?? null,
      contextOrigin: input.capabilityPlan.contextOrigin,
      resolutionMs,
      orchestrator: input.orchestrator ?? null,
    }),
  }
}

function buildRecipeExecutionPlan(input: {
  message: string
  requestedAction?: string
  pendingInput?: CosPendingInput | null
  context?: CosNormalizedContext | null
  intentConfidence?: number | null
  intentReason?: string | null
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  startedAt: number
  recipe: CosExecutionRecipe
}): CosExecutionPlan {
  const planId = randomUUID()
  const normalizedMessage = normalizeText(input.message)
  const reason = input.recipe.reason({ normalizedMessage, workspace: input.workspace })
  const steps = input.recipe.stepIds.map((capabilityId, order) =>
    createStepPlanForCapability({
      capabilityId,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingInput: input.pendingInput,
      context: input.context,
      surface: input.surface,
      workspace: input.workspace,
      planId,
      order,
      reason,
    }),
  )

  const requiresIntentConfirmation = Boolean(
    input.requestedAction &&
    typeof input.intentConfidence === "number" &&
    input.intentConfidence >= 0.6 &&
    input.intentConfidence < 0.8 &&
    !input.pendingInput,
  )
  const requiresConfirmation = steps.some((step) => shouldRequireConfirmation(step.action)) || requiresIntentConfirmation
  const resolutionMs = Date.now() - input.startedAt
  const contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy" =
    getWorkspaceEntity(input.workspace)
      ? "workspace"
      : input.pendingInput
        ? "pending_input"
        : "catalog"

  const plan: CosExecutionPlan = {
    id: planId,
    source: "recipe",
    reason,
    status: requiresConfirmation ? "needs_confirmation" : "pending",
    message: input.message,
    requestedAction: input.requestedAction,
    surface: input.surface,
    workspace: input.workspace,
    pendingInput: input.pendingInput ?? null,
    context: input.context ?? null,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation,
    confirmationMessage: requiresConfirmation
      ? requiresIntentConfirmation
        ? buildIntentConfirmationMessage({
            capabilityPlan: steps[0].plan,
            intentReason: input.intentReason,
          })
        : buildConfirmationMessage(steps)
      : null,
    telemetry: buildTelemetry({
      planId,
      source: "recipe",
      planner: "deterministic",
      reason,
      surface: input.surface,
      steps,
      unresolvedGoals: [],
      requestedAction: input.requestedAction,
      message: input.message,
      workspace: input.workspace,
      contextOrigin,
      resolutionMs,
      orchestrator: null,
    }),
  }

  console.info("[cos][execution-plan]", {
    planId: plan.id,
    source: plan.source,
    planner: plan.telemetry.planner,
    stepCount: plan.steps.length,
    capabilities: plan.steps.map((step) => step.capabilityId),
    unresolvedGoals: plan.unresolvedGoals.map((gap) => gap.id),
    requiresConfirmation: plan.requiresConfirmation,
    surface: input.surface,
    workspaceEntity: plan.telemetry.workspaceEntity,
    workspaceEntityId: plan.telemetry.workspaceEntityId,
    resolutionMs,
    reason,
  })

  return plan
}

function buildAiExecutionPlan(input: {
  message: string
  requestedAction?: string
  pendingInput?: CosPendingInput | null
  context?: CosNormalizedContext | null
  intentConfidence?: number | null
  intentReason?: string | null
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  startedAt: number
  aiPlan: Awaited<ReturnType<typeof generateCosAiExecutionPlan>> & { accepted: true }
}): CosExecutionPlan {
  const planId = randomUUID()
  const stepIdMap = new Map(input.aiPlan.data.steps.map((step, index) => [step.id, `${planId}:step:${index + 1}`]))
  const steps = input.aiPlan.data.steps.map((step, order) =>
    createStepPlanForCapability({
      capabilityId: step.capability as CosCapabilityId,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingInput: input.pendingInput,
      context: input.context,
      surface: input.surface,
      workspace: input.workspace,
      planId,
      order,
      reason: input.aiPlan.data.reason,
      stepId: stepIdMap.get(step.id),
      dependsOn: step.dependsOn.map((dependency) => stepIdMap.get(dependency)).filter((value): value is string => Boolean(value)),
      source: "ai",
      confidence: input.aiPlan.data.confidence,
    }),
  )

  const requiresIntentConfirmation = Boolean(
    input.requestedAction &&
    typeof input.intentConfidence === "number" &&
    input.intentConfidence >= 0.6 &&
    input.intentConfidence < 0.8 &&
    !input.pendingInput,
  )
  const requiresConfirmation = steps.some((step) => shouldRequireConfirmation(step.action)) || requiresIntentConfirmation
  const resolutionMs = Date.now() - input.startedAt
  const contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy" =
    getWorkspaceEntity(input.workspace)
      ? "workspace"
      : input.pendingInput
        ? "pending_input"
        : "catalog"

  return {
    id: planId,
    source: "ai",
    reason: input.aiPlan.data.reason,
    status: requiresConfirmation ? "needs_confirmation" : "pending",
    message: input.message,
    requestedAction: input.requestedAction,
    surface: input.surface,
    workspace: input.workspace,
    pendingInput: input.pendingInput ?? null,
    context: input.context ?? null,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation,
    confirmationMessage: requiresConfirmation
      ? requiresIntentConfirmation
        ? buildIntentConfirmationMessage({
            capabilityPlan: steps[0].plan,
            intentReason: input.intentReason,
          })
        : buildConfirmationMessage(steps)
      : null,
    telemetry: buildTelemetry({
      planId,
      source: "ai",
      planner: "ai",
      reason: input.aiPlan.data.reason,
      surface: input.surface,
      steps,
      unresolvedGoals: [],
      requestedAction: input.requestedAction,
      message: input.message,
      workspace: input.workspace,
      contextOrigin,
      resolutionMs,
      orchestrator: {
        ...input.aiPlan.audit,
        executedCapabilities: steps.map((step) => step.capabilityId),
      },
    }),
  }
}

export async function planCosExecution(input: {
  message: string
  requestedAction?: string
  pendingInput?: CosPendingInput | null
  surface?: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
  activeWorkflow?: CosWorkflow | null
  context?: CosNormalizedContext | null
  intentConfidence?: number | null
  intentReason?: string | null
  aiOrchestratorOverride?: unknown
  allowAiOrchestrator?: boolean
  isExplicitAction?: boolean
}): Promise<CosExecutionPlan> {
  const startedAt = Date.now()
  const surface = input.surface ?? "portal"
  const workspace = input.workspace ?? null
  const pendingInput = input.pendingInput ?? null
  const primaryCapabilityPlan = planCosCapability({
    message: input.message,
    requestedAction: input.requestedAction,
    pendingInput,
    context: input.context ?? null,
    intentConfidence: input.intentConfidence ?? null,
    intentReason: input.intentReason ?? null,
    surface,
    workspace,
  })

  // Uma requestedAction explícita (ex.: os botões de Ajuda, ou "Ver detalhes da operação") já é uma
  // intenção determinística vinda da própria interface — o matching de recipe por texto livre não
  // deve nunca sobrescrevê-la. Sem essa guarda, uma mensagem longa (como o resumo de pendências
  // enviado por "Ver detalhes da operação", que menciona "contrato" e "assinatura" só como dois dos
  // vários itens listados) podia colidir com um recipe genérico e descartar a capability já resolvida
  // com confiança máxima, substituindo-a por um workflow de 3 passos sobre contrato não solicitado.
  // Mesma exceção que shouldTryAiOrchestrator (lib/cos/ai-orchestrator.ts) já aplica para requestedAction.
  const matchedRecipe = findCosExecutionRecipe({
    message: input.message,
    workspace,
    isExplicitAction: input.isExplicitAction,
  })
  if (matchedRecipe) {
    return buildRecipeExecutionPlan({
      message: input.message,
      requestedAction: input.requestedAction,
      pendingInput,
      context: input.context ?? null,
      intentConfidence: input.intentConfidence ?? null,
      intentReason: input.intentReason ?? null,
      surface,
      workspace,
      startedAt,
      recipe: matchedRecipe,
    })
  }

  const aiTrigger = evaluateAiOrchestratorTrigger({
    message: input.message,
    surface,
    requestedAction: input.isExplicitAction ? input.requestedAction : undefined,
    workspace,
    pendingInput,
    context: input.context ?? null,
    primaryCapabilityId: primaryCapabilityPlan.capabilityId,
    primarySource: primaryCapabilityPlan.source,
    primaryConfidence: primaryCapabilityPlan.confidence,
    recipeMatched: Boolean(matchedRecipe),
  })

  if (!aiTrigger.shouldTry || input.allowAiOrchestrator === false) {
    return buildSingleExecutionPlan({
      capabilityPlan: primaryCapabilityPlan,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingInput,
      context: input.context ?? null,
      intentConfidence: input.intentConfidence ?? null,
      intentReason: input.intentReason ?? null,
      surface,
      workspace,
      startedAt,
      planner: "deterministic",
    })
  }

  const aiPlan = await generateCosAiExecutionPlan({
    message: input.message,
    surface,
    workspace,
    pendingInput,
    context: input.context ?? null,
    activeWorkflowSummary: summarizeActiveWorkflow(input.activeWorkflow ?? null),
    triggerReason: aiTrigger.triggerReason ?? "deterministic_fallback",
    responseOverride: input.aiOrchestratorOverride,
  })

  if (aiPlan.accepted) {
    const plan = buildAiExecutionPlan({
      message: input.message,
      requestedAction: input.requestedAction,
      pendingInput,
      context: input.context ?? null,
      intentConfidence: input.intentConfidence ?? null,
      intentReason: input.intentReason ?? null,
      surface,
      workspace,
      startedAt,
      aiPlan,
    })

    console.info("[cos][execution-plan]", {
      planId: plan.id,
      source: plan.source,
      planner: plan.telemetry.planner,
      stepCount: plan.steps.length,
      capabilities: plan.steps.map((step) => step.capabilityId),
      unresolvedGoals: [],
      requiresConfirmation: plan.requiresConfirmation,
      surface,
      workspaceEntity: plan.telemetry.workspaceEntity,
      workspaceEntityId: plan.telemetry.workspaceEntityId,
      resolutionMs: plan.telemetry.resolutionMs,
      reason: plan.reason,
    })

    return plan
  }

  const fallbackCapabilityPlan: CosCapabilityPlan = {
    ...primaryCapabilityPlan,
    reason: aiPlan.audit.triggerReason
      ? `${primaryCapabilityPlan.reason} | fallback apos AI (${aiPlan.audit.triggerReason})`
      : `${primaryCapabilityPlan.reason} | fallback apos AI`,
  }

  const fallbackPlan = buildSingleExecutionPlan({
    capabilityPlan: fallbackCapabilityPlan,
    message: input.message,
    requestedAction: input.requestedAction,
    pendingInput,
    context: input.context ?? null,
    intentConfidence: input.intentConfidence ?? null,
    intentReason: input.intentReason ?? null,
    surface,
    workspace,
    startedAt,
    planner: "deterministic",
    orchestrator: {
      ...aiPlan.audit,
      fallbackUsed: true,
      executedCapabilities: [primaryCapabilityPlan.capabilityId],
      validationErrors: [
        ...aiPlan.audit.validationErrors,
        ...buildRejectedAiPlanGoal({ audit: aiPlan.audit }).map((goal) => goal.reason),
      ],
    },
  })

  console.info("[cos][execution-plan][fallback]", {
    planId: fallbackPlan.id,
    planner: fallbackPlan.telemetry.planner,
    fallbackReason: aiPlan.audit.fallbackReason,
    aiStatus: aiPlan.audit.status,
    capability: fallbackPlan.primaryStep.capabilityId,
  })

  return fallbackPlan
}
