import { randomUUID } from "crypto"

import type { PendingAssessorContext } from "@/lib/eme-backend"

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
  CosExecutionStep,
  CosWorkspaceContext,
  CosWorkspaceEntity,
} from "@/lib/cos/types"

type ExecutionRecipe = {
  id: string
  match: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => boolean
  stepIds: CosCapabilityId[]
  gaps?: Array<{
    id: string
    title: string
    when: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => boolean
    reason: string
  }>
  reason: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => string
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
        : "catalog"
  const payload = {
    ...(input.pendingContext ? { pendingContext: input.pendingContext } : {}),
    ...(input.workspace ? { workspace: input.workspace } : {}),
  }
  const telemetry = {
    capabilityId: capability.id,
    entity,
    confidence: 0.92,
    source: "catalog" as CosCapabilityPlanSource,
    reason: `${input.reason} [step ${input.order + 1}]`,
    fallbackUsed: false,
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
    source: "catalog",
    reason: telemetry.reason,
    contextOrigin,
    telemetry,
  }

  return {
    id: `${input.planId}:step:${input.order + 1}`,
    order: input.order,
    entity,
    capabilityId: capability.id,
    action: plan.action,
    status: "pending",
    dependsOn: input.order === 0 ? [] : [`${input.planId}:step:${input.order}`],
    durationMs: null,
    result: null,
    errorMessage: null,
    plan,
  }
}

function buildUnresolvedGoals(recipe: ExecutionRecipe, input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) {
  return (recipe.gaps ?? [])
    .filter((gap) => gap.when(input))
    .map(
      (gap): CosExecutionPlanGap => ({
        id: gap.id,
        title: gap.title,
        reason: gap.reason,
      }),
    )
}

function buildConfirmationMessage(steps: CosExecutionStep[]) {
  if (steps.length === 0) return null
  if (steps.length === 1) return getCosCapabilityConfirmationMessage(steps[0].action)

  const labels = steps.map((step, index) => `${index + 1}. ${step.plan.capability.title}`)
  return ["Posso executar este plano agora:", ...labels, "", "Deseja confirmar?"].join("\n")
}

function buildSingleExecutionPlan(input: {
  capabilityPlan: CosCapabilityPlan
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
  surface: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
  startedAt: number
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
    telemetry: {
      planId,
      source: "single",
      reason: input.capabilityPlan.reason,
      surface: input.surface,
      stepCount: 1,
      steps: [
        {
          id: step.id,
          capabilityId: step.capabilityId,
          action: step.action,
          entity: step.entity,
          source: step.plan.source,
          mutatesData: step.plan.capability.mutatesData,
          requiresConfirmation: step.plan.capability.requiresConfirmation,
        },
      ],
      unresolvedGoals: [],
      requestedAction: input.requestedAction?.trim() || null,
      messageLength: input.message.trim().length,
      workspaceReceived: Boolean(input.workspace),
      workspaceEntity: getWorkspaceEntity(input.workspace ?? null),
      workspaceEntityId: getWorkspaceEntityId(input.workspace ?? null),
      contextOrigin: input.capabilityPlan.contextOrigin,
      resolutionMs,
    },
  }
}

export function planCosExecution(input: {
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
  surface?: CosCapabilitySurface
  workspace?: CosWorkspaceContext | null
}): CosExecutionPlan {
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
  if (!matchedRecipe) {
    return buildSingleExecutionPlan({
      capabilityPlan: primaryCapabilityPlan,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingContext,
      surface,
      workspace,
      startedAt,
    })
  }

  const planId = randomUUID()
  const reason = matchedRecipe.reason({ normalizedMessage, workspace })
  const steps = matchedRecipe.stepIds.map((capabilityId, order) =>
    createStepPlanForCapability({
      capabilityId,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingContext,
      surface,
      workspace,
      planId,
      order,
      reason,
    }),
  )
  const unresolvedGoals = buildUnresolvedGoals(matchedRecipe, { normalizedMessage, workspace })

  if (steps.length <= 1 && unresolvedGoals.length === 0) {
    return buildSingleExecutionPlan({
      capabilityPlan: primaryCapabilityPlan,
      message: input.message,
      requestedAction: input.requestedAction,
      pendingContext,
      surface,
      workspace,
      startedAt,
    })
  }

  const requiresConfirmation = steps.some((step) => step.plan.capability.requiresConfirmation)
  const resolutionMs = Date.now() - startedAt
  const contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy" =
    getWorkspaceEntity(workspace)
      ? "workspace"
      : pendingContext
        ? "pending_context"
        : "catalog"

  const plan: CosExecutionPlan = {
    id: planId,
    source: "recipe",
    reason,
    status: requiresConfirmation ? "needs_confirmation" : "pending",
    message: input.message,
    requestedAction: input.requestedAction,
    surface,
    workspace,
    pendingContext,
    primaryStep: steps[0],
    steps,
    unresolvedGoals,
    requiresConfirmation,
    confirmationMessage: requiresConfirmation ? buildConfirmationMessage(steps) : null,
    telemetry: {
      planId,
      source: "recipe",
      reason,
      surface,
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
      unresolvedGoals,
      requestedAction: input.requestedAction?.trim() || null,
      messageLength: input.message.trim().length,
      workspaceReceived: Boolean(workspace),
      workspaceEntity: getWorkspaceEntity(workspace),
      workspaceEntityId: getWorkspaceEntityId(workspace),
      contextOrigin,
      resolutionMs,
    },
  }

  console.info("[cos][execution-plan]", {
    planId: plan.id,
    source: plan.source,
    stepCount: plan.steps.length,
    capabilities: plan.steps.map((step) => step.capabilityId),
    unresolvedGoals: plan.unresolvedGoals.map((gap) => gap.id),
    requiresConfirmation: plan.requiresConfirmation,
    surface,
    workspaceEntity: plan.telemetry.workspaceEntity,
    workspaceEntityId: plan.telemetry.workspaceEntityId,
    resolutionMs,
    reason,
  })

  return plan
}
