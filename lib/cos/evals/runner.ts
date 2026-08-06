import { createCosNormalizedContext } from "../context"
import { createEvalScenarioRuntime } from "./helpers"
import { cosEvalScenarios } from "./scenarios"
import type { CosEvalExecutionPlan, CosEvalScenario, CosEvalScenarioResult } from "./types"
import { resolveFastCosAction } from "../fast-action-resolver"
import { resolveCosIntent } from "../intent-resolver"
import { getCosCapabilityDescriptorByAction, getCosEntityModuleIdByCapabilityId } from "../capability-catalog"
import type { AssessorAction } from "../../eme-backend"
import type { CosEntityModuleId } from "../types"

function getRequestedActionFromFastAction(fastAction: ReturnType<typeof resolveFastCosAction>) {
  return fastAction.kind === "workflow_action" || fastAction.kind === "workflow_details"
    ? fastAction.action
    : null
}

function hasSelectedEntityFor(actionEntity: CosEntityModuleId, context: ReturnType<typeof createCosNormalizedContext>) {
  const selectedEntityIds = context.selectedEntityIds

  if (actionEntity === "proposal" || actionEntity === "contract") {
    return Boolean(
      selectedEntityIds.property ||
      selectedEntityIds.lead ||
      selectedEntityIds.contract ||
      context.workspace?.entity === "property" ||
      context.workspace?.entity === "lead" ||
      context.workspace?.entity === "contract",
    )
  }

  if (actionEntity === "studio_ia") {
    return Boolean(
      selectedEntityIds.property ||
      selectedEntityIds.lead ||
      context.workspace?.entity === "studio_ia" ||
      context.workspace?.entity === "property" ||
      context.workspace?.entity === "lead",
    )
  }

  if (actionEntity === "agenda") {
    return Boolean(selectedEntityIds.agenda || context.workspace?.entity === "agenda" || context.workspace?.entity === "operation")
  }

  if (actionEntity === "property") {
    return Boolean(selectedEntityIds.property || context.workspace?.entity === "property")
  }

  if (actionEntity === "lead") {
    return Boolean(selectedEntityIds.lead || context.workspace?.entity === "lead")
  }

  return Boolean(selectedEntityIds[actionEntity])
}

function estimateProjectedQuestions(input: {
  fastAction: ReturnType<typeof resolveFastCosAction>
  executionPlan: CosEvalExecutionPlan | null
  context: ReturnType<typeof createCosNormalizedContext>
}) {
  if (input.fastAction.kind === "clarify") return 1
  if (!input.executionPlan) return 0

  let questions = 0
  if (input.executionPlan.requiresConfirmation) questions += 1

  const primaryEntity = input.executionPlan.primaryStep.entity
  const requiresSelection = input.executionPlan.primaryStep.plan.requiresSelection
  if (requiresSelection && !hasSelectedEntityFor(primaryEntity, input.context)) {
    questions += 1
  }

  return questions
}

function compareWorkflowActions(actual: AssessorAction[], expected: AssessorAction[]) {
  if (actual.length !== expected.length) return false
  return actual.every((action, index) => action === expected[index])
}

function getDescriptorContextOrigin(action: AssessorAction | null, context: ReturnType<typeof createCosNormalizedContext>) {
  if (!action) return null

  const descriptor = getCosCapabilityDescriptorByAction(action)
  const entity = getCosEntityModuleIdByCapabilityId(descriptor.id)
  if (!entity) return "catalog" as const

  if (entity === "proposal" || entity === "contract") {
    if (context.selectedEntityIds.property || context.selectedEntityIds.lead || context.selectedEntityIds.contract) {
      return "workspace" as const
    }
    return "catalog" as const
  }

  return context.selectedEntityIds[entity] ? "workspace" as const : "catalog" as const
}

function buildEvalExecutionPlan(action: AssessorAction | null, context: ReturnType<typeof createCosNormalizedContext>) {
  if (!action) return null

  const descriptor = getCosCapabilityDescriptorByAction(action)
  const entity = getCosEntityModuleIdByCapabilityId(descriptor.id) ?? "general"
  const contextOrigin = getDescriptorContextOrigin(action, context)
  const requiresConfirmation =
    descriptor.requiresConfirmation ||
    action === "DELETE_LEAD"

  return {
    steps: [
      {
        action,
        entity,
      },
    ],
    requiresConfirmation,
    primaryStep: {
      entity,
      plan: {
        contextOrigin,
        capabilityId: descriptor.id,
        requiresSelection: descriptor.requiresSelection,
      },
    },
  } satisfies CosEvalExecutionPlan
}

function buildFailures(input: {
  scenario: CosEvalScenario
  fastAction: ReturnType<typeof resolveFastCosAction>
  intentAction: AssessorAction | null
  workflowDecision: string
  capabilityId: string | null
  executionPlan: CosEvalExecutionPlan | null
  effectiveConfidence: number
  projectedQuestions: number
}) {
  const failures: string[] = []
  const expected = input.scenario.expected

  if (expected.fastActionKind && input.fastAction.kind !== expected.fastActionKind) {
    failures.push(`fastAction esperado=${expected.fastActionKind} atual=${input.fastAction.kind}`)
  }

  if (expected.navigationHref && input.fastAction.kind === "navigation" && input.fastAction.href !== expected.navigationHref) {
    failures.push(`navigation href esperada=${expected.navigationHref} atual=${input.fastAction.href}`)
  }

  const effectiveIntentAction =
    input.fastAction.kind === "workflow_details"
      ? "workflow_details"
      : input.intentAction

  if (Object.prototype.hasOwnProperty.call(expected, "intentAction") && effectiveIntentAction !== expected.intentAction) {
    failures.push(`intentAction esperada=${expected.intentAction} atual=${input.intentAction}`)
  }

  if (expected.workflowDecision && input.workflowDecision !== expected.workflowDecision) {
    failures.push(`workflowDecision esperado=${expected.workflowDecision} atual=${input.workflowDecision}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, "capabilityId") && input.capabilityId !== expected.capabilityId) {
    failures.push(`capability esperada=${expected.capabilityId} atual=${input.capabilityId}`)
  }

  if (expected.workflowActions) {
    const actualWorkflowActions = input.executionPlan?.steps.map((step) => step.action) ?? []
    if (!compareWorkflowActions(actualWorkflowActions, expected.workflowActions)) {
      failures.push(`workflow esperado=${expected.workflowActions.join(" > ")} atual=${actualWorkflowActions.join(" > ") || "none"}`)
    }
  }

  if (typeof expected.minConfidence === "number" && input.effectiveConfidence < expected.minConfidence) {
    failures.push(`confidence minima=${expected.minConfidence} atual=${input.effectiveConfidence}`)
  }

  if (typeof expected.requiresConfirmation === "boolean") {
    const actualRequiresConfirmation = input.executionPlan?.requiresConfirmation ?? false
    if (actualRequiresConfirmation !== expected.requiresConfirmation) {
      failures.push(`confirmacao esperada=${expected.requiresConfirmation} atual=${actualRequiresConfirmation}`)
    }
  }

  if (typeof expected.maxProjectedQuestions === "number" && input.projectedQuestions > expected.maxProjectedQuestions) {
    failures.push(`perguntas projetadas max=${expected.maxProjectedQuestions} atual=${input.projectedQuestions}`)
  }

  if (Object.prototype.hasOwnProperty.call(expected, "contextOrigin")) {
    const actualContextOrigin = input.executionPlan?.primaryStep.plan.contextOrigin ?? null
    if (actualContextOrigin !== expected.contextOrigin) {
      failures.push(`contextOrigin esperado=${expected.contextOrigin} atual=${actualContextOrigin}`)
    }
  }

  return failures
}

export async function runCosEvalScenario(scenario: CosEvalScenario): Promise<CosEvalScenarioResult> {
  const startedAt = Date.now()
  const runtime = createEvalScenarioRuntime(scenario)
  const context = createCosNormalizedContext({
    ...runtime.normalizedContext,
    message: scenario.message,
  })

  const fastAction = resolveFastCosAction({
    message: scenario.message,
    workspace: runtime.workspace,
    context,
  })
  const requestedAction = getRequestedActionFromFastAction(fastAction)
  const intentResolution = resolveCosIntent({
    message: scenario.message,
    requestedAction,
    attachments: runtime.attachments,
    workspace: runtime.workspace,
    activeWorkflow: runtime.activeWorkflow,
    memory: runtime.memory,
    context,
  })

  const resolvedAction =
    fastAction.kind === "workflow_action"
      ? fastAction.action
      : fastAction.kind === "workflow_details"
        ? null
        : intentResolution.requestedAction

  const executionPlan =
    fastAction.kind === "navigation" || fastAction.kind === "clarify"
      ? null
      : buildEvalExecutionPlan(resolvedAction, context)

  const capabilityId = executionPlan?.primaryStep.plan.capabilityId ?? null

  const effectiveConfidence = fastAction.kind !== "none" ? fastAction.confidence : intentResolution.confidence
  const projectedQuestions = estimateProjectedQuestions({
    fastAction,
    executionPlan,
    context,
  })
  const failures = buildFailures({
    scenario,
    fastAction,
    intentAction: intentResolution.requestedAction,
    workflowDecision: intentResolution.workflowDecision,
    capabilityId,
    executionPlan,
    effectiveConfidence,
    projectedQuestions,
  })

  return {
    scenario,
    durationMs: Date.now() - startedAt,
    success: failures.length === 0,
    failures,
    projectedQuestions,
    fastAction,
    intentResolution,
    capabilityId,
    executionPlan,
  }
}

export async function runCosEvalSuite() {
  const results: CosEvalScenarioResult[] = []
  for (const scenario of cosEvalScenarios) {
    results.push(await runCosEvalScenario(scenario))
  }

  const total = results.length
  const passed = results.filter((result) => result.success).length
  const failed = total - passed
  const capabilityEvaluated = results.filter((result) => result.scenario.expected.capabilityId !== undefined)
  const workflowEvaluated = results.filter((result) => result.scenario.expected.workflowActions)
  const intentEvaluated = results.filter((result) => Object.prototype.hasOwnProperty.call(result.scenario.expected, "intentAction"))
  const entityEvaluated = results.filter((result) => Object.prototype.hasOwnProperty.call(result.scenario.expected, "contextOrigin"))
  const ambiguities = results.filter((result) => {
    const securityClarification =
      result.fastAction.kind === "clarify" &&
      typeof result.fastAction.reason === "string" &&
      result.fastAction.reason.startsWith("security_guard:")
    const securityLowConfidence =
      typeof result.intentResolution.reason === "string" &&
      result.intentResolution.reason.startsWith("security_guard:")

    if (securityClarification || securityLowConfidence) {
      return false
    }

    return (result.fastAction.kind === "clarify" && result.fastAction.confidence < 0.7) || result.intentResolution.confidence < 0.6
  })
  const confirmations = results.filter((result) => result.executionPlan?.requiresConfirmation)
  const autonomousExecutions = results.filter((result) => {
    if (result.fastAction.kind === "navigation") return true
    if (result.fastAction.kind === "workflow_action") {
      return !(result.executionPlan?.requiresConfirmation ?? false)
    }
    return Boolean(result.executionPlan && !result.executionPlan.requiresConfirmation && result.projectedQuestions === 0)
  })

  const successRate = total === 0 ? 100 : Number(((passed / total) * 100).toFixed(2))
  const intentAccuracy = intentEvaluated.length === 0 ? 100 : Number(((intentEvaluated.filter((result) => result.failures.every((failure) => !failure.startsWith("intentAction"))).length / intentEvaluated.length) * 100).toFixed(2))
  const workflowAccuracy = workflowEvaluated.length === 0 ? 100 : Number(((workflowEvaluated.filter((result) => result.failures.every((failure) => !failure.startsWith("workflow esperado"))).length / workflowEvaluated.length) * 100).toFixed(2))
  const capabilityAccuracy = capabilityEvaluated.length === 0 ? 100 : Number(((capabilityEvaluated.filter((result) => result.failures.every((failure) => !failure.startsWith("capability esperada"))).length / capabilityEvaluated.length) * 100).toFixed(2))
  const entityResolutionAccuracy = entityEvaluated.length === 0 ? 100 : Number(((entityEvaluated.filter((result) => result.failures.every((failure) => !failure.startsWith("contextOrigin esperado"))).length / entityEvaluated.length) * 100).toFixed(2))
  const avgDurationMs = total === 0 ? 0 : Number((results.reduce((sum, result) => sum + result.durationMs, 0) / total).toFixed(2))
  const avgProjectedQuestions = total === 0 ? 0 : Number((results.reduce((sum, result) => sum + result.projectedQuestions, 0) / total).toFixed(2))
  const categoryBreakdown = Array.from(
    results.reduce<Map<string, { total: number; passed: number }>>((acc, result) => {
      const current = acc.get(result.scenario.category) ?? { total: 0, passed: 0 }
      current.total += 1
      current.passed += result.success ? 1 : 0
      acc.set(result.scenario.category, current)
      return acc
    }, new Map()),
  )
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      passed: stats.passed,
      successRate: Number(((stats.passed / stats.total) * 100).toFixed(2)),
    }))

  const topFailures = results
    .filter((result) => !result.success)
    .slice(0, 25)
    .map((result) => ({
      id: result.scenario.id,
      category: result.scenario.category,
      description: result.scenario.description,
      failures: result.failures,
      message: result.scenario.message,
    }))

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      scenarios: total,
      passed,
      failed,
      successRate,
    },
    metrics: {
      intentAccuracy,
      workflowAccuracy,
      capabilityAccuracy,
      entityResolutionAccuracy,
      averageDurationMs: avgDurationMs,
      averageQuestionsPerOperation: avgProjectedQuestions,
      autonomousExecutionsRate: total === 0 ? 100 : Number(((autonomousExecutions.length / total) * 100).toFixed(2)),
      confirmationsRate: total === 0 ? 0 : Number(((confirmations.length / total) * 100).toFixed(2)),
      ambiguitiesRate: total === 0 ? 0 : Number(((ambiguities.length / total) * 100).toFixed(2)),
    },
    categoryBreakdown,
    topFailures,
    results,
  }
}

export function buildCosEvalMarkdownReport(report: Awaited<ReturnType<typeof runCosEvalSuite>>) {
  const lines = [
    "# COS Eval Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Total scenarios: ${report.totals.scenarios}`,
    `- Passed: ${report.totals.passed}`,
    `- Failed: ${report.totals.failed}`,
    `- Success rate: ${report.totals.successRate}%`,
    "",
    "## Metrics",
    "",
    `- Intent Accuracy: ${report.metrics.intentAccuracy}%`,
    `- Workflow Accuracy: ${report.metrics.workflowAccuracy}%`,
    `- Capability Accuracy: ${report.metrics.capabilityAccuracy}%`,
    `- Entity Resolution Accuracy: ${report.metrics.entityResolutionAccuracy}%`,
    `- Average Duration: ${report.metrics.averageDurationMs} ms`,
    `- Average Questions per Operation: ${report.metrics.averageQuestionsPerOperation}`,
    `- Autonomous Executions: ${report.metrics.autonomousExecutionsRate}%`,
    `- Confirmations: ${report.metrics.confirmationsRate}%`,
    `- Ambiguities: ${report.metrics.ambiguitiesRate}%`,
    "",
    "## Category Breakdown",
    "",
    ...report.categoryBreakdown.map((item) => `- ${item.category}: ${item.passed}/${item.total} (${item.successRate}%)`),
    "",
    "## Top Failures",
    "",
    ...(report.topFailures.length
      ? report.topFailures.flatMap((failure) => [
          `- ${failure.id} (${failure.category})`,
          `  Message: ${failure.message}`,
          ...failure.failures.map((item) => `  - ${item}`),
        ])
      : ["- None"]),
    "",
  ]

  return lines.join("\n")
}

export async function runDefaultCosEvalSuite() {
  return runCosEvalSuite()
}
