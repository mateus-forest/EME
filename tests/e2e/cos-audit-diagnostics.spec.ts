import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { resolveCosIntent } from "@/lib/cos/intent-resolver"
import type {
  CosCapabilityId,
  CosConversationMemory,
  CosEntityModuleId,
  CosPendingInput,
  CosWorkflow,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

const NOW = "2026-08-14T12:00:00.000Z"

function buildWorkflow(input: {
  action: AssessorAction
  capabilityId: CosCapabilityId
  entity: CosEntityModuleId
  pendingInput: CosPendingInput
}): CosWorkflow {
  return {
    id: `diagnostic-${input.capabilityId}`,
    conversationId: "diagnostic-conversation",
    status: "awaiting_input",
    executionPlan: {
      id: `diagnostic-${input.capabilityId}`,
      source: "single",
      reason: "Teste de caracterização da auditoria",
      message: "",
      surface: "portal",
      workspace: null,
      unresolvedGoals: [],
    },
    currentStep: 0,
    steps: [
      {
        id: "step-1",
        order: 0,
        entity: input.entity,
        capabilityId: input.capabilityId,
        action: input.action,
        status: "awaiting_input",
        dependsOn: [],
        durationMs: null,
        errorMessage: null,
        resultResponse: null,
        resultMetadata: null,
      },
    ],
    pendingInput: input.pendingInput,
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    pausedAt: NOW,
    totalPausedMs: 0,
  }
}

function resolve(message: string, input?: {
  activeWorkflow?: CosWorkflow | null
  memory?: CosConversationMemory | null
}) {
  return resolveCosIntent({
    message,
    requestedAction: null,
    attachments: [],
    workspace: null,
    activeWorkflow: input?.activeWorkflow ?? null,
    memory: input?.memory ?? null,
  })
}

test.describe("COS — diagnóstico da arquitetura conversacional atual", () => {
  test("A — criação simples é classificada como cadastro de lead", () => {
    const result = resolve("Cadastre o cliente João da Silva.")

    expect(result.requestedAction).toBe("createLead")
    expect(result.workflowDecision).toBe("start_new")
  })

  test("B — telefone continua o fluxo, mas e-mail posterior perde a edição da entidade criada", () => {
    const workflow = buildWorkflow({
      action: "createLead",
      capabilityId: "lead.create",
      entity: "lead",
      pendingInput: {
        field: "phone",
        label: "Telefone",
        type: "phone",
        required: true,
        entity: "lead",
        action: "createLead",
        parsedData: { extractedName: "Marina" },
      },
    })

    const phone = resolve("Telefone 54 99999-9999.", { activeWorkflow: workflow })
    expect(phone.requestedAction).toBe("createLead")
    expect(phone.workflowDecision).toBe("continue_workflow")

    const email = resolve("Coloca marina@email.com também.", {
      memory: {
        leadId: "lead-marina",
        selectedClient: { id: "lead-marina", label: "Marina" },
        lastAction: "createLead",
        lastUserMessage: "Telefone 54 99999-9999.",
        lastResult: "Cliente criado.",
        updatedAt: NOW,
      },
    })
    expect(email.requestedAction).toBe("CREATE_PROPOSAL")
    expect(email.requestedAction).not.toBe("UPDATE_LEAD")
  })

  test("C — correção de valor abandona o fluxo de proposta em vez de alterar o dado pendente", () => {
    const workflow = buildWorkflow({
      action: "CREATE_PROPOSAL",
      capabilityId: "proposal.create",
      entity: "proposal",
      pendingInput: {
        field: "lead",
        label: "Cliente",
        type: "selection",
        required: true,
        entity: "proposal",
        action: "CREATE_PROPOSAL",
        parsedData: { price: 900_000 },
        options: [{ id: "lead-1", label: "João da Silva" }],
      },
    })

    const result = resolve("Na verdade coloca R$ 850 mil.", { activeWorkflow: workflow })

    expect(result.requestedAction).toBe("LIST_DOCUMENTS")
    expect(result.workflowDecision).toBe("start_new")
  })

  test("D — ordinal funciona apenas no pending; pronome posterior vira analytics", () => {
    const workflow = buildWorkflow({
      action: "searchProperties",
      capabilityId: "property.search",
      entity: "property",
      pendingInput: {
        field: "propertyChoice",
        label: "Imóvel",
        type: "selection",
        required: true,
        entity: "property",
        action: "searchProperties",
        parsedData: {},
        options: [
          { id: "property-1", label: "Apartamento 1" },
          { id: "property-2", label: "Apartamento 2" },
        ],
      },
    })

    const ordinal = resolve("O segundo.", { activeWorkflow: workflow })
    expect(ordinal.requestedAction).toBe("searchProperties")
    expect(ordinal.workflowDecision).toBe("continue_workflow")

    const pronoun = resolve("Quantos metros ele tem?", {
      memory: {
        propertyId: "property-2",
        selectedProperty: { id: "property-2", label: "Apartamento 2" },
        lastAction: "searchProperties",
        lastUserMessage: "O segundo.",
        lastResult: "Apartamento 2",
        updatedAt: NOW,
      },
    })
    expect(pronoun.requestedAction).toBe("GET_ANALYTICS_PROPERTIES")
  })

  test("E — consulta de agenda é classificada como criação; troca para leads inicia novo fluxo", () => {
    const agenda = resolve("Tenho compromisso amanhã?")
    expect(agenda.requestedAction).toBe("CREATE_AGENDA_EVENT")

    const workflow = buildWorkflow({
      action: "CREATE_AGENDA_EVENT",
      capabilityId: "agenda.create",
      entity: "agenda",
      pendingInput: {
        field: "time",
        label: "Horário",
        type: "time",
        required: true,
        entity: "agenda",
        action: "CREATE_AGENDA_EVENT",
        parsedData: { date: "tomorrow" },
      },
    })
    const leads = resolve("E quantos leads entraram essa semana?", { activeWorkflow: workflow })
    expect(leads.requestedAction).toBe("getLeadsSummary")
    expect(leads.workflowDecision).toBe("start_new")
  })

  test("F — retorno aos imóveis não recupera a lista ou o primeiro item anterior", () => {
    const result = resolve("Voltando aos imóveis, abre o primeiro.", {
      memory: {
        leadId: "lead-1",
        selectedClient: { id: "lead-1", label: "Cliente atual" },
        lastAction: "FIND_LEAD",
        lastUserMessage: "Agora quero ver meus clientes.",
        lastResult: "Clientes encontrados.",
        updatedAt: NOW,
      },
    })

    expect(result.requestedAction).toBe("GET_ANALYTICS_PROPERTIES")
    expect(result.requestedAction).not.toBe("searchProperties")
  })

  test("G — pergunta sobre Catálogo e Marketplace é tratada como compartilhamento", () => {
    const result = resolve("Qual a diferença entre catálogo e Marketplace?")

    expect(result.requestedAction).toBe("SHARE_CATALOG")
    expect(result.workflowDecision).toBe("start_new")
  })

  test("H — pergunta de capacidade é interpretada como ordem de execução", () => {
    const result = resolve("Você consegue cadastrar um cliente para mim?")

    expect(result.requestedAction).toBe("createLead")
    expect(result.workflowDecision).toBe("start_new")
  })

  test("I — referência ambígua sem estado não tem resolução", () => {
    const result = resolve("manda aquele")

    expect(result.requestedAction).toBeNull()
    expect(result.candidates).toEqual([])
  })

  test("J — o formatter de workflow ainda contém texto com codificação corrompida", () => {
    const source = readFileSync(join(process.cwd(), "lib/cos/workflow-engine.ts"), "utf8")

    expect(source).toMatch(/Ãƒ|Ã¢/)
  })
})
