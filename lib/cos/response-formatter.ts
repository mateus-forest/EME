import type { CosCapabilityDefinition, CosExecutionPlan, CosExecutionPlanResult } from "@/lib/cos/types"
import { buildCosExecutionResponseViewModel } from "@/lib/cos/response-view-model"

export async function formatCosCapabilityResponse(input: {
  message: string
  action: string
  capability: CosCapabilityDefinition
  actionResponse: string
}) {
  return input.actionResponse
}

export async function formatCosExecutionPlanResponse(input: {
  message: string
  plan: CosExecutionPlan
  result: CosExecutionPlanResult
}) {
  return buildCosExecutionResponseViewModel(input).text
}
