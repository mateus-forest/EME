import { generateAssessorText, type AssessorAction } from "@/lib/eme-backend"

import type { CosCapabilityDefinition, CosExecutionPlan, CosExecutionPlanResult } from "@/lib/cos/types"

export async function formatCosCapabilityResponse(input: {
  message: string
  action: AssessorAction
  capability: CosCapabilityDefinition
  actionResponse: string
}) {
  if (input.capability.responseMode === "raw") {
    return input.actionResponse
  }

  return generateAssessorText(input.message, input.action, input.actionResponse)
}

export async function formatCosExecutionPlanResponse(input: {
  message: string
  plan: CosExecutionPlan
  result: CosExecutionPlanResult
}) {
  if (input.result.status === "awaiting_input" && input.result.interruptedStep?.result) {
    return input.result.interruptedStep.result.response
  }

  if (input.result.status === "failed") {
    return (
      input.result.interruptedStep?.result?.response?.trim() ||
      "NÃ£o consegui concluir isso agora. Pode me pedir novamente de outra forma?"
    )
  }

  const executedSteps = input.result.executedSteps.filter((step) => Boolean(step.result?.response?.trim()))

  if (input.result.steps.length === 1) {
    const step = input.result.steps[0]
    return formatCosCapabilityResponse({
      message: input.message,
      action: step.action,
      capability: step.plan.capability,
      actionResponse: step.result?.response ?? "",
    })
  }

  if (executedSteps.length === 1) {
    const step = executedSteps[0]
    return formatCosCapabilityResponse({
      message: input.message,
      action: step.action,
      capability: step.plan.capability,
      actionResponse: step.result?.response ?? "",
    })
  }

  const stepResponses = executedSteps
    .map((step) => step.result?.response?.trim() || "")
    .filter(Boolean)

  if (stepResponses.length === 0) {
    return "ConcluÃ­do."
  }

  if (stepResponses.length === 1) {
    return stepResponses[0]
  }

  return summarizeExecutionResponse(stepResponses[stepResponses.length - 1] ?? "") || stepResponses[0]
}

function summarizeExecutionResponse(response: string) {
  return response
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
