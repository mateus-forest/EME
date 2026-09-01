import { expect, test } from "@playwright/test"

import { applyCosAiDialogueInterpretation, evaluateCosAiDialogueInterpretationTrigger, isCosDialogueDecisionAuthoritativeForCapability, listCosRoutableCapabilityDescriptors, resolveCosDialogueDecision } from "@/lib/cos/conversation-decision"
import { buildCosContextResponse } from "@/lib/cos/conversation"
import { createCosNormalizedContext } from "@/lib/cos/context"
import { findCosExecutionRecipe } from "@/lib/cos/execution-recipes"
import { resolveFastCosAction } from "@/lib/cos/fast-action-resolver"
import { classifyCosPendingReply, createPendingInput, hasCosPendingRejectionFollowUp } from "@/lib/cos/pending-input"
import type {
  CosConversationEntityReference,
  CosConversationSnapshot,
  CosPendingInput,
  CosSemanticInterpretationInput,
  CosWorkflow,
} from "@/lib/cos/types"

const NOW = "2026-08-14T12:00:00.000Z"

function entity(type: CosConversationEntityReference["type"], id: string, label: string): CosConversationEntityReference {
  return {
    type,
    id,
    label,
    source: "execution",
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "decision-test",
  }
}

function snapshot(overrides: Partial<CosConversationSnapshot> = {}): CosConversationSnapshot {
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

function workflow(action: CosWorkflow["steps"][number]["action"], capabilityId: CosWorkflow["steps"][number]["capabilityId"], pendingInput: CosPendingInput): CosWorkflow {
  return {
    id: `workflow-${capabilityId}`,
    conversationId: "conversation",
    status: "awaiting_input",
    executionPlan: {
      id: `plan-${capabilityId}`,
      source: "single",
      reason: "decision-test",
      message: "",
      surface: "portal",
      workspace: null,
      unresolvedGoals: [],
    },
    currentStep: 0,
    steps: [{
      id: "step-1",
      order: 0,
      entity: pendingInput.entity,
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

function decide(message: string, input: {
  snapshot?: CosConversationSnapshot | null
  workflow?: CosWorkflow | null
  requestedAction?: string | null
} = {}) {
  return resolveCosDialogueDecision({
    message,
    requestedAction: input.requestedAction ?? null,
    surface: "portal",
    workspace: null,
    snapshot: input.snapshot ?? null,
    activeWorkflow: input.workflow ?? null,
    memory: null,
    attachments: [],
  })
}

function proposalWorkflow() {
  const pending = createPendingInput({
    field: "lead",
    type: "selection",
    action: "CREATE_PROPOSAL",
    entity: "proposal",
    capabilityId: "proposal.create",
    parsedData: { price: 90_000_000 },
    options: [{ id: "lead-1", label: "João" }],
    now: new Date(NOW),
  })
  return workflow("CREATE_PROPOSAL", "proposal.create", pending)
}

function phoneWorkflow() {
  const pending = createPendingInput({
    field: "phone",
    type: "phone",
    action: "createLead",
    entity: "lead",
    capabilityId: "lead.create",
    parsedData: { extractedName: "Marina" },
    now: new Date(NOW),
  })
  return workflow("createLead", "lead.create", pending)
}

function propertySelectionSnapshot() {
  const propertyTopic = {
    id: "topic-properties",
    domain: "property" as const,
    label: "Imóveis em Porto Alegre",
    entityType: "property" as const,
    selectionSetId: "selection-properties",
    startedAt: NOW,
    lastMentionedAt: NOW,
  }
  return snapshot({
    currentTopic: propertyTopic,
    selectionSets: [{
      id: "selection-properties",
      type: "property",
      items: [
        { index: 1, entity: entity("property", "property-1", "Apartamento Centro") },
        { index: 2, entity: entity("property", "property-2", "Casa Moinhos") },
      ],
      query: "imóveis em Porto Alegre",
      topicId: propertyTopic.id,
      createdAt: NOW,
      expiresAt: "2026-08-20T12:00:00.000Z",
    }],
  })
}

function semanticInterpretation(overrides: Partial<CosSemanticInterpretationInput> = {}): CosSemanticInterpretationInput {
  return {
    dialogueAct: "query",
    objective: {
      mode: "query",
      summary: "consultar o outro imóvel da seleção",
      targetCapabilityId: "property.get",
    },
    primaryDomain: "property",
    secondaryDomains: [],
    entities: [],
    references: [{
      expression: "o outro",
      type: "property",
      id: "property-2",
      label: "Casa Moinhos",
      relation: "alternative",
    }],
    filters: [],
    corrections: [],
    confidence: 0.93,
    needsClarification: false,
    clarificationQuestion: null,
    ...overrides,
  }
}

test.describe("COS — Decision Layer da Etapa 2C", () => {
  test("A — execução explícita", () => {
    const result = decide("Cadastre o cliente João da Silva.")
    expect(result.dialogueAct).toBe("execute")
    expect(result.primaryDomain).toBe("lead")
    expect(result.selectedAction).toBe("createLead")
  })

  test("B — pergunta de capacidade não executa cadastro", () => {
    const result = decide("Você consegue cadastrar um cliente?")
    expect(result.dialogueAct).toBe("capability_question")
    expect(result.primaryDomain).toBe("lead")
    expect(result.objective.targetCapabilityId).toBe("lead.create")
    expect(result.selectedAction).toBe("general")
  })

  test("C — agenda query usa consulta", () => {
    const result = decide("Tenho compromisso amanhã?")
    expect(result.dialogueAct).toBe("query")
    expect(result.primaryDomain).toBe("agenda")
    expect(result.selectedAction).toBe("LIST_AGENDA_EVENTS")
  })

  test("D — agenda execute usa criação", () => {
    const result = decide("Crie um compromisso amanhã às 15h.")
    expect(result.dialogueAct).toBe("execute")
    expect(result.primaryDomain).toBe("agenda")
    expect(result.selectedAction).toBe("CREATE_AGENDA_EVENT")
  })

  for (const [message, capabilityId] of [
    ["Quanto recebi este mês?", "finance.cashflow"],
    ["Quanto tenho a receber?", "finance.receivable"],
    ["Quais comissões estão atrasadas?", "finance.commission"],
    ["Quanto gastei este mês?", "finance.payable"],
    ["Qual o valor da minha carteira?", "finance.summary"],
    ["Quais são meus próximos recebimentos?", "finance.forecast"],
  ] as const) {
    test(`financeiro somente leitura: ${message}`, () => {
      const result = decide(message)
      expect(result.dialogueAct).toBe("query")
      expect(result.primaryDomain).toBe("finance")
      expect(result.objective.targetCapabilityId).toBe(capabilityId)
      const descriptor = listCosRoutableCapabilityDescriptors("portal").find((item) => item.id === capabilityId)
      expect(descriptor?.mutatesData).toBe(false)
      expect(descriptor?.requiresConfirmation).toBe(false)
    })
  }

  test("E — correção preserva a proposta atual", () => {
    const active = proposalWorkflow()
    const result = decide("Na verdade coloca 850 mil.", { workflow: active, snapshot: snapshot({ activeWorkflow: active, pendingInput: active.pendingInput }) })
    expect(result.dialogueAct).toBe("correct")
    expect(result.primaryDomain).toBe("proposal")
    expect(result.selectedAction).toBe("CREATE_PROPOSAL")
    expect(result.workflowDecision).toBe("continue_workflow")
  })

  test("F — pronome consulta o imóvel ativo, não analytics", () => {
    const property = entity("property", "property-2", "Casa B")
    const result = decide("Quantos metros ele tem?", { snapshot: snapshot({ activeEntities: { property }, recentEntities: [property] }) })
    expect(result.dialogueAct).toBe("query")
    expect(result.primaryDomain).toBe("property")
    expect(result.reference.id).toBe("property-2")
    expect(result.selectedAction).toBe("GET_PROPERTY")
  })

  test("G — explicação não compartilha catálogo", () => {
    const result = decide("Qual a diferença entre catálogo e Marketplace?")
    expect(result.dialogueAct).toBe("explain")
    expect(result.primaryDomain).toBe("catalog")
    expect(result.secondaryDomains).toContain("marketplace")
    expect(result.selectedAction).toBe("help_general_question")
    expect(result.selectedAction).not.toBe("SHARE_CATALOG")
  })

  test("H — retorno usa tópico e selection set anteriores", () => {
    const properties = propertySelectionSnapshot()
    const leadTopic = {
      id: "topic-leads",
      domain: "lead" as const,
      label: "Clientes",
      entityType: "lead" as const,
      selectionSetId: null,
      startedAt: NOW,
      lastMentionedAt: NOW,
    }
    const result = decide("Voltando aos imóveis, abre o primeiro.", {
      snapshot: { ...properties, currentTopic: leadTopic, recentTopics: [properties.currentTopic!] },
    })
    expect(result.dialogueAct).toBe("return_topic")
    expect(result.primaryDomain).toBe("property")
    expect(result.reference.id).toBe("property-1")
    expect(result.selectedAction).toBe("GET_PROPERTY")
  })

  test("I — telefone responde ao pending", () => {
    const active = phoneWorkflow()
    const result = decide("54 99999-9999", { workflow: active, snapshot: snapshot({ activeWorkflow: active, pendingInput: active.pendingInput }) })
    expect(result.dialogueAct).toBe("provide_input")
    expect(result.selectedAction).toBe("createLead")
  })

  test("J — pergunta de imóvel interrompe pending de telefone", () => {
    const active = phoneWorkflow()
    const result = decide("Quantos imóveis tenho publicados?", {
      workflow: active,
      snapshot: snapshot({
        activeWorkflow: active,
        pendingInput: active.pendingInput,
        currentTopic: {
          id: "topic-lead",
          domain: "lead",
          label: "Cadastro da Marina",
          entityType: "lead",
          selectionSetId: null,
          startedAt: NOW,
          lastMentionedAt: NOW,
        },
      }),
    })
    expect(result.dialogueAct).toBe("switch_topic")
    expect([result.primaryDomain, ...result.secondaryDomains]).toContain("property")
    expect(result.selectedAction).not.toBe("createLead")
    expect(result.workflowDecision).toBe("start_new")
  })

  test("K — não isolado rejeita confirmação pendente", () => {
    const pending = createPendingInput({
      field: "confirmation",
      type: "confirmation",
      action: "DELETE_LEAD",
      entity: "lead",
      capabilityId: "lead.delete",
      now: new Date(NOW),
    })
    const active = workflow("DELETE_LEAD", "lead.delete", pending)
    expect(decide("não", { workflow: active }).dialogueAct).toBe("reject")
  })

  test("L — não com novo valor é correção", () => {
    const active = proposalWorkflow()
    expect(decide("não, o valor é 850 mil", { workflow: active }).dialogueAct).toBe("correct")
  })

  test("M — ordinal seleciona item da lista", () => {
    const result = decide("o segundo", { snapshot: propertySelectionSnapshot() })
    expect(result.dialogueAct).toBe("select")
    expect(result.reference.id).toBe("property-2")
    expect(result.selectedAction).toBe("GET_PROPERTY")
  })

  test("N — telefone consulta cliente ativo", () => {
    const lead = entity("lead", "lead-joao", "João")
    const result = decide("qual o telefone dela?", { snapshot: snapshot({ activeEntities: { lead }, recentEntities: [lead] }) })
    expect(result.dialogueAct).toBe("query")
    expect(result.primaryDomain).toBe("lead")
    expect(result.reference.id).toBe("lead-joao")
    expect(result.selectedAction).toBe("FIND_LEAD")
  })

  test("O — objetivo multi-step permite recipe dependente", () => {
    const message = "Cadastre a Ana e depois crie uma proposta para o imóvel da Rua X."
    const decision = decide(message)
    const recipe = findCosExecutionRecipe({ message, workspace: null, decision })
    expect(decision.dialogueAct).toBe("execute")
    expect(decision.primaryDomain).toBe("lead")
    expect(decision.selectedAction).toBe("createLead")
    expect(recipe?.id).toBe("lead_create_then_proposal")
  })
})

test.describe("COS — decisão de agenda", () => {
  for (const scenario of [
    ["Quais compromissos tenho hoje?", "query", "LIST_AGENDA_TODAY"],
    ["Mostre meus compromissos de amanhã.", "query", "LIST_AGENDA_EVENTS"],
    ["Como está minha agenda da semana?", "query", "LIST_AGENDA_WEEK"],
    ["Qual é meu próximo compromisso?", "query", "LIST_AGENDA_EVENTS"],
    ["Crie um compromisso amanhã às 15h.", "execute", "CREATE_AGENDA_EVENT"],
    ["Altere o compromisso para amanhã às 16h.", "execute", "UPDATE_AGENDA_EVENT"],
    ["Cancele o compromisso de amanhã.", "execute", "CANCEL_AGENDA_EVENT"],
    ["Conclua o compromisso de hoje.", "execute", "MARK_AGENDA_DONE"],
  ] as const) {
    test(`${scenario[0]} → ${scenario[2]}`, () => {
      const result = decide(scenario[0])
      expect(result.dialogueAct).toBe(scenario[1])
      expect(result.primaryDomain).toBe("agenda")
      expect(result.selectedAction).toBe(scenario[2])
    })
  }
})

test.describe("COS — linguagem natural e continuidade operacional", () => {
  test("busca para cliente usa property como alvo e lead como contexto", () => {
    const carlos = entity("lead", "lead-carlos", "Carlos Mendes")
    const result = decide("Procura alguma coisa pro Carlos.", {
      snapshot: snapshot({ activeEntities: { lead: carlos }, recentEntities: [carlos] }),
    })
    expect(result.dialogueAct).toBe("query")
    expect(result.primaryDomain).toBe("property")
    expect(result.secondaryDomains).toContain("lead")
    expect(result.reference.id).toBe("lead-carlos")
    expect(result.selectedCapabilityId).toBe("property.search")
  })

  test("refinamentos curtos mantêm busca e filtros no contexto de imóveis", () => {
    const carlos = entity("lead", "lead-carlos", "Carlos Mendes")
    const propertyTopic = {
      id: "topic-property-search",
      domain: "property" as const,
      label: "Busca para Carlos",
      entityType: "property" as const,
      selectionSetId: null,
      startedAt: NOW,
      lastMentionedAt: NOW,
    }
    const context = snapshot({
      currentTopic: propertyTopic,
      activeEntities: { lead: carlos },
      recentEntities: [carlos],
      lastAction: "searchProperties",
    })
    for (const message of ["Só até 700.", "E com duas vagas?"]) {
      const result = decide(message, { snapshot: context })
      expect.soft(result.dialogueAct).toBe("query")
      expect.soft(result.primaryDomain).toBe("property")
      expect.soft(result.selectedCapabilityId).toBe("property.search")
    }
  })

  test("sobrenome resolve seleção pendente sem trocar a capability do fluxo", () => {
    const pending = createPendingInput({
      field: "leadChoice",
      type: "selection",
      action: "searchProperties",
      entity: "property",
      capabilityId: "property.search",
      options: [
        { id: "lead-carlos-mendes", label: "Carlos Mendes" },
        { id: "lead-carlos-mendonca", label: "Carlos Mendonça" },
      ],
      now: new Date(NOW),
    })
    const active = workflow("searchProperties", "property.search", pending)
    const result = decide("Mendes.", {
      workflow: active,
      snapshot: snapshot({ activeWorkflow: active, pendingInput: pending }),
    })
    expect(result.dialogueAct).toBe("select")
    expect(result.reference.id).toBe("lead-carlos-mendes")
    expect(result.selectedCapabilityId).toBe("property.search")
  })

  test("alternativa de uma lista vira consulta do outro item, não nova busca", () => {
    const result = decide("E o outro?", { snapshot: propertySelectionSnapshot() })
    expect(result.dialogueAct).toBe("query")
    expect(result.reference.id).toBe("property-2")
    expect(result.selectedCapabilityId).toBe("property.get")
  })

  test("ranking sem dados mantém a capability e pede seleção sem escolher item", () => {
    const result = decide("O mais barato.", { snapshot: propertySelectionSnapshot() })
    expect(result.dialogueAct).toBe("select")
    expect(result.reference.id).toBeNull()
    expect(result.selectedCapabilityId).toBe("property.get")
    expect(result.needsClarification).toBe(true)
  })

  test("filtro temporal explícito vence o período anterior", () => {
    const result = decide("E amanhã?", {
      snapshot: snapshot({
        currentTopic: {
          id: "topic-agenda",
          domain: "agenda",
          label: "Agenda de hoje",
          entityType: "agenda",
          selectionSetId: null,
          startedAt: NOW,
          lastMentionedAt: NOW,
        },
        lastAction: "LIST_AGENDA_TODAY",
      }),
    })
    expect(result.dialogueAct).toBe("query")
    expect(result.selectedCapabilityId).toBe("agenda.list")
  })

  test("confirmações informais usam o mesmo classificador da execução", () => {
    const pending = createPendingInput({
      field: "confirmation",
      type: "confirmation",
      action: "DELETE_LEAD",
      entity: "lead",
      capabilityId: "lead.delete",
      parsedData: { leadId: "lead-roberto" },
      now: new Date(NOW),
    })
    const active = workflow("DELETE_LEAD", "lead.delete", pending)
    for (const message of ["Sim!", "s", "ok", "Pode.", "seguir", "Manda bala.", "Beleza.", "Combinado."]) {
      expect.soft(decide(message, { workflow: active }).dialogueAct).toBe("confirm")
      expect.soft(classifyCosPendingReply(message)).toBe("confirm")
    }
    expect(classifyCosPendingReply("Não, deixa.")).toBe("reject")
    expect(classifyCosPendingReply("Não deixa.")).toBe("answer")
    expect(decide("Não, deixa.", { workflow: active }).dialogueAct).toBe("reject")
    expect(decide("Não cancela.", { workflow: active }).dialogueAct).toBe("provide_input")
    expect(classifyCosPendingReply("não cancela")).toBe("answer")
    expect(classifyCosPendingReply("não deixa pra lá")).toBe("answer")
  })

  test("recusa com consulta residual troca de ação; negativa pura não inverte intenção", () => {
    const roberto = entity("lead", "lead-roberto", "Roberto Lima")
    const pending = createPendingInput({
      field: "confirmation",
      type: "confirmation",
      action: "DELETE_LEAD",
      entity: "lead",
      capabilityId: "lead.delete",
      parsedData: { leadId: roberto.id },
      now: new Date(NOW),
    })
    const active = workflow("DELETE_LEAD", "lead.delete", pending)
    const result = decide("Não, só queria ver o cadastro.", {
      workflow: active,
      snapshot: snapshot({ activeWorkflow: active, pendingInput: pending, activeEntities: { lead: roberto }, recentEntities: [roberto] }),
    })
    expect(result.dialogueAct).toBe("reject")
    expect(result.selectedCapabilityId).toBe("lead.find")
    expect(result.workflowDecision).toBe("start_new")
    expect(hasCosPendingRejectionFollowUp("Não quero abrir o cadastro.")).toBe(false)
    expect(hasCosPendingRejectionFollowUp("Não preciso ver os detalhes.")).toBe(false)
  })

  test("pronome locativo preserva entidade e capability do tópico", () => {
    const property = entity("property", "property-studio", "Solar Comercial")
    const result = decide("Faz nele.", {
      snapshot: snapshot({
        currentTopic: {
          id: "topic-studio",
          domain: "studio",
          label: "Campanha do Solar",
          entityType: "property",
          selectionSetId: null,
          startedAt: NOW,
          lastMentionedAt: NOW,
        },
        activeEntities: { property },
        recentEntities: [property],
        lastAction: "STUDIO_GENERATE_CAMPAIGN",
      }),
    })
    expect(result.dialogueAct).toBe("execute")
    expect(result.reference.id).toBe("property-studio")
    expect(result.primaryDomain).toBe("studio")
    expect(result.selectedCapabilityId).toBe("studio.generateCampaign")
  })

  test("abertura por nome curto sem contexto não escolhe silenciosamente um tipo", () => {
    const result = decide("Abre o Solar.")
    expect(result.dialogueAct).toBe("query")
    expect(result.reference.id).toBeNull()
    expect(result.primaryDomain).toBe("general")
    expect(result.needsClarification).toBe(true)
  })

  test("referência resolvida decide entre cliente e imóvel sem heurística pelo nome", () => {
    const carlos = entity("lead", "lead-carlos", "Carlos")
    const result = decide("Mostra Carlos.", {
      snapshot: snapshot({ activeEntities: { lead: carlos }, recentEntities: [carlos] }),
    })
    expect(result.primaryDomain).toBe("lead")
    expect(result.selectedCapabilityId).toBe("lead.find")
  })

  test("ação explícita nova não é sequestrada pelo pending anterior", () => {
    const active = phoneWorkflow()
    const result = decide("Criar proposta", {
      workflow: active,
      snapshot: snapshot({ activeWorkflow: active, pendingInput: active.pendingInput }),
      requestedAction: "CREATE_PROPOSAL",
    })
    expect(result.dialogueAct).toBe("execute")
    expect(result.selectedCapabilityId).toBe("proposal.create")
    expect(result.workflowDecision).toBe("start_new")
  })

  test("pedido de assinatura nativa reconhece o gap sem escolher outra mutação", () => {
    for (const message of ["Assine o contrato do João.", "Assinar este contrato?", "O cliente consegue assinar contrato pelo EME?"]) {
      const result = decide(message)
      expect.soft(result.primaryDomain).toBe("contract")
      expect.soft(result.selectedCapabilityId).toBeNull()
      expect.soft(result.selectedAction).toBeNull()
    }
  })

  test("pergunta geral usa ajuda geral e capacidade declarada usa ajuda do COS", () => {
    const howTo = decide("Como excluo?")
    expect(howTo.primaryDomain).toBe("general")
    expect(howTo.selectedCapabilityId).toBe("help.general_question")

    const capabilities = decide("O que você consegue fazer?")
    expect(capabilities.primaryDomain).toBe("general")
    expect(capabilities.selectedCapabilityId).toBe("help.use_cos")
  })

  test("ajuda por área e orientação inicial permanecem explicativas", () => {
    const clients = decide("Como funciona Clientes?")
    expect(clients).toMatchObject({
      dialogueAct: "explain",
      primaryDomain: "lead",
      selectedCapabilityId: "help.manage_clients",
      needsClarification: false,
    })

    const firstSteps = decide("Como começo?")
    expect(firstSteps).toMatchObject({
      dialogueAct: "explain",
      selectedCapabilityId: "help.first_steps",
      needsClarification: false,
    })
  })

  test("relato de contexto não inicia operação e pergunta somente a referência ausente", () => {
    const result = decide("Tenho um cliente procurando sala comercial.")

    expect(result).toMatchObject({
      dialogueAct: "context",
      primaryDomain: "lead",
      selectedCapabilityId: "general.chat",
      selectedAction: "general",
      needsClarification: false,
    })
    expect(result.secondaryDomains).toContain("property")
    expect(buildCosContextResponse(result)).toBe("Qual cliente?")

    for (const operationalQuery of ["Quero buscar imóveis em Curitiba.", "Preciso ver meus clientes."]) {
      expect(decide(operationalQuery).dialogueAct).toBe("query")
    }
  })

  test("decisão válida é autoritativa para o Planner", () => {
    const decision = decide("Mostre meus clientes.")
    expect(decision.selectedCapabilityId).not.toBeNull()
    expect(isCosDialogueDecisionAuthoritativeForCapability({
      decision,
      capabilityId: decision.selectedCapabilityId!,
    })).toBe(true)
    expect(isCosDialogueDecisionAuthoritativeForCapability({
      decision,
      capabilityId: "contract.list",
    })).toBe(false)
  })

  test("recomendação de divulgação usa o Studio sem iniciar geração", () => {
    const property = entity("property", "property-studio", "Solar Comercial")
    const result = decide("Preciso divulgar mais esse imóvel. O que você recomenda?", {
      snapshot: snapshot({ activeEntities: { property }, recentEntities: [property] }),
    })
    expect(result.dialogueAct).toBe("query")
    expect(result.primaryDomain).toBe("studio")
    expect(result.secondaryDomains).toContain("property")
    expect(result.selectedCapabilityId).toBe("help.marketing_studio")
  })

  test("completude temporal exige um horário explícito", () => {
    const missingTime = decide("Marca um compromisso dia 20.")
    expect(missingTime.selectedCapabilityId).toBe("agenda.create")
    expect(missingTime.needsClarification).toBe(true)
    expect(missingTime.clarificationReason).toBe("agenda_time_missing")

    const withTime = decide("Cria um compromisso amanhã às 15.")
    expect(withTime.selectedCapabilityId).toBe("agenda.create")
    expect(withTime.clarificationReason).not.toBe("agenda_time_missing")
  })

  test("limite de preço não é confundido com localização da busca encadeada", () => {
    const missingLocation = decide("Cadastra Ana e procura apartamento no máximo 600 mil.")
    expect(missingLocation.selectedCapabilityId).toBe("lead.create")
    expect(missingLocation.needsClarification).toBe(true)
    expect(missingLocation.clarificationReason).toBe("property_search_location_missing")

    const withLocation = decide("Cadastra Ana e procura apartamento em Porto Alegre até 600 mil.")
    expect(withLocation.selectedCapabilityId).toBe("lead.create")
    expect(withLocation.clarificationReason).not.toBe("property_search_location_missing")

    const purpose = decide("Procura apartamentos para venda em São Paulo.")
    expect(purpose.selectedCapabilityId).toBe("property.search")
    expect(purpose.clarificationReason).not.toBe("property_search_context_incomplete")
  })

  test("proposta encadeada aguarda imóvel sem perder o cliente criado", () => {
    const result = decide("Cadastra Lucas e cria uma proposta pra ele.")
    expect(result.selectedCapabilityId).toBe("lead.create")
    expect(result.secondaryDomains).toContain("proposal")
    expect(result.needsClarification).toBe(true)
    expect(result.clarificationReason).toBe("proposal_property_missing")
  })

  test("operações multi-entidade não tratam primeiro nome como cliente inequívoco", () => {
    const property = entity("property", "property-solar", "Solar Comercial")
    for (const message of [
      "Faz uma proposta pro Carlos no Solar Comercial.",
      "Marca visita no Solar Comercial com Carlos amanhã às 15.",
    ]) {
      const result = decide(message, {
        snapshot: snapshot({ activeEntities: { property }, recentEntities: [property] }),
      })
      expect.soft(result.needsClarification).toBe(true)
      expect.soft(result.clarificationReason).toBe("lead_target_ambiguous")
    }

    for (const completeMessage of [
      "Cria uma proposta do Solar Comercial para Carlos Mendes.",
      "Cria uma proposta com entrada de 100 mil do Solar Comercial para Carlos Mendes.",
    ]) {
      expect(decide(completeMessage).clarificationReason).not.toBe("lead_target_ambiguous")
    }
  })
})

test.describe("COS — cobertura do Registry e perguntas de capacidade", () => {
  test("deriva 74 actions roteáveis do Registry do portal", () => {
    const descriptors = listCosRoutableCapabilityDescriptors("portal")
    const actions = new Set(descriptors.map((descriptor) => descriptor.action))
    expect(descriptors).toHaveLength(74)
    expect(actions.size).toBe(74)
    for (const action of ["LIST_AGENDA_TODAY", "LIST_AGENDA_WEEK", "GET_FINANCE_CASHFLOW", "CONTRACT_PREVIEW", "GET_PROPERTY", "createInternalNotification"]) {
      expect(actions.has(action as never)).toBe(true)
    }
  })

  for (const scenario of [
    ["Você consegue cadastrar um imóvel?", "property", "property.create"],
    ["Dá para criar uma proposta por aqui?", "proposal", "proposal.create"],
    ["Você consegue criar um contrato?", "contract", "contract.create"],
    ["Você consegue marcar um compromisso?", "agenda", "agenda.create"],
    ["Dá para gerar um vídeo no Studio IA?", "studio", "studio.generateVideo"],
  ] as const) {
    test(`${scenario[0]} não executa`, () => {
      const result = decide(scenario[0])
      expect(result.dialogueAct).toBe("capability_question")
      expect(result.primaryDomain).toBe(scenario[1])
      expect(result.objective.targetCapabilityId).toBe(scenario[2])
      expect(result.selectedAction).toBe("general")
    })
  }
})

test.describe("COS — interpretação semântica validada", () => {
  test("aceita relato contextual sem convertê-lo em operação", () => {
    const baseline = decide("Tenho um cliente procurando sala comercial.")
    const validated = applyCosAiDialogueInterpretation({
      baseline,
      interpretation: semanticInterpretation({
        dialogueAct: "context",
        objective: { mode: "respond", summary: "registrar contexto de busca do cliente", targetCapabilityId: "general.chat" },
        primaryDomain: "lead",
        secondaryDomains: ["property"],
        references: [],
        confidence: 0.94,
      }),
      surface: "portal",
      workspace: null,
      snapshot: null,
      activeWorkflow: null,
    })

    expect(validated.accepted).toBe(true)
    expect(validated.decision).toMatchObject({
      dialogueAct: "context",
      selectedCapabilityId: "general.chat",
      selectedAction: "general",
      needsClarification: false,
    })
  })

  test("usa a alternativa do working set sem aceitar ids inventados", () => {
    const currentSnapshot = propertySelectionSnapshot()
    const baseline = decide("Faz com o outro.", { snapshot: currentSnapshot })
    const validated = applyCosAiDialogueInterpretation({
      baseline,
      interpretation: semanticInterpretation(),
      surface: "portal",
      workspace: null,
      snapshot: currentSnapshot,
      activeWorkflow: null,
    })

    expect(validated.accepted).toBe(true)
    expect(validated.decision.source).toBe("ai_interpretation")
    expect(validated.decision.selectedCapabilityId).toBe("property.get")
    expect(validated.decision.reference.id).toBe("property-2")

    const context = createCosNormalizedContext({
      brokerId: "broker",
      userId: "user",
      surface: "portal",
      message: "Faz com o outro.",
      workspace: null,
      workflow: null,
      memory: null,
      snapshot: currentSnapshot,
      decision: validated.decision,
    })
    expect(context.selectedEntityIds.property).toBe("property-2")

    const invented = applyCosAiDialogueInterpretation({
      baseline,
      interpretation: semanticInterpretation({
        references: [{
          expression: "o outro",
          type: "property",
          id: "property-inventado",
          label: "Imóvel inventado",
          relation: "alternative",
        }],
      }),
      surface: "portal",
      workspace: null,
      snapshot: currentSnapshot,
      activeWorkflow: null,
    })
    expect(invented.decision.semanticInterpretation?.references[0].id).toBeNull()
    expect(invented.decision.semanticInterpretation?.validationEvidence).toContain("reference_id_removed:property-inventado")
  })

  test("Registry, surface e limiar de mutação continuam soberanos", () => {
    const currentSnapshot = propertySelectionSnapshot()
    const baseline = decide("Publica aquele imóvel.", { snapshot: currentSnapshot })
    const inventedCapability = applyCosAiDialogueInterpretation({
      baseline,
      interpretation: semanticInterpretation({
        dialogueAct: "execute",
        objective: { mode: "execute", summary: "publicar imóvel", targetCapabilityId: "property.magic" },
      }),
      surface: "portal",
      workspace: null,
      snapshot: currentSnapshot,
      activeWorkflow: null,
    })
    expect(inventedCapability.accepted).toBe(false)
    expect(inventedCapability.validationErrors).toContain("capability_not_in_registry:property.magic")

    const lowConfidenceMutation = applyCosAiDialogueInterpretation({
      baseline,
      interpretation: semanticInterpretation({
        dialogueAct: "execute",
        objective: { mode: "execute", summary: "publicar imóvel", targetCapabilityId: "property.publish" },
        confidence: 0.61,
      }),
      surface: "portal",
      workspace: null,
      snapshot: currentSnapshot,
      activeWorkflow: null,
    })
    expect(lowConfidenceMutation.accepted).toBe(true)
    expect(lowConfidenceMutation.decision.selectedAction).toBeNull()
    expect(lowConfidenceMutation.decision.needsClarification).toBe(true)
    expect(lowConfidenceMutation.decision.clarificationReason).toBe("semantic_confidence_below_risk_threshold")
  })

  test("preserva botões e pending simples no caminho determinístico", () => {
    const contextual = decide("Procura alguma coisa boa pra ele.", {
      snapshot: snapshot({ activeEntities: { lead: entity("lead", "lead-1", "Carlos") } }),
    })
    expect(evaluateCosAiDialogueInterpretationTrigger({
      message: "Procura alguma coisa boa pra ele.",
      pendingInput: null,
      decision: contextual,
      attachments: [],
    })).toEqual({ shouldTry: true, triggerReason: "contextual_reference" })

    const pendingWorkflow = phoneWorkflow()
    const phoneDecision = decide("(11) 99999-0000", { workflow: pendingWorkflow })
    expect(evaluateCosAiDialogueInterpretationTrigger({
      message: "(11) 99999-0000",
      pendingInput: pendingWorkflow.pendingInput,
      decision: phoneDecision,
      attachments: [],
    }).shouldTry).toBe(false)

    const structuredPendingCases = [
      {
        message: "850 mil",
        pending: createPendingInput({
          field: "price",
          type: "currency",
          action: "CREATE_PROPOSAL",
          entity: "proposal",
          capabilityId: "proposal.create",
          now: new Date(NOW),
        }),
      },
      {
        message: "16h30",
        pending: createPendingInput({
          field: "time",
          type: "time",
          action: "CREATE_AGENDA_EVENT",
          entity: "agenda",
          capabilityId: "agenda.create",
          now: new Date(NOW),
        }),
      },
    ]
    for (const pendingCase of structuredPendingCases) {
      const activeWorkflow = workflow(pendingCase.pending.action, pendingCase.pending.capabilityId!, pendingCase.pending)
      const decision = decide(pendingCase.message, { workflow: activeWorkflow })
      expect(evaluateCosAiDialogueInterpretationTrigger({
        message: pendingCase.message,
        pendingInput: pendingCase.pending,
        decision,
        attachments: [],
      }).shouldTry).toBe(false)
    }

    const selectionWorkflow = proposalWorkflow()
    const selectionDecision = decide("1", { workflow: selectionWorkflow })
    expect(evaluateCosAiDialogueInterpretationTrigger({
      message: "1",
      pendingInput: selectionWorkflow.pendingInput,
      decision: selectionDecision,
      attachments: [],
    }).shouldTry).toBe(false)

    const buttonDecision = decide("Publicar imóvel", {
      snapshot: propertySelectionSnapshot(),
      requestedAction: "PUBLISH_PROPERTY",
    })
    expect(evaluateCosAiDialogueInterpretationTrigger({
      message: "Publicar imóvel",
      requestedAction: "PUBLISH_PROPERTY",
      structuredInteraction: true,
      pendingInput: null,
      decision: buttonDecision,
      attachments: [],
    }).shouldTry).toBe(false)
  })

  test("CTAs de desambiguação carregam ação ou navegação estruturada", () => {
    const currentSnapshot = propertySelectionSnapshot()
    const context = createCosNormalizedContext({
      brokerId: "broker",
      userId: "user",
      surface: "portal",
      message: "Editar imóvel",
      workspace: { surface: "portal", page: "properties", entity: "property", entityId: "property-1", selection: [], metadata: {} },
      workflow: null,
      memory: null,
      snapshot: currentSnapshot,
    })
    const edit = resolveFastCosAction({ message: "Editar imóvel", workspace: context.workspace, context })
    expect(edit.kind).toBe("clarify")
    if (edit.kind === "clarify") {
      expect(edit.options.map((option) => option.action)).toEqual([
        "UPDATE_PROPERTY_MEDIA",
        "improvePropertyDescription",
        "PUBLISH_PROPERTY",
      ])
    }

    const navigation = resolveFastCosAction({ message: "Abrir", workspace: null, context: null })
    expect(navigation.kind).toBe("clarify")
    if (navigation.kind === "clarify") {
      expect(navigation.options.every((option) => Boolean(option.href))).toBe(true)
    }
  })

  for (const [message, triggerReason] of [
    ["Antes disso, mostra o histórico daquele cliente.", "contextual_reference"],
    ["Na verdade, troca o horário para 16h.", "contextual_correction"],
    ["Cadastra a Ana e depois procura uma casa para ela.", "contextual_reference"],
    ["Compara os dois e recomenda o melhor.", "recommendation_or_comparison"],
  ] as const) {
    test(`aciona IA semântica para: ${message}`, () => {
      const currentSnapshot = propertySelectionSnapshot()
      const decision = decide(message, { snapshot: currentSnapshot })
      expect(evaluateCosAiDialogueInterpretationTrigger({
        message,
        pendingInput: null,
        decision,
        attachments: [],
      })).toEqual({ shouldTry: true, triggerReason })
    })
  }
})
