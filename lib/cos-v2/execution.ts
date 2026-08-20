import "server-only"

import { randomUUID } from "crypto"

import { getCosCapabilityByAction } from "@/lib/cos/capability-registry"
import {
  doesCosCapabilityRequireConfirmation,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityDescriptorById,
  getCosEntityModuleIdByCapabilityId,
} from "@/lib/cos/capability-catalog"
import type {
  CosCapabilityId,
  CosExecutionPlan,
  CosExecutionStep,
  CosNormalizedContext,
  CosPendingInput,
  CosWorkspaceContext,
} from "@/lib/cos/types"

export function buildCosV2ExecutionPlan(input: {
  message: string
  capabilityIds: CosCapabilityId[]
  payload: Record<string, unknown>
  context: CosNormalizedContext
  pendingInput?: CosPendingInput | null
  surface: "portal" | "cos_home"
  workspace: CosWorkspaceContext | null
  confidence: number
  reason: string
}): CosExecutionPlan {
  if (input.capabilityIds.length === 0) throw new Error("COS_V2_EXECUTION_WITHOUT_CAPABILITY")
  const planId = randomUUID()
  const startedAt = Date.now()
  const steps: CosExecutionStep[] = input.capabilityIds.map((capabilityId, order) => {
    const descriptor = getCosCapabilityDescriptorById(capabilityId)
    if (!descriptor) throw new Error(`COS_V2_CAPABILITY_NOT_FOUND:${capabilityId}`)
    const capability = getCosCapabilityByAction(descriptor.action)
    const entity = getCosEntityModuleIdByCapabilityId(capabilityId) ?? "general"
    const stepId = `${planId}:step:${order + 1}`
    const contextOrigin = input.workspace ? "workspace" as const : input.pendingInput ? "pending_input" as const : "catalog" as const
    const telemetry = {
      capabilityId,
      entity,
      confidence: input.confidence,
      source: "ai" as const,
      reason: `${input.reason} [COS V2, etapa ${order + 1}]`,
      fallbackUsed: false,
      pendingInputUsed: Boolean(input.pendingInput),
      surface: input.surface,
      resolutionMs: 0,
      requestedAction: descriptor.action,
      contextOrigin,
      workspaceReceived: Boolean(input.workspace),
      workspacePage: input.workspace?.page ?? null,
      workspaceEntity: input.workspace?.entity ?? null,
      workspaceEntityId: input.workspace?.entityId ?? null,
      workspaceEntityUsed: input.workspace?.entity ?? null,
      workspaceEntityIdUsed: input.workspace?.entityId ?? null,
    }
    const stepPlan = {
      action: descriptor.action,
      payload: input.payload,
      pendingInput: input.pendingInput ?? null,
      context: input.context,
      workspace: input.workspace,
      capability,
      capabilityId,
      entity,
      confidence: input.confidence,
      source: "ai" as const,
      reason: telemetry.reason,
      contextOrigin,
      telemetry,
    }
    return {
      id: stepId,
      order,
      entity,
      capabilityId,
      action: descriptor.action,
      status: "pending" as const,
      dependsOn: order === 0 ? [] : [`${planId}:step:${order}`],
      durationMs: null,
      result: null,
      errorMessage: null,
      plan: stepPlan,
    }
  })
  const confirmationSteps = steps.filter((step) => doesCosCapabilityRequireConfirmation(step.capabilityId))
  const confirmationMessage = confirmationSteps.length === 0
    ? null
    : confirmationSteps.length === 1
      ? getCosCapabilityConfirmationMessage(confirmationSteps[0].action)
      : `Antes de continuar, confirme: ${confirmationSteps.map((step) => step.plan.capability.title.toLowerCase()).join(" e ")}.`
  const requiresConfirmation = confirmationSteps.length > 0
  const source = steps.length > 1 ? "ai" as const : "single" as const

  return {
    id: planId,
    source,
    reason: input.reason,
    status: requiresConfirmation ? "needs_confirmation" : "pending",
    message: input.message,
    requestedAction: steps[0].action,
    surface: input.surface,
    workspace: input.workspace,
    pendingInput: input.pendingInput ?? null,
    context: input.context,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation,
    confirmationMessage,
    telemetry: {
      planId,
      source,
      planner: "ai",
      reason: `${input.reason} [runtime=v2]`,
      surface: input.surface,
      stepCount: steps.length,
      steps: steps.map((step) => ({
        id: step.id,
        capabilityId: step.capabilityId,
        action: step.action,
        entity: step.entity,
        source: "ai",
        mutatesData: step.plan.capability.mutatesData,
        requiresConfirmation: step.plan.capability.requiresConfirmation,
      })),
      unresolvedGoals: [],
      requestedAction: steps[0].action,
      messageLength: input.message.length,
      workspaceReceived: Boolean(input.workspace),
      workspaceEntity: input.workspace?.entity ?? null,
      workspaceEntityId: input.workspace?.entityId ?? null,
      contextOrigin: input.workspace ? "workspace" : input.pendingInput ? "pending_input" : "catalog",
      resolutionMs: Date.now() - startedAt,
      orchestrator: null,
    },
  }
}
