import { executeLegacyCosAction } from "@/lib/cos/legacy-adapter"

import type { CosActionResult, CosCapabilityPlan, CosExecutionPlan, CosExecutionPlanResult, CosExecutionStep } from "@/lib/cos/types"

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

  return (await executeLegacyCosAction({
    brokerId: input.brokerId,
    userId: input.userId,
    message: input.message,
    action: input.plan.action,
    confirm: input.confirm,
    payload: mergedPayload,
  })) as CosActionResult
}

function isAwaitingInputResult(result: CosActionResult) {
  const required = Array.isArray(result.metadata?.required) ? result.metadata.required : []
  if (required.length > 0) return true

  return (
    result.response.includes("preciso de confirmacao") ||
    result.response.includes("confirmacao") ||
    result.response.includes("Qual ") ||
    result.response.includes("Pode confirmar")
  )
}

function buildExecutionMetadata(input: {
  plan: CosExecutionPlan
  steps: CosExecutionStep[]
  interruptedStep: CosExecutionStep | null
  interruptedReason: string | null
  totalDurationMs: number
}) {
  return {
    planId: input.plan.id,
    source: input.plan.source,
    reason: input.plan.reason,
    totalDurationMs: input.totalDurationMs,
    interruptedStepId: input.interruptedStep?.id ?? null,
    interruptedCapabilityId: input.interruptedStep?.capabilityId ?? null,
    interruptedReason: input.interruptedReason,
    unresolvedGoals: input.plan.unresolvedGoals,
    steps: input.steps.map((step) => ({
      id: step.id,
      order: step.order,
      capabilityId: step.capabilityId,
      action: step.action,
      entity: step.entity,
      status: step.status,
      dependsOn: step.dependsOn,
      durationMs: step.durationMs,
      errorMessage: step.errorMessage,
      metadata: step.result?.metadata ?? {},
    })),
  }
}

export async function executeCosExecutionPlan(input: {
  plan: CosExecutionPlan
  brokerId: string
  userId: string
  message: string
  confirm?: boolean
  payload?: Record<string, unknown>
  startStepIndex?: number
  existingSteps?: CosExecutionStep[]
}): Promise<CosExecutionPlanResult> {
  const startedAt = Date.now()
  const steps: CosExecutionStep[] = (input.existingSteps ?? input.plan.steps).map((step) => ({
    ...step,
    dependsOn: [...step.dependsOn],
  }))
  const startStepIndex = Math.max(0, input.startStepIndex ?? 0)
  let interruptedStep: CosExecutionStep | null = null
  let interruptedReason: string | null = null
  let lastLeadId: string | undefined
  let lastPropertyId: string | undefined
  let lastDocumentId: string | undefined
  const runtimePayload: Record<string, unknown> = {
    ...(input.payload ?? {}),
  }
  const executedSteps: CosExecutionStep[] = []

  for (let index = startStepIndex; index < steps.length; index += 1) {
    const step = steps[index]
    if (step.status === "completed") {
      lastLeadId = step.result?.leadId ?? lastLeadId
      lastPropertyId = step.result?.propertyId ?? lastPropertyId
      continue
    }

    step.status = "running"
    const stepStartedAt = Date.now()

    try {
      const result = await executeCosCapability({
        plan: step.plan,
        brokerId: input.brokerId,
        userId: input.userId,
        message: input.message,
        confirm: input.confirm,
        payload: runtimePayload,
      })

      step.durationMs = Date.now() - stepStartedAt
      step.result = result
      step.errorMessage = null
      lastLeadId = result.leadId ?? lastLeadId
      lastPropertyId = result.propertyId ?? lastPropertyId
      lastDocumentId =
        (typeof result.metadata?.documentId === "string" ? result.metadata.documentId : undefined) ??
        lastDocumentId
      if (lastLeadId) runtimePayload.leadId = lastLeadId
      if (lastPropertyId) runtimePayload.propertyId = lastPropertyId
      if (lastDocumentId) runtimePayload.documentId = lastDocumentId
      if (result.metadata && typeof result.metadata === "object") {
        runtimePayload.lastStepMetadata = result.metadata
      }

      if (isAwaitingInputResult(result)) {
        step.status = "awaiting_input"
        interruptedStep = step
        interruptedReason = "awaiting_input"
        executedSteps.push(step)
        break
      }

      step.status = "completed"
      executedSteps.push(step)
    } catch (caughtError) {
      step.durationMs = Date.now() - stepStartedAt
      step.status = "failed"
      step.errorMessage = caughtError instanceof Error ? caughtError.message : "Erro interno na etapa."
      interruptedStep = step
      interruptedReason = "failed"
      executedSteps.push(step)
      break
    }
  }

  const finalStatus =
    interruptedReason === "failed"
      ? "failed"
      : interruptedReason === "awaiting_input"
        ? "awaiting_input"
        : "completed"
  const completedSteps = steps.filter((step) => step.status === "completed")
  const totalDurationMs = Date.now() - startedAt

  console.info("[cos][execution-run]", {
    planId: input.plan.id,
    status: finalStatus,
    stepCount: steps.length,
    completedSteps: completedSteps.length,
    interruptedStepId: interruptedStep?.id ?? null,
    interruptedCapabilityId: interruptedStep?.capabilityId ?? null,
    interruptedReason,
    totalDurationMs,
  })

  return {
    planId: input.plan.id,
    status: finalStatus,
    primaryAction: input.plan.primaryStep.action,
    primaryCapabilityId: input.plan.primaryStep.capabilityId,
    steps,
    completedSteps,
    executedSteps,
    interruptedStep,
    interruptedReason,
    unresolvedGoals: input.plan.unresolvedGoals,
    metadata: buildExecutionMetadata({
      plan: input.plan,
      steps,
      interruptedStep,
      interruptedReason,
      totalDurationMs,
    }),
    leadId: lastLeadId,
    propertyId: lastPropertyId,
    totalDurationMs,
  }
}
