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
  if (input.result.steps.length === 1) {
    const step = input.result.steps[0]
    return formatCosCapabilityResponse({
      message: input.message,
      action: step.action,
      capability: step.plan.capability,
      actionResponse: step.result?.response ?? "",
    })
  }

  if (input.result.status === "awaiting_input" && input.result.interruptedStep?.result) {
    const remainingCount = input.result.steps.filter((step) => step.status === "pending").length
    return remainingCount > 0
      ? `${input.result.interruptedStep.result.response}\n\nAssim que voce responder, continuo com as proximas ${remainingCount} etapa(s) do plano.`
      : input.result.interruptedStep.result.response
  }

  if (input.result.status === "failed") {
    const completed = input.result.completedSteps.length
    const completedSummary =
      completed > 0
        ? `Conclui ${completed} etapa(s) antes da interrupcao.\n\n`
        : ""
    return `${completedSummary}A execucao foi interrompida em "${input.result.interruptedStep?.plan.capability.title ?? "etapa do plano"}".`
  }

  const stepBlocks = input.result.completedSteps
    .map((step, index) => {
      const response = step.result?.response?.trim() || "Etapa concluida."
      return `${index + 1}. ${step.plan.capability.title}\n${response}`
    })
    .join("\n\n")

  const unresolved =
    input.result.unresolvedGoals.length > 0
      ? `\n\nPendencias fora do Registry atual:\n${input.result.unresolvedGoals.map((goal) => `- ${goal.title}`).join("\n")}`
      : ""

  return `Plano executado em ${input.result.completedSteps.length} etapa(s).\n\n${stepBlocks}${unresolved}`
}
