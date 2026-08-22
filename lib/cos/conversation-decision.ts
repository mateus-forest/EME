import { getCosCapabilityDescriptorByAliasOrAction, getCosCapabilityDescriptorById, listCosCapabilityCatalog } from "@/lib/cos/capability-catalog"
import { classifyCosSocialIntent } from "@/lib/cos/conversation"
import { resolveCosConversationReference } from "@/lib/cos/conversation-snapshot"
import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"
import { classifyCosPendingReply, hasCosPendingRejectionFollowUp } from "@/lib/cos/pending-input"

import type {
  CosAttachmentInput,
  CosCapabilityDescriptor,
  CosCapabilityId,
  CosCapabilitySurface,
  CosConversationDomain,
  CosConversationEntityReference,
  CosConversationEntityType,
  CosConversationMemory,
  CosConversationSnapshot,
  CosDialogueAct,
  CosDialogueDecision,
  CosDialogueDecisionCandidate,
  CosPendingInput,
  CosSemanticInterpretation,
  CosSemanticInterpretationInput,
  CosWorkflow,
  CosWorkspaceContext,
} from "@/lib/cos/types"

export const COS_DECISION_CONFIDENCE = {
  high: 0.82,
  medium: 0.62,
  queryMinimum: 0.56,
  mutationMinimum: 0.72,
  ambiguityMargin: 0.08,
} as const

export function isCosDialogueDecisionAuthoritativeForCapability(input: {
  decision: CosDialogueDecision | null | undefined
  capabilityId: CosCapabilityId
}) {
  return Boolean(
    input.decision &&
    input.decision.source !== "fallback" &&
    input.decision.selectedCapabilityId === input.capabilityId &&
    !input.decision.needsClarification,
  )
}

const INTERNAL_ONLY_CAPABILITIES = new Set<CosCapabilityId>()

const GENERIC_TOKENS = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "ela", "ele",
  "em", "esse", "essa", "este", "esta", "me", "meu", "minha", "na", "nas", "no", "nos",
  "o", "os", "ou", "para", "por", "pra", "que", "se", "um", "uma", "voce",
])

const NATURAL_MUTATION_VERBS = new Set([
  "cadastra", "cadastre", "cadastrar", "cria", "crie", "criar", "gera", "gere", "gerar",
  "publica", "publique", "publicar", "despublica", "despublique", "despublicar",
  "atualiza", "atualize", "atualizar", "edita", "edite", "editar", "altera", "altere", "alterar",
  "reagenda", "reagende", "reagendar", "agenda", "agende", "agendar", "marca", "marque", "marcar",
  "conclui", "conclua", "concluir", "exclui", "exclua", "excluir", "remove", "remova", "remover",
  "apaga", "apague", "apagar", "deleta", "delete", "deletar", "envia", "envie", "enviar",
  "assina", "assine", "assinar", "cancela", "cancele", "cancelar", "desmarca", "desmarque", "desmarcar",
  "anexa", "anexe", "anexar", "melhora", "melhore", "melhorar", "arquiva", "arquive", "arquivar",
  "adiciona", "adicione", "adicionar", "aprova", "aprove", "aprovar", "responde", "responda", "responder",
  "troca", "troque", "trocar", "tira", "tire", "tirar", "coloca", "coloque", "colocar",
  "monta", "monte", "montar", "passa", "passe", "passar", "faz", "faca", "usar", "usa",
])

const NATURAL_QUERY_COMMANDS = new Set([
  "abre", "abra", "abrir", "analisa", "analise", "analisar", "busca", "busque", "buscar", "consulta", "consulte", "consultar",
  "encontra", "encontre", "encontrar", "lista", "liste", "listar", "localiza", "localize", "localizar", "mostra", "mostre", "mostrar",
  "procura", "procure", "procurar", "revisa", "revise", "revisar", "ver",
])

const ORIENTATION_SIGNAL = /\b(?:como (?:comeco|comecar)|por onde (?:comeco|comecar)|primeiros passos|sou nov[oa])\b/

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !GENERIC_TOKENS.has(token))
}

function isDeterministicPendingReply(input: {
  message: string
  pendingInput: CosPendingInput | null
  decision: CosDialogueDecision
  attachments: CosAttachmentInput[]
}) {
  const pending = input.pendingInput
  if (!pending) return false
  if (["confirm", "reject", "cancel", "select"].includes(input.decision.dialogueAct)) return true
  if (input.decision.dialogueAct !== "provide_input") return false

  const normalized = normalizeText(input.message)
  if (pending.type === "phone") return input.message.replace(/\D/g, "").length >= 10
  if (["currency", "number", "date", "time"].includes(pending.type)) return /\d/.test(normalized)
  if (pending.type === "selection") return /^\d{1,2}$/.test(normalized) || normalized.split(/\s+/).length <= 4
  if (["attachments", "document", "imageUrls"].includes(pending.field)) return input.attachments.length > 0
  return pending.type === "text" && normalized.split(/\s+/).length <= 5
}

export function evaluateCosAiDialogueInterpretationTrigger(input: {
  message: string
  requestedAction?: string | null
  structuredInteraction?: boolean
  pendingInput: CosPendingInput | null
  decision: CosDialogueDecision
  attachments: CosAttachmentInput[]
}) {
  const securityAudit = evaluateCosDecisionSecurity({
    message: input.message,
    attachments: input.attachments.map((attachment) => ({
      name: attachment.name,
      textContent: attachment.textContent,
    })),
  })
  if (securityAudit.flagged) return { shouldTry: false, triggerReason: null }
  if (input.requestedAction || input.structuredInteraction || input.decision.source === "explicit_interface") {
    return { shouldTry: false, triggerReason: null }
  }
  if (["social", "confirm", "reject", "cancel", "select", "provide_input"].includes(input.decision.dialogueAct) &&
      (input.decision.dialogueAct === "social" || isDeterministicPendingReply(input))) {
    return { shouldTry: false, triggerReason: null }
  }

  const normalized = normalizeText(input.message)
  const contextualSignals = /\b(aquele|aquela|aquilo|esse|essa|isso|ele|ela|dele|dela|outro|outra|anterior|antes disso|depois disso|voltando|retomando)\b/.test(normalized)
  const correctionSignals = /\b(na verdade|corrig\w*|quis dizer|troca\w*|muda para|o correto|estava errado)\b/.test(normalized)
  const compoundSignals = /\b(e depois|e tambem|alem disso|antes de|depois de|mas antes|ao mesmo tempo)\b/.test(normalized) ||
    (input.decision.secondaryDomains.length > 0 && /\be\b/.test(normalized))
  const recommendationSignals = /\b(recomend\w*|compar\w*|melhor opcao|alguma coisa boa|o que faz mais sentido|sugere|sugira)\b/.test(normalized)
  const topicSignals = /\b(mudando de assunto|agora sobre|voltando|retomando|antes disso)\b/.test(normalized)

  if (contextualSignals) return { shouldTry: true, triggerReason: "contextual_reference" }
  if (correctionSignals) return { shouldTry: true, triggerReason: "contextual_correction" }
  if (compoundSignals) return { shouldTry: true, triggerReason: "compound_request" }
  if (recommendationSignals) return { shouldTry: true, triggerReason: "recommendation_or_comparison" }
  if (topicSignals) return { shouldTry: true, triggerReason: "topic_transition" }
  if (input.decision.needsClarification) return { shouldTry: true, triggerReason: "deterministic_ambiguity" }
  if (input.decision.dialogueAct === "unknown" || input.decision.source === "fallback" || input.decision.selectedCapabilityId === "general.chat") {
    return { shouldTry: true, triggerReason: "deterministic_fallback" }
  }
  if (input.decision.dialogueActConfidence < COS_DECISION_CONFIDENCE.high) {
    return { shouldTry: true, triggerReason: "low_dialogue_confidence" }
  }

  return { shouldTry: false, triggerReason: null }
}

function tokensMatch(left: string, right: string) {
  if (left === right) return true
  if (left.length >= 4 && right.length >= 4 && left.slice(0, 4) === right.slice(0, 4)) return true
  if (left.endsWith("s") && left.slice(0, -1) === right) return true
  if (right.endsWith("s") && right.slice(0, -1) === left) return true
  return false
}

function hasAny(message: string, tokens: string[]) {
  return tokens.some((token) => message.includes(token))
}

function describesLeadByNeed(message: string) {
  return /\bquem\b.*\b(?:quer\w*|procur\w*|busc\w*|precis\w*)\b/.test(message) ||
    /\b(?:aquele|aquela)\s+(?:cliente|lead|contato|pessoa|cara)\b.*\b(?:quer\w*|procur\w*|busc\w*|precis\w*)\b/.test(message)
}

function describesPastLeadPreference(message: string) {
  return /\b(?:aquele|aquela)\s+(?:cliente|lead|contato|pessoa|cara)\b.*\b(?:queria|procurava|buscava)\b/.test(message) ||
    /\b(?:queria|procurava|buscava)\b.*\bquem\b|\bquem\b.*\b(?:queria|procurava|buscava)\b/.test(message)
}

function descriptorDomain(descriptor: CosCapabilityDescriptor): CosConversationDomain {
  if (descriptor.id.startsWith("help.")) return "help"
  if (descriptor.domain === "property") return "property"
  if (descriptor.domain === "lead") return "lead"
  if (descriptor.domain === "proposal") return "proposal"
  if (descriptor.domain === "contract") return "contract"
  if (descriptor.domain === "document") return "contract"
  if (descriptor.domain === "agenda") return "agenda"
  if (descriptor.domain === "catalog") return "catalog"
  if (descriptor.domain === "finance") return "finance"
  if (descriptor.domain === "analytics" || descriptor.domain === "operation") return "analytics"
  if (descriptor.domain === "studio") return "studio"
  return "general"
}

function entityDomain(type: CosConversationEntityType | null | undefined): CosConversationDomain | null {
  if (type === "lead") return "lead"
  if (type === "property") return "property"
  if (type === "proposal") return "proposal"
  if (type === "contract") return "contract"
  if (type === "agenda") return "agenda"
  return null
}

function workspaceDomain(entity: string | null | undefined): CosConversationDomain | null {
  if (entity === "studio_ia") return "studio"
  if (entity === "document") return "contract"
  if (entity === "operation") return "analytics"
  if (entity === "conversation") return "general"
  if (["lead", "property", "proposal", "contract", "agenda", "catalog", "finance", "analytics"].includes(entity ?? "")) {
    return entity as CosConversationDomain
  }
  return null
}

function topicDomain(domain: string | null | undefined): CosConversationDomain | null {
  if (!domain) return null
  if (["lead", "property", "proposal", "contract", "agenda", "catalog", "marketplace", "account", "plan", "library", "history", "security", "finance", "studio", "general"].includes(domain)) {
    return domain as CosConversationDomain
  }
  if (domain === "analytics" || domain === "operation") return "analytics"
  return null
}

function detectMentionedDomains(message: string): CosConversationDomain[] {
  const detected: CosConversationDomain[] = []
  const add = (domain: CosConversationDomain, matches: boolean) => {
    if (matches && !detected.includes(domain)) detected.push(domain)
  }

  add("lead", /\b(cliente|clientes|lead|leads|contato|contatos|cadastro do cliente)\b/.test(message) || describesLeadByNeed(message) || /\bcadastr\w*\b(?![^.]*\bimove)/.test(message))
  add("property", /\b(imovel|imoveis|apartamento|apartamentos|casa|casas|terreno|terrenos|sala comercial|comercial|residencial)\b/.test(message) || /\b(?:procur\w*|busc\w*|encontr\w*)\b.*\b(?:algo|alguma coisa)\b.*\b(?:pra|pro|para)\b/.test(message))
  add("proposal", /\b(proposta|propostas)\b/.test(message))
  add("contract", /\b(contrato|contratos|assinatura)\b/.test(message))
  add("agenda", /\b(agenda|compromisso|compromissos|evento|eventos|visita|visitas|reuniao|reunioes|lembrete)\b/.test(message))
  add("catalog", /\b(catalogo|catalogos)\b/.test(message))
  add("marketplace", /\b(marketplace|mercado publico|portal publico)\b/.test(message) || /\bconversa\b.*\b(?:atendimento|encerrada|aberta)\b/.test(message) || /\bavaliacao\b.*\b(?:estrela|aprova|modera)\w*\b/.test(message))
  add("account", /\b(creci|senha|seguranca da conta|minha conta|meu telefone|meu e mail)\b/.test(message))
  add("plan", /\b(plano|planos|assinatura atual|capacidade da carteira|creditos?)\b/.test(message))
  add("library", /\b(biblioteca|arte|artes|material|materiais|asset|assets)\b/.test(message))
  add("history", /\b(historico de conversa|conversa antiga|retomar conversa)\b/.test(message) || /\b(?:volt\w*|retom\w*)\b.*\bconversa\b/.test(message))
  add("finance", /\b(financeiro|financeira|comissao|comissoes|recebiveis|despesas|pagamentos|caixa|cashflow|forecast)\b/.test(message))
  add("analytics", /\b(analytics|desempenho|performance|perform\w*|metricas|estatisticas|conversao|ranking|visualiz\w*|operacao)\b/.test(message) || /\b(?:teve mais procura|pessoas estao procurando|gente buscando|resolver primeiro)\b/.test(message))
  add("studio", /\b(studio|campanha|campanhas|instagram|facebook|story|stories|reel|reels|video|videos)\b/.test(message) || /\b(?:divulg\w*|promov\w*)\b.*\bimove(?:l|is)\b/.test(message))
  add("help", /\b(sistema|modulo|modulos|funcionalidade|funcionalidades)\b/.test(message))

  if (/\bquantos? (?:imoveis|clientes|leads|contratos|propostas)\b/.test(message) && !detected.includes("analytics")) {
    detected.push("analytics")
  }
  return detected
}

function lastContextDescriptor(snapshot: CosConversationSnapshot | null, activeWorkflow: CosWorkflow | null) {
  const active = getCosCapabilityDescriptorByAliasOrAction(workflowAction(activeWorkflow))
  if (active) return active
  if (snapshot?.lastExecution?.capabilityId) {
    const descriptor = getCosCapabilityDescriptorById(snapshot.lastExecution.capabilityId)
    if (descriptor) return descriptor
  }
  const byLastAction = getCosCapabilityDescriptorByAliasOrAction(snapshot?.lastAction)
  if (byLastAction) return byLastAction
  for (const message of [...(snapshot?.recentMessages ?? [])].reverse()) {
    const descriptor = getCosCapabilityDescriptorByAliasOrAction(message.action)
    if (descriptor) return descriptor
  }
  return null
}

function hasOperationalQuestionStructure(message: string) {
  return /^(?:como|onde|quando|quem|qual|quais|quanto|quantos|quantas|por que|porque|o que|tem|esta|estao|foi|foram)\b/.test(message) ||
    /^(?:e\s+)?(?:quem|qual|quais|quanto|quantos|quantas|onde|quando|como|tem|esta|estao|foi)\b/.test(message)
}

function hasNaturalMutationVerb(message: string) {
  return message.split(/\s+/).some((token) => NATURAL_MUTATION_VERBS.has(token))
}

function hasNaturalQueryVerb(message: string) {
  return /\b(?:procur\w*|busc\w*|encontr\w*|localiz\w*|consult\w*|abr(?:e|ir)|mostr\w*|list\w*|analis\w*|revis\w*)\b/.test(message)
}

function hasNaturalQueryCommand(message: string) {
  const tokens = message.split(/\s+/).filter(Boolean)
  if (NATURAL_QUERY_COMMANDS.has(tokens[0] ?? "")) return true
  if (!["me", "quero", "gostaria", "preciso"].includes(tokens[0] ?? "")) return false
  const commandIndex = tokens[1] === "de" ? 2 : 1
  return NATURAL_QUERY_COMMANDS.has(tokens[commandIndex] ?? "")
}

function hasSingleTokenLeadTarget(message: string) {
  const tokens = message.split(/\s+/).filter(Boolean)
  const boundaries = new Set([
    "amanha", "as", "ate", "com", "da", "de", "depois", "do", "e", "em", "hoje", "na", "no",
    "num", "numa", "para", "por", "pra", "pro", "segunda", "sexta", "quinta", "sabado", "domingo", "terca", "quarta",
  ])
  const contextualReferences = new Set(["aquele", "aquela", "ele", "ela", "esse", "essa", "este", "esta"])
  const articles = new Set(["a", "o"])
  const entityNouns = new Set(["cliente", "contato", "lead", "pessoa"])
  const nonPersonTargets = new Set([
    ...boundaries,
    "apartamento", "casa", "data", "duracao", "entrada", "horario", "imovel", "investimento", "locacao",
    "morar", "terreno", "temporada", "valor", "venda",
  ])

  for (let index = 0; index < tokens.length; index += 1) {
    if (!["com", "para", "pra", "pro"].includes(tokens[index])) continue
    let targetIndex = index + 1
    if (articles.has(tokens[targetIndex] ?? "")) targetIndex += 1
    if (entityNouns.has(tokens[targetIndex] ?? "")) targetIndex += 1
    const firstToken = tokens[targetIndex]
    if (!firstToken || contextualReferences.has(firstToken) || nonPersonTargets.has(firstToken)) continue
    const nextToken = tokens[targetIndex + 1]
    if (!nextToken || boundaries.has(nextToken)) return true
  }
  return false
}

function openNamedTargetDomain(message: string): "lead" | "property" | null {
  const match = message.match(/^(?:abre|me mostra|mostra)\s+(?:(?:o|a)\s+)?(.+)$/u)
  const target = match?.[1]?.trim()
  if (!target) return null
  if (/\b(?:imovel|apartamento|casa|terreno|sala|comercial|residencial|residence)\b/.test(target)) return "property"
  return target.split(/\s+/).length > 1 ? "lead" : null
}

function prioritizeRecentDomains(message: string, domains: CosConversationDomain[]) {
  const channel = domains.find((domain) => {
    if (domain === "marketplace") return /\bmarketplace\b/.test(message)
    if (domain === "catalog") return /\bcatalogo\b/.test(message)
    if (domain === "history") return /\b(?:historico|conversa antiga|retom\w* conversa|volt\w*.*conversa)\b/.test(message)
    if (domain === "studio") return /\b(?:studio|campanha|instagram|facebook|story|reel|video|divulg\w*|promov\w*)\b/.test(message)
    return false
  })
  return channel ? [channel, ...domains.filter((domain) => domain !== channel)] : domains
}

function preferredConversationDomain(input: {
  message: string
  act: CosDialogueAct
  mentionedDomains: CosConversationDomain[]
  pendingInput: CosPendingInput | null
  topicDomain: CosConversationDomain | null
  referenceDomain: CosConversationDomain | null
  contextDescriptor: CosCapabilityDescriptor | null
  recentDomains: CosConversationDomain[]
}) {
  const message = input.message
  const contextualAct = ["provide_input", "correct", "confirm", "reject", "cancel", "select"].includes(input.act)
  if (contextualAct) {
    return input.topicDomain ?? (input.contextDescriptor ? descriptorDomain(input.contextDescriptor) : null) ?? pendingDomain(input.pendingInput) ?? input.referenceDomain
  }
  if (input.act === "context") {
    return input.mentionedDomains.find((domain) => domain !== "help") ?? input.topicDomain ?? input.referenceDomain
  }
  if (input.act === "capability_question" && input.contextDescriptor && /\b(isso|esse|essa|custa|creditos?)\b/.test(message)) {
    return descriptorDomain(input.contextDescriptor)
  }

  const recentPublicationChannel = input.recentDomains.find((domain) => domain === "marketplace" || domain === "catalog")
  if (recentPublicationChannel && /\b(?:o que falta|quais? pendencias?|o que ainda precisa)\b/.test(message)) return recentPublicationChannel

  if (input.mentionedDomains.includes("catalog") && /\b(catalogo|nao aparece|complet\w*|tira\w*|despublic\w*)\b/.test(message)) return "catalog"
  if (input.act === "execute" && /\b(?:publica|publique|publicar)\b/.test(message) && !input.mentionedDomains.includes("marketplace")) return "catalog"
  if (input.mentionedDomains.includes("marketplace") && !/\b(?:diferenca|catalogo)\b.*\bmarketplace\b/.test(message)) return "marketplace"
  if (input.mentionedDomains.includes("library")) return "library"
  if (input.mentionedDomains.includes("history")) return "history"
  if (input.mentionedDomains.includes("plan")) return /\bcos\b.*\bcreditos?\b/.test(message) ? "general" : "plan"
  if (/\bquantos?\s+imoveis\b.*\b(?:ainda posso|posso cadastrar|cabem|capacidade)\b/.test(message)) return "plan"
  if (input.mentionedDomains.includes("account")) return "account"
  if (input.mentionedDomains.includes("studio") || /\b(campanha|video|instagram|facebook|story|reel)\b/.test(message)) return "studio"
  if (input.mentionedDomains.includes("proposal") && !/^cadastr\w*\b/.test(message)) return "proposal"
  if (input.mentionedDomains.includes("contract")) return "contract"
  if (input.mentionedDomains.includes("agenda") || (/\b(amanha|sexta|dia \d+|\d+h|hoje)\b/.test(message) && /\b(marc\w*|agend\w*|compromisso|visita|o que tenho)\b/.test(message))) return "agenda"
  if ((input.mentionedDomains.includes("analytics") || (input.contextDescriptor && descriptorDomain(input.contextDescriptor) === "analytics")) && /\b(performance|perform\w*|desempenho|visualiz\w*|procur\w*|busc\w*|contatos|conversao|operacao|metricas|estatisticas|atencao|resolver primeiro)\b/.test(message)) return "analytics"
  if (describesLeadByNeed(message) || /\bprecisando de atencao\b/.test(message)) return "lead"
  if (input.referenceDomain && /^(?:abre|me mostra|mostra)\b/.test(message)) return input.referenceDomain
  const openTargetDomain = openNamedTargetDomain(message)
  if (openTargetDomain) return openTargetDomain
  if (/^cadastr\w*\b/.test(message) && !/\bcadastr\w*\b.{0,30}\bimovel\b/.test(message)) return "lead"
  if (input.mentionedDomains.includes("property")) return "property"
  if (input.mentionedDomains.includes("lead")) return "lead"
  if (/\b(?:procur\w*|algo|alguma coisa)\b.*\b(?:pra|pro|para)\b/.test(message)) return "property"
  if (input.recentDomains.length > 0 && (!input.contextDescriptor || ["help", "general"].includes(descriptorDomain(input.contextDescriptor)))) return input.recentDomains[0]
  if (input.referenceDomain && /\b(?:documentos?|cadastro|historico|propostas?|contratos?)\b.*\b(?:dele|dela|deles|delas)\b/.test(message)) return input.referenceDomain
  if (input.contextDescriptor) {
    const domain = descriptorDomain(input.contextDescriptor)
    return domain === "help" ? input.mentionedDomains.find((candidate) => candidate !== "help") ?? "general" : domain
  }
  return input.topicDomain ?? input.referenceDomain ?? input.mentionedDomains.find((domain) => domain !== "help") ?? null
}

function workflowAction(workflow: CosWorkflow | null) {
  return workflow?.pendingInput?.action ?? workflow?.steps[workflow.currentStep]?.action ?? workflow?.steps[0]?.action ?? null
}

function pendingDomain(pendingInput: CosPendingInput | null): CosConversationDomain | null {
  if (!pendingInput) return null
  if (pendingInput.entity === "lead") return "lead"
  if (pendingInput.entity === "property") return "property"
  if (pendingInput.entity === "proposal") return "proposal"
  if (pendingInput.entity === "contract") return "contract"
  if (pendingInput.entity === "agenda") return "agenda"
  if (pendingInput.entity === "catalog") return "catalog"
  if (pendingInput.entity === "finance") return "finance"
  if (pendingInput.entity === "studio_ia") return "studio"
  return null
}

function legacyReference(memory: CosConversationMemory | null, domain: CosConversationDomain): CosConversationEntityReference | null {
  const now = memory?.updatedAt ?? new Date(0).toISOString()
  if (domain === "lead") {
    const id = memory?.selectedClient?.id ?? memory?.leadId
    return id ? { type: "lead", id, label: memory?.selectedClient?.label ?? null, source: "legacy_memory", lastMentionedAt: now, confidence: 0.8, evidence: "legacy_memory" } : null
  }
  if (domain === "property") {
    const id = memory?.selectedProperty?.id ?? memory?.propertyId
    return id ? { type: "property", id, label: memory?.selectedProperty?.label ?? null, source: "legacy_memory", lastMentionedAt: now, confidence: 0.8, evidence: "legacy_memory" } : null
  }
  if (domain === "proposal") {
    const id = memory?.selectedProposal?.id ?? memory?.proposalId
    return id ? { type: "proposal", id, label: memory?.selectedProposal?.label ?? null, source: "legacy_memory", lastMentionedAt: now, confidence: 0.8, evidence: "legacy_memory" } : null
  }
  if (domain === "contract") {
    const id = memory?.selectedContract?.id ?? memory?.contractId
    return id ? { type: "contract", id, label: memory?.selectedContract?.label ?? null, source: "legacy_memory", lastMentionedAt: now, confidence: 0.8, evidence: "legacy_memory" } : null
  }
  return null
}

function inferDialogueAct(input: {
  rawMessage: string
  normalized: string
  hasQuestionMark: boolean
  requestedDescriptor: CosCapabilityDescriptor | null
  pendingInput: CosPendingInput | null
  activeWorkflow: CosWorkflow | null
  snapshot: CosConversationSnapshot | null
  mentionedDomains: CosConversationDomain[]
  referenceResolved: boolean
  referenceReason: string
  referenceType: CosConversationEntityType | null
  contextDescriptor: CosCapabilityDescriptor | null
  attachments: CosAttachmentInput[]
}) {
  const evidence: string[] = []
  const message = input.normalized
  const hasActiveContext = Boolean(
    input.activeWorkflow ||
    input.pendingInput ||
    input.snapshot?.currentTopic ||
    input.snapshot?.lastExecution ||
    input.snapshot?.lastAction ||
    input.snapshot?.recentMessages.some((item) => item.action) ||
    Object.keys(input.snapshot?.activeEntities ?? {}).length,
  )

  const requestedContinuesPending = Boolean(
    input.requestedDescriptor &&
    input.pendingInput &&
    input.requestedDescriptor.action === input.pendingInput.action,
  )
  if (input.requestedDescriptor && !requestedContinuesPending) {
    const act: CosDialogueAct = input.requestedDescriptor.id.startsWith("help.")
      ? "explain"
      : input.requestedDescriptor.mutatesData
        ? "execute"
        : "query"
    return { act, confidence: 1, evidence: ["requested_action_explicit"] }
  }

  const pendingReply = input.pendingInput ? classifyCosPendingReply(input.rawMessage) : null
  if (pendingReply === "confirm" && input.pendingInput?.type === "confirmation") {
    return { act: "confirm" as const, confidence: 0.99, evidence: ["confirmation_pending", "affirmative_reply"] }
  }
  if (pendingReply === "reject" && input.pendingInput?.type === "confirmation") {
    return { act: "reject" as const, confidence: 0.99, evidence: ["confirmation_pending", "negative_reply"] }
  }
  if (pendingReply === "cancel") return { act: "cancel" as const, confidence: 0.99, evidence: ["pending_context", "cancel_marker"] }
  if (pendingReply === "answer" && input.pendingInput?.type === "confirmation" && /^nao\s+(?:cancelar|cancela|deixa|esquece)\b/.test(message)) {
    return { act: "provide_input" as const, confidence: 0.62, evidence: ["confirmation_pending", "negated_cancel_ambiguous"] }
  }

  if (input.requestedDescriptor) {
    const act: CosDialogueAct = input.requestedDescriptor.id.startsWith("help.")
      ? "explain"
      : input.requestedDescriptor.mutatesData
        ? "execute"
        : "query"
    return { act, confidence: 1, evidence: ["requested_action_explicit"] }
  }

  const socialIntent = classifyCosSocialIntent(message)
  if (socialIntent === "capabilities" || socialIntent === "identity") {
    return { act: "explain" as const, confidence: 0.98, evidence: [`informational_social:${socialIntent}`] }
  }
  if (socialIntent) return { act: "social" as const, confidence: 0.98, evidence: [`social:${socialIntent}`] }

  if (
    /\b(voce|o cos) (consegue|pode|sabe)\b/.test(message) ||
    /\b(da para|da pra|tem como|e possivel)\b/.test(message) ||
    /^(?:se|quando) eu (?:falar|disser|mandar|pedir)\b.*\bvoce\b/.test(message) ||
    /^se eu\b.*\b(?:mandar|pedir|falar)\b.*\b(?:muda|faz|executa|cadastra|publica|gera)\b/.test(message) ||
    /^(?:quanto|quantos) (?:custa|creditos).*\b(?:gerar|criar|fazer)\b/.test(message)
    || /\b(?:custa|consome)\b.*\bcreditos?\b/.test(message)
  ) {
    return { act: "capability_question" as const, confidence: 0.96, evidence: ["capability_question_structure"] }
  }

  const correction = /^(na verdade\s+|corrige(?: para)?\s+|muda(?: para)?\s+|troca(?: para)?\s+|quis dizer\s+|nao\s+(?:coloca|muda|troca|corrige|o valor|o preco|a data|o horario|e\s+\d))/.test(message) ||
    /\b(esta errado|estava errado|o correto e|na realidade)\b/.test(message)
  if ((correction || pendingReply === "correction") && hasActiveContext) {
    return { act: "correct" as const, confidence: 0.96, evidence: ["explicit_correction_marker", "active_context"] }
  }

  const returnTopic = /\b(voltando|volta(?:ndo)?|retomando|retoma|de volta|sobre aquel[ea]|anterior)\b/.test(message)
  const distantEntityReturn = /\b(?:aquele|aquela)\s+(?:cliente|lead|imovel|contrato|proposta)\b/.test(message) &&
    input.referenceResolved && input.contextDescriptor && entityDomain(input.referenceType) !== descriptorDomain(input.contextDescriptor)
  if (returnTopic || distantEntityReturn) {
    return { act: "return_topic" as const, confidence: 0.94, evidence: ["return_topic_marker", "recent_topic_available"] }
  }

  const selection =
    (!input.hasQuestionMark && /^(?:o |a )?(?:primeir[oa]|segund[oa]|terceir[oa]|ultim[oa]|anterior|mais barat[oa]|mais complet[oa])(?:\s+.+)?$/.test(message)) ||
    /^\d{1,2}$/.test(message) ||
    (/^(manda|envia|abre|usa|faz)\b/.test(message) && /\b(esse|essa|aquele|aquela)\b/.test(message)) ||
    (["selection_label", "selection_ranked_price"].includes(input.referenceReason) && message.split(/\s+/).length <= 4)
  if (selection) {
    return input.referenceResolved || input.snapshot?.selectionSets.length || input.pendingInput?.options?.length
      ? { act: "select" as const, confidence: 0.95, evidence: ["selection_marker", "selection_context"] }
      : { act: "select" as const, confidence: 0.62, evidence: ["selection_marker", "selection_context_missing"] }
  }

  if (input.pendingInput?.type === "selection" && input.referenceResolved && input.referenceReason.startsWith("selection_")) {
    return { act: "select" as const, confidence: 0.97, evidence: ["pending_selection", input.referenceReason] }
  }

  if (input.pendingInput) {
    if (pendingReply === "correction") return { act: "correct" as const, confidence: 0.97, evidence: ["pending_correction"] }
  }

  if (hasActiveContext && /^(cancela|cancelar|esquece|deixa pra la|deixa para la|para isso)$/.test(message)) {
    return { act: "cancel" as const, confidence: 0.98, evidence: ["isolated_cancel_marker", "active_context"] }
  }

  if (/\b(qual a diferenca|qual e a diferenca|como funciona|como funcionam|como (?:cadastro|cadastrar|excluo|publico|crio|faco|gerencio|gerenciar|administro|administrar|uso|usar)|o que e|o que precisa|o que acontece se|o que significa|por que precisa|onde ficam|me explica|me explique|quero entender)\b/.test(message) ||
    ORIENTATION_SIGNAL.test(message) ||
    /^(?:quantas?|quantos?)\b.*\b(?:precisa|exige|necessari[oa]s?)\b/.test(message) ||
    (/^por que\b/.test(message) && !/\b(meu|minha|nao consigo|nao aparece|\d+\s*(?:%|por cento))\b/.test(message)) ||
    /^(?:o|a)\s+\w+(?:\s+\w+){0,3}\s+consegue\b.*\b(?:eme|sistema)\b/.test(message) ||
    /^o que (?:o )?(?:eme|cos) faz\b/.test(message) ||
    /^posso\b/.test(message) ||
    (/^e\s+com\b/.test(message) && !input.referenceResolved && input.contextDescriptor?.id.startsWith("help."))) {
    return { act: "explain" as const, confidence: 0.95, evidence: ["explanation_structure"] }
  }

  const executeSignal = hasNaturalMutationVerb(message)
  const hasLeadContactValue =
    message.replace(/\D/g, "").length >= 10 ||
    (/\bemail\b/.test(message) && !/^(qual|quais|quanto|quantos|tem|mostre|mostrar)\b/.test(message))
  if (!input.pendingInput && input.referenceType === "lead" && hasLeadContactValue && !input.hasQuestionMark && !hasOperationalQuestionStructure(message)) {
    return { act: "execute" as const, confidence: 0.9, evidence: ["active_lead_contact_followup"] }
  }
  const querySignal = input.hasQuestionMark || hasOperationalQuestionStructure(message) || hasNaturalQueryVerb(message) || hasAny(message, [
    "qual ", "quais ", "quanto ", "quantos ", "quantas ", "como esta", "como ficam", "me mostra", "mostre", "mostrar", "liste", "listar",
    "buscar", "busque", "encontre", "consultar", "ver meus", "ver minhas", "proximo compromisso", "so ate", "e com", "antes disso",
  ])
  const switchSignal = /\b(agora|vamos falar|mudando de assunto)\b/.test(message) || /^(?:e\s+)?(?:os|as|quantos|quantas)\b/.test(message)
  const currentDomain = topicDomain(input.snapshot?.currentTopic?.domain)
  const explicitOtherDomain = input.mentionedDomains.some((domain) => domain !== currentDomain && domain !== "analytics")
  if (hasActiveContext && (switchSignal || Boolean(input.pendingInput && querySignal)) && explicitOtherDomain) {
    evidence.push("topic_switch_marker", executeSignal ? "execute_signal" : "query_signal")
    return { act: "switch_topic" as const, confidence: 0.92, evidence }
  }

  if (input.pendingInput) {
    const hasAttachmentAnswer = input.attachments.length > 0 && ["attachments", "document", "imageUrls"].includes(input.pendingInput.field)
    const pendingDomainValue = pendingDomain(input.pendingInput)
    const unrelatedDomain = input.mentionedDomains.some((domain) => domain !== pendingDomainValue && domain !== "analytics")
    const hasNumericValue = /\d/.test(message)
    const compatibleTypedValue =
      (input.pendingInput.type === "phone" && message.replace(/\D/g, "").length >= 10) ||
      (["currency", "number", "date", "time"].includes(input.pendingInput.type) && hasNumericValue) ||
      (input.pendingInput.type === "selection" && input.referenceResolved) ||
      (input.pendingInput.type === "text" && !querySignal && !executeSignal)
    if (!unrelatedDomain && (hasAttachmentAnswer || compatibleTypedValue)) {
      return { act: "provide_input" as const, confidence: 0.94, evidence: ["pending_input_present", hasAttachmentAnswer ? "expected_attachment" : "typed_value_compatible"] }
    }
  }

  if (querySignal && (input.hasQuestionMark || hasOperationalQuestionStructure(message))) {
    return { act: "query" as const, confidence: 0.9, evidence: ["question_overrides_operational_verb"] }
  }
  if (executeSignal) return { act: "execute" as const, confidence: 0.9, evidence: ["explicit_execution_verb"] }

  if (
    input.mentionedDomains.some((domain) => domain !== "help") &&
    !hasNaturalQueryCommand(message)
  ) {
    return { act: "context" as const, confidence: 0.88, evidence: ["declarative_context"] }
  }

  if (querySignal) return { act: "query" as const, confidence: 0.88, evidence: ["query_structure"] }

  if (input.referenceResolved) return { act: "query" as const, confidence: 0.78, evidence: ["resolved_reference"] }
  if (input.contextDescriptor && hasActiveContext) {
    return { act: "query" as const, confidence: 0.72, evidence: ["contextual_continuation", input.contextDescriptor.id] }
  }
  return { act: "unknown" as const, confidence: 0.25, evidence: ["insufficient_dialogue_signals"] }
}

function capabilityOperation(descriptor: CosCapabilityDescriptor): "execute" | "query" | "explain" {
  if (descriptor.id.startsWith("help.")) return "explain"
  if (descriptor.id === "property.description.improve") return "execute"
  if (descriptor.mutatesData) return "execute"
  if (descriptor.id.endsWith(".download")) return "execute"
  return "query"
}

function capabilitySearchText(descriptor: CosCapabilityDescriptor) {
  return normalizeText([
    descriptor.id,
    descriptor.action.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "),
    descriptor.title,
    descriptor.description,
    descriptor.aliases.join(" "),
  ].join(" "))
}

function helpCapabilityBoost(descriptor: CosCapabilityDescriptor, domains: CosConversationDomain[], message: string) {
  if (!descriptor.id.startsWith("help.")) return 0
  if (descriptor.id === "help.first_steps" && ORIENTATION_SIGNAL.test(message)) return 16
  if (domains.includes("property") && descriptor.id === "help.register_properties") return 9
  if (domains.includes("lead") && descriptor.id === "help.manage_clients") return 9
  if ((domains.includes("contract") || domains.includes("proposal")) && descriptor.id === "help.contracts_proposals") return 9
  if ((domains.includes("studio") || domains.includes("library")) && descriptor.id === "help.marketing_studio") return 9
  if (domains.includes("general") && descriptor.id === "help.use_cos" && /\b(?:o que (?:voce|o cos|o eme) (?:consegue|pode|faz)|capacidades? do cos)\b/.test(message)) return 12
  if (domains.includes("general") && descriptor.id === "help.general_question") return 9
  if ((domains.includes("catalog") || domains.includes("marketplace")) && descriptor.id === "help.general_question") return 10
  if (descriptor.id === "help.general_question") return 4
  return 0
}

function semanticCapabilityBoost(descriptor: CosCapabilityDescriptor, message: string, referenceType: CosConversationEntityType | null) {
  let score = 0
  const evidence: string[] = []
  const add = (value: number, reason: string) => {
    score += value
    evidence.push(reason)
  }

  if (descriptor.id === "agenda.today" && /\bhoje\b/.test(message)) add(18, "agenda_today")
  if (descriptor.id === "agenda.week" && /\b(semana|proximos sete dias)\b/.test(message)) add(18, "agenda_week")
  if (descriptor.id === "agenda.month" && /\b(mes|mensal)\b/.test(message)) add(18, "agenda_month")
  if (descriptor.id === "agenda.list" && /\b(amanha|proximo compromisso|proximos compromissos)\b/.test(message)) add(10, "agenda_filtered_query")
  if (descriptor.id === "agenda.create" && /\b(cri\w*|marc\w*|agend\w*|novo compromisso)\b/.test(message)) add(10, "agenda_create")
  if (descriptor.id === "agenda.update" && /\b(alter\w*|reagend\w*|passa\w*|mude o horario|troca\w*)\b/.test(message)) add(11, "agenda_update")
  if (descriptor.id === "agenda.cancel" && /\b(cancel\w*|desmarc\w*)\b/.test(message)) add(11, "agenda_cancel")
  if (descriptor.id === "agenda.complete" && /\b(conclu\w*|marque como concluido|feito)\b/.test(message)) add(10, "agenda_complete")

  if (descriptor.id === "property.get" && referenceType === "property") add(9, "active_property_detail")
  if (descriptor.id === "property.get" && openNamedTargetDomain(message) === "property") add(14, "named_property_open")
  if (descriptor.id === "lead.find" && referenceType === "lead") add(9, "active_lead_detail")
  if (descriptor.id === "lead.find" && (openNamedTargetDomain(message) === "lead" || describesPastLeadPreference(message))) add(14, "named_lead_lookup")
  if (descriptor.id === "contract.get" && referenceType === "contract") add(9, "active_contract_detail")
  if (descriptor.id === "proposal.summary" && referenceType === "proposal") add(7, "active_proposal_detail")
  if (descriptor.id === "property.get" && /\b(metros|metragem|area|quartos|banheiros|vagas)\b/.test(message)) add(8, "property_detail_field")
  if (descriptor.id === "lead.find" && /\b(telefone|whatsapp|email|e mail|contato)\b/.test(message)) add(8, "lead_detail_field")
  if (descriptor.id === "lead.update" && referenceType === "lead" && (message.replace(/\D/g, "").length >= 10 || (/\bemail\b/.test(message) && !/^(qual|quais|quanto|quantos|tem|mostre|mostrar)\b/.test(message)))) add(10, "lead_contact_update")
  if (descriptor.id === "lead.summary" && /\b(?:quant(?:os|as) (?:leads|clientes)|clientes? novos?|precisando de atencao|tem cliente|quem esta)\b/.test(message)) add(12, "lead_summary_query")
  if (descriptor.id === "proposal.summary" && /\b(valor|status|proposta)\b/.test(message)) add(10, "proposal_detail_field")

  if (descriptor.id === "lead.create" && /\bcadastr\w*\b/.test(message) && !/\bcadastr\w*\b.{0,30}\bimovel\b/.test(message)) add(12, "lead_create")
  if (descriptor.id === "property.create" && (/\bcadastr\w*\b.{0,30}\bimovel\b/.test(message) || /\b(novo imovel|cri\w* um imovel)\b/.test(message))) add(12, "property_create")
  if (descriptor.id === "proposal.create" && /\b(?:cri\w*|ger\w*|faz|monta\w*)\b.{0,30}\bproposta\b|\bproposta\b/.test(message)) add(12, "proposal_create")
  if (descriptor.id === "contract.create" && /\b(?:cri\w*|ger\w*|monta\w*)\b.{0,30}\bcontrato\b/.test(message)) add(12, "contract_create")
  if (descriptor.id === "property.search" && /\b(mostr\w*|bus(?:c|qu)\w*|procur\w*|encontr\w*|list\w*|imoveis em|algo\b.*\b(?:pra|pro|para)|alguma coisa)\b/.test(message)) add(11, "property_search")
  if (descriptor.id === "lead.find" && /\b(mostr\w*|busc\w*|procur\w*|encontr\w*|abr\w*|cliente|cadastro)\b/.test(message)) add(8, "lead_query")
  if (descriptor.id === "lead.update" && referenceType === "lead" && /\b(telefon\w*|email|sobrenome|atualiz\w*|troc\w*|errad\w*)\b/.test(message)) add(10, "lead_update")
  if (descriptor.id === "lead.delete" && /\b(exclu\w*|apag\w*|delet\w*|remov\w*)\b/.test(message)) add(12, "lead_delete")
  if (descriptor.id === "lead.timeline" && /\b(aconteceu|ultimamente|antes disso|timeline|historico|interacoes)\b/.test(message)) add(14, "lead_timeline")
  if (descriptor.id === "catalog.publish" && /\b(public\w*|coloca\w*)\b/.test(message)) add(12, "catalog_publish")
  if (descriptor.id === "catalog.unpublish" && /\b(tira\w*|despublic\w*|remov\w*)\b/.test(message)) add(12, "catalog_unpublish")
  if (descriptor.id === "catalog.analyze" && /\b(nao aparece|falta|complet\w*|analis\w*|diagnostic\w*)\b/.test(message)) add(11, "catalog_analyze")
  if (descriptor.id === "property.archive" && /\b(arquiv\w*|exclu\w*|remov\w*)\b/.test(message)) add(12, "property_archive")
  if (descriptor.id === "property.media.update" && /\b(foto|fotos|imagem|imagens|midia|midias)\b/.test(message)) add(10, "property_media")
  if (descriptor.id === "property.description.improve" && /\b(descricao|texto|anuncio)\b.*\b(frac\w*|melhor\w*)|\bmelhor\w*\b.*\b(descricao|texto|anuncio)\b/.test(message)) add(11, "property_description")
  if (descriptor.id === "property.price.suggest" && /\b(quanto|preco|valor)\b.*\b(acha|deveria|pedir|vale)\b/.test(message)) add(14, "property_price")
  if (descriptor.id === "analytics.performance" && /\b(performance|perform\w*|procur\w*|busc\w*|contat\w*|convers\w*|atencao|operacao)\b/.test(message)) add(10, "analytics_performance")
  if (descriptor.id === "analytics.properties" && /\b(imoveis?|visualizacoes?|publicados?)\b/.test(message)) add(9, "analytics_properties")
  if (descriptor.id === "operation.summary" && /\b(saude|operacao|resolver primeiro|atencao)\b/.test(message)) add(12, "operation_summary")
  if (descriptor.id === "studio.generateVideo" && /\bvideo\b/.test(message)) add(12, "studio_video")
  if (descriptor.id === "studio.generateInstagram" && /\binstagram\b/.test(message)) add(12, "studio_instagram")
  if (descriptor.id === "studio.generateCampaign" && /\bcampanha\b/.test(message)) add(9, "studio_campaign")
  if (descriptor.id === "document.list" && /\b(mais documentos?|outros documentos?|listar documentos?)\b/.test(message)) add(18, "document_list")

  if (descriptor.id === "contract.preview" && /\b(preview|revisar|visualizar)\b/.test(message)) add(8, "contract_preview")
  if (descriptor.id === "contract.history" && /\b(historico|andamento|status dos contratos)\b/.test(message)) add(8, "contract_history")
  if (descriptor.id === "contract.list" && /\b(contratos|listar|mostrar)\b/.test(message)) add(4, "contract_list")
  if (descriptor.id === "contract.get" && /\b(contrato|abrir|ver)\b/.test(message)) add(3, "contract_get")

  return { score, evidence }
}

function scoreCandidates(input: {
  message: string
  act: CosDialogueAct
  domains: CosConversationDomain[]
  surface: CosCapabilitySurface
  referenceType: CosConversationEntityType | null
  contextCapabilityId?: CosCapabilityId | null
  targetOperation?: "execute" | "query" | "explain"
}) {
  const messageTokens = tokenize(input.message)
  const operation = input.targetOperation ?? (
    input.act === "explain" ? "explain" : input.act === "execute" ? "execute" : "query"
  )
  const routableDescriptors = listCosRoutableCapabilityDescriptors(input.surface)
  const primaryDomain = input.domains[0]
  const primaryHasCapability = routableDescriptors.some((descriptor) => descriptorDomain(descriptor) === primaryDomain)
  const eligibleDomains = new Set(input.act === "explain" ? ["help"] : primaryHasCapability ? input.domains : primaryDomain ? [primaryDomain] : input.domains)

  return routableDescriptors
    .filter((descriptor) => {
      if (input.act === "explain") return descriptor.id.startsWith("help.")
      if (descriptor.id.startsWith("help.") || descriptor.id === "general.chat") return false
      const domain = descriptorDomain(descriptor)
      if (eligibleDomains.size > 0 && !eligibleDomains.has(domain)) return false
      return capabilityOperation(descriptor) === operation
    })
    .map((descriptor) => {
      const domain = descriptorDomain(descriptor)
      const searchTokens = tokenize(capabilitySearchText(descriptor))
      const overlap = messageTokens.filter((token) => searchTokens.some((candidate) => tokensMatch(token, candidate)))
      const isPrimaryDomain = input.domains[0] === domain
      const domainScore = isPrimaryDomain ? 10 : input.domains.includes(domain) ? 3 : 0
      let score = domainScore + overlap.length * 1.15
      const evidence = [domainScore ? `${isPrimaryDomain ? "primary" : "secondary"}_domain:${domain}` : "", overlap.length ? `tokens:${overlap.join(",")}` : ""].filter(Boolean)
      const exactAlias = descriptor.aliases.find((alias) => normalizeText(alias) === input.message)
      const partialAlias = descriptor.aliases.find((alias) => input.message.includes(normalizeText(alias)))
      if (exactAlias) {
        score += 10
        evidence.push(`exact_alias:${exactAlias}`)
      } else if (partialAlias) {
        score += 5
        evidence.push(`partial_alias:${partialAlias}`)
      }
      const semantic = semanticCapabilityBoost(descriptor, input.message, input.referenceType)
      score += semantic.score + helpCapabilityBoost(descriptor, input.domains, input.message)
      evidence.push(...semantic.evidence)
      if (descriptor.id === "lead.find" && primaryDomain === "lead" && /^(?:o|a)\s+[\p{L}]+(?:\s+[\p{L}]+)?\s+(?:serve|atende|funciona)\b/u.test(input.message)) {
        score += 10
        evidence.push("named_lead_candidate_query")
      }
      if (input.contextCapabilityId === descriptor.id) {
        const contextualRefinement = descriptor.id === "property.search" && /^(?:so|e\s+com|com|ate)\b/.test(input.message)
        score += contextualRefinement ? 12 : 6
        evidence.push(contextualRefinement ? "snapshot_filter_refinement" : "snapshot_capability")
      }
      if (capabilityOperation(descriptor) === operation) {
        score += 3
        evidence.push(`operation:${operation}`)
      }
      return { descriptor, score, evidence }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.descriptor.id.localeCompare(right.descriptor.id))
}

function toDecisionCandidates(scored: ReturnType<typeof scoreCandidates>): CosDialogueDecisionCandidate[] {
  const topScore = scored[0]?.score ?? 0
  return scored.slice(0, 6).map((candidate, index) => {
    const margin = candidate.score - (scored[index + 1]?.score ?? 0)
    const confidence = Math.max(0.35, Math.min(0.98, Number((0.44 + candidate.score / 45 + (margin >= 3 ? 0.1 : 0)).toFixed(2))))
    return {
      capabilityId: candidate.descriptor.id,
      action: candidate.descriptor.action,
      title: candidate.descriptor.title,
      domain: descriptorDomain(candidate.descriptor),
      score: Number(candidate.score.toFixed(2)),
      confidence: index === 0 ? confidence : Math.min(confidence, Math.max(0.35, 0.7 - (topScore - candidate.score) / 30)),
      evidence: candidate.evidence,
      mutatesData: candidate.descriptor.mutatesData,
    }
  })
}

function contextualCapabilityId(type: CosConversationEntityType): CosCapabilityId {
  if (type === "property") return "property.get"
  if (type === "lead") return "lead.find"
  if (type === "proposal") return "proposal.summary"
  if (type === "contract") return "contract.get"
  return "agenda.list"
}

function contextualUpdateCapabilityId(type: CosConversationEntityType): CosCapabilityId | null {
  if (type === "lead") return "lead.update"
  if (type === "contract") return "contract.update"
  if (type === "agenda") return "agenda.update"
  return null
}

function directCandidate(descriptor: CosCapabilityDescriptor, evidence: string[]): CosDialogueDecisionCandidate {
  return {
    capabilityId: descriptor.id,
    action: descriptor.action,
    title: descriptor.title,
    domain: descriptorDomain(descriptor),
    score: 100,
    confidence: 0.99,
    evidence,
    mutatesData: descriptor.mutatesData,
  }
}

function trustedSemanticEntities(input: {
  snapshot: CosConversationSnapshot | null
  workspace: CosWorkspaceContext | null
}) {
  const trusted = new Map<string, { type: CosConversationEntityType; id: string; label: string | null }>()
  const add = (type: CosConversationEntityType | null, id: string | null | undefined, label?: string | null) => {
    if (!type || !id) return
    trusted.set(`${type}:${id}`, { type, id, label: label ?? null })
  }

  for (const entity of Object.values(input.snapshot?.activeEntities ?? {})) {
    if (entity) add(entity.type, entity.id, entity.label)
  }
  for (const entity of input.snapshot?.recentEntities ?? []) add(entity.type, entity.id, entity.label)
  for (const selection of input.snapshot?.selectionSets ?? []) {
    for (const item of selection.items) add(item.entity.type, item.entity.id, item.entity.label)
  }

  const workspaceType = (entity: string | null | undefined): CosConversationEntityType | null => {
    if (entity === "lead" || entity === "property" || entity === "contract" || entity === "agenda") return entity
    if (entity === "document") return "proposal"
    return null
  }
  add(workspaceType(input.workspace?.entity), input.workspace?.entityId)
  for (const selection of input.workspace?.selection ?? []) {
    add(workspaceType(selection.entity), selection.entityId, selection.label)
  }

  return trusted
}

function selectedEntityTypeForDescriptor(descriptor: CosCapabilityDescriptor): CosConversationEntityType | null {
  if (descriptor.entity === "lead" || descriptor.entity === "property" || descriptor.entity === "contract" || descriptor.entity === "agenda") {
    return descriptor.entity
  }
  if (descriptor.entity === "document") return descriptor.domain === "proposal" ? "proposal" : "contract"
  return null
}

export function applyCosAiDialogueInterpretation(input: {
  baseline: CosDialogueDecision
  interpretation: CosSemanticInterpretationInput
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  snapshot: CosConversationSnapshot | null
  activeWorkflow: CosWorkflow | null
}): { decision: CosDialogueDecision; accepted: boolean; validationErrors: string[] } {
  const validationErrors: string[] = []
  if (input.baseline.source === "explicit_interface") {
    return { decision: input.baseline, accepted: false, validationErrors: ["explicit_interface_is_authoritative"] }
  }

  const requestedCapabilityId = input.interpretation.objective.targetCapabilityId
  const descriptor = requestedCapabilityId
    ? getCosCapabilityDescriptorById(requestedCapabilityId as CosCapabilityId)
    : null
  if (requestedCapabilityId && !descriptor) validationErrors.push(`capability_not_in_registry:${requestedCapabilityId}`)
  if (descriptor && !descriptor.surfaces.includes(input.surface)) validationErrors.push(`capability_not_allowed_on_surface:${descriptor.id}`)
  const contextualGeneralResponse = descriptor?.id === "general.chat" && input.interpretation.dialogueAct === "context"
  if (descriptor && !contextualGeneralResponse && descriptorDomain(descriptor) !== input.interpretation.primaryDomain && !input.interpretation.secondaryDomains.includes(descriptorDomain(descriptor))) {
    validationErrors.push(`capability_domain_mismatch:${descriptor.id}`)
  }
  if (descriptor?.id === "general.chat" && !["social", "capability_question", "context"].includes(input.interpretation.dialogueAct)) {
    validationErrors.push("general_chat_is_not_operational_fallback")
  }

  const pendingRequiredAct = ["confirm", "reject", "cancel", "provide_input"].includes(input.interpretation.dialogueAct)
  const pendingInput = input.activeWorkflow?.pendingInput ?? input.snapshot?.pendingInput ?? null
  if (pendingRequiredAct && !pendingInput) validationErrors.push(`dialogue_act_without_pending:${input.interpretation.dialogueAct}`)
  if (input.interpretation.dialogueAct === "select" && !pendingInput && !(input.snapshot?.selectionSets.length)) {
    validationErrors.push("selection_without_working_set")
  }
  const mutationDialogueAllowed = ["execute", "correct", "switch_topic"].includes(input.interpretation.dialogueAct) ||
    input.interpretation.objective.mode === "execute" || input.interpretation.objective.mode === "continue"
  if (descriptor?.mutatesData && !mutationDialogueAllowed) validationErrors.push(`mutation_dialogue_mismatch:${descriptor.id}`)

  const activeDescriptor = getCosCapabilityDescriptorByAliasOrAction(workflowAction(input.activeWorkflow))
  const continuationAct = ["provide_input", "correct", "confirm", "reject", "cancel", "select"].includes(input.interpretation.dialogueAct)
  if (input.activeWorkflow?.pendingInput && continuationAct && descriptor && activeDescriptor && descriptor.id !== activeDescriptor.id) {
    validationErrors.push(`pending_workflow_mismatch:${activeDescriptor.id}:${descriptor.id}`)
  }

  const criticalValidationError = validationErrors.some((error) =>
    error.startsWith("capability_not_in_registry:") ||
    error.startsWith("capability_not_allowed_on_surface:") ||
    error.startsWith("capability_domain_mismatch:") ||
    error.startsWith("pending_workflow_mismatch:") ||
    error.startsWith("dialogue_act_without_pending:") ||
    error.startsWith("mutation_dialogue_mismatch:") ||
    error === "selection_without_working_set" ||
    error === "general_chat_is_not_operational_fallback",
  )
  if (criticalValidationError) {
    return { decision: input.baseline, accepted: false, validationErrors }
  }

  const trusted = trustedSemanticEntities(input)
  const validationEvidence = ["structured_output_valid", "registry_checked", `surface_checked:${input.surface}`]
  const trustedEntity = (type: CosConversationEntityType, id: string | null) => id ? trusted.get(`${type}:${id}`) ?? null : null
  const entities = input.interpretation.entities.map((entity) => {
    const matched = trustedEntity(entity.type, entity.id)
    if (entity.id && !matched) validationEvidence.push(`entity_id_removed:${entity.type}:${entity.id}`)
    return { ...entity, id: matched?.id ?? null, label: matched?.label ?? entity.label }
  })
  const references = input.interpretation.references.map((reference) => {
    const matched = reference.type ? trustedEntity(reference.type, reference.id) : null
    if (reference.id && !matched) validationEvidence.push(`reference_id_removed:${reference.id}`)
    return {
      ...reference,
      id: matched?.id ?? null,
      label: matched?.label ?? reference.label,
    }
  })
  const resolvedReference = references.find((reference) => reference.type && reference.id) ?? null
  const preservesDeterministicOrdinalReference = Boolean(
    input.baseline.reference.id &&
    /(?:selection_ordinal|recent_ordinal)$/.test(input.baseline.reference.reason),
  )
  const reference = preservesDeterministicOrdinalReference
    ? input.baseline.reference
    : resolvedReference
    ? {
        type: resolvedReference.type,
        id: resolvedReference.id,
        label: resolvedReference.label,
        reason: `ai_validated:${resolvedReference.relation}`,
        ambiguousIds: [],
      }
    : input.baseline.reference

  const confidenceThreshold = descriptor?.mutatesData
    ? COS_DECISION_CONFIDENCE.mutationMinimum
    : COS_DECISION_CONFIDENCE.queryMinimum
  const confidenceAllowsCapability = input.interpretation.confidence >= confidenceThreshold
  if (descriptor && !confidenceAllowsCapability) validationEvidence.push(`confidence_below_threshold:${confidenceThreshold}`)

  const requiredEntityType = descriptor ? selectedEntityTypeForDescriptor(descriptor) : null
  const hasRequiredReference = !requiredEntityType || Boolean(
    reference.type === requiredEntityType && reference.id,
  )
  const selectionCanBeCollectedByHandler = descriptor?.id === "property.search" || descriptor?.id === "lead.find" || descriptor?.id === "proposal.create" || descriptor?.id === "contract.create" || descriptor?.id === "agenda.create"
  const requiredReferenceMissing = Boolean(descriptor?.requiresSelection && !hasRequiredReference && !selectionCanBeCollectedByHandler)
  if (requiredReferenceMissing) validationEvidence.push(`required_reference_missing:${requiredEntityType ?? "unknown"}`)

  const selectedDescriptor = descriptor && confidenceAllowsCapability && !requiredReferenceMissing ? descriptor : null
  const selectedCandidate = selectedDescriptor
    ? [{
        ...directCandidate(selectedDescriptor, ["ai_semantic_interpretation", ...validationEvidence]),
        score: Number((input.interpretation.confidence * 100).toFixed(2)),
        confidence: input.interpretation.confidence,
      }]
    : []
  const semanticInterpretation: CosSemanticInterpretation = {
    ...input.interpretation,
    objective: {
      ...input.interpretation.objective,
      targetCapabilityId: descriptor?.id ?? null,
    },
    entities,
    references,
    validationEvidence,
  }
  const needsClarification = input.interpretation.needsClarification || !selectedDescriptor
  const clarificationReason = input.interpretation.needsClarification
    ? "semantic_clarification_requested"
    : descriptor && !confidenceAllowsCapability
      ? "semantic_confidence_below_risk_threshold"
      : requiredReferenceMissing
        ? "required_entity_unresolved"
        : !descriptor
          ? "semantic_capability_unavailable"
          : null
  const workflowDecision: CosDialogueDecision["workflowDecision"] = !input.activeWorkflow
    ? selectedDescriptor ? "start_new" : "none"
    : continuationAct && selectedDescriptor?.id === activeDescriptor?.id
      ? "continue_workflow"
      : "start_new"

  return {
    accepted: true,
    validationErrors,
    decision: {
      ...input.baseline,
      dialogueAct: input.interpretation.dialogueAct,
      dialogueActConfidence: input.interpretation.confidence,
      dialogueActEvidence: ["ai_semantic_interpretation", ...validationEvidence],
      primaryDomain: input.interpretation.primaryDomain,
      secondaryDomains: input.interpretation.secondaryDomains.filter((domain) => domain !== input.interpretation.primaryDomain),
      objective: semanticInterpretation.objective,
      reference,
      selectedCapabilityId: selectedDescriptor?.id ?? null,
      selectedAction: selectedDescriptor?.action ?? null,
      candidateCapabilities: selectedCandidate,
      workflowDecision,
      needsClarification,
      clarificationReason,
      source: "ai_interpretation",
      semanticInterpretation,
    },
  }
}

export function listCosRoutableCapabilityDescriptors(surface: CosCapabilitySurface) {
  return listCosCapabilityCatalog().filter((descriptor) => descriptor.surfaces.includes(surface) && !INTERNAL_ONLY_CAPABILITIES.has(descriptor.id))
}

export function resolveCosDialogueDecision(input: {
  message: string
  requestedAction?: string | null
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  snapshot: CosConversationSnapshot | null
  activeWorkflow: CosWorkflow | null
  memory: CosConversationMemory | null
  attachments?: CosAttachmentInput[]
}): CosDialogueDecision {
  const normalized = normalizeText(input.message)
  const requestedDescriptor = getCosCapabilityDescriptorByAliasOrAction(input.requestedAction)
  const pendingInput = input.activeWorkflow?.pendingInput ?? input.snapshot?.pendingInput ?? null
  const snapshotReference = input.snapshot
    ? resolveCosConversationReference(input.message, input.snapshot)
    : { entity: null, selectionSet: null, ambiguous: [], reason: "snapshot_unavailable" }
  const mentionedDomains = detectMentionedDomains(normalized)
  const contextDescriptor = lastContextDescriptor(input.snapshot, input.activeWorkflow)
  const recentDomains: CosConversationDomain[] = []
  for (const recent of [...(input.snapshot?.recentMessages ?? [])].slice(-3).reverse()) {
    const recentMessage = normalizeText(recent.userMessage)
    for (const domain of prioritizeRecentDomains(
      recentMessage,
      detectMentionedDomains(recentMessage).filter((candidate) => candidate !== "help"),
    )) {
      if (!recentDomains.includes(domain)) recentDomains.push(domain)
    }
  }
  const legacyHint = mentionedDomains.length === 0
    ? /\b(metros|metragem|area|quartos|banheiros|vagas)\b/.test(normalized) && (input.memory?.propertyId || input.memory?.selectedProperty?.id)
      ? "property"
      : (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input.message) || input.message.replace(/\D/g, "").length >= 10) && (input.memory?.leadId || input.memory?.selectedClient?.id)
        ? "lead"
        : null
    : null
  const hintedDomain = mentionedDomains[0] ?? legacyHint ?? pendingDomain(pendingInput) ?? topicDomain(input.snapshot?.currentTopic?.domain) ?? (contextDescriptor ? descriptorDomain(contextDescriptor) : null)
  const legacyEntity = hintedDomain ? legacyReference(input.memory, hintedDomain) : null
  const referenceEntity = snapshotReference.entity ?? legacyEntity
  const actResolution = inferDialogueAct({
    rawMessage: input.message,
    normalized,
    hasQuestionMark: /\?\s*$/.test(input.message),
    requestedDescriptor,
    pendingInput,
    activeWorkflow: input.activeWorkflow,
    snapshot: input.snapshot,
    mentionedDomains,
    referenceResolved: Boolean(referenceEntity),
    referenceReason: snapshotReference.reason,
    referenceType: referenceEntity?.type ?? null,
    contextDescriptor,
    attachments: input.attachments ?? [],
  })
  const act = actResolution.act
  const referenceDomain = entityDomain(referenceEntity?.type)
  const topicValue = act === "return_topic"
    ? input.snapshot?.recentTopics.find((topic) => {
        const explicit = mentionedDomains.find((domain) => domain !== "analytics" && domain !== "help")
        return !explicit || topicDomain(topic.domain) === explicit
      }) ?? null
    : input.snapshot?.currentTopic ?? null
  const topicValueDomain = topicDomain(topicValue?.domain)
  const preferredDomain = preferredConversationDomain({
    message: normalized,
    act,
    mentionedDomains,
    pendingInput,
    topicDomain: topicValueDomain,
    referenceDomain,
    contextDescriptor,
    recentDomains,
  })
  const domains: CosConversationDomain[] = []
  const addDomain = (domain: CosConversationDomain | null) => {
    if (domain && !domains.includes(domain)) domains.push(domain)
  }
  addDomain(preferredDomain)
  for (const domain of mentionedDomains) {
    if (domain !== "help" && domain !== preferredDomain) addDomain(domain)
  }
  const recentPublicationDomains = recentDomains.filter((domain) => domain === "catalog" || domain === "marketplace")
  if (/\b(?:nos dois|em ambos|entre eles|entre os dois)\b/.test(normalized)) {
    for (const domain of recentPublicationDomains) addDomain(domain)
  } else if (preferredDomain === "property" && referenceEntity && /^(?:e|ja|quanto|quantas?)\b/.test(normalized)) {
    addDomain(recentPublicationDomains[0] ?? null)
  }
  if (preferredDomain === "property" && (/\b(?:pra|pro|para)\b/.test(normalized) || referenceDomain === "lead" || input.snapshot?.activeEntities.lead)) addDomain("lead")
  if (preferredDomain === "proposal") {
    addDomain("property")
    addDomain("lead")
  }
  if (preferredDomain === "lead" && (referenceDomain === "property" || input.snapshot?.activeEntities.property)) addDomain("property")
  if (preferredDomain === "contract" && (/\b(?:de quem|dele|dela)\b/.test(normalized) || referenceDomain === "lead" || input.snapshot?.activeEntities.lead)) addDomain("lead")
  if (preferredDomain === "agenda") {
    if (/\bvisita\b/.test(normalized) || referenceDomain === "property" || input.snapshot?.activeEntities.property) addDomain("property")
    if (/\b(?:com|falar|ele|ela)\b/.test(normalized) || referenceDomain === "lead" || input.snapshot?.activeEntities.lead) addDomain("lead")
    if (input.snapshot?.activeEntities.proposal) addDomain("proposal")
  }
  if (preferredDomain && ["catalog", "marketplace", "studio"].includes(preferredDomain) && (mentionedDomains.includes("property") || referenceDomain === "property" || input.snapshot?.activeEntities.property)) addDomain("property")
  if (preferredDomain === "catalog" && /\bpublic(?:a|e|ar)\w*\b/.test(normalized)) addDomain("property")
  if (preferredDomain === "analytics") {
    if (mentionedDomains.includes("property") || referenceDomain === "property" || input.snapshot?.activeEntities.property || /\b(?:ou|compar\w*)\b.*\b(?:procur\w*|busc\w*|visualiz\w*)\b/.test(normalized)) addDomain("property")
    if (mentionedDomains.includes("lead") || referenceDomain === "lead") addDomain("lead")
  }
  if (preferredDomain === "library") addDomain("studio")
  if (preferredDomain === "history" && mentionedDomains.includes("proposal")) addDomain("lead")
  if (preferredDomain === "property" && /\bpublicad\w*\b/.test(normalized) && act === "query") {
    addDomain("catalog")
    addDomain("marketplace")
  }
  if (preferredDomain === "general" && /\bcreditos?\b/.test(normalized)) addDomain("studio")
  if (preferredDomain === "catalog" && /\bnao consigo publicar\b/.test(normalized)) addDomain("account")
  addDomain(referenceDomain)
  if ((act === "query" || act === "explain") && pendingInput?.type === "selection") addDomain(pendingDomain(pendingInput))
  if (act === "provide_input" || act === "correct" || act === "confirm" || act === "reject" || act === "cancel" || act === "select") addDomain(pendingDomain(pendingInput))
  if (act !== "switch_topic") addDomain(topicValueDomain)
  if (contextDescriptor && act !== "switch_topic") {
    const contextDomain = descriptorDomain(contextDescriptor)
    if (contextDomain !== "help") addDomain(contextDomain)
  }
  if (domains.length === 0) addDomain(workspaceDomain(input.workspace?.entity))
  if (domains.length === 0) domains.push("general")

  const primaryDomain = domains[0]
  const secondaryDomains = domains.slice(1)
  let candidates: CosDialogueDecisionCandidate[] = []
  let selectedCapabilityId: CosCapabilityId | null = null
  let selectedAction = null as CosDialogueDecision["selectedAction"]
  let source: CosDialogueDecision["source"] = requestedDescriptor ? "explicit_interface" : "dialogue_rules"
  let needsClarification = false
  let clarificationReason: string | null = null
  let objectiveMode: CosDialogueDecision["objective"]["mode"] = "clarify"

  const activeAction = workflowAction(input.activeWorkflow)
  const activeDescriptor = getCosCapabilityDescriptorByAliasOrAction(activeAction)
  const rejectedWithFollowUp = act === "reject" && hasCosPendingRejectionFollowUp(input.message)
  const unsupportedContractReview = primaryDomain === "contract" && /\b(?:analis\w*|(?:algo|alguma coisa)\s+errad\w*|ponto que .* marcou|revisao documental)\b/.test(normalized)
  const unsupportedNativeSignature = primaryDomain === "contract" && /\bassin(?:a|e|ar)\b/.test(normalized) && !/\bmarc\w*\b.*\bassinad\w*\b/.test(normalized)
  const unsupportedCatalogAccountDiagnosis = primaryDomain === "catalog" && domains.includes("account") && /\b(?:nao consigo|bloquead\w*|creci)\b.*\bpublic\w*|\bpublic\w*.*\b(?:nao consigo|bloquead\w*|creci)\b/.test(normalized)
  const studioRecommendation = act === "query" && primaryDomain === "studio" && /\brecomend\w*\b/.test(normalized)
  const namedPropertySearch = act === "query" && primaryDomain === "property" &&
    /\b(?:bus(?:c|qu)\w*|procur\w*|encontr\w*)\b.*\bimove(?:l|is)\s+(?:chamad[oa]s?|de nome|intitulad[oa]s?)\b/.test(normalized)
  if (requestedDescriptor) {
    candidates = [directCandidate(requestedDescriptor, ["requested_action_explicit"])]
    selectedCapabilityId = requestedDescriptor.id
    selectedAction = requestedDescriptor.action
    objectiveMode = act === "explain" ? "explain" : requestedDescriptor.mutatesData ? "execute" : "query"
  } else if (rejectedWithFollowUp && referenceEntity) {
    const descriptor = getCosCapabilityDescriptorById(contextualCapabilityId(referenceEntity.type))
    if (descriptor) {
      candidates = [directCandidate(descriptor, ["rejection_follow_up", snapshotReference.reason])]
      selectedCapabilityId = descriptor.id
      selectedAction = descriptor.action
      objectiveMode = "query"
      source = "snapshot_context"
    }
  } else if (act === "query" && referenceEntity && ["selection_alternative", "selection_ordinal", "selection_ranked_price"].includes(snapshotReference.reason)) {
    const descriptor = getCosCapabilityDescriptorById(contextualCapabilityId(referenceEntity.type))
    if (descriptor) {
      candidates = [directCandidate(descriptor, [snapshotReference.reason, "selection_detail_query"])]
      selectedCapabilityId = descriptor.id
      selectedAction = descriptor.action
      objectiveMode = "query"
      source = "snapshot_context"
    }
  } else if (["provide_input", "correct", "confirm", "reject", "cancel"].includes(act) && activeDescriptor) {
    candidates = [directCandidate(activeDescriptor, [`active_workflow:${act}`])]
    selectedCapabilityId = activeDescriptor.id
    selectedAction = activeDescriptor.action
    objectiveMode = "continue"
    source = "snapshot_context"
  } else if (act === "correct" && referenceEntity) {
    const descriptorId = contextualUpdateCapabilityId(referenceEntity.type)
    const descriptor = descriptorId ? getCosCapabilityDescriptorById(descriptorId) : null
    if (descriptor) {
      candidates = [directCandidate(descriptor, ["contextual_correction", snapshotReference.reason])]
      selectedCapabilityId = descriptor.id
      selectedAction = descriptor.action
      objectiveMode = "continue"
      source = "snapshot_context"
    }
  } else if (act === "select" && pendingInput?.type === "selection" && activeDescriptor) {
    candidates = [directCandidate(activeDescriptor, ["pending_selection"])]
    selectedCapabilityId = activeDescriptor.id
    selectedAction = activeDescriptor.action
    objectiveMode = "continue"
    source = "snapshot_context"
  } else if ((act === "select" || act === "return_topic") && referenceEntity) {
    const descriptor = getCosCapabilityDescriptorById(contextualCapabilityId(referenceEntity.type))
    if (descriptor) {
      candidates = [directCandidate(descriptor, [snapshotReference.reason, act])]
      selectedCapabilityId = descriptor.id
      selectedAction = descriptor.action
      objectiveMode = "query"
      source = "snapshot_context"
    }
  } else if (act === "select" && snapshotReference.selectionSet) {
    const descriptor = getCosCapabilityDescriptorById(contextualCapabilityId(snapshotReference.selectionSet.type))
    if (descriptor) {
      candidates = [directCandidate(descriptor, [snapshotReference.reason, "selection_target_unresolved"])]
      selectedCapabilityId = descriptor.id
      selectedAction = descriptor.action
      objectiveMode = "clarify"
      source = "snapshot_context"
    }
  } else if (act === "select" || act === "return_topic") {
    needsClarification = true
    clarificationReason = act === "select" ? "selection_context_missing" : "return_topic_not_found"
    objectiveMode = "clarify"
    source = "snapshot_context"
  } else if (act === "social") {
    const descriptor = getCosCapabilityDescriptorById("general.chat")!
    candidates = [directCandidate(descriptor, ["social_dialogue"])]
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "respond"
  } else if (act === "context") {
    const descriptor = getCosCapabilityDescriptorById("general.chat")!
    candidates = [directCandidate(descriptor, ["declarative_context"])]
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "respond"
    source = "registry"
  } else if (unsupportedContractReview || unsupportedNativeSignature || unsupportedCatalogAccountDiagnosis) {
    objectiveMode = act === "explain" ? "explain" : "query"
    source = "registry"
  } else if (studioRecommendation) {
    const descriptor = getCosCapabilityDescriptorById("help.marketing_studio")!
    candidates = [directCandidate(descriptor, ["studio_recommendation"])]
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "query"
    source = "registry"
  } else if (namedPropertySearch) {
    const descriptor = getCosCapabilityDescriptorById("property.search")!
    candidates = [directCandidate(descriptor, ["named_property_search"])]
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "query"
    source = "dialogue_rules"
  } else if (act === "capability_question") {
    const targetOperation = hasAny(normalized, ["buscar", "consultar", "mostrar", "listar", "ver "]) ? "query" : "execute"
    candidates = toDecisionCandidates(scoreCandidates({ message: normalized, act, domains, surface: input.surface, referenceType: referenceEntity?.type ?? null, contextCapabilityId: contextDescriptor?.id ?? null, targetOperation }))
    const descriptor = getCosCapabilityDescriptorById("general.chat")!
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "respond"
    source = "registry"
  } else if (act === "explain") {
    candidates = toDecisionCandidates(scoreCandidates({ message: normalized, act, domains, surface: input.surface, referenceType: referenceEntity?.type ?? null, contextCapabilityId: contextDescriptor?.id ?? null }))
    const top = candidates[0]
    selectedCapabilityId = top?.capabilityId ?? "help.general_question"
    selectedAction = top?.action ?? "help_general_question"
    objectiveMode = "explain"
    source = "registry"
  } else if (["execute", "query", "switch_topic"].includes(act)) {
    const switchMutation = act === "switch_topic" && hasNaturalMutationVerb(normalized) && !/\?\s*$/.test(input.message) && !hasOperationalQuestionStructure(normalized)
    const targetOperation = act === "execute" || switchMutation
      ? "execute"
      : "query"
    candidates = toDecisionCandidates(scoreCandidates({ message: normalized, act, domains, surface: input.surface, referenceType: referenceEntity?.type ?? null, contextCapabilityId: contextDescriptor?.id ?? null, targetOperation }))
    const top = candidates[0]
    const runnerUp = candidates[1]
    const threshold = top?.mutatesData ? COS_DECISION_CONFIDENCE.mutationMinimum : COS_DECISION_CONFIDENCE.queryMinimum
    const confidenceMargin = top && runnerUp ? top.confidence - runnerUp.confidence : 1
    const scoreMargin = top && runnerUp ? top.score - runnerUp.score : Number.POSITIVE_INFINITY
    const safelySeparated = scoreMargin >= (top?.mutatesData ? 2.5 : 1.5) || confidenceMargin >= COS_DECISION_CONFIDENCE.ambiguityMargin
    if (top && top.confidence >= threshold && safelySeparated) {
      selectedCapabilityId = top.capabilityId
      selectedAction = top.action
    } else if (top) {
      needsClarification = true
      clarificationReason = top.confidence < threshold ? "confidence_below_risk_threshold" : "capability_candidates_ambiguous"
    } else {
      needsClarification = true
      clarificationReason = "known_dialogue_act_without_capability"
    }
    objectiveMode = targetOperation
    source = "registry"
  } else {
    const descriptor = getCosCapabilityDescriptorById("general.chat")!
    candidates = [directCandidate(descriptor, ["safe_general_fallback"])]
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "respond"
    source = "fallback"
  }

  const selectedDescriptor = selectedCapabilityId ? getCosCapabilityDescriptorById(selectedCapabilityId) : null
  const unresolvedRequiredReference = Boolean(
    selectedDescriptor?.requiresSelection &&
    !referenceEntity &&
    selectedDescriptor.id !== "property.search" &&
    selectedDescriptor.id !== "lead.find",
  )
  const hasClientBeneficiary = /\b(?:pra|pro)\b/.test(normalized) ||
    /\bpara\s+(?!(?:aluguel|comprar|investimento|locacao|morar|temporada|venda)\b)[\p{L}]{2,}\b/u.test(normalized)
  const requestsRecentProperties = /\b(?:meus\s+)?(?:ultimos|recentes)\s+imoveis(?:\s+cadastrados)?\b/u.test(normalized)
  const unresolvedClientSearch = selectedCapabilityId === "property.search" && !requestsRecentProperties && (
    (hasClientBeneficiary && !referenceEntity) ||
    !/\b(?:apartamento|casa|terreno|sala|comercial|residencial|em\s+[\p{L}]+|ate\s+\d)\b/u.test(normalized)
  )
  const analyzesCurrentSelectionSet = selectedCapabilityId === "catalog.analyze" &&
    act === "query" &&
    Boolean(snapshotReference.selectionSet) &&
    snapshotReference.ambiguous.length > 1
  const ambiguousReference = snapshotReference.ambiguous.length > 0 && !analyzesCurrentSelectionSet
  const ambiguousHour = selectedCapabilityId === "agenda.create" && /\b(?:as\s+)?(?:[1-9]|1[0-2])\b/.test(normalized) && !/\b(?:manha|tarde|noite|\d{1,2}:\d{2}|\d{1,2}h)\b/.test(normalized)
  const missingCorrectionValue = act === "correct" && selectedCapabilityId === "lead.update" && /\b(?:telefone|email|sobrenome)\b/.test(normalized) && !(/\d{10,}/.test(normalized.replace(/\D/g, "")) || /\S+@\S+/.test(input.message) || /\b(?:e|para)\s+[\p{L}]{2,}\b/u.test(normalized))
  const missingCatalogTarget = selectedCapabilityId === "catalog.analyze" && !referenceEntity && !analyzesCurrentSelectionSet
  const genericStudioRequest = selectedCapabilityId === "studio.generateCampaign" && !/\b(instagram|facebook|story|reel|video|anuncio|objetivo)\b/.test(normalized)
  const incompletePropertyDraft = selectedCapabilityId === "property.create" && /\b(?:foto|fotos|imagem|imagens)\b/.test(normalized) && !/\b(?:rua|avenida|bairro|cidade|preco|valor|apartamento|casa|terreno)\b/.test(normalized)
  const ambiguousPerformanceMetric = selectedCapabilityId === "analytics.performance" && /\b(?:melhor|mais\s+procur\w*)\b/.test(normalized) && !/\b(?:visualiz\w*|contat\w*|convers\w*|lead\w*|propost\w*)\b/.test(normalized)
  const hasExplicitAgendaTime = /\b(?:as\s+(?:[01]?\d|2[0-3])(?::[0-5]\d)?|(?:[01]?\d|2[0-3])h(?:[0-5]\d)?|(?:[01]?\d|2[0-3]):[0-5]\d)\b/.test(normalized)
  const missingAgendaTime = selectedCapabilityId === "agenda.create" && !hasExplicitAgendaTime
  const hasExplicitSearchLocation = /\b(?:em|na|no)\s+(?!maximo\b|minimo\b|valor\b|preco\b|total\b|momento\b|prazo\b|dia\b|mes\b|ano\b)[\p{L}][\p{L}\s-]{1,40}(?:$|\bate\b|\bcom\b|\bdepois\b)/u.test(normalized)
  const chainedPropertySearchMissingLocation = selectedCapabilityId === "lead.create" &&
    domains.includes("property") &&
    /\b(?:procur\w*|busc\w*|encontr\w*)\b/.test(normalized) &&
    !hasExplicitSearchLocation
  const chainedProposalMissingProperty = selectedCapabilityId === "lead.create" &&
    domains.includes("proposal") &&
    !domains.includes("property") &&
    !input.snapshot?.activeEntities.property
  const unresolvedNamedLeadTarget = ["agenda.create", "proposal.create"].includes(selectedCapabilityId ?? "") &&
    referenceEntity?.type !== "lead" &&
    hasSingleTokenLeadTarget(normalized)
  const isWorkflowContinuation = Boolean(input.activeWorkflow) && ["provide_input", "correct", "confirm", "reject", "cancel", "select"].includes(act)
  if (!needsClarification && !isWorkflowContinuation && (unresolvedRequiredReference || unresolvedClientSearch || ambiguousReference || ambiguousHour || missingCorrectionValue || missingCatalogTarget || genericStudioRequest || incompletePropertyDraft || ambiguousPerformanceMetric || missingAgendaTime || chainedPropertySearchMissingLocation || chainedProposalMissingProperty || unresolvedNamedLeadTarget)) {
    needsClarification = true
    clarificationReason = ambiguousReference
      ? "entity_reference_ambiguous"
      : unresolvedClientSearch
        ? "property_search_context_incomplete"
        : ambiguousHour
          ? "temporal_input_ambiguous"
          : missingCorrectionValue
            ? "correction_value_missing"
            : missingCatalogTarget
              ? "catalog_target_missing"
              : genericStudioRequest
                ? "studio_parameters_missing"
                  : incompletePropertyDraft
                    ? "property_draft_data_missing"
                    : ambiguousPerformanceMetric
                      ? "performance_metric_ambiguous"
                      : missingAgendaTime
                        ? "agenda_time_missing"
                        : chainedPropertySearchMissingLocation
                          ? "property_search_location_missing"
                          : chainedProposalMissingProperty
                            ? "proposal_property_missing"
                            : unresolvedNamedLeadTarget
                              ? "lead_target_ambiguous"
                            : "required_entity_unresolved"
  }

  const rejectedIntoNewAction = rejectedWithFollowUp && Boolean(selectedAction) && selectedAction !== activeAction
  const workflowDecision: CosDialogueDecision["workflowDecision"] = !input.activeWorkflow
    ? selectedAction ? "start_new" : "none"
    : rejectedIntoNewAction
      ? "start_new"
    : ["provide_input", "correct", "confirm", "reject", "cancel"].includes(act)
      ? "continue_workflow"
      : act === "select" && pendingInput?.type === "selection"
        ? "continue_workflow"
        : selectedAction === activeAction && act === "execute"
          ? "continue_workflow"
          : "start_new"

  return {
    schemaVersion: 1,
    dialogueAct: act,
    dialogueActConfidence: actResolution.confidence,
    dialogueActEvidence: actResolution.evidence,
    primaryDomain,
    secondaryDomains,
    objective: {
      mode: objectiveMode,
      summary: `${act}:${domains.join("+")}`,
      targetCapabilityId: candidates[0]?.capabilityId ?? selectedCapabilityId,
    },
    reference: {
      type: referenceEntity?.type ?? null,
      id: referenceEntity?.id ?? null,
      label: referenceEntity?.label ?? null,
      reason: snapshotReference.entity ? snapshotReference.reason : legacyEntity ? "legacy_active_entity" : snapshotReference.reason,
      ambiguousIds: snapshotReference.ambiguous.map((entity) => entity.id),
    },
    selectedCapabilityId,
    selectedAction,
    candidateCapabilities: candidates,
    workflowDecision,
    needsClarification,
    clarificationReason,
    source,
  }
}
