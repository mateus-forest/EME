import { expect, test } from "@playwright/test"

import {
  buildCosConversationSnapshot,
  resolveCosContextualTurn,
  resolveCosConversationReference,
  updateCosConversationSnapshot,
} from "@/lib/cos/conversation-snapshot"
import { createPendingInput } from "@/lib/cos/pending-input"
import { resolveCosIntent } from "@/lib/cos/intent-resolver"
import type {
  CosConversationEntityReference,
  CosConversationSnapshot,
  CosExecutionPlanResult,
  CosWorkflow,
} from "@/lib/cos/types"

const NOW = "2026-08-14T12:00:00.000Z"

function workflow(action: CosWorkflow["steps"][number]["action"], capabilityId: CosWorkflow["steps"][number]["capabilityId"], pendingInput = createPendingInput({
  field: "lead",
  action,
  entity: action === "CREATE_PROPOSAL" ? "proposal" : "lead",
  parsedData: action === "CREATE_PROPOSAL" ? { price: 90_000_000 } : {},
  now: new Date(NOW),
})): CosWorkflow {
  return {
    id: `workflow-${capabilityId}`,
    conversationId: "conversation",
    status: "awaiting_input",
    executionPlan: {
      id: `workflow-${capabilityId}`,
      source: "single",
      reason: "teste",
      message: "teste",
      surface: "portal",
      workspace: null,
      unresolvedGoals: [],
    },
    currentStep: 0,
    steps: [{
      id: "step-1",
      order: 0,
      entity: action === "CREATE_PROPOSAL" ? "proposal" : "lead",
      capabilityId,
      action,
      status: "awaiting_input",
      dependsOn: [],
      durationMs: null,
      errorMessage: null,
      resultResponse: null,
      resultMetadata: null,
    }],
    pendingInput,
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    pausedAt: NOW,
    totalPausedMs: 0,
  }
}

function emptySnapshot(overrides: Partial<CosConversationSnapshot> = {}): CosConversationSnapshot {
  return {
    schemaVersion: 1,
    conversationId: "conversation",
    recentMessages: [],
    activeWorkflow: null,
    pendingInput: null,
    currentTopic: null,
    recentTopics: [],
    activeEntities: {},
    recentEntities: [],
    recentResults: [],
    selectionSets: [],
    lastAction: null,
    lastExecution: null,
    temporalContext: { today: "2026-08-14", references: {} },
    workspace: null,
    updatedAt: NOW,
    ...overrides,
  }
}

function entity(type: CosConversationEntityReference["type"], id: string, label: string): CosConversationEntityReference {
  return {
    type,
    id,
    label,
    source: "execution",
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "teste",
  }
}

function executionResult(input: {
  action: CosExecutionPlanResult["primaryAction"]
  capabilityId: CosExecutionPlanResult["primaryCapabilityId"]
  status: "success" | "awaiting_input"
  metadata: Record<string, unknown>
  propertyId?: string
  leadId?: string
  pendingInput?: ReturnType<typeof createPendingInput>
}): CosExecutionPlanResult {
  const step = {
    id: "step-1",
    order: 0,
    entity: input.action.includes("PROPERTY") || input.action === "searchProperties" ? "property" : "lead",
    capabilityId: input.capabilityId,
    action: input.action,
    status: input.status === "success" ? "completed" : "awaiting_input",
    dependsOn: [],
    durationMs: 1,
    errorMessage: null,
    result: input.status === "success"
      ? { status: "success", response: "resultado", metadata: input.metadata, propertyId: input.propertyId, leadId: input.leadId }
      : { status: "awaiting_input", response: "selecione", metadata: input.metadata, pendingInput: input.pendingInput as ReturnType<typeof createPendingInput> },
  } as unknown as CosExecutionPlanResult["steps"][number]
  return {
    planId: "plan",
    status: input.status === "success" ? "completed" : "awaiting_input",
    primaryAction: input.action,
    primaryCapabilityId: input.capabilityId,
    steps: [step],
    completedSteps: input.status === "success" ? [step] : [],
    executedSteps: [step],
    interruptedStep: input.status === "awaiting_input" ? step : null,
    interruptedReason: input.status === "awaiting_input" ? "awaiting_input" : null,
    unresolvedGoals: [],
    metadata: {},
    propertyId: input.propertyId,
    leadId: input.leadId,
    totalDurationMs: 1,
  }
}

test.describe("COS — ConversationSnapshot da Etapa 2B", () => {
  test("usa uma janela previsível de 12 mensagens e absorve memory antiga", () => {
    const snapshot = buildCosConversationSnapshot({
      conversationId: "conversation",
      message: "hoje e amanhã",
      recentMessages: Array.from({ length: 15 }, (_, index) => ({
        id: `message-${index}`,
        message: `Mensagem ${index}`,
        response: `Resposta ${index}`,
        actionType: "general",
        actionStatus: "success",
        leadId: null,
        propertyId: null,
        metadata: {},
        createdAt: new Date(Date.parse(NOW) + index * 1000),
      })),
      activeWorkflow: null,
      memory: {
        leadId: "lead-marina",
        selectedClient: { id: "lead-marina", label: "Marina" },
        updatedAt: NOW,
      },
      workspace: null,
      now: new Date(NOW),
    })

    expect(snapshot.recentMessages).toHaveLength(12)
    expect(snapshot.recentMessages[0].id).toBe("message-3")
    expect(snapshot.activeEntities.lead?.id).toBe("lead-marina")
    expect(snapshot.temporalContext.references.today).toBeTruthy()
    expect(snapshot.temporalContext.references.tomorrow).toBeTruthy()
  })

  test("B — contato posterior continua sobre a Marina ativa", () => {
    const marina = entity("lead", "lead-marina", "Marina")
    const result = resolveCosContextualTurn({
      message: "Coloca marina@email.com também.",
      snapshot: emptySnapshot({ activeEntities: { lead: marina }, recentEntities: [marina] }),
      activeWorkflow: null,
    })

    expect(result.requestedAction).toBe("UPDATE_LEAD")
    expect(result.payload).toEqual({ leadId: "lead-marina" })
  })

  test("C — correção explícita preserva o workflow e atualiza o slot", () => {
    const active = workflow("CREATE_PROPOSAL", "proposal.create")
    const result = resolveCosContextualTurn({
      message: "Na verdade coloca R$ 850 mil.",
      snapshot: emptySnapshot({ activeWorkflow: active, pendingInput: active.pendingInput }),
      activeWorkflow: active,
    })

    expect(result.requestedAction).toBe("CREATE_PROPOSAL")
    expect(result.workflow?.pendingInput?.parsedData.price).toBe(85_000_000)
    expect(result.reason).toBe("active_workflow_correction")
  })

  test("D — selection set sobrevive ao pending e pronome aponta ao segundo imóvel", () => {
    const pendingInput = createPendingInput({
      field: "propertyChoice",
      type: "selection",
      action: "searchProperties",
      entity: "property",
      options: [
        { id: "property-1", label: "Apartamento A" },
        { id: "property-2", label: "Casa B" },
      ],
      now: new Date(NOW),
    })
    const first = updateCosConversationSnapshot({
      snapshot: emptySnapshot(),
      message: "Mostre imóveis em Gramado.",
      workflow: workflow("searchProperties", "property.search", pendingInput),
      result: executionResult({
        action: "searchProperties",
        capabilityId: "property.search",
        status: "awaiting_input",
        metadata: { propertyIds: ["property-1", "property-2"] },
        pendingInput,
      }),
      status: "awaiting_input",
      now: new Date(NOW),
    })
    const ordinal = resolveCosConversationReference("O segundo.", first)
    expect(ordinal.entity?.id).toBe("property-2")

    const selected = updateCosConversationSnapshot({
      snapshot: first,
      message: "O segundo.",
      workflow: { ...workflow("searchProperties", "property.search", pendingInput), status: "completed", pendingInput: null },
      result: executionResult({
        action: "searchProperties",
        capabilityId: "property.search",
        status: "success",
        metadata: { propertyId: "property-2" },
        propertyId: "property-2",
      }),
      status: "success",
      now: new Date("2026-08-14T12:01:00.000Z"),
    })
    expect(resolveCosConversationReference("Quantos metros ele tem?", selected).entity?.id).toBe("property-2")
    expect(resolveCosContextualTurn({ message: "Quantos metros ele tem?", snapshot: selected, activeWorkflow: null }).requestedAction).toBe("GET_PROPERTY")
  })

  test("F — troca de tópico mantém a lista anterior recuperável", () => {
    const propertyTopic = {
      id: "topic-property",
      domain: "property" as const,
      label: "Imóveis em Porto Alegre",
      entityType: "property" as const,
      selectionSetId: "selection-properties",
      startedAt: NOW,
      lastMentionedAt: NOW,
    }
    const leadTopic = {
      id: "topic-lead",
      domain: "lead" as const,
      label: "Meus clientes",
      entityType: "lead" as const,
      selectionSetId: null,
      startedAt: NOW,
      lastMentionedAt: NOW,
    }
    const snapshot = emptySnapshot({
      currentTopic: leadTopic,
      recentTopics: [propertyTopic],
      selectionSets: [{
        id: "selection-properties",
        type: "property",
        items: [
          { index: 1, entity: entity("property", "property-poa-1", "Apartamento Centro") },
          { index: 2, entity: entity("property", "property-poa-2", "Casa Moinhos") },
        ],
        query: "Porto Alegre",
        topicId: propertyTopic.id,
        createdAt: NOW,
        expiresAt: "2026-08-20T12:00:00.000Z",
      }],
    })

    const result = resolveCosContextualTurn({
      message: "Voltando aos imóveis, abre o primeiro.",
      snapshot,
      activeWorkflow: null,
    })
    expect(result.requestedAction).toBe("GET_PROPERTY")
    expect(result.payload).toEqual({ propertyId: "property-poa-1" })
  })

  test("referência ambígua não escolhe um dos dois clientes", () => {
    const joaoA = entity("lead", "lead-a", "João A")
    const joaoB = entity("lead", "lead-b", "João B")
    const result = resolveCosConversationReference("atualiza aquele cliente", emptySnapshot({ recentEntities: [joaoA, joaoB] }))
    expect(result.entity).toBeNull()
    expect(result.ambiguous.map((item) => item.id)).toEqual(["lead-a", "lead-b"])
  })

  test("pending de telefone não captura pergunta de outro domínio", () => {
    const active = workflow("createLead", "lead.create", createPendingInput({
      field: "phone",
      action: "createLead",
      entity: "lead",
      parsedData: { extractedName: "Marina" },
      now: new Date(NOW),
    }))
    const result = resolveCosIntent({
      message: "Quantos imóveis tenho publicados?",
      requestedAction: null,
      attachments: [],
      workspace: null,
      activeWorkflow: active,
      memory: null,
    })
    expect(result.workflowDecision).toBe("start_new")
    expect(result.requestedAction).not.toBe("createLead")
  })
})
