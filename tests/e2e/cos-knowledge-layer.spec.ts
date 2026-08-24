import { expect, test } from "@playwright/test"

import { getCosCapabilityDescriptorById } from "@/lib/cos/capability-catalog"
import { resolveCosDialogueDecision } from "@/lib/cos/conversation-decision"
import {
  clearCosKnowledgeIndexCacheForTests,
  COS_KNOWLEDGE_SOURCE_CHUNK_CHARS,
  loadCosKnowledgeIndex,
  parseCosKnowledgeDocument,
} from "@/lib/cos/knowledge/loader.server"
import {
  buildCosKnowledgeAudit,
  COS_KNOWLEDGE_LIMITS,
  formatCosKnowledgeContext,
  isDetailedCosKnowledgeRequest,
  retrieveCosKnowledge,
  selectCosKnowledgeFacts,
  shouldRetrieveCosKnowledge,
} from "@/lib/cos/knowledge/retrieval"
import { buildCosGroundedHelpResponse, normalizeCosGroundedResponse } from "@/lib/cos/response-formatter"
import type {
  CosCapabilityId,
  CosConversationDomain,
  CosDialogueAct,
  CosDialogueDecision,
} from "@/lib/cos/types"

function decision(input: {
  act: CosDialogueAct
  primaryDomain: CosConversationDomain
  secondaryDomains?: CosConversationDomain[]
  targetCapabilityId?: CosCapabilityId | null
}): CosDialogueDecision {
  const objectiveMode: CosDialogueDecision["objective"]["mode"] =
    input.act === "execute"
      ? "execute"
      : input.act === "query"
        ? "query"
        : input.act === "explain"
          ? "explain"
          : input.act === "capability_question"
            ? "respond"
            : ["confirm", "reject", "cancel", "select", "provide_input", "correct"].includes(input.act)
              ? "continue"
              : "respond"

  return {
    schemaVersion: 1,
    dialogueAct: input.act,
    dialogueActConfidence: 1,
    dialogueActEvidence: ["knowledge-layer-test"],
    primaryDomain: input.primaryDomain,
    secondaryDomains: input.secondaryDomains ?? [],
    objective: {
      mode: objectiveMode,
      summary: `${input.act}:${input.primaryDomain}`,
      targetCapabilityId: input.targetCapabilityId ?? null,
    },
    reference: {
      type: null,
      id: null,
      label: null,
      reason: "not_required",
      ambiguousIds: [],
    },
    selectedCapabilityId: null,
    selectedAction: null,
    candidateCapabilities: [],
    workflowDecision: "none",
    needsClarification: false,
    clarificationReason: null,
    source: "dialogue_rules",
  }
}

function decide(message: string) {
  return resolveCosDialogueDecision({
    message,
    requestedAction: null,
    surface: "portal",
    workspace: null,
    snapshot: null,
    activeWorkflow: null,
    memory: null,
    attachments: [],
  })
}

test.describe("COS — Knowledge Layer da Etapa 4", () => {
  test.beforeEach(() => clearCosKnowledgeIndexCacheForTests())

  test("loader mantém os 17 capítulos, metadata e cache determinísticos", async () => {
    const firstPromise = loadCosKnowledgeIndex()
    const secondPromise = loadCosKnowledgeIndex()
    expect(secondPromise).toBe(firstPromise)

    const index = await firstPromise
    expect(index.documents.map((document) => document.id)).toEqual([
      "eme",
      "cos",
      "clientes",
      "imoveis",
      "catalogo",
      "marketplace",
      "propostas",
      "contratos",
      "compromissos",
      "financeiro",
      "desempenho",
      "studio",
      "planos-conta",
      "regras-negocio",
      "glossario",
      "capacidades-cos",
      "operacao-cos-v2",
    ])
    expect(index.sourceVersion).toContain("catalogo@1.0.0")
    expect(index.sourceVersion).toContain("capacidades-cos@1.0.0")

    const catalog = index.documents.find((document) => document.id === "catalogo")
    expect(catalog).toMatchObject({
      title: "Catálogo",
      domains: ["catalog"],
      knowledgeTypes: ["module", "procedure"],
      fileName: "04-catalogo.md",
      version: "1.0.0",
    })
    expect(catalog?.aliases).toContain("vitrine individual")

    expect(index.documentsById.get("catalogo")).toBe(catalog)
    expect(index.documentIdsByAlias.get("vitrine individual")).toBe("catalogo")
    expect(index.documentIdsByDomain.get("catalog")).toEqual(expect.arrayContaining(["catalogo", "glossario"]))
    expect(index.documentIdsByDomain.get("catalog")).not.toContain("studio")
    expect(index.documentIdsByType.get("glossary")).toEqual(["glossario"])
    expect(index.documentIdsByType.get("capability")).toEqual(["capacidades-cos", "operacao-cos-v2"])
  })

  test("parser valida frontmatter, domínio e tipo sem ignorar fonte inválida", () => {
    expect(() => parseCosKnowledgeDocument("sem-frontmatter.md", "# Documento")).toThrow(
      "COS_KNOWLEDGE_INVALID_FRONTMATTER:sem-frontmatter.md",
    )

    const source = (domains: string, knowledgeType: string) => [
      "---",
      "id: teste",
      "title: Teste",
      `domains: [${domains}]`,
      "aliases: [teste local]",
      "version: 1.0.0",
      "updated_at: 2026-08-14",
      `knowledge_type: [${knowledgeType}]`,
      "---",
      "",
      "# Teste",
      "",
      "Introdução.",
      "",
      "## Regra",
      "",
      "Conteúdo.",
    ].join("\n")

    expect(() => parseCosKnowledgeDocument("dominio.md", source("inexistente", "module"))).toThrow(
      "COS_KNOWLEDGE_UNKNOWN_DOMAIN:dominio.md:inexistente",
    )
    expect(() => parseCosKnowledgeDocument("tipo.md", source("general", "inexistente"))).toThrow(
      "COS_KNOWLEDGE_UNKNOWN_TYPE:tipo.md:inexistente",
    )

    const first = parseCosKnowledgeDocument("teste.md", source("general", "rule"))
    const second = parseCosKnowledgeDocument("teste.md", source("general", "rule"))
    expect(first.chunks.map((chunk) => chunk.id)).toEqual(["teste#visao-geral", "teste#regra"])
    expect(second.chunks).toEqual(first.chunks)
  })

  test("chunking preserva fonte e seção, inclui introduções e respeita o limite físico", async () => {
    const index = await loadCosKnowledgeIndex()
    const ids = new Set<string>()

    for (const document of index.documents) {
      expect(document.chunks.map((chunk) => chunk.order)).toEqual(document.chunks.map((_, order) => order))
      for (const chunk of document.chunks) {
        expect(ids.has(chunk.id)).toBe(false)
        ids.add(chunk.id)
        expect(chunk).toMatchObject({
          sourceId: document.id,
          documentTitle: document.title,
          domains: document.domains,
          knowledgeTypes: document.knowledgeTypes,
          version: document.version,
        })
        expect(chunk.heading.length).toBeGreaterThan(0)
        expect(chunk.text.length).toBeGreaterThan(0)
        expect(chunk.text.length).toBeLessThanOrEqual(COS_KNOWLEDGE_SOURCE_CHUNK_CHARS)
        expect(chunk.text).not.toContain("knowledge_type:")
      }
    }

    const catalogDefinition = index.chunks.find((chunk) => chunk.id === "catalogo#o-que-e")
    expect(catalogDefinition?.text).toContain("catálogo público individual")
    expect(catalogDefinition?.text).not.toContain("## Para que serve")

    const glossary = index.documents.find((document) => document.id === "glossario")
    const glossaryText = glossary?.chunks.map((chunk) => chunk.text).join("\n") ?? ""
    expect(glossaryText).toContain("`Property` / `property` | Imóvel")
    expect(glossaryText).toContain("`AgendaEvent` / `agenda` | Compromisso")
    expect(glossaryText).toContain("`Lead` / `lead` | Cliente")

    const capabilityChunks = index.documents.find((document) => document.id === "capacidades-cos")?.chunks ?? []
    expect(capabilityChunks.filter((chunk) => chunk.id.includes("inventario-gerado-do-registry")).length).toBeGreaterThan(1)
    expect(capabilityChunks.map((chunk) => chunk.text).join("\n")).toContain("`proposal.create` | `CREATE_PROPOSAL`")
  })

  test("Catálogo × Marketplace recupera as duas definições sem contaminar outros módulos", async () => {
    const message = "Qual a diferença entre meu Catálogo e o Marketplace?"
    const dialogue = decide(message)
    expect(dialogue.dialogueAct).toBe("explain")
    expect(dialogue.primaryDomain).toBe("catalog")
    expect(dialogue.secondaryDomains).toContain("marketplace")

    const context = await retrieveCosKnowledge({ message, decision: dialogue })
    expect(context.required).toBe(true)
    expect(context.knowledgeMiss).toBe(false)
    expect(context.selectedDocuments.map((document) => document.id)).toEqual(expect.arrayContaining(["catalogo", "marketplace", "regras-negocio"]))

    const catalogText = context.chunks.filter((chunk) => chunk.sourceId === "catalogo").map((chunk) => chunk.text).join("\n")
    const marketplaceText = context.chunks.filter((chunk) => chunk.sourceId === "marketplace").map((chunk) => chunk.text).join("\n")
    expect(catalogText).toContain("público individual")
    expect(marketplaceText).toContain("ambiente público agregado")
    expect(context.chunks.some((chunk) => ["studio", "financeiro", "contratos"].includes(chunk.sourceId))).toBe(false)
  })

  test("Knowledge entrega fatos relevantes e a Response Layer os apresenta sem texto cru", async () => {
    const cases = [
      {
        message: "Como usar o COS?",
        expectedDocuments: ["cos", "capacidades-cos"],
        expectedText: ["consultar"],
      },
      {
        message: "Como eu utilizo o sistema?",
        expectedDocuments: ["eme"],
        expectedText: ["clientes", "imóveis"],
      },
      {
        message: "Qual a diferença entre Catálogo e Marketplace?",
        expectedDocuments: ["catalogo", "marketplace"],
        expectedText: ["individual", "agregado", "separad"],
      },
      {
        message: "Como cadastrar imóvel?",
        expectedDocuments: ["imoveis"],
        expectedText: ["revis"],
      },
      {
        message: "O que você consegue fazer?",
        expectedDocuments: ["cos", "capacidades-cos"],
        expectedText: ["consultar", "criar"],
      },
    ] as const

    for (const example of cases) {
      const dialogue = decide(example.message)
      expect(["explain", "capability_question", "query"]).toContain(dialogue.dialogueAct)
      expect(dialogue.selectedAction ?? "").not.toMatch(/^(?:CREATE|UPDATE|DELETE|PUBLISH|UNPUBLISH|ARCHIVE|CANCEL|SIGN|SEND)_/)

      const context = await retrieveCosKnowledge({ message: example.message, decision: dialogue })
      expect(context.knowledgeMiss, example.message).toBe(false)
      expect(context.selectedDocuments.map((document) => document.id)).toEqual(expect.arrayContaining([...example.expectedDocuments]))

      const facts = selectCosKnowledgeFacts({ message: example.message, context })
      expect(facts.length).toBeGreaterThan(0)
      expect(facts.length).toBeLessThanOrEqual(3)

      const answer = buildCosGroundedHelpResponse({ message: example.message, context })
      expect(answer.length).toBeGreaterThan(20)
      expect(answer.length).toBeLessThanOrEqual(520)
      expect(answer).not.toMatch(/(?:```|\|---|\[[^\]]+ ·|\b(?:general|capability|workflow|registry|handler|descriptor|actions?)\b)/i)
      expect(answer).not.toMatch(/\b[A-Z][A-Z0-9_]{3,}\b/)
      for (const fragment of example.expectedText) expect(answer.toLowerCase()).toContain(fragment)
    }
  })

  test("resposta longa só é habilitada quando o corretor pede detalhes", () => {
    expect(isDetailedCosKnowledgeRequest("Como cadastrar imóvel?")).toBe(false)
    expect(isDetailedCosKnowledgeRequest("Explique em detalhes como cadastrar imóvel.")).toBe(true)

    const source = [
      "Primeira frase útil.",
      "Segunda frase útil.",
      "Terceira frase útil.",
      "Quarta frase útil.",
    ].join(" ")
    expect(normalizeCosGroundedResponse(source, false)).not.toContain("Quarta frase")
    expect(normalizeCosGroundedResponse(source, true)).toContain("Quarta frase")
  })

  test("ajuda de Clientes explica a área, suas possibilidades e oferece ajuda", async () => {
    const message = "Como funciona Clientes?"
    const context = await retrieveCosKnowledge({ message, decision: decide(message) })
    const answer = buildCosGroundedHelpResponse({ message, context })

    expect(answer).toMatch(/^Clientes\b/)
    expect(answer).toMatch(/contato|interesse|histórico/i)
    expect(answer).toMatch(/Você pode|posso ajudar/i)
    expect(answer).toContain("Se quiser, posso ajudar")
    expect(answer).not.toMatch(/Livro|Registry|capability|workflow|general|property|Lead/i)
  })

  test("contratos recupera a regra completa sem esconder a divergência do legado", async () => {
    const message = "O EME cria cláusulas para mim?"
    const context = await retrieveCosKnowledge({
      message,
      decision: decision({ act: "explain", primaryDomain: "contract" }),
    })

    expect(context.knowledgeMiss).toBe(false)
    expect(context.selectedDocuments.map((document) => document.id)).toEqual(["contratos"])
    const rule = context.chunks.find((chunk) => chunk.id === "contratos#regras-de-negocio")
    expect(rule?.text).toContain("não inventa conteúdo jurídico nem cláusulas")
    expect(rule?.text).toContain("gerador legado ainda monta cláusulas programáticas")
  })

  test("pergunta de capacidade combina Livro com o descriptor real do Registry", async () => {
    const message = "Você consegue criar uma proposta?"
    const dialogue = decide(message)
    expect(dialogue.dialogueAct).toBe("capability_question")
    expect(dialogue.objective.targetCapabilityId).toBe("proposal.create")
    expect(dialogue.selectedAction).toBe("general")

    const descriptor = getCosCapabilityDescriptorById(dialogue.objective.targetCapabilityId!)
    expect(descriptor).toMatchObject({
      id: "proposal.create",
      action: "CREATE_PROPOSAL",
      mutatesData: true,
      requiresConfirmation: false,
      requiresSelection: true,
    })
    expect(descriptor?.surfaces).toEqual(expect.arrayContaining(["portal", "cos_home"]))

    const context = await retrieveCosKnowledge({ message, decision: dialogue })
    expect(context.selectedDocuments.map((document) => document.id)).toEqual(expect.arrayContaining(["capacidades-cos", "propostas"]))
    const capabilityText = context.chunks.filter((chunk) => chunk.sourceId === "capacidades-cos").map((chunk) => chunk.text).join("\n")
    expect(capabilityText).toContain("`proposal.create` | `CREATE_PROPOSAL`")
  })

  test("pergunta sobre publicar imóvel recupera procedimento, sem executar a mutação", async () => {
    const message = "Como publico meu imóvel?"
    const dialogue = decide(message)
    expect(dialogue.dialogueAct).toBe("explain")
    expect(dialogue.primaryDomain).toBe("property")

    const context = await retrieveCosKnowledge({ message, decision: dialogue })
    expect(context.required).toBe(true)
    expect(context.selectedDocuments.map((document) => document.id)).toEqual(["imoveis"])
    const procedure = context.chunks.find((chunk) => chunk.id === "imoveis#fluxos-principais")
    expect(procedure?.text).toContain("revisão dos dados/mídias → publicação")

    const descriptor = getCosCapabilityDescriptorById("property.publish")
    expect(descriptor).toMatchObject({
      action: "PUBLISH_PROPERTY",
      requiresConfirmation: true,
      requiresSelection: true,
    })
    expect(dialogue.selectedAction).not.toBe("PUBLISH_PROPERTY")
  })

  for (const glossaryCase of [
    ["property", "`Property` / `property`", "Imóvel"],
    ["agenda", "`AgendaEvent` / `agenda`", "Compromisso"],
    ["lead", "`Lead` / `lead`", "Cliente"],
  ] as const) {
    test(`glossário resolve ${glossaryCase[0]} para o termo de apresentação`, async () => {
      const message = `O que significa ${glossaryCase[0]}?`
      const context = await retrieveCosKnowledge({
        message,
        decision: decision({ act: "explain", primaryDomain: "general" }),
        filters: { documentIds: ["glossario"], knowledgeTypes: ["glossary"] },
      })

      expect(context.knowledgeMiss).toBe(false)
      expect(context.selectedDocuments.map((document) => document.id)).toEqual(["glossario"])
      const text = context.chunks.map((chunk) => chunk.text).join("\n")
      expect(text).toContain(glossaryCase[1])
      expect(text).toContain(glossaryCase[2])
    })
  }

  test("feature inexistente produz knowledge miss em vez de resposta inventada", async () => {
    const context = await retrieveCosKnowledge({
      message: "O EME gerencia uma frota de drones autônomos?",
      decision: decision({ act: "explain", primaryDomain: "general" }),
    })

    expect(context).toMatchObject({ required: true, knowledgeMiss: true })
    expect(context.selectedDocuments).toEqual([])
    expect(context.chunks).toEqual([])
    expect(formatCosKnowledgeContext(context)).toBe("")
  })

  test("isolamento e limites impedem carregar Studio ou Financeiro numa dúvida de Catálogo", async () => {
    const context = await retrieveCosKnowledge({
      message: "Como funciona o Catálogo?",
      decision: decision({ act: "explain", primaryDomain: "catalog" }),
    })

    expect(context.knowledgeMiss).toBe(false)
    expect(context.selectedDocuments.map((document) => document.id)).toEqual(["catalogo"])
    expect(context.chunks.length).toBeLessThanOrEqual(COS_KNOWLEDGE_LIMITS.maxChunks)
    expect(context.limits.selectedChars).toBeLessThanOrEqual(COS_KNOWLEDGE_LIMITS.maxContextChars)
    for (const chunk of context.chunks) expect(chunk.text.length).toBeLessThanOrEqual(COS_KNOWLEDGE_LIMITS.maxChunkChars)
    expect(context.chunks.some((chunk) => ["studio", "financeiro"].includes(chunk.sourceId))).toBe(false)

    const formatted = formatCosKnowledgeContext(context)
    expect(formatted.length).toBeGreaterThan(0)
    expect(formatted).toContain("[catalogo ·")
    expect(formatted).not.toContain("[studio ·")
    expect(formatted).not.toContain("[financeiro ·")
  })

  test("confirmação, seleção, pending factual, consulta ao banco e mutação declarada não carregam o Livro", async () => {
    const cases = [
      ["sim", decision({ act: "confirm", primaryDomain: "general" })],
      ["o segundo", decision({ act: "select", primaryDomain: "property" })],
      ["54 99999-9999", decision({ act: "provide_input", primaryDomain: "lead" })],
      ["Quantos leads entraram?", decision({ act: "query", primaryDomain: "lead" })],
      ["Publique esse imóvel.", decision({ act: "execute", primaryDomain: "property" })],
    ] as const

    for (const [message, dialogue] of cases) {
      expect(shouldRetrieveCosKnowledge({ message, decision: dialogue })).toMatchObject({ required: false })
      const context = await retrieveCosKnowledge({ message, decision: dialogue })
      expect(context).toMatchObject({
        required: false,
        knowledgeMiss: false,
        selectedDocuments: [],
        chunks: [],
        sourceVersion: "eme-book:not-loaded",
      })
    }
  })

  test("filtros por ID, tipo e alias restringem o conjunto; interseção impossível retorna miss", async () => {
    const dialogue = decision({ act: "explain", primaryDomain: "catalog" })
    const filtered = await retrieveCosKnowledge({
      message: "Como funciona minha vitrine individual?",
      decision: dialogue,
      filters: { documentIds: ["catalogo"], knowledgeTypes: ["procedure"] },
    })

    expect(filtered.knowledgeMiss).toBe(false)
    expect(filtered.selectedDocuments.map((document) => document.id)).toEqual(["catalogo"])
    expect(filtered.chunks.every((chunk) => chunk.sourceId === "catalogo" && chunk.knowledgeTypes.includes("procedure"))).toBe(true)
    expect(filtered.chunks.some((chunk) => chunk.reason.includes("alias_phrase"))).toBe(true)

    const impossible = await retrieveCosKnowledge({
      message: "Como funciona o Catálogo?",
      decision: dialogue,
      filters: { documentIds: ["studio"], knowledgeTypes: ["procedure"] },
    })
    expect(impossible).toMatchObject({ knowledgeMiss: true, selectedDocuments: [], chunks: [] })
  })

  test("decisionAudit persiste referências e scores, nunca o texto integral dos chunks", async () => {
    const context = await retrieveCosKnowledge({
      message: "Como funciona o Catálogo?",
      decision: decision({ act: "explain", primaryDomain: "catalog" }),
    })
    const audit = buildCosKnowledgeAudit(context)

    expect(audit).toEqual({
      knowledgeRequired: true,
      retrievalQuery: "como funciona o catalogo",
      documentIds: context.selectedDocuments.map((document) => document.id),
      chunkIds: context.chunks.map((chunk) => chunk.id),
      scores: context.chunks.map((chunk) => ({ id: chunk.id, score: chunk.score })),
      knowledgeMiss: false,
      knowledgeVersion: context.sourceVersion,
    })
    expect(audit).not.toHaveProperty("chunks")
    expect(audit).not.toHaveProperty("selectedDocuments")
    for (const chunk of context.chunks) expect(JSON.stringify(audit)).not.toContain(chunk.text)

    const redacted = buildCosKnowledgeAudit({ ...context, query: "telefone 54 99999-9999" })
    expect(redacted?.retrievalQuery).toBe("telefone [dado]")
  })
})
