import { expect, test } from "@playwright/test"

import { formatCosExecutionPlanResponse } from "@/lib/cos/response-formatter"
import {
  buildCosConfirmationResponseViewModel,
  buildCosExecutionResponseViewModel,
  buildCosSimpleResponseViewModel,
  parseCosResponseViewModel,
} from "@/lib/cos/response-view-model"
import type {
  CosCapabilityDefinition,
  CosCapabilityDomain,
  CosCapabilityId,
  CosDialogueAct,
  CosDialogueDecision,
  CosEntityModuleId,
  CosExecutionPlan,
  CosExecutionPlanResult,
  CosExecutionStep,
  CosRuntimeActionResult,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

const TECHNICAL_OUTPUT = /\b(?:pending|completed|failed|property|appointment)\b|\b(?:CREATE|UPDATE|DELETE|GET|LIST|PUBLISH|UNPUBLISH|ARCHIVE|STUDIO|CONTRACT|MARK)_[A-Z0-9_]+\b/i
const MOJIBAKE_OUTPUT = /(?:Ãƒ|Ã¢|Ã£|Ã§|Ã©|Ãª|Ã­|Ã³|Ã´|Ãº|Â|âœ|âš|â‚|â|â¬)/

function assertUserFacingText(text: string) {
  expect(text.trim().length).toBeGreaterThan(0)
  expect(text).not.toMatch(TECHNICAL_OUTPUT)
  expect(text).not.toMatch(MOJIBAKE_OUTPUT)
}

function success(response: string, metadata: Record<string, unknown> = {}): CosRuntimeActionResult {
  return {
    status: "success",
    response,
    metadata: metadata as CosRuntimeActionResult["metadata"],
  }
}

function awaitingInput(input: {
  response: string
  action: AssessorAction
  entity: CosEntityModuleId
  capabilityId: CosCapabilityId
  field: string
  label: string
  type: "text" | "phone" | "currency" | "time" | "selection" | "confirmation"
  options?: Array<{ id: string; label: string; description?: string }>
}): CosRuntimeActionResult {
  const pendingInput = {
    schemaVersion: 2 as const,
    createdAt: "2026-08-14T12:00:00.000Z",
    expiresAt: "2026-08-14T12:30:00.000Z",
    source: "handler" as const,
    reason: "missing_required_field",
    capabilityId: input.capabilityId,
    field: input.field,
    label: input.label,
    type: input.type,
    required: true,
    entity: input.entity,
    action: input.action,
    parsedData: {},
    options: input.options,
  }

  return {
    status: "awaiting_input",
    response: input.response,
    metadata: { pendingInput } as unknown as CosRuntimeActionResult["metadata"],
    pendingInput,
  }
}

function error(response: string, errorCode = "COS_TEST_ERROR"): CosRuntimeActionResult {
  return {
    status: "error",
    response,
    errorCode,
    metadata: {},
  }
}

function createCapability(input: {
  id: CosCapabilityId
  action: AssessorAction
  title: string
  domain?: CosCapabilityDomain
  entity?: CosCapabilityDefinition["entity"]
  mutatesData?: boolean
}): CosCapabilityDefinition {
  return {
    id: input.id,
    action: input.action,
    title: input.title,
    description: input.title,
    domain: input.domain ?? "general",
    entity: input.entity ?? "conversation",
    aliases: [],
    responseMode: "raw",
    source: "modular",
    mutatesData: input.mutatesData ?? false,
    requiresConfirmation: false,
    requiresSelection: false,
    surfaces: ["portal", "cos_home"],
  }
}

function createStep(input: {
  planId: string
  order: number
  capability: CosCapabilityDefinition
  entity: CosEntityModuleId
  result: CosRuntimeActionResult
  status?: CosExecutionStep["status"]
  dependsOn?: string[]
}): CosExecutionStep {
  const id = `${input.planId}:step:${input.order + 1}`
  return {
    id,
    order: input.order,
    entity: input.entity,
    capabilityId: input.capability.id,
    action: input.capability.action,
    status: input.status ?? (input.result.status === "success" ? "completed" : input.result.status === "error" ? "failed" : "awaiting_input"),
    dependsOn: input.dependsOn ?? (input.order === 0 ? [] : [`${input.planId}:step:${input.order}`]),
    durationMs: 4,
    result: input.result,
    errorMessage: input.result.status === "error" ? input.result.errorCode : null,
    plan: {
      action: input.capability.action,
      payload: {},
      pendingInput: null,
      context: null,
      workspace: null,
      capability: input.capability,
      capabilityId: input.capability.id,
      entity: input.entity,
      confidence: 1,
      source: "catalog",
      reason: "fixture da Response Layer",
      contextOrigin: "catalog",
      telemetry: {
        capabilityId: input.capability.id,
        entity: input.entity,
        confidence: 1,
        source: "catalog",
        reason: "fixture da Response Layer",
        fallbackUsed: false,
        pendingInputUsed: input.result.status === "awaiting_input",
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
  const planId = steps[0]?.id.split(":step:")[0] ?? "response-plan"
  return {
    id: planId,
    source: steps.length > 1 ? "recipe" : "single",
    reason: "fixture da Response Layer",
    status: "pending",
    message: "mensagem de teste",
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
      reason: "fixture da Response Layer",
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
      messageLength: 17,
      workspaceReceived: false,
      workspaceEntity: null,
      workspaceEntityId: null,
      contextOrigin: "catalog",
      resolutionMs: 0,
      orchestrator: null,
    },
  }
}

function createExecution(input: {
  steps: CosExecutionStep[]
  status?: CosExecutionPlanResult["status"]
}): { plan: CosExecutionPlan; result: CosExecutionPlanResult } {
  const plan = createPlan(input.steps)
  const status = input.status ?? (input.steps.some((step) => step.status === "failed")
    ? "failed"
    : input.steps.some((step) => step.status === "awaiting_input")
      ? "awaiting_input"
      : "completed")
  const interruptedStep = status === "completed"
    ? null
    : input.steps.find((step) => step.status === "failed" || step.status === "awaiting_input") ?? null

  return {
    plan,
    result: {
      planId: plan.id,
      status,
      primaryAction: plan.primaryStep.action,
      primaryCapabilityId: plan.primaryStep.capabilityId,
      steps: input.steps,
      completedSteps: input.steps.filter((step) => step.status === "completed"),
      executedSteps: input.steps.filter((step) => step.status !== "pending" && step.status !== "skipped"),
      interruptedStep,
      interruptedReason: status === "failed" ? "handler_error" : status === "awaiting_input" ? "awaiting_input" : null,
      unresolvedGoals: [],
      metadata: {},
      totalDurationMs: input.steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0),
    },
  }
}

function viewFor(input: {
  steps: CosExecutionStep[]
  dialogueAct?: CosDialogueAct
  status?: CosExecutionPlanResult["status"]
}) {
  const execution = createExecution({ steps: input.steps, status: input.status })
  return {
    ...execution,
    view: buildCosExecutionResponseViewModel({
      message: "mensagem de teste",
      ...execution,
      decision: input.dialogueAct
        ? createDecision(input.dialogueAct, input.steps[0]?.plan.capability.domain ?? "general", input.steps[0] ?? null)
        : undefined,
    }),
  }
}

function createDecision(
  dialogueAct: CosDialogueAct,
  domain: CosCapabilityDomain,
  step: CosExecutionStep | null,
): CosDialogueDecision {
  const primaryDomain = domain === "operation" || domain === "document" ? "general" : domain
  return {
    schemaVersion: 1,
    dialogueAct,
    dialogueActConfidence: 1,
    dialogueActEvidence: ["fixture explícita da Response Layer"],
    primaryDomain,
    secondaryDomains: [],
    objective: {
      mode: dialogueAct === "query"
        ? "query"
        : dialogueAct === "explain" || dialogueAct === "capability_question"
          ? "explain"
          : dialogueAct === "provide_input"
            ? "continue"
            : "execute",
      summary: "objetivo de teste",
      targetCapabilityId: step?.capabilityId ?? null,
    },
    reference: {
      type: null,
      id: null,
      label: null,
      reason: "sem referência necessária",
      ambiguousIds: [],
    },
    selectedCapabilityId: step?.capabilityId ?? null,
    selectedAction: step?.action ?? null,
    candidateCapabilities: [],
    workflowDecision: "start_new",
    needsClarification: false,
    clarificationReason: null,
    source: "dialogue_rules",
  }
}

test.describe("COS — Response Layer", () => {
  test("representa sucesso sem expor action ou status técnico", () => {
    const step = createStep({
      planId: "success",
      order: 0,
      entity: "lead",
      capability: createCapability({ id: "lead.create", action: "createLead", title: "Cadastrar cliente", domain: "lead", entity: "lead", mutatesData: true }),
      result: success("Cliente João cadastrado com sucesso.", { leadId: "lead-1" }),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "execute" })

    expect(view.kind).toBe("success")
    expect(view.text).toContain("João")
    assertUserFacingText(view.text)
  })

  test("distingue consulta de execução", () => {
    const step = createStep({
      planId: "query",
      order: 0,
      entity: "property",
      capability: createCapability({ id: "property.get", action: "GET_PROPERTY", title: "Consultar imóvel", domain: "property", entity: "property" }),
      result: success("Apartamento Centro\n140 m² • 3 quartos", { propertyId: "property-1" }),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "query" })

    expect(view.kind).toBe("query_result")
    expect(view.text).toContain("140 m²")
    assertUserFacingText(view.text)
  })

  test("representa explicação baseada no contexto sem mudar os fatos", () => {
    const step = createStep({
      planId: "explain",
      order: 0,
      entity: "general",
      capability: createCapability({ id: "help.general_question", action: "help_general_question", title: "Explicar o EME", domain: "general" }),
      result: success("O Catálogo é a vitrine individual do corretor. O Marketplace reúne imóveis e corretores do EME.", {
        knowledgeDocumentIds: ["catalogo", "marketplace"],
      }),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "explain" })

    expect(view.kind).toBe("explanation")
    expect(view.text).toContain("Catálogo")
    expect(view.text).toContain("Marketplace")
    assertUserFacingText(view.text)
  })

  test("erro tipado nunca é apresentado como sucesso nem vaza errorCode", () => {
    const step = createStep({
      planId: "error",
      order: 0,
      entity: "lead",
      capability: createCapability({ id: "lead.update", action: "UPDATE_LEAD", title: "Atualizar cliente", domain: "lead", entity: "lead", mutatesData: true }),
      result: error("Não consegui salvar a alteração. Tente novamente.", "P2025_INTERNAL_DATABASE_DETAIL"),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "execute" })

    expect(view.kind).toBe("error")
    expect(view.text).toContain("Não consegui")
    expect(view.text).not.toContain("P2025")
    expect(view.error?.code).toBe("P2025_INTERNAL_DATABASE_DETAIL")
    assertUserFacingText(view.text)
  })

  test("pending pergunta somente o campo necessário", () => {
    const step = createStep({
      planId: "pending",
      order: 0,
      entity: "lead",
      capability: createCapability({ id: "lead.create", action: "createLead", title: "Cadastrar cliente", domain: "lead", entity: "lead", mutatesData: true }),
      result: awaitingInput({
        response: "Qual é o telefone da Marina?",
        action: "createLead",
        entity: "lead",
        capabilityId: "lead.create",
        field: "phone",
        label: "Telefone",
        type: "phone",
      }),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "provide_input" })

    expect(view.kind).toBe("awaiting_input")
    expect(view.pending).toMatchObject({ field: "phone", label: "Telefone" })
    expect(view.text).toBe("Qual é o telefone da Marina?")
    assertUserFacingText(view.text)
  })

  test("selection preserva opções estruturadas sem depender do texto", () => {
    const step = createStep({
      planId: "selection",
      order: 0,
      entity: "property",
      capability: createCapability({ id: "property.search", action: "searchProperties", title: "Buscar imóveis", domain: "property", entity: "property" }),
      result: awaitingInput({
        response: "Encontrei dois imóveis. Qual deles você quer abrir?",
        action: "searchProperties",
        entity: "property",
        capabilityId: "property.search",
        field: "propertyChoice",
        label: "Imóvel",
        type: "selection",
        options: [
          { id: "property-1", label: "Apartamento Centro" },
          { id: "property-2", label: "Casa Planalto" },
        ],
      }),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "select" })

    expect(view.kind).toBe("selection")
    expect(view.pending?.options).toHaveLength(2)
    expect(view.pending?.options?.[1]?.label).toBe("Casa Planalto")
    assertUserFacingText(view.text)
  })

  test("confirmação é estruturada e não mostra o enum da action", () => {
    const view = buildCosConfirmationResponseViewModel({
      action: "DELETE_LEAD",
      capabilityTitle: "Excluir cliente",
      prompt: "Posso excluir o cliente João? Essa ação não pode ser desfeita.",
    })

    expect(view.kind).toBe("confirmation_required")
    expect(view.confirmation?.prompt).toBe("Posso excluir o cliente João? Essa ação não pode ser desfeita.")
    expect(view.text).not.toContain("DELETE_LEAD")
    assertUserFacingText(view.text)
  })

  test("cancelamento possui estado de apresentação próprio", () => {
    const view = buildCosSimpleResponseViewModel({
      kind: "cancelled",
      text: "Tudo bem. Não executei a alteração.",
    })

    expect(view.kind).toBe("cancelled")
    expect(view.text).toBe("Tudo bem. Não executei a alteração.")
    assertUserFacingText(view.text)
  })

  test("resultado parcial preserva etapas concluídas e o próximo dado", () => {
    const first = createStep({
      planId: "partial",
      order: 0,
      entity: "lead",
      capability: createCapability({ id: "lead.create", action: "createLead", title: "Cadastrar cliente", domain: "lead", entity: "lead", mutatesData: true }),
      result: success("Cadastrei a Ana.", { leadId: "lead-ana" }),
    })
    const second = createStep({
      planId: "partial",
      order: 1,
      entity: "proposal",
      capability: createCapability({ id: "proposal.create", action: "CREATE_PROPOSAL", title: "Criar proposta", domain: "proposal", entity: "document", mutatesData: true }),
      result: awaitingInput({
        response: "Qual imóvel devo usar na proposta?",
        action: "CREATE_PROPOSAL",
        entity: "proposal",
        capabilityId: "proposal.create",
        field: "propertyChoice",
        label: "Imóvel",
        type: "selection",
      }),
    })
    const { view } = viewFor({ steps: [first, second], dialogueAct: "execute" })

    expect(view.kind).toBe("partial_result")
    expect(view.completedSteps).toHaveLength(1)
    expect(view.text).toContain("Ana")
    expect(view.text).toContain("Qual imóvel")
    assertUserFacingText(view.text)
  })

  test("multi-step resume fatos úteis sem concatenar respostas cruas", () => {
    const firstRaw = "Cadastrei a Ana com o telefone informado."
    const secondRaw = "Criei a proposta de R$ 850.000,00 para o Apartamento Centro."
    const first = createStep({
      planId: "multi",
      order: 0,
      entity: "lead",
      capability: createCapability({ id: "lead.create", action: "createLead", title: "Cadastrar cliente", domain: "lead", entity: "lead", mutatesData: true }),
      result: success(firstRaw, { leadId: "lead-ana" }),
    })
    const second = createStep({
      planId: "multi",
      order: 1,
      entity: "proposal",
      capability: createCapability({ id: "proposal.create", action: "CREATE_PROPOSAL", title: "Criar proposta", domain: "proposal", entity: "document", mutatesData: true }),
      result: success(secondRaw, { documentId: "proposal-1" }),
    })
    const { view } = viewFor({ steps: [first, second], dialogueAct: "execute" })

    expect(view.kind).toBe("success")
    expect(view.completedSteps).toHaveLength(2)
    expect(view.text).toContain("Ana")
    expect(view.text).toContain("proposta")
    expect(view.text).not.toBe(`${firstRaw}\n${secondRaw}`)
    assertUserFacingText(view.text)
  })

  test("capability question é explicação e não afirma execução", () => {
    const step = createStep({
      planId: "capability-question",
      order: 0,
      entity: "general",
      capability: createCapability({ id: "general.chat", action: "general", title: "Responder sobre capacidade" }),
      result: success("Sim. Posso cadastrar clientes. Nada foi executado agora."),
    })
    const { view } = viewFor({ steps: [step], dialogueAct: "capability_question" })

    expect(view.kind).toBe("explanation")
    expect(view.text).toContain("Nada foi executado")
    assertUserFacingText(view.text)
  })

  test("formatter legado devolve exatamente o texto renderizado pelo ViewModel", async () => {
    const step = createStep({
      planId: "compatibility",
      order: 0,
      entity: "agenda",
      capability: createCapability({ id: "agenda.create", action: "CREATE_AGENDA_EVENT", title: "Criar compromisso", domain: "agenda", entity: "agenda", mutatesData: true }),
      result: success("Compromisso criado para amanhã às 15h."),
    })
    const execution = createExecution({ steps: [step] })
    const view = buildCosExecutionResponseViewModel({
      message: "Crie um compromisso amanhã às 15h.",
      ...execution,
      decision: createDecision("execute", "agenda", step),
    })
    const legacyText = await formatCosExecutionPlanResponse({
      message: "Crie um compromisso amanhã às 15h.",
      ...execution,
    })

    expect(legacyText).toBe(view.text)
    assertUserFacingText(legacyText)
  })

  test("parser aceita schema atual e rejeita objetos arbitrários", () => {
    const view = buildCosSimpleResponseViewModel({ kind: "warning", text: "Preciso de mais informações para continuar." })

    expect(parseCosResponseViewModel(JSON.parse(JSON.stringify(view)))).toEqual(view)
    expect(parseCosResponseViewModel({ schemaVersion: 99, kind: "success", text: "forjado" })).toBeNull()
    expect(parseCosResponseViewModel({ schemaVersion: 1, kind: "success", text: 123 })).toBeNull()
  })
})
