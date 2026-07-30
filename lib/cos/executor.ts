import { runLegacyAssessorAction } from "@/lib/eme-backend"

import type { CosActionResult, CosCapabilityPlan } from "@/lib/cos/types"

export async function executeCosCapability(input: {
  plan: CosCapabilityPlan
  brokerId: string
  userId: string
  message: string
  confirm?: boolean
  payload?: Record<string, unknown>
}): Promise<CosActionResult> {
  const mergedPayload = {
    ...(input.payload ?? {}),
    ...input.plan.payload,
  }

  if (input.plan.capability.handler) {
    return input.plan.capability.handler({
      brokerId: input.brokerId,
      userId: input.userId,
      message: input.message,
      action: input.plan.action,
      confirm: input.confirm,
      payload: mergedPayload,
      pendingContext: input.plan.pendingContext ?? undefined,
    })
  }

  return (await runLegacyAssessorAction({
    brokerId: input.brokerId,
    userId: input.userId,
    message: input.message,
    action: input.plan.action,
    confirm: input.confirm,
    payload: mergedPayload,
  })) as CosActionResult
}
