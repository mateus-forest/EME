import { getCosCapabilityByAction } from "@/lib/cos/capability-registry"
import { getCosCapabilityDescriptorById, getCosEntityModuleIdByCapabilityId } from "@/lib/cos/capability-catalog"
import type {
  CosCapabilityId,
  CosCapabilityPlan,
  CosCapabilityPlanSource,
  CosCapabilitySurface,
  CosEntityModuleId,
  CosExecutionStep,
  CosNormalizedContext,
  CosPendingInput,
  CosWorkspaceContext,
} from "@/lib/cos/types"

function workspaceEntity(workspace: CosWorkspaceContext | null | undefined) {
  return workspace?.entity || workspace?.selection[0]?.entity || null
}

function workspaceEntityId(workspace: CosWorkspaceContext | null | undefined) {
  return workspace?.entityId || workspace?.selection[0]?.entityId || null
}

/**
 * Hidrata uma etapa já escolhida contra Registry + handler. Não classifica texto,
 * não escolhe capability e não planeja objetivos.
 */
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
  if (!descriptor) throw new Error(`Capability ${input.capabilityId} nao encontrada no catalogo do COS.`)

  const capability = getCosCapabilityByAction(descriptor.action)
  const entity = getCosEntityModuleIdByCapabilityId(capability.id) ?? ("general" as CosEntityModuleId)
  const workspaceEntityUsed = workspaceEntity(input.workspace)
  const workspaceEntityIdUsed = workspaceEntityId(input.workspace)
  const contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy" = workspaceEntityUsed
    ? "workspace"
    : input.pendingInput
      ? "pending_input"
      : input.source === "legacy"
        ? "legacy"
        : "catalog"
  const source = input.source ?? "catalog"
  const confidence = input.confidence ?? (source === "ai" ? 0.82 : 0.92)
  const telemetry = {
    capabilityId: capability.id,
    entity,
    confidence,
    source,
    reason: `${input.reason} [step ${input.order + 1}]`,
    fallbackUsed: source === "legacy",
    pendingInputUsed: Boolean(input.pendingInput),
    surface: input.surface,
    resolutionMs: 0,
    requestedAction: input.requestedAction?.trim() || null,
    contextOrigin,
    workspaceReceived: Boolean(input.workspace),
    workspacePage: input.workspace?.page ?? null,
    workspaceEntity: workspaceEntity(input.workspace),
    workspaceEntityId: workspaceEntityId(input.workspace),
    workspaceEntityUsed,
    workspaceEntityIdUsed,
  }
  const plan: CosCapabilityPlan = {
    action: descriptor.action,
    payload: {
      ...(input.workspace ? { workspace: input.workspace } : {}),
      ...(input.context ? { context: input.context } : {}),
    },
    pendingInput: input.pendingInput ?? null,
    context: input.context ?? null,
    workspace: input.workspace ?? null,
    capability,
    capabilityId: capability.id,
    entity,
    confidence,
    source,
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
