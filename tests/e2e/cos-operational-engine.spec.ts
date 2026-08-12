import { expect, test } from "@playwright/test"

import { executeCosExecutionPlan } from "@/lib/cos/executor"
import { formatCosExecutionPlanResponse } from "@/lib/cos/response-formatter"
import { resumeWorkflowState, shouldResumeWorkflow } from "@/lib/cos/workflow-recovery"
import type {
  CosActionResult,
  CosCapabilityDefinition,
  CosCapabilityHandler,
  CosCapabilityId,
  CosExecutionPlan,
  CosExecutionStep,
  CosWorkflow,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

function createCapability(input: {
  id: CosCapabilityId
  action: AssessorAction
  title: string
  mutatesData?: boolean
  handler: CosCapabilityHandler
}): CosCapabilityDefinition {
  return {
    id: input.id,
    action: input.action,
    title: input.title,
    description: input.title,
    domain: "general",
    entity: "conversation",
    aliases: [],
    responseMode: "raw",
    source: "modular",
    mutatesData: input.mutatesData ?? false,
    requiresConfirmation: false,
    requiresSelection: false,
    surfaces: ["portal", "cos_home"],
    handler: input.handler,
  }
}

function createStep(input: {
  planId: string
  order: number
  capability: CosCapabilityDefinition
  dependsOn?: string[]
}): CosExecutionStep {
  const id = `${input.planId}:step:${input.order + 1}`
  return {
    id,
    order: input.order,
    entity: "general",
    capabilityId: input.capability.id,
    action: input.capability.action,
    status: "pending",
    dependsOn: input.dependsOn ?? (input.order === 0 ? [] : [`${input.planId}:step:${input.order}`]),
    durationMs: null,
    result: null,
    errorMessage: null,
    plan: {
      action: input.capability.action,
      payload: {},
      pendingInput: null,
      context: null,
      workspace: null,
      capability: input.capability,
      capabilityId: input.capability.id,
      entity: "general",
      confidence: 1,
      source: "catalog",
      reason: "teste operacional",
      contextOrigin: "catalog",
      telemetry: {
        capabilityId: input.capability.id,
        entity: "general",
        confidence: 1,
        source: "catalog",
        reason: "teste operacional",
        fallbackUsed: false,
        pendingInputUsed: false,
        surface: "portal",
        resolutionMs: 0,
        requestedAction: input.capability.action,
        contextOrigin: "catalog",
        workspaceReceived: false,
        workspacePage: null,
        workspaceEntity: null,
        workspaceEntityId: null,
        workspaceEntityUsed: null,
        workspaceEntityIdUsed: null,
      },
    },
  }
}

function createPlan(steps: CosExecutionStep[]): CosExecutionPlan {
  const planId = steps[0].id.split(":step:")[0]
  return {
    id: planId,
    source: steps.length > 1 ? "recipe" : "single",
    reason: "teste operacional",
    status: "pending",
    message: "teste",
    surface: "portal",
    workspace: null,
    pendingInput: null,
    context: null,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation: false,
    confirmationMessage: null,
    telemetry: {
      planId,
      source: steps.length > 1 ? "recipe" : "single",
      planner: "deterministic",
      reason: "teste operacional",
      surface: "portal",
      stepCount: steps.length,
      steps: steps.map((step) => ({
        id: step.id,
        capabilityId: step.capabilityId,
        action: step.action,
        entity: step.entity,
        source: "catalog",
        mutatesData: step.plan.capability.mutatesData,
        requiresConfirmation: false,
      })),
      unresolvedGoals: [],
      requestedAction: null,
      messageLength: 5,
      workspaceReceived: false,
      workspaceEntity: null,
      workspaceEntityId: null,
      contextOrigin: "catalog",
      resolutionMs: 0,
      orchestrator: null,
    },
  }
}

function success(response: string, metadata: Record<string, unknown> = {}): CosActionResult {
  return { response, metadata: metadata as CosActionResult["metadata"] }
}

test.describe("COS — núcleo operacional", () => {
  test("propaga o resultado de uma etapa para a dependente", async () => {
    const planId = "dependency-plan"
    let receivedLeadId: unknown = null
    const first = createStep({
      planId,
      order: 0,
      capability: createCapability({
        id: "lead.create",
        action: "createLead",
        title: "Cadastrar cliente",
        mutatesData: true,
        handler: async () => ({ ...success("Cliente criado"), leadId: "lead-123" }),
      }),
    })
    const second = createStep({
      planId,
      order: 1,
      capability: createCapability({
        id: "proposal.create",
        action: "CREATE_PROPOSAL",
        title: "Criar proposta",
        mutatesData: true,
        handler: async ({ payload }) => {
          receivedLeadId = payload?.leadId
          return success("Proposta criada")
        },
      }),
    })

    const result = await executeCosExecutionPlan({
      plan: createPlan([first, second]),
      brokerId: "broker",
      userId: "user",
      message: "teste",
    })

    expect(result.status).toBe("completed")
    expect(receivedLeadId).toBe("lead-123")
    expect(result.completedSteps).toHaveLength(2)
    const response = await formatCosExecutionPlanResponse({ message: "teste", plan: createPlan([first, second]), result })
    expect(response).toContain("✓ Cadastrar cliente")
    expect(response).toContain("✓ Criar proposta")
  })

  test("não executa etapa cuja dependência não foi concluída", async () => {
    let calls = 0
    const step = createStep({
      planId: "blocked-plan",
      order: 0,
      dependsOn: ["missing-step"],
      capability: createCapability({
        id: "lead.summary",
        action: "getLeadsSummary",
        title: "Consultar clientes",
        handler: async () => {
          calls += 1
          return success("Resumo")
        },
      }),
    })

    const result = await executeCosExecutionPlan({
      plan: createPlan([step]),
      brokerId: "broker",
      userId: "user",
      message: "teste",
    })

    expect(result.status).toBe("failed")
    expect(result.interruptedReason).toBe("dependency_not_completed")
    expect(result.steps[0].status).toBe("skipped")
    expect(calls).toBe(0)
  })

  test("preserva etapas concluídas e interrompe o restante após falha", async () => {
    const planId = "partial-plan"
    const calls = [0, 0, 0]
    const handlers: CosCapabilityHandler[] = [
      async () => { calls[0] += 1; return success("Primeira concluída") },
      async () => { calls[1] += 1; throw new Error("falha controlada") },
      async () => { calls[2] += 1; return success("Não deveria executar") },
    ]
    const definitions = [
      { id: "lead.summary" as const, action: "getLeadsSummary" as const, title: "Consultar clientes" },
      { id: "finance.summary" as const, action: "getFinancialSummary" as const, title: "Consultar financeiro" },
      { id: "operation.summary" as const, action: "createInternalNotification" as const, title: "Resumir operação" },
    ]
    const steps = definitions.map((definition, order) => createStep({
      planId,
      order,
      capability: createCapability({ ...definition, handler: handlers[order] }),
    }))

    const result = await executeCosExecutionPlan({
      plan: createPlan(steps),
      brokerId: "broker",
      userId: "user",
      message: "teste",
    })

    expect(result.status).toBe("failed")
    expect(result.completedSteps).toHaveLength(1)
    expect(result.steps.map((step) => step.status)).toEqual(["completed", "failed", "pending"])
    expect(calls).toEqual([1, 1, 0])
    const response = await formatCosExecutionPlanResponse({ message: "teste", plan: createPlan(steps), result })
    expect(response).toContain("O que já foi concluído foi preservado")
    expect(response).not.toContain("falha controlada")
  })

  test("aceita retry explícito somente para leitura e preserva passos concluídos", () => {
    const base: CosWorkflow = {
      id: "workflow",
      conversationId: "conversation",
      status: "failed",
      executionPlan: {
        id: "plan",
        source: "recipe",
        reason: "teste",
        message: "teste",
        surface: "portal",
        workspace: null,
        unresolvedGoals: [],
      },
      currentStep: 1,
      steps: [
        {
          id: "step-1",
          order: 0,
          entity: "lead",
          capabilityId: "lead.summary",
          action: "getLeadsSummary",
          status: "completed",
          dependsOn: [],
          durationMs: 1,
          errorMessage: null,
          resultResponse: "ok",
          resultMetadata: {},
        },
        {
          id: "step-2",
          order: 1,
          entity: "finance",
          capabilityId: "finance.summary",
          action: "getFinancialSummary",
          status: "failed",
          dependsOn: ["step-1"],
          durationMs: 1,
          errorMessage: "falha",
          resultResponse: null,
          resultMetadata: null,
        },
      ],
      pendingInput: null,
      startedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      completedAt: new Date(0).toISOString(),
      pausedAt: null,
      totalPausedMs: 0,
    }

    expect(shouldResumeWorkflow(base, "tentar novamente")).toBe(true)
    expect(shouldResumeWorkflow(base, "continuar")).toBe(false)
    const resumed = resumeWorkflowState(base)
    expect(resumed.status).toBe("processing")
    expect(resumed.steps.map((step) => step.status)).toEqual(["completed", "pending"])

    const mutating = {
      ...base,
      currentStep: 0,
      steps: [{ ...base.steps[0], action: "createLead" as const, capabilityId: "lead.create" as const, status: "failed" as const }],
    }
    expect(shouldResumeWorkflow(mutating, "tentar novamente")).toBe(false)
  })
})
