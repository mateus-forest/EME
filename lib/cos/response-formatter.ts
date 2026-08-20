import {
  isDetailedCosKnowledgeRequest,
  selectCosKnowledgeFacts,
  type CosKnowledgeFact,
} from "@/lib/cos/knowledge/retrieval"
import type { CosCapabilityDefinition, CosExecutionPlan, CosExecutionPlanResult, CosKnowledgeContext } from "@/lib/cos/types"
import { buildCosExecutionResponseViewModel, sanitizeCosResponseText } from "@/lib/cos/response-view-model"

const DEFAULT_HELP_OFFER = "Se quiser, posso ajudar com alguma dessas ações."

function withFinalPunctuation(value: string) {
  const text = value.trim()
  if (!text) return ""
  return /[.!?]$/.test(text) ? text : `${text}.`
}

function lowercaseFirst(value: string) {
  return value ? value.charAt(0).toLocaleLowerCase("pt-BR") + value.slice(1) : value
}

function titleForFact(context: CosKnowledgeContext, fact: CosKnowledgeFact) {
  return context.selectedDocuments.find((document) => document.id === fact.sourceId)?.title ?? null
}

function naturalizeKnowledgeFact(fact: CosKnowledgeFact, context: CosKnowledgeContext) {
  let text = sanitizeCosResponseText(fact.text)
    .replace(/\s*→\s*/g, ", depois ")
    .replace(/\bRegistry\b/gi, "EME")
    .replace(/\bhandlers?\b/gi, "recursos")
    .replace(/\bdescriptors?\b/gi, "regras")
    .replace(/\//g, " ou ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text || /\b(?:schema version|conversation snapshot|payload|prisma)\b/i.test(text)) return ""
  if (/apresentação do cadastro técnico/i.test(text)) return ""

  const title = titleForFact(context, fact)
  const startsWithInfinitive = /^[\p{L}-]+r\b/u.test(text)
  if (fact.heading === "para que serve" && title && startsWithInfinitive) {
    text = `${title} ajuda a ${lowercaseFirst(text)}`
  } else if (fact.heading === "o que o usuario pode fazer" && startsWithInfinitive) {
    text = `Você pode ${lowercaseFirst(text)}`
  } else if (fact.heading === "o que o cos pode fazer") {
    text = text.replace(/^O COS pode\b/i, "Posso").replace(/^[\p{L}-]+r\b/u, (verb) => `Posso ${lowercaseFirst(verb)}`)
    text = text.replace(/\s+conforme\b.*$/i, "")
  } else if (fact.heading === "fluxos principais" && /^Cadastro e atendimento de clientes;/i.test(text)) {
    text = "No EME, você pode gerenciar clientes e imóveis, criar propostas e contratos, organizar compromissos, publicar e gerar conteúdo"
  }

  return withFinalPunctuation(text)
}

function truncateResponse(value: string, maxChars: number) {
  if (value.length <= maxChars) return value
  const candidate = value.slice(0, maxChars + 1)
  const sentenceEnd = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "), candidate.lastIndexOf("\n"))
  if (sentenceEnd >= Math.floor(maxChars * 0.55)) return candidate.slice(0, sentenceEnd + 1).trim()
  const wordEnd = candidate.lastIndexOf(" ")
  return `${candidate.slice(0, wordEnd > 0 ? wordEnd : maxChars).trimEnd()}…`
}

export function normalizeCosGroundedResponse(value: string, detailed: boolean) {
  const maxUnits = detailed ? 8 : 3
  const maxChars = detailed ? 1_600 : 520
  const units = value
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => sanitizeCosResponseText(line.replace(/^#{1,6}\s+/, "").replace(/^(?:[-*]|\d+[.)])\s+/, "")))
    .filter(Boolean)
    .slice(0, maxUnits)
    .map(withFinalPunctuation)
  return truncateResponse(detailed ? units.map((unit) => `- ${unit}`).join("\n") : units.join(" "), maxChars)
}

export function normalizeCosHelpResponse(value: string, detailed: boolean) {
  const response = normalizeCosGroundedResponse(value, detailed)
  if (!response || /\b(?:se quiser|posso ajudar|posso fazer)\b/i.test(response)) return response
  if (detailed) return normalizeCosGroundedResponse(`${response}\n${DEFAULT_HELP_OFFER}`, true)

  const units = response.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2)
  return normalizeCosGroundedResponse([...units, DEFAULT_HELP_OFFER].join(" "), false)
}

export function formatCosKnowledgeFactsForResponse(input: {
  message: string
  context: CosKnowledgeContext
}) {
  return selectCosKnowledgeFacts({ message: input.message, context: input.context })
    .map((fact) => `[${titleForFact(input.context, fact) ?? fact.sourceId} · ${fact.heading}] ${fact.text}`)
    .join("\n")
}

export function buildCosGroundedHelpResponse(input: {
  message: string
  context: CosKnowledgeContext
}) {
  const detailed = isDetailedCosKnowledgeRequest(input.message)
  const comparison = /\b(?:diferença|diferenca|comparar|comparação|comparacao)\b/i.test(input.message)
  const facts = selectCosKnowledgeFacts({
    message: input.message,
    context: input.context,
    limit: detailed ? 8 : 4,
  })
  const presentedFacts = facts
    .map((fact) => naturalizeKnowledgeFact(fact, input.context))
    .filter((fact, index, values) => Boolean(fact) && values.indexOf(fact) === index)
    .slice(0, detailed ? 8 : comparison ? 3 : 2)
  if (presentedFacts.length === 0) return ""

  if (detailed) return normalizeCosGroundedResponse([...presentedFacts, DEFAULT_HELP_OFFER].join("\n"), true)
  if (comparison) return normalizeCosGroundedResponse(presentedFacts.join(" "), false)
  return normalizeCosGroundedResponse([...presentedFacts, DEFAULT_HELP_OFFER].join(" "), false)
}

export async function formatCosCapabilityResponse(input: {
  message: string
  action: string
  capability: CosCapabilityDefinition
  actionResponse: string
}) {
  return sanitizeCosResponseText(input.actionResponse)
}

export async function formatCosExecutionPlanResponse(input: {
  message: string
  plan: CosExecutionPlan
  result: CosExecutionPlanResult
}) {
  return buildCosExecutionResponseViewModel(input).text
}
