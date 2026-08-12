import { doesCosCapabilityMutateData } from "@/lib/cos/capability-catalog"
import { normalizeWorkflowStatus } from "@/lib/cos/pending-input"
import type { CosWorkflow, CosWorkflowStatus } from "@/lib/cos/types"

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function resumeWorkflowState(workflow: CosWorkflow) {
  if (workflow.status === "failed") {
    return {
      ...workflow,
      status: "processing" as CosWorkflowStatus,
      steps: workflow.steps.map((step, index) =>
        index === workflow.currentStep && step.status === "failed"
          ? { ...step, status: "pending" as const, errorMessage: null, durationMs: null }
          : step,
      ),
      completedAt: null,
      updatedAt: new Date().toISOString(),
    }
  }

  if (!workflow.pausedAt) return workflow
  const pausedMs = Date.now() - new Date(workflow.pausedAt).getTime()
  return {
    ...workflow,
    status: "processing" as CosWorkflowStatus,
    pausedAt: null,
    totalPausedMs: workflow.totalPausedMs + Math.max(0, pausedMs),
    updatedAt: new Date().toISOString(),
  }
}

export function shouldResumeWorkflow(workflow: CosWorkflow | null, message?: string) {
  if (!workflow) return false
  const status = normalizeWorkflowStatus(workflow.status)

  if (status === "failed") {
    const failedStep = workflow.steps[workflow.currentStep]
    const explicitRetry = /^(tentar novamente|tente novamente|repetir|repita|retry)$/i.test(normalizeText(message ?? ""))
    return Boolean(explicitRetry && failedStep && !doesCosCapabilityMutateData(failedStep.action))
  }

  return status === "awaiting_input" || status === "paused" || status === "processing"
}
