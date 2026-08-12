import type { CosCapabilityDefinition, CosExecutionPlan, CosExecutionPlanResult } from "@/lib/cos/types"

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
  if (input.result.status === "awaiting_input" && input.result.interruptedStep?.result) {
    const completedLabels = input.result.completedSteps.map((step) => `✓ ${step.plan.capability.title}`)
    return completedLabels.length > 0
      ? [...completedLabels, "", input.result.interruptedStep.result.response].join("\n")
      : input.result.interruptedStep.result.response
  }

  if (input.result.status === "failed") {
    const failedStep = input.result.interruptedStep
    const completedLabels = input.result.completedSteps.map((step) => step.plan.capability.title)
    const lines = [
      `Não consegui concluir ${failedStep?.plan.capability.title.toLowerCase() ?? "a operação"} agora.`,
    ]
    if (completedLabels.length > 0) {
      lines.push(`O que já foi concluído foi preservado: ${completedLabels.join(", ")}.`)
    }
    lines.push(
      failedStep && !failedStep.plan.capability.mutatesData
        ? 'Você pode responder "tentar novamente" para repetir somente esta etapa.'
        : "Confira o resultado anterior antes de iniciar uma nova tentativa.",
    )
    return lines.join("\n")
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
    return "Concluído."
  }

  if (stepResponses.length === 1) {
    return stepResponses[0]
  }

  const completedLabels = input.result.completedSteps.map((step) => `✓ ${step.plan.capability.title}`)
  const summary = summarizeExecutionResponse(stepResponses[stepResponses.length - 1] ?? "") || stepResponses[0]
  return [...completedLabels, "", summary].join("\n")
}

function summarizeExecutionResponse(response: string) {
  return response
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
