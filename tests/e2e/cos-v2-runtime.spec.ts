import { expect, test } from "@playwright/test"

import { cosGoldenV1Conversations, COS_GOLDEN_V1_METADATA } from "@/lib/cos/evals/conversations/golden-v1"
import { resolveCosV2Capability, validateCosV2Interpretation } from "@/lib/cos-v2/capabilities"
import { getCosV2StructuredContextEntities } from "@/lib/cos-v2/context"
import { retrieveCosV2Knowledge } from "@/lib/cos-v2/knowledge"
import { buildCosV2ContextResponse, getCosV2DomainOverview, getCosV2HelpAnswer } from "@/lib/cos-v2/presentation"
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
    helpTopic: null,
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

test("quick action reutiliza cliente e imóvel ativos quando a capability aceita esse contexto", () => {
  const activeLead = {
    type: "lead" as const,
    id: "lead-marina",
    label: "Marina",
    source: "execution" as const,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "conversation-context",
  }
  const activeProperty = {
    type: "property" as const,
    id: "property-office",
    label: "Sala Comercial",
    source: "execution" as const,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "conversation-context",
  }
  const currentSnapshot = snapshot({
    activeEntities: { lead: activeLead, property: activeProperty },
    recentEntities: [activeProperty, activeLead],
  })
  const capability = resolveCosV2Capability("CREATE_PROPOSAL", "portal")
  const entities = getCosV2StructuredContextEntities({ snapshot: currentSnapshot, capability })
  const validated = validateCosV2Interpretation({
    message: "Quero gerar uma proposta.",
    interpretation: interpretation({
      source: "structured_action",
      primaryDomain: "proposals",
      intendedAction: "proposal.create",
      steps: [{ action: "proposal.create", goal: "Gerar proposta" }],
      entities,
    }),
    surface: "portal",
    snapshot: currentSnapshot,
    workspace: null,
  })

  expect(validated.payload.leadId).toBe(activeLead.id)
  expect(validated.payload.propertyId).toBe(activeProperty.id)
})

test("referência ao item anterior usa o conjunto real do ConversationSnapshot", () => {
  const previousLead = {
    type: "lead" as const,
    id: "lead-previous",
    label: "Marina",
    source: "selection" as const,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "selection",
  }
  const activeLead = {
    ...previousLead,
    id: "lead-current",
    label: "Marcela",
  }
  const currentSnapshot = snapshot({
    activeEntities: { lead: activeLead },
    recentEntities: [activeLead, previousLead],
    selectionSets: [{
      id: "lead-options",
      type: "lead",
      items: [
        { index: 0, entity: previousLead },
        { index: 1, entity: activeLead },
      ],
      query: "Mar",
      topicId: null,
      createdAt: NOW,
      expiresAt: "2026-08-15T13:00:00.000Z",
    }],
  })
  const validated = validateCosV2Interpretation({
    message: "Mostre o cliente anterior.",
    interpretation: interpretation({
      objective: { kind: "query", summary: "Consultar o cliente anterior." },
      intendedAction: "lead.find",
      steps: [{ action: "lead.find", goal: "Consultar cliente" }],
    }),
    surface: "portal",
    snapshot: currentSnapshot,
    workspace: null,
  })

  expect(validated.payload.leadId).toBe(previousLead.id)
  expect(validated.evidence).toContain("snapshot_reference:previous_recent_ordinal")
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

test("resposta explicativa nunca é convertida em execução por um action sugerido", () => {
  const validated = validateCosV2Interpretation({
    message: "Como cadastro um cliente?",
    interpretation: interpretation({
      objective: { kind: "answer", summary: "Explicar cadastro de cliente." },
      responseFocus: "how_to",
      helpTopic: "managing_clients",
    }),
    surface: "portal",
    snapshot: snapshot(),
    workspace: null,
  })

  expect(validated.accepted).toBe(true)
  expect(validated.capabilityIds).toEqual([])
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

test("contratos de entrada distinguem requisitos reais de dados opcionais", () => {
  expect(resolveCosV2Capability("lead.create", "portal")?.inputContract).toEqual(expect.objectContaining({ required: ["name"] }))
  expect(resolveCosV2Capability("property.create", "portal")?.inputContract).toEqual(expect.objectContaining({ required: ["price"] }))
  expect(resolveCosV2Capability("proposal.create", "portal")?.inputContract).toEqual(expect.objectContaining({ required: ["client", "property"] }))
  expect(resolveCosV2Capability("agenda.create", "portal")?.inputContract).toEqual(expect.objectContaining({ required: ["time"] }))
})

test("dados opcionais sugeridos pela IA não bloqueiam uma execução válida", () => {
  const validated = validateCosV2Interpretation({
    message: "Cadastre um cliente chamado Marcos.",
    interpretation: interpretation({
      objective: { kind: "context", summary: "Cadastrar Marcos." },
      providedData: [{ field: "name", value: "Marcos" }],
      missingData: ["phone", "email", "cpf", "address", "more_context"],
      clarificationQuestion: "Qual o telefone e os demais dados?",
    }),
    surface: "portal",
    snapshot: snapshot(),
    workspace: null,
  })

  expect(validated.accepted).toBe(true)
  expect(validated.capabilityIds).toEqual(["lead.create"])
  expect(validated.interpretation.objective.kind).toBe("execute")
  expect(validated.interpretation.missingData).toEqual([])
  expect(validated.interpretation.clarificationQuestion).toBeNull()
  expect(validated.payload.name).toBe("Marcos")
})

test("requisito ausente continua com o handler em vez de coletar opcionais", () => {
  const validated = validateCosV2Interpretation({
    message: "Crie um imóvel em rascunho.",
    interpretation: interpretation({
      primaryDomain: "properties",
      intendedAction: "property.create",
      steps: [{ action: "property.create", goal: "Criar imóvel" }],
      missingData: ["price", "city", "neighborhood", "description"],
      clarificationQuestion: "Qual o valor e o endereço completo?",
    }),
    surface: "portal",
    snapshot: snapshot(),
    workspace: null,
  })

  expect(validated.capabilityIds).toEqual(["property.create"])
  expect(validated.interpretation.missingData).toEqual(["price"])
})

test("complemento inequívoco atualiza a entidade recém-criada", () => {
  const activeLead = {
    type: "lead" as const,
    id: "lead-marcos",
    label: "Marcos",
    source: "execution" as const,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "lead.create:completed",
  }
  const recentCreation = {
    capabilityId: "lead.create" as const,
    action: "createLead" as const,
    status: "success" as const,
    entities: [
      activeLead,
      {
        type: "property" as const,
        id: "property-related",
        label: "Imóvel relacionado",
        source: "execution" as const,
        lastMentionedAt: NOW,
        confidence: 1,
        evidence: "lead.create:linked",
      },
    ],
    selectionSetId: null,
    metadata: { leadId: activeLead.id },
    executedAt: NOW,
  }
  const validated = validateCosV2Interpretation({
    message: "O telefone dele é 54999980754.",
    interpretation: interpretation({
      turnType: "correction",
      objective: { kind: "context", summary: "Complementar o telefone do cliente recém-criado." },
      intendedAction: null,
      steps: [],
      providedData: [{ field: "phone", value: "54999980754" }],
    }),
    surface: "portal",
    snapshot: snapshot({
      activeEntities: { lead: activeLead },
      recentEntities: [activeLead],
      recentResults: [recentCreation],
      lastExecution: recentCreation,
    }),
    workspace: null,
  })

  expect(validated.capabilityIds).toEqual(["lead.update"])
  expect(validated.payload.leadId).toBe("lead-marcos")
  expect(validated.payload.phone).toBe("54999980754")
  expect(validated.evidence).toContain("contextual_continuation:lead.update")
})

test("ajuda usa respostas específicas por tópico", () => {
  const firstSteps = getCosV2HelpAnswer("first_steps")
  const usingCos = getCosV2HelpAnswer("using_cos")
  const properties = getCosV2HelpAnswer("registering_properties")

  expect(new Set([firstSteps, usingCos, properties]).size).toBe(3)
  expect(firstSteps).toContain("O EME organiza sua operação")
  expect(usingCos).toContain("linguagem natural")
  expect(properties).toContain("usando IA")
  expect(properties).toContain("por importação")
  expect(properties).toContain("publicá-lo no Catálogo")
})

test("Knowledge recupera somente os capítulos do tópico de ajuda", async () => {
  const [firstSteps, properties] = await Promise.all([
    retrieveCosV2Knowledge({ message: "Primeiros passos", domain: "general", turnType: "question", helpTopic: "first_steps" }),
    retrieveCosV2Knowledge({ message: "Como cadastrar imóveis?", domain: "properties", turnType: "question", helpTopic: "registering_properties" }),
  ])

  expect(firstSteps.selectedDocuments.length).toBeGreaterThan(0)
  expect(firstSteps.selectedDocuments.every((document) => ["eme", "cos"].includes(document.id))).toBe(true)
  expect(properties.selectedDocuments.map((document) => document.id)).toEqual(["imoveis"])
})
