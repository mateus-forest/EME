import { expect, test } from "@playwright/test"

import { cosGoldenV1Conversations, COS_GOLDEN_V1_METADATA } from "@/lib/cos/evals/conversations/golden-v1"
import { resolveCosV2Capability, validateCosV2Interpretation } from "@/lib/cos-v2/capabilities"
import { buildCosV2ContextResponse, getCosV2DomainOverview } from "@/lib/cos-v2/presentation"
import type { CosConversationSnapshot } from "@/lib/cos/types"
import type { CosV2Interpretation } from "@/lib/cos-v2/types"

const NOW = "2026-08-15T12:00:00.000Z"

function snapshot(overrides: Partial<CosConversationSnapshot> = {}): CosConversationSnapshot {
  return {
    schemaVersion: 1,
    conversationId: "cos-v2-test",
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
    temporalContext: { today: "2026-08-15", references: {} },
    workspace: null,
    updatedAt: NOW,
    ...overrides,
  }
}

function interpretation(overrides: Partial<CosV2Interpretation> = {}): CosV2Interpretation {
  return {
    schemaVersion: 2,
    turnType: "execution",
    objective: { kind: "execute", summary: "Executar ação validada." },
    primaryDomain: "clients",
    secondaryDomains: [],
    entities: [],
    references: [],
    filters: [],
    providedData: [],
    corrections: [],
    missingData: [],
    intendedAction: "lead.create",
    steps: [{ action: "lead.create", goal: "Cadastrar cliente" }],
    confidence: 0.95,
    clarificationQuestion: null,
    responseFocus: "direct",
    source: "openai",
    ...overrides,
  }
}

test("COS V2 cobre no Registry as capabilities dos quatro domínios presentes no Golden congelado", () => {
  expect(COS_GOLDEN_V1_METADATA.frozen).toBe(true)
  const capabilityIds = new Set(
    cosGoldenV1Conversations.flatMap((conversation) => conversation.turns.flatMap((turn) => {
      const capabilityId = turn.expected.selectedCapabilityId ?? turn.expected.capabilityId
      return capabilityId && /^(?:lead|property|proposal|agenda)\./.test(capabilityId) ? [capabilityId] : []
    })),
  )

  expect(capabilityIds.size).toBeGreaterThan(15)
  for (const capabilityId of capabilityIds) {
    expect(resolveCosV2Capability(capabilityId, "portal")?.id, capabilityId).toBe(capabilityId)
  }
})

test("ações estruturadas canônicas chegam à mesma capability real", () => {
  expect(resolveCosV2Capability("create_proposal", "portal")?.id).toBe("proposal.create")
  expect(resolveCosV2Capability("CREATE_PROPOSAL", "portal")?.id).toBe("proposal.create")
  expect(resolveCosV2Capability("create_client", "portal")?.id).toBe("lead.create")
  expect(resolveCosV2Capability("finance.summary", "portal")).toBeNull()
  expect(resolveCosV2Capability("contract.create", "portal")).toBeNull()
})

test("pergunta e contexto podem referenciar capability sem autorizar execução", () => {
  for (const value of [
    interpretation({
      turnType: "question",
      objective: { kind: "answer", summary: "Explicar criação de proposta." },
      primaryDomain: "proposals",
      intendedAction: "proposal.create",
      steps: [{ action: "proposal.create", goal: "Explicar" }],
      responseFocus: "how_to",
    }),
    interpretation({
      turnType: "context",
      objective: { kind: "context", summary: "Registrar contexto comercial." },
      primaryDomain: "properties",
      secondaryDomains: ["clients"],
      intendedAction: "property.search",
      steps: [{ action: "property.search", goal: "Busca futura" }],
      missingData: ["client"],
      clarificationQuestion: "Qual cliente?",
    }),
  ]) {
    const validated = validateCosV2Interpretation({ message: "teste", interpretation: value, surface: "portal", snapshot: snapshot(), workspace: null })
    expect(validated.accepted).toBe(true)
    expect(validated.capabilityIds).toEqual([])
    expect(validated.referencedCapabilityId).not.toBeNull()
  }
})

test("ids inventados pela IA são descartados e o Snapshot continua sendo autoridade", () => {
  const activeLead = {
    type: "lead" as const,
    id: "lead-real",
    label: "Marina",
    source: "execution" as const,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "golden-state",
  }
  const validated = validateCosV2Interpretation({
    message: "Exclua esse cliente.",
    interpretation: interpretation({
      intendedAction: "lead.delete",
      steps: [{ action: "lead.delete", goal: "Excluir cliente" }],
      entities: [{ type: "client", id: "lead-inventado", name: "Marina", role: "target" }],
    }),
    surface: "portal",
    snapshot: snapshot({ activeEntities: { lead: activeLead }, recentEntities: [activeLead] }),
    workspace: null,
  })

  expect(validated.accepted).toBe(true)
  expect(validated.payload.leadId).toBe("lead-real")
  expect(validated.evidence).toContain("untrusted_entity_ids_removed")
})

test("dados ativos no Snapshot eliminam uma pergunta faltante sugerida pela IA", () => {
  const activeLead = {
    type: "lead" as const,
    id: "lead-marina",
    label: "Marina",
    source: "execution" as const,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "golden-state",
  }
  const validated = validateCosV2Interpretation({
    message: "Ela procura uma sala comercial.",
    interpretation: interpretation({
      turnType: "context",
      objective: { kind: "context", summary: "Registrar preferência comercial." },
      primaryDomain: "properties",
      secondaryDomains: ["clients"],
      intendedAction: null,
      steps: [],
      missingData: ["client"],
      clarificationQuestion: "Qual cliente?",
    }),
    surface: "portal",
    snapshot: snapshot({ activeEntities: { lead: activeLead }, recentEntities: [activeLead] }),
    workspace: null,
  })

  expect(validated.interpretation.missingData).toEqual([])
  expect(validated.interpretation.clarificationQuestion).toBeNull()
})

test("consulta não pode transformar capability mutável em operação escondida", () => {
  const validated = validateCosV2Interpretation({
    message: "Dá para excluir um cliente?",
    interpretation: interpretation({
      turnType: "question",
      objective: { kind: "query", summary: "Perguntar sobre exclusão." },
      intendedAction: "lead.delete",
      steps: [{ action: "lead.delete", goal: "Excluir" }],
    }),
    surface: "portal",
    snapshot: snapshot(),
    workspace: null,
  })

  expect(validated.accepted).toBe(false)
  expect(validated.errors).toContain("query_cannot_execute_mutation")
})

test("pergunta e declaração de contexto nunca iniciam execução escondida", () => {
  const question = validateCosV2Interpretation({
    message: "Você consegue cadastrar um cliente?",
    interpretation: interpretation({
      turnType: "question",
      objective: { kind: "execute", summary: "Cadastrar cliente." },
    }),
    surface: "portal",
    snapshot: snapshot(),
    workspace: null,
  })
  const context = validateCosV2Interpretation({
    message: "Tenho um cliente procurando uma sala.",
    interpretation: interpretation({
      turnType: "context",
      objective: { kind: "query", summary: "Buscar salas." },
      primaryDomain: "properties",
      intendedAction: "property.search",
      steps: [{ action: "property.search", goal: "Buscar" }],
    }),
    surface: "portal",
    snapshot: snapshot(),
    workspace: null,
  })

  expect(question.errors).toContain("question_cannot_start_execution")
  expect(context.errors).toContain("context_cannot_start_execution")
})

test("Response V2 explica Clientes de forma curta sem despejar o Livro", () => {
  const response = getCosV2DomainOverview("clients")
  expect(response).toBe("Clientes é onde você organiza seus contatos e negociações. Posso ajudar a cadastrar, localizar, atualizar informações, acompanhar histórico e relacionar imóveis e documentos.")
  expect(response.length).toBeLessThan(260)
})

test("turno de contexto pergunta somente a entidade que falta", () => {
  const response = buildCosV2ContextResponse(interpretation({
    turnType: "context",
    objective: { kind: "context", summary: "Cliente procura sala comercial." },
    primaryDomain: "properties",
    secondaryDomains: ["clients"],
    intendedAction: null,
    steps: [],
    missingData: ["client"],
    clarificationQuestion: "Qual cliente?",
  }))

  expect(response.text).toBe("Qual cliente?")
  expect(response.pending).toBeUndefined()
})
