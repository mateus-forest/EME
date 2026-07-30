import { randomUUID } from "crypto"

import type { PendingAssessorContext } from "@/lib/eme-backend"

import { buildRejectedAiPlanGoal, evaluateAiOrchestratorTrigger, generateCosAiExecutionPlan, type CosAiOrchestratorAudit } from "@/lib/cos/ai-orchestrator"
import { getCosCapabilityByAction } from "@/lib/cos/capability-registry"
import { getCosCapabilityConfirmationMessage, getCosCapabilityDescriptorById, getCosEntityModuleIdByCapabilityId } from "@/lib/cos/capability-catalog"
import { planCosCapability } from "@/lib/cos/planner"
import type {
  CosCapabilityId,
  CosCapabilityPlan,
  CosCapabilityPlanSource,
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

type ExecutionRecipe = {
  id: string
  match: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => boolean
  stepIds: CosCapabilityId[]
  reason: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => string
}

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

function hasAny(normalizedMessage: string, tokens: string[]) {
  return tokens.some((token) => normalizedMessage.includes(token))
}

function isPropertyWorkspace(workspace: CosWorkspaceContext | null) {
  return getWorkspaceEntity(workspace) === "property" && Boolean(getWorkspaceEntityId(workspace))
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

const executionRecipes: ExecutionRecipe[] = [
  {
    id: "lead_create_then_proposal",
    match: ({ normalizedMessage }) =>
      hasAny(normalizedMessage, ["cadastre", "cadastrar", "novo cliente", "novo lead", "crie cliente", "criar cliente"]) &&
      normalizedMessage.includes("proposta"),
    stepIds: ["lead.create", "proposal.create"],
    reason: () => "pedido combinou cadastro de cliente com geracao de proposta",
  },
  {
    id: "contract_create_then_signature",
    match: ({ normalizedMessage }) =>
      normalizedMessage.includes("contrato") && hasAny(normalizedMessage, ["assinatura", "assinar", "envie", "enviar"]),
    stepIds: ["contract.create", "contract.send", "contract.sign"],
    reason: () => "pedido combinou criacao de contrato com envio e conclusao da assinatura no mesmo workflow",
  },
  {
    id: "operation_analysis",
    match: ({ normalizedMessage }) =>
      hasAny(normalizedMessage, ["analise minha operacao", "analisar minha operacao", "analise minha carteira", "analisar minha carteira"]),
    stepIds: ["lead.summary", "finance.summary", "analytics.summary", "operation.summary"],
    reason: () => "pedido exige consolidacao operacional em multiplas leituras do Registry",
  },
  {
    id: "property_sale_preparation",
    match: ({ normalizedMessage, workspace }) =>
      isPropertyWorkspace(workspace) &&
      hasAny(normalizedMessage, ["quero vender", "vender este imovel", "gere um anuncio", "criar anuncio", "publicar este imovel"]),
    stepIds: ["property.description.improve", "catalog.publish", "studio.generateCampaign"],
    reason: () => "pedido usou um imovel do workspace para preparar a venda com descricao, publicacao e campanha",
  },
  {
    id: "catalog_publish_then_campaign",
    match: ({ normalizedMessage }) => normalizedMessage.includes("catalogo") && hasAny(normalizedMessage, ["publique", "publicar", "campanha"]),
    stepIds: ["catalog.publish", "studio.generateCampaign"],
    reason: () => "pedido combinou publicacao em catalogo com geracao de campanha no Studio IA",
  },
]

export function createStepPlanForCapability(input: {
  capabilityId: CosCapabilityId
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
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
  const contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy" =
    workspaceEntityUsed
      ? "workspace"
      : input.pendingContext
        ? "pending_context"
        : input.source === "legacy"
          ? "legacy"
          : "catalog"
  const payload = {
    ...(input.pendingContext ? { pendingContext: input.pendingContext } : {}),
    ...(input.workspace ? { workspace: input.workspace } : {}),
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
    pendingContextUsed: Boolean(input.pendingContext),
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
    pendingContext: input.pendingContext ?? null,
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

  const labels = steps.map((step, index) => `${index + 1}. ${step.plan.capability.title}`)
  return ["Posso executar este plano agora:", ...labels, "", "Deseja confirmar?"].join("\n")
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
  contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy"
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
      requiresConfirmation: step.plan.capability.requiresConfirmation,
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
  pendingContext?: PendingAssessorContext | null
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
  return {
    id: planId,
    source: "single",
    reason: input.capabilityPlan.reason,
    status: input.capabilityPlan.capability.requiresConfirmation ? "needs_confirmation" : "pending",
    message: input.message,
    requestedAction: input.requestedAction,
    surface: input.surface,
    workspace: input.workspace ?? null,
    pendingContext: input.pendingContext ?? null,
    primaryStep: step,
    steps: [step],
    unresolvedGoals: [],
    requiresConfirmation: input.capabilityPlan.capability.requiresConfirmation,
    confirmationMessage: input.capabilityPlan.capability.requiresConfirmation ? getCosCapabilityConfirmationMessage(input.capabilityPlan.action) : null,
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
  pendingContext?: PendingAssessorContext | null
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  startedAt: number
  recipe: ExecutionRecipe
}): CosExecutionPlan {
  const planId = randomUUID()
  const normalizedMessage = normalizeText(input.message)
  const reason = input.recipe.reason({ normalizedMessage, workspace: input.workspace })
  const steps = input.recipe.stepIds.map((capabilityId, order) =>
    createStepPlanForCapability({
      capabilityId,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingContext: input.pendingContext,
      surface: input.surface,
      workspace: input.workspace,
      planId,
      order,
      reason,
    }),
  )

  const requiresConfirmation = steps.some((step) => step.plan.capability.requiresConfirmation)
  const resolutionMs = Date.now() - input.startedAt
  const contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy" =
    getWorkspaceEntity(input.workspace)
      ? "workspace"
      : input.pendingContext
        ? "pending_context"
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
    pendingContext: input.pendingContext ?? null,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation,
    confirmationMessage: requiresConfirmation ? buildConfirmationMessage(steps) : null,
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
  pendingContext?: PendingAssessorContext | null
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
      pendingContext: input.pendingContext,
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

  const requiresConfirmation = steps.some((step) => step.plan.capability.requiresConfirmation)
  const resolutionMs = Date.now() - input.startedAt
  const contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy" =
    getWorkspaceEntity(input.workspace)
      ? "workspace"
      : input.pendingContext
        ? "pending_context"
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
    pendingContext: input.pendingContext ?? null,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation,
    confirmationMessage: requiresConfirmation ? buildConfirmationMessage(steps) : null,
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
  pendingContext?: PendingAssessorContext | null
  surface?: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
  activeWorkflow?: CosWorkflow | null
  aiOrchestratorOverride?: unknown
  allowAiOrchestrator?: boolean
}): Promise<CosExecutionPlan> {
  const startedAt = Date.now()
  const surface = input.surface ?? "portal"
  const workspace = input.workspace ?? null
  const pendingContext = input.pendingContext ?? null
  const normalizedMessage = normalizeText(input.message)
  const primaryCapabilityPlan = planCosCapability({
    message: input.message,
    requestedAction: input.requestedAction,
    pendingContext,
    surface,
    workspace,
  })

  const matchedRecipe = executionRecipes.find((recipe) => recipe.match({ normalizedMessage, workspace }))
  if (matchedRecipe) {
    return buildRecipeExecutionPlan({
      message: input.message,
      requestedAction: input.requestedAction,
      pendingContext,
      surface,
      workspace,
      startedAt,
      recipe: matchedRecipe,
    })
  }

  const aiTrigger = evaluateAiOrchestratorTrigger({
    message: input.message,
    surface,
    requestedAction: input.requestedAction,
    workspace,
    pendingContext,
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
      pendingContext,
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
    pendingContext,
    activeWorkflowSummary: summarizeActiveWorkflow(input.activeWorkflow ?? null),
    triggerReason: aiTrigger.triggerReason ?? "deterministic_fallback",
    responseOverride: input.aiOrchestratorOverride,
  })

  if (aiPlan.accepted) {
    const plan = buildAiExecutionPlan({
      message: input.message,
      requestedAction: input.requestedAction,
      pendingContext,
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
    pendingContext,
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
