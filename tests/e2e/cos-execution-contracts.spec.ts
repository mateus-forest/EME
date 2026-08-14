import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createCosAwaitingInputResult, createCosErrorResult, createCosSuccessResult } from "@/lib/cos/action-result"
import { validateCosCapabilityRegistry } from "@/lib/cos/capability-invariants"
import {
  doesCosCapabilityRequireConfirmation,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
import { executeCosExecutionPlan } from "@/lib/cos/executor"
import {
  classifyCosPendingReply,
  createPendingInput,
  isAwaitingInputResult,
  isCosPendingInputExpired,
  normalizeCosPendingInput,
} from "@/lib/cos/pending-input"
import type {
  CosCapabilityDefinition,
  CosCapabilityHandler,
  CosCapabilityId,
  CosExecutionPlan,
  CosExecutionStep,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

function buildPlan(handler: CosCapabilityHandler): CosExecutionPlan {
  const capability: CosCapabilityDefinition = {
    id: "general.chat",
    action: "general",
    title: "Teste",
    description: "Teste",
    domain: "general",
    entity: "conversation",
    aliases: [],
    responseMode: "raw",
    source: "modular",
    mutatesData: false,
    requiresConfirmation: false,
    requiresSelection: false,
    surfaces: ["portal"],
    handler,
  }
  const step: CosExecutionStep = {
    id: "test-plan:step:1",
    order: 0,
    entity: "general",
    capabilityId: capability.id,
    action: capability.action,
    status: "pending",
    dependsOn: [],
    durationMs: null,
    result: null,
    errorMessage: null,
    plan: {
      action: capability.action,
      payload: {},
      pendingInput: null,
      context: null,
      workspace: null,
      capability,
      capabilityId: capability.id,
      entity: "general",
      confidence: 1,
      source: "catalog",
      reason: "teste",
      contextOrigin: "catalog",
      telemetry: {
        capabilityId: capability.id,
        entity: "general",
        confidence: 1,
        source: "catalog",
        reason: "teste",
        fallbackUsed: false,
        pendingInputUsed: false,
        surface: "portal",
        resolutionMs: 0,
        requestedAction: null,
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
  return {
    id: "test-plan",
    source: "single",
    reason: "teste",
    status: "pending",
    message: "teste",
    surface: "portal",
    workspace: null,
    pendingInput: null,
    context: null,
    primaryStep: step,
    steps: [step],
    unresolvedGoals: [],
    requiresConfirmation: false,
    confirmationMessage: null,
    telemetry: {
      planId: "test-plan",
      source: "single",
      planner: "deterministic",
      reason: "teste",
      surface: "portal",
      stepCount: 1,
      steps: [{
        id: step.id,
        capabilityId: capability.id,
        action: capability.action,
        entity: "general",
        source: "catalog",
        mutatesData: false,
        requiresConfirmation: false,
      }],
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

async function execute(handler: CosCapabilityHandler) {
  return executeCosExecutionPlan({
    plan: buildPlan(handler),
    brokerId: "broker",
    userId: "user",
    message: "teste",
  })
}

test.describe("COS — contratos operacionais da Etapa 2A", () => {
  test("registry não possui action duplicada nem capability sem handler", () => {
    const source = readFileSync(join(process.cwd(), "lib/cos/capability-handlers.ts"), "utf8")
    const handlerIds = [...source.matchAll(/^\s*"([^"]+)":/gm)].map((match) => match[1])
    const actionSource = readFileSync(join(process.cwd(), "lib/eme-backend.ts"), "utf8")
    const actionBlock = actionSource.match(/export const assessorActions = \[([\s\S]*?)\] as const/)?.[1] ?? ""
    const validActions = [...actionBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1] as AssessorAction)
    const issues = validateCosCapabilityRegistry({
      descriptors: listCosCapabilityCatalog(),
      handlerIds,
      validActions,
    })

    expect(issues).toEqual([])
  })

  test("invariante detecta duplicidade, handler ausente e handler órfão", () => {
    const descriptor = listCosCapabilityCatalog()[0]
    const issues = validateCosCapabilityRegistry({
      descriptors: [descriptor, { ...descriptor, id: "lead.create" as CosCapabilityId }],
      handlerIds: [descriptor.id, "property.create"],
      validActions: [descriptor.action] as AssessorAction[],
    })

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_ACTION",
      "MISSING_HANDLER",
      "ORPHAN_HANDLER",
    ]))
  })

  test("confirmação vem dos descriptors: exclusão confirma e consulta não", () => {
    expect(doesCosCapabilityRequireConfirmation("lead.delete")).toBe(true)
    expect(doesCosCapabilityRequireConfirmation("property.archive")).toBe(true)
    expect(doesCosCapabilityRequireConfirmation("lead.summary")).toBe(false)
    expect(doesCosCapabilityRequireConfirmation("property.search")).toBe(false)
    expect(readFileSync(join(process.cwd(), "lib/cos/execution-planner.ts"), "utf8")).not.toContain("confirmationOnlyActions")
  })

  test("executor preserva success, awaiting_input e error sem analisar texto", async () => {
    const success = await execute(async () => createCosSuccessResult({ response: "Concluído", metadata: {} }))
    expect(success.status).toBe("completed")

    const pendingInput = createPendingInput({ field: "phone", action: "createLead", entity: "lead" })
    const awaiting = await execute(async () => createCosAwaitingInputResult({
      response: "Informe o telefone.",
      pendingInput,
    }))
    expect(awaiting.status).toBe("awaiting_input")
    expect(awaiting.interruptedStep?.status).toBe("awaiting_input")

    const failed = await execute(async () => createCosErrorResult({
      response: "Não foi possível concluir.",
      errorCode: "COS_TEST_FAILURE",
    }))
    expect(failed.status).toBe("failed")
    expect(failed.interruptedStep?.errorMessage).toBe("COS_TEST_FAILURE")
  })

  test("pending não depende de frase e formato antigo é normalizado", () => {
    expect(isAwaitingInputResult(createCosSuccessResult({ response: "Qual cliente?", metadata: {} }))).toBe(false)

    const legacy = normalizeCosPendingInput({
      pendingInput: {
        field: "phone",
        label: "Telefone",
        type: "phone",
        required: true,
        action: "createLead",
        entity: "lead",
        parsedData: { extractedName: "Marina" },
      },
      fallbackAction: "createLead",
      fallbackEntity: "lead",
    })
    expect(legacy?.schemaVersion).toBe(2)
    expect(legacy?.source).toBe("legacy_adapter")
    expect(legacy?.expiresAt).toBeTruthy()
  })

  test("pending expirado e respostas simples de cancelamento são seguras", () => {
    const pending = createPendingInput({
      field: "phone",
      action: "createLead",
      entity: "lead",
      now: new Date("2026-08-12T00:00:00.000Z"),
    })
    expect(isCosPendingInputExpired(pending, new Date("2026-08-14T00:00:00.000Z"))).toBe(true)
    expect(classifyCosPendingReply("não")).toBe("reject")
    expect(classifyCosPendingReply("cancelar")).toBe("cancel")
    expect(classifyCosPendingReply("não, o valor é 850 mil")).toBe("correction")
  })

  test("mutações críticas não contêm fallback explícito para registro mais recente", () => {
    const sources = [
      "lib/cos/capabilities/lead/manage.ts",
      "lib/cos/capabilities/property/manage.ts",
      "lib/cos/capabilities/contract/manage.ts",
      "lib/cos/capabilities/agenda/manage.ts",
      "lib/cos/capabilities/agenda/complete.ts",
    ].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n")

    expect(sources).not.toMatch(/findFirst\(\{[\s\S]*?where:\s*\{\s*brokerId\s*\},[\s\S]*?orderBy:\s*\{\s*updatedAt:\s*"desc"/)
    expect(sources).not.toContain("where: { brokerId, status: \"pending\" }")
  })
})
