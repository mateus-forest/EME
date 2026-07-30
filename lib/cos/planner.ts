import { resolveAssessorInputWithContext, type PendingAssessorContext } from "@/lib/eme-backend"

import { getCosCapabilityByAction } from "@/lib/cos/capability-registry"
import type { CosCapabilityPlan } from "@/lib/cos/types"

export function planCosCapability(input: {
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
}): CosCapabilityPlan {
  const resolved = resolveAssessorInputWithContext({
    message: input.message,
    requestedAction: input.requestedAction,
    pendingContext: input.pendingContext,
  })

  return {
    action: resolved.action,
    payload: resolved.payload,
    pendingContext: input.pendingContext ?? null,
    capability: getCosCapabilityByAction(resolved.action),
  }
}
