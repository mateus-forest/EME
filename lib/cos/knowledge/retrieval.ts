import { COS_KNOWLEDGE_SOURCE_CHUNK_CHARS, loadCosKnowledgeIndex, type CosKnowledgeDocument } from "@/lib/cos/knowledge/loader.server"
import type { CosConversationDomain, CosDialogueDecision, CosKnowledgeChunk, CosKnowledgeContext, CosKnowledgeType } from "@/lib/cos/types"

export const COS_KNOWLEDGE_LIMITS = {
  maxChunks: 5,
  maxChunkChars: COS_KNOWLEDGE_SOURCE_CHUNK_CHARS,
  maxContextChars: 6_000,
} as const

const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "como", "da", "das", "de", "do", "dos", "e", "em", "essa", "esse", "eu", "faz", "me", "meu", "minha",
  "na", "nas", "no", "nos", "o", "os", "para", "por", "qual", "que", "se", "tem", "um", "uma", "voce",
])

const GENERIC_PRODUCT_TOKENS = new Set(["eme", "cos", "sistema"])
const TECHNICAL_GLOSSARY_TERMS = /\b(property|lead|agenda|appointment|broker|listing|proposal|contract|pending|completed|failed)\b/
const PROCEDURE_SIGNAL = /\b(como faco|como fazer|como publico|como publicar|como cadastro|como cadastrar|como configuro|como configurar|como compartilho|como compartilhar|onde encontro|passo a passo|funciona)\b/
const RULE_SIGNAL = /\b(regra|regras|clausula|clausulas|assinatura digital|certificado|moderacao|aprovar avaliacao|pode inventar|cria clausula)\b/

const DOMAIN_DOCUMENT_IDS: Partial<Record<CosConversationDomain, string>> = {
  lead: "clientes",
  property: "imoveis",
  proposal: "propostas",
  contract: "contratos",
  agenda: "compromissos",
  catalog: "catalogo",
  marketplace: "marketplace",
  finance: "financeiro",
  analytics: "desempenho",
  studio: "studio",
  help: "cos",
  general: "eme",
}

export type CosKnowledgeRetrievalFilters = {
  documentIds?: string[]
  knowledgeTypes?: CosKnowledgeType[]
}

export function normalizeCosKnowledgeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string) {
  return [...new Set(normalizeCosKnowledgeText(value).split(" ").filter((token) => token.length > 2 && !STOP_WORDS.has(token)))]
}

function hasPhrase(text: string, phrase: string) {
  if (!phrase) return false
  return ` ${text} `.includes(` ${phrase} `)
}

function knowledgeTypesForDecision(decision: CosDialogueDecision): CosKnowledgeType[] {
  if (decision.dialogueAct === "capability_question") return ["capability", "module", "procedure"]
  if (decision.dialogueAct === "explain") return ["module", "rule", "procedure", "glossary"]
  if (decision.dialogueAct === "execute") return ["rule", "procedure"]
  return ["module", "procedure", "rule", "glossary"]
}

export function shouldRetrieveCosKnowledge(input: { message: string; decision: CosDialogueDecision }) {
  const selectedId = input.decision.selectedCapabilityId ?? input.decision.objective.targetCapabilityId
  if (["confirm", "reject", "cancel", "select", "provide_input", "correct", "social"].includes(input.decision.dialogueAct)) {
    return { required: false, reason: ["knowledge_not_needed_for_dialogue_act"] }
  }
  if (selectedId?.startsWith("help.")) return { required: true, reason: ["help_capability"] }
  if (["explain", "capability_question"].includes(input.decision.dialogueAct)) {
    return { required: true, reason: [`dialogue_act:${input.decision.dialogueAct}`] }
  }

  const normalized = normalizeCosKnowledgeText(input.message)
  if (PROCEDURE_SIGNAL.test(normalized) && ["query", "unknown", "switch_topic"].includes(input.decision.dialogueAct)) {
    return { required: true, reason: ["procedural_question"] }
  }
  if (RULE_SIGNAL.test(normalized) && ["query", "unknown", "execute"].includes(input.decision.dialogueAct)) {
    return { required: true, reason: ["business_rule_question"] }
  }
  if (input.decision.dialogueAct === "execute" && ["contract", "marketplace"].includes(input.decision.primaryDomain)) {
    return { required: true, reason: [`operational_rule:${input.decision.primaryDomain}`] }
  }
  return { required: false, reason: ["knowledge_not_needed"] }
}

function headingBoost(input: { heading: string; query: string; decision: CosDialogueDecision }) {
  const heading = normalizeCosKnowledgeText(input.heading)
  let score = 0
  const reason: string[] = []
  if (heading.startsWith("exemplos de")) {
    score -= 8
    reason.push("example_section_penalty")
  }
  if (input.decision.dialogueAct === "explain" && /^(o que e|para que serve|relacao com outros modulos)/.test(heading)) {
    score += 8
    reason.push("explanation_heading")
  }
  if (/\b(diferenca|diferencas|comparar|comparacao)\b/.test(input.query) && /^(o que e|relacao com outros modulos|regras de negocio)/.test(heading)) {
    score += 7
    reason.push("comparison_heading")
  }
  if (RULE_SIGNAL.test(input.query) && heading.startsWith("regras de negocio")) {
    score += 12
    reason.push("business_rule_heading")
  }
  if (PROCEDURE_SIGNAL.test(input.query) && /^(fluxos principais|regras de negocio|o que o usuario pode fazer)/.test(heading)) {
    score += 10
    reason.push("procedure_heading")
  }
  if (input.decision.dialogueAct === "capability_question" && heading.startsWith("o que o cos pode fazer")) {
    score += 9
    reason.push("capability_heading")
  }
  if (TECHNICAL_GLOSSARY_TERMS.test(input.query) && heading === "visao geral") {
    score += 10
    reason.push("glossary_definition_heading")
  }
  return { score, reason }
}

function scoreChunk(input: {
  chunk: CosKnowledgeChunk
  document: CosKnowledgeDocument
  decision: CosDialogueDecision
  query: string
  queryTokens: string[]
  expectedTypes: CosKnowledgeType[]
  explicitlyFiltered: boolean
}) {
  let score = 0
  const reason: string[] = []
  const normalizedHeading = normalizeCosKnowledgeText(input.chunk.heading)
  const normalizedTitle = normalizeCosKnowledgeText(input.document.title)
  const normalizedText = normalizeCosKnowledgeText(input.chunk.text)
  const normalizedAliases = input.document.aliases.map(normalizeCosKnowledgeText)

  if (input.chunk.domains.includes(input.decision.primaryDomain)) {
    score += 8
    reason.push(`primary_domain:${input.decision.primaryDomain}`)
  }
  for (const domain of input.decision.secondaryDomains) {
    if (input.chunk.domains.includes(domain)) {
      score += 5
      reason.push(`secondary_domain:${domain}`)
    }
  }
  const matchedType = input.chunk.knowledgeTypes.find((type) => input.expectedTypes.includes(type))
  if (matchedType) {
    score += 3
    reason.push(`knowledge_type:${matchedType}`)
  }

  const targetCapability = input.decision.objective.targetCapabilityId
  const targetCapabilityMatched = Boolean(targetCapability && hasPhrase(normalizedText, normalizeCosKnowledgeText(targetCapability)))
  if (targetCapabilityMatched) {
    score += 18
    reason.push("target_capability")
  }

  const aliasMatched = normalizedAliases.some((alias) => alias && hasPhrase(input.query, alias))
  if (aliasMatched) {
    score += 13
    reason.push("alias_phrase")
  }

  let lexicalHits = 0
  let meaningfulLexicalHits = 0
  const headingTokens = new Set(tokenize(normalizedHeading))
  const titleTokens = new Set(tokenize(normalizedTitle))
  const textTokens = new Set(tokenize(normalizedText))
  const aliasTokens = new Set(normalizedAliases.flatMap(tokenize))
  for (const token of input.queryTokens) {
    const generic = GENERIC_PRODUCT_TOKENS.has(token)
    if (headingTokens.has(token)) {
      score += generic ? 0.5 : 4
      lexicalHits += 1
      if (!generic) meaningfulLexicalHits += 1
    } else if (titleTokens.has(token)) {
      score += generic ? 0.5 : 3
      lexicalHits += 1
      if (!generic) meaningfulLexicalHits += 1
    } else if (aliasTokens.has(token)) {
      score += generic ? 0.5 : 2.5
      lexicalHits += 1
      if (!generic) meaningfulLexicalHits += 1
    } else if (textTokens.has(token)) {
      score += generic ? 0.25 : 1
      lexicalHits += 1
      if (!generic) meaningfulLexicalHits += 1
    }
  }
  if (lexicalHits) reason.push(`lexical_hits:${lexicalHits}`)

  const heading = headingBoost({ heading: input.chunk.heading, query: input.query, decision: input.decision })
  score += heading.score
  reason.push(...heading.reason)

  if (input.document.id === "capacidades-cos" && input.decision.dialogueAct === "capability_question" && targetCapabilityMatched) {
    score += 10
    reason.push("registry_inventory_evidence")
  }
  const glossaryMatched = input.document.id === "glossario" && TECHNICAL_GLOSSARY_TERMS.test(input.query) && meaningfulLexicalHits > 0
  if (glossaryMatched) {
    score += 14
    reason.push("glossary_term")
  }

  const productDefinitionMatched = input.document.id === "eme" && /^(o que e|como funciona) (o )?eme\b/.test(input.query)
  const hasEvidence = meaningfulLexicalHits > 0 || aliasMatched || targetCapabilityMatched || glossaryMatched || productDefinitionMatched || input.explicitlyFiltered
  return { score: hasEvidence ? score : 0, reason }
}

function isCandidateDocument(document: CosKnowledgeDocument, decision: CosDialogueDecision, query: string) {
  if (document.id === "glossario" && !TECHNICAL_GLOSSARY_TERMS.test(query)) return false
  if (document.id === "capacidades-cos" && decision.dialogueAct !== "capability_question") return false
  const domains = [decision.primaryDomain, ...decision.secondaryDomains]
  if (document.domains.some((domain) => domains.includes(domain))) return true
  if (decision.dialogueAct === "capability_question" && document.id === "capacidades-cos") return true
  if (["explain", "execute"].includes(decision.dialogueAct) && document.id === "regras-negocio") return true
  if (document.id === "glossario" && TECHNICAL_GLOSSARY_TERMS.test(query)) return true
  return document.aliases.some((alias) => hasPhrase(query, normalizeCosKnowledgeText(alias)))
}

function selectWithinLimits(scored: CosKnowledgeChunk[], preferredSourceIds: string[]) {
  const selected: CosKnowledgeChunk[] = []
  let selectedChars = 0
  const add = (chunk: CosKnowledgeChunk | undefined) => {
    if (!chunk || selected.some((item) => item.id === chunk.id) || selected.length >= COS_KNOWLEDGE_LIMITS.maxChunks) return
    if (!chunk.text || chunk.text.length > COS_KNOWLEDGE_LIMITS.maxChunkChars) return
    if (selectedChars + chunk.text.length > COS_KNOWLEDGE_LIMITS.maxContextChars) return
    selected.push(chunk)
    selectedChars += chunk.text.length
  }
  for (const sourceId of preferredSourceIds) add(scored.find((chunk) => chunk.sourceId === sourceId))
  for (const chunk of scored) add(chunk)
  return { selected, selectedChars }
}

function emptyKnowledgeContext(input: {
  required: boolean
  query: string
  reason: string[]
  sourceVersion: string
  knowledgeMiss?: boolean
}): CosKnowledgeContext {
  return {
    schemaVersion: 1,
    required: input.required,
    query: input.query,
    reason: input.reason,
    selectedDocuments: [],
    chunks: [],
    knowledgeMiss: input.knowledgeMiss ?? false,
    sourceVersion: input.sourceVersion,
    limits: { ...COS_KNOWLEDGE_LIMITS, selectedChars: 0 },
  }
}

export async function retrieveCosKnowledge(input: {
  message: string
  decision: CosDialogueDecision
  filters?: CosKnowledgeRetrievalFilters
}): Promise<CosKnowledgeContext> {
  const need = shouldRetrieveCosKnowledge(input)
  const query = normalizeCosKnowledgeText(input.message).slice(0, 320)
  if (!need.required) {
    return emptyKnowledgeContext({ required: false, query, reason: need.reason, sourceVersion: "eme-book:not-loaded" })
  }

  try {
    const index = await loadCosKnowledgeIndex()
    const queryTokens = tokenize(query)
    const expectedTypes = knowledgeTypesForDecision(input.decision)
    const explicitlyFiltered = Boolean(input.filters?.documentIds?.length || input.filters?.knowledgeTypes?.length)
    const scored = index.documents
      .filter((document) => isCandidateDocument(document, input.decision, query))
      .filter((document) => !input.filters?.documentIds?.length || input.filters.documentIds.includes(document.id))
      .filter((document) => !input.filters?.knowledgeTypes?.length || document.knowledgeTypes.some((type) => input.filters!.knowledgeTypes!.includes(type)))
      .flatMap((document) => document.chunks.map((chunk) => {
        const result = scoreChunk({ chunk, document, decision: input.decision, query, queryTokens, expectedTypes, explicitlyFiltered })
        return { ...chunk, score: Number(result.score.toFixed(2)), reason: result.reason.slice(0, 6) }
      }))
      .filter((chunk) => chunk.score >= 5)
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))

    const preferredSourceIds = [input.decision.primaryDomain, ...input.decision.secondaryDomains]
      .map((domain) => DOMAIN_DOCUMENT_IDS[domain])
      .filter((id): id is string => Boolean(id))
    if (input.decision.dialogueAct === "capability_question" && input.decision.objective.targetCapabilityId) {
      preferredSourceIds.unshift("capacidades-cos")
    }
    const { selected, selectedChars } = selectWithinLimits(scored, [...new Set(preferredSourceIds)])
    const selectedDocumentIds = [...new Set(selected.map((chunk) => chunk.sourceId))]
    const selectedDocuments = selectedDocumentIds.map((id) => {
      const document = index.documentsById.get(id)!
      return { id: document.id, title: document.title, version: document.version }
    })

    return {
      schemaVersion: 1,
      required: true,
      query,
      reason: need.reason,
      selectedDocuments,
      chunks: selected,
      knowledgeMiss: selected.length === 0,
      sourceVersion: index.sourceVersion,
      limits: { ...COS_KNOWLEDGE_LIMITS, selectedChars },
    }
  } catch (caughtError) {
    console.error("[cos][knowledge][load-error]", {
      error: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return emptyKnowledgeContext({
      required: true,
      query,
      reason: [...need.reason, "knowledge_load_error"],
      sourceVersion: "eme-book:unavailable",
      knowledgeMiss: true,
    })
  }
}

function redactKnowledgeAuditQuery(value: string) {
  return value
    .replace(/\b\d(?:[\d\s._-]{6,}\d)\b/g, "[dado]")
    .slice(0, 256)
}

export function buildCosKnowledgeAudit(context: CosKnowledgeContext | null | undefined) {
  if (!context) return null
  return {
    knowledgeRequired: context.required,
    retrievalQuery: redactKnowledgeAuditQuery(context.query),
    documentIds: context.selectedDocuments.map((document) => document.id),
    chunkIds: context.chunks.map((chunk) => chunk.id),
    scores: context.chunks.map((chunk) => ({ id: chunk.id, score: chunk.score })),
    knowledgeMiss: context.knowledgeMiss,
    knowledgeVersion: context.sourceVersion,
  }
}

export function formatCosKnowledgeContext(context: CosKnowledgeContext) {
  if (context.knowledgeMiss || context.chunks.length === 0) return ""
  return context.chunks.map((chunk) => `[${chunk.sourceId} · ${chunk.heading} · v${chunk.version}]\n${chunk.text}`).join("\n\n---\n\n")
}
