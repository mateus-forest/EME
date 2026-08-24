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
const PROCEDURE_SIGNAL = /\b(como (?:eu )?(?:usar|utiliz\w*)|como faco|como fazer|como publico|como publicar|como cadastro|como cadastrar|como configuro|como configurar|como compartilho|como compartilhar|onde encontro|passo a passo|funciona)\b/
const RULE_SIGNAL = /\b(regra|regras|clausula|clausulas|assinatura digital|certificado|moderacao|aprovar avaliacao|pode inventar|cria clausula)\b/
const COS_GUIDANCE_SIGNAL = /\b(?:(?:o que|quais? coisas?) (?:voce|o cos) (?:faz|consegue|pode fazer)|(?:voce|o cos) (?:consegue|pode) fazer|como (?:usar|utilizar|utilizo|uso) (?:o )?cos)\b/
const DETAILED_ANSWER_SIGNAL = /\b(?:em detalhes|detalhadamente|passo a passo|lista completa|explique melhor|aprofund\w*|tudo sobre|resposta completa)\b/
const INTERNAL_KNOWLEDGE_LANGUAGE = /\b(?:conversation\s*snapshot|dialogue\s*decision|schema\s*version|executor|payload|prisma)\b/i
const EXPLICIT_ONLY_DOCUMENT_IDS = new Set(["operacao-cos-v2"])

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

function isCosGuidanceQuery(message: string, targetCapabilityId: CosDialogueDecision["objective"]["targetCapabilityId"]) {
  const normalized = normalizeCosKnowledgeText(message)
  return targetCapabilityId === "help.use_cos" || COS_GUIDANCE_SIGNAL.test(normalized)
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
  cosGuidanceQuery: boolean
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
  const productUsageMatched = input.document.id === "eme" && PROCEDURE_SIGNAL.test(input.query) && /\b(?:eme|sistema)\b/.test(input.query)
  if (productUsageMatched && /^(o que o usuario pode fazer|fluxos principais|para que serve)/.test(normalizeCosKnowledgeText(input.chunk.heading))) {
    score += 16
    reason.push("product_usage_heading")
  }
  const cosGuidanceMatched = input.cosGuidanceQuery && ["cos", "capacidades-cos"].includes(input.document.id)
  if (cosGuidanceMatched) {
    const heading = normalizeCosKnowledgeText(input.chunk.heading)
    if (/^(o que o usuario pode fazer|o que o cos pode fazer|para que serve|como interpretar)/.test(heading)) {
      score += 18
      reason.push("cos_guidance_heading")
    }
  }
  const hasEvidence = meaningfulLexicalHits > 0 || aliasMatched || targetCapabilityMatched || glossaryMatched || productDefinitionMatched || productUsageMatched || cosGuidanceMatched || input.explicitlyFiltered
  return { score: hasEvidence ? score : 0, reason }
}

function isCandidateDocument(document: CosKnowledgeDocument, decision: CosDialogueDecision, query: string, cosGuidanceQuery: boolean) {
  if (document.id === "glossario" && !TECHNICAL_GLOSSARY_TERMS.test(query)) return false
  if (document.id === "capacidades-cos" && decision.dialogueAct !== "capability_question" && !cosGuidanceQuery) return false
  const domains = [decision.primaryDomain, ...decision.secondaryDomains]
  if (document.domains.some((domain) => domains.includes(domain))) return true
  if (cosGuidanceQuery && ["cos", "capacidades-cos"].includes(document.id)) return true
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
    const cosGuidanceQuery = isCosGuidanceQuery(input.message, input.decision.objective.targetCapabilityId)
    const scored = index.documents
      .filter((document) => !EXPLICIT_ONLY_DOCUMENT_IDS.has(document.id) || Boolean(input.filters?.documentIds?.includes(document.id)))
      .filter((document) => isCandidateDocument(document, input.decision, query, cosGuidanceQuery))
      .filter((document) => !input.filters?.documentIds?.length || input.filters.documentIds.includes(document.id))
      .filter((document) => !input.filters?.knowledgeTypes?.length || document.knowledgeTypes.some((type) => input.filters!.knowledgeTypes!.includes(type)))
      .flatMap((document) => document.chunks.map((chunk) => {
        const result = scoreChunk({ chunk, document, decision: input.decision, query, queryTokens, expectedTypes, explicitlyFiltered, cosGuidanceQuery })
        return { ...chunk, score: Number(result.score.toFixed(2)), reason: result.reason.slice(0, 6) }
      }))
      .filter((chunk) => chunk.score >= 5)
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))

    const preferredSourceIds = [input.decision.primaryDomain, ...input.decision.secondaryDomains]
      .map((domain) => DOMAIN_DOCUMENT_IDS[domain])
      .filter((id): id is string => Boolean(id))
    const comparesCatalogAndMarketplace = /\b(?:diferenca|comparar|comparacao|distincao)\b/.test(query) &&
      /\bcatalogo\b/.test(query) &&
      /\bmarketplace\b/.test(query)
    if (comparesCatalogAndMarketplace) preferredSourceIds.push("regras-negocio")
    if (input.decision.dialogueAct === "capability_question" && input.decision.objective.targetCapabilityId) {
      preferredSourceIds.unshift("capacidades-cos")
    }
    if (cosGuidanceQuery) preferredSourceIds.unshift("cos", "capacidades-cos")
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

export function isDetailedCosKnowledgeRequest(message: string) {
  return DETAILED_ANSWER_SIGNAL.test(normalizeCosKnowledgeText(message))
}

function cleanKnowledgeFact(value: string) {
  if (INTERNAL_KNOWLEDGE_LANGUAGE.test(value)) return ""
  if (/^Somente as capabilit(?:y|ies) validadas do Registry\.?$/i.test(value.trim())) return ""
  return value
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

export type CosKnowledgeFact = {
  text: string
  sourceId: string
  heading: string
  order: number
}

function knowledgeUnits(context: CosKnowledgeContext) {
  return context.chunks.flatMap((chunk, chunkIndex) => {
    if (/inventário gerado/i.test(chunk.heading)) return []
    const heading = normalizeCosKnowledgeText(chunk.heading)
    const units = chunk.text
      .replace(/```[\s\S]*?```/g, " ")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^(?:#|---|\|)/.test(line))
      .flatMap((line) => line.replace(/^[-*]\s+/, "").split(/(?<=[.!?])\s+/))
      .map(cleanKnowledgeFact)
      .filter((unit) => unit.length >= 18)

    return units.map((text, unitIndex) => ({
      text,
      sourceId: chunk.sourceId,
      heading,
      order: chunkIndex * 100 + unitIndex,
    }))
  })
}

function unitScore(input: {
  unit: ReturnType<typeof knowledgeUnits>[number]
  queryTokens: string[]
  comparison: boolean
  procedure: boolean
  capability: boolean
}) {
  const heading = input.unit.heading
  let score = 0
  if (input.comparison) {
    if (heading === "o que e") score += 40
    if (heading === "regras de negocio") score += 24
    if (heading === "relacao com outros modulos") score += 14
  } else if (input.capability) {
    if (heading === "o que o cos pode fazer") score += 38
    if (heading === "o que o usuario pode fazer") score += 34
    if (heading === "para que serve") score += 18
    if (heading === "como interpretar") score += 12
    if (input.unit.sourceId === "cos") score += 24
    if (input.unit.sourceId === "capacidades-cos") score += 10
  } else if (input.procedure) {
    if (heading === "fluxos principais") score += 36
    if (heading === "o que o usuario pode fazer") score += 32
    if (heading === "regras de negocio") score += 22
    if (heading === "para que serve") score += 16
  } else {
    if (heading === "o que e") score += 30
    if (heading === "para que serve") score += 25
    if (heading === "regras de negocio") score += 14
  }
  const normalizedText = normalizeCosKnowledgeText(input.unit.text)
  score += input.queryTokens.filter((token) => normalizedText.includes(token)).length * 4
  if (input.procedure && input.unit.order % 100 === 0) score += 8
  if (!input.queryTokens.includes("studio") && normalizedText.includes("studio")) score -= 12
  if (input.unit.text.length > 280) score -= 10
  return score
}

export function selectCosKnowledgeFacts(input: {
  message: string
  context: CosKnowledgeContext
  limit?: number
}): CosKnowledgeFact[] {
  if (input.context.knowledgeMiss || input.context.chunks.length === 0) return []
  const normalizedMessage = normalizeCosKnowledgeText(input.message)
  const detailed = isDetailedCosKnowledgeRequest(input.message)
  const comparison = /\b(?:diferenca|comparar|comparacao|distincao)\b/.test(normalizedMessage)
  const procedure = !/\bcomo funciona\b/.test(normalizedMessage) && (
    PROCEDURE_SIGNAL.test(normalizedMessage) || /\bcomo (?:usar|utilizar|utilizo|uso)\b/.test(normalizedMessage)
  )
  const capability = isCosGuidanceQuery(input.message, null)
  const queryTokens = tokenize(normalizedMessage).filter((token) => !GENERIC_PRODUCT_TOKENS.has(token))
  const candidates = knowledgeUnits(input.context)
    .map((unit) => ({ ...unit, score: unitScore({ unit, queryTokens, comparison, procedure, capability }) }))
    .sort((left, right) => right.score - left.score || left.order - right.order)
  const selected: typeof candidates = []
  const add = (candidate: typeof candidates[number] | undefined) => {
    if (!candidate || selected.some((item) => normalizeCosKnowledgeText(item.text) === normalizeCosKnowledgeText(candidate.text))) return
    selected.push(candidate)
  }

  if (comparison) {
    for (const document of input.context.selectedDocuments) {
      const sourceCandidate = document.id === "regras-negocio"
        ? candidates.find((candidate) => candidate.sourceId === document.id && /\bpublicacao\b.*\bseparad\w*\b/.test(normalizeCosKnowledgeText(candidate.text)))
        : candidates.find((candidate) => candidate.sourceId === document.id)
      add(sourceCandidate)
    }
  } else {
    const preferredHeadings = capability
      ? ["o que o cos pode fazer", "o que o usuario pode fazer", "para que serve"]
      : procedure
        ? ["fluxos principais", "o que o usuario pode fazer", "para que serve"]
        : ["o que e", "para que serve", "o que o usuario pode fazer"]
    for (const heading of preferredHeadings) add(candidates.find((candidate) => candidate.heading === heading))
  }
  const answerUnitLimit = input.limit ?? (detailed ? 8 : comparison ? Math.max(2, selected.length) : 3)
  if (selected.length < answerUnitLimit) {
    for (const candidate of candidates) {
      if (selected.length >= answerUnitLimit) break
      add(candidate)
    }
  }

  return selected.slice(0, answerUnitLimit).map(({ text, sourceId, heading, order }) => ({ text, sourceId, heading, order }))
}
