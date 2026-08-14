import { getCosCapabilityDescriptorByAliasOrAction, getCosCapabilityDescriptorById, listCosCapabilityCatalog } from "@/lib/cos/capability-catalog"
import { classifyCosSocialIntent } from "@/lib/cos/conversation"
import { resolveCosConversationReference } from "@/lib/cos/conversation-snapshot"
import { classifyCosPendingReply } from "@/lib/cos/pending-input"

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

const INTERNAL_ONLY_CAPABILITIES = new Set<CosCapabilityId>([
  "operation.summary",
])

const GENERIC_TOKENS = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "ela", "ele",
  "em", "esse", "essa", "este", "esta", "me", "meu", "minha", "na", "nas", "no", "nos",
  "o", "os", "ou", "para", "por", "pra", "que", "se", "um", "uma", "voce",
])

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

function descriptorDomain(descriptor: CosCapabilityDescriptor): CosConversationDomain {
  if (descriptor.id.startsWith("help.")) return "help"
  if (descriptor.domain === "property") return "property"
  if (descriptor.domain === "lead") return "lead"
  if (descriptor.domain === "proposal") return "proposal"
  if (descriptor.domain === "contract") return "contract"
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
  if (["lead", "property", "contract", "agenda", "catalog", "finance", "analytics"].includes(entity ?? "")) {
    return entity as CosConversationDomain
  }
  return null
}

function topicDomain(domain: string | null | undefined): CosConversationDomain | null {
  if (!domain) return null
  if (["lead", "property", "proposal", "contract", "agenda", "catalog", "finance", "studio", "general"].includes(domain)) {
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

  add("lead", /\b(cliente|clientes|lead|leads|contato|contatos)\b/.test(message) || /\b(cadastre|cadastrar)\b.*\bproposta\b/.test(message))
  add("property", /\b(imovel|imoveis|apartamento|apartamentos|casa|casas|terreno|terrenos|sala comercial)\b/.test(message))
  add("proposal", /\b(proposta|propostas)\b/.test(message))
  add("contract", /\b(contrato|contratos|assinatura)\b/.test(message))
  add("agenda", /\b(agenda|compromisso|compromissos|evento|eventos|visita|visitas|reuniao|reunioes|lembrete)\b/.test(message))
  add("catalog", /\b(catalogo|catalogos)\b/.test(message))
  add("marketplace", /\b(marketplace|mercado publico|portal publico)\b/.test(message))
  add("finance", /\b(financeiro|financeira|comissao|comissoes|recebiveis|despesas|pagamentos|caixa|cashflow|forecast)\b/.test(message))
  add("analytics", /\b(analytics|desempenho|performance|metricas|estatisticas|conversao|ranking)\b/.test(message))
  add("studio", /\b(studio|campanha|campanhas|instagram|facebook|story|stories|reel|reels|video|videos)\b/.test(message))
  add("help", /\b(eme|cos|sistema|modulo|modulos|funcionalidade|funcionalidades)\b/.test(message))

  if (/\bquantos? (?:imoveis|clientes|leads|contratos|propostas)\b/.test(message) && !detected.includes("analytics")) {
    detected.push("analytics")
  }
  return detected
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
  normalized: string
  requestedDescriptor: CosCapabilityDescriptor | null
  pendingInput: CosPendingInput | null
  activeWorkflow: CosWorkflow | null
  snapshot: CosConversationSnapshot | null
  mentionedDomains: CosConversationDomain[]
  referenceResolved: boolean
  referenceType: CosConversationEntityType | null
  attachments: CosAttachmentInput[]
}) {
  const evidence: string[] = []
  const message = input.normalized
  const hasActiveContext = Boolean(input.activeWorkflow || input.pendingInput || input.snapshot?.currentTopic)

  if (input.requestedDescriptor) {
    const act: CosDialogueAct = input.requestedDescriptor.id.startsWith("help.")
      ? "explain"
      : input.requestedDescriptor.mutatesData
        ? "execute"
        : "query"
    return { act, confidence: 1, evidence: ["requested_action_explicit"] }
  }

  const socialIntent = classifyCosSocialIntent(message)
  if (socialIntent) return { act: "social" as const, confidence: 0.98, evidence: [`social:${socialIntent}`] }

  if (/\b(voce|o cos) (consegue|pode|sabe)\b/.test(message) || /\b(da para|tem como|e possivel)\b/.test(message)) {
    return { act: "capability_question" as const, confidence: 0.96, evidence: ["capability_question_structure"] }
  }

  const correction = /^(nao\s+|na verdade\s+|corrige(?: para)?\s+|muda(?: para)?\s+|troca(?: para)?\s+|quis dizer\s+)/.test(message) ||
    /\b(esta errado|estava errado|o correto e|na realidade)\b/.test(message)
  if (correction && hasActiveContext) {
    return { act: "correct" as const, confidence: 0.96, evidence: ["explicit_correction_marker", "active_context"] }
  }

  const returnTopic = /\b(voltando|volta(?:ndo)?|retomando|retoma|de volta|sobre aquel[ea]|anterior)\b/.test(message)
  if (returnTopic && input.snapshot?.recentTopics.length) {
    return { act: "return_topic" as const, confidence: 0.94, evidence: ["return_topic_marker", "recent_topic_available"] }
  }

  const selection =
    /^(?:o |a )?(?:primeir[oa]|segund[oa]|terceir[oa]|ultim[oa]|anterior|esse|essa|aquele|aquela)\b/.test(message) ||
    /^\d{1,2}$/.test(message) ||
    (/^(manda|envia|abre|usa|faz)\b/.test(message) && /\b(esse|essa|aquele|aquela)\b/.test(message))
  if (selection) {
    return input.referenceResolved || input.snapshot?.selectionSets.length || input.pendingInput?.options?.length
      ? { act: "select" as const, confidence: 0.95, evidence: ["selection_marker", "selection_context"] }
      : { act: "select" as const, confidence: 0.62, evidence: ["selection_marker", "selection_context_missing"] }
  }

  if (input.pendingInput) {
    const reply = classifyCosPendingReply(message)
    if (reply === "correction") return { act: "correct" as const, confidence: 0.97, evidence: ["pending_correction"] }
    if (reply === "confirm" && input.pendingInput.type === "confirmation") {
      return { act: "confirm" as const, confidence: 0.99, evidence: ["confirmation_pending", "affirmative_reply"] }
    }
    if (reply === "reject" && input.pendingInput.type === "confirmation") {
      return { act: "reject" as const, confidence: 0.99, evidence: ["confirmation_pending", "negative_reply"] }
    }
    if (reply === "cancel") return { act: "cancel" as const, confidence: 0.99, evidence: ["pending_context", "cancel_marker"] }
  }

  if (hasActiveContext && /^(cancela|cancelar|esquece|deixa pra la|deixa para la|para isso)$/.test(message)) {
    return { act: "cancel" as const, confidence: 0.98, evidence: ["isolated_cancel_marker", "active_context"] }
  }

  if (/\b(qual a diferenca|qual e a diferenca|como funciona|como funcionam|o que e|me explica|me explique|quero entender)\b/.test(message)) {
    return { act: "explain" as const, confidence: 0.95, evidence: ["explanation_structure"] }
  }

  const executeSignal = hasAny(message, [
    "cadastre", "cadastrar", "crie", "criar", "gere", "gerar", "publique", "publicar", "despublique", "despublicar",
    "atualize", "atualizar", "edite", "editar", "altere", "alterar", "reagende", "reagendar", "marque", "marcar",
    "conclua", "concluir", "exclua", "excluir", "remova", "remover", "envie", "enviar", "assine", "assinar",
    "cancele", "cancelar", "baixe", "baixar", "anexe", "anexar", "melhore", "melhorar",
  ])
  const hasLeadContactValue =
    message.replace(/\D/g, "").length >= 10 ||
    (/\bemail\b/.test(message) && !/^(qual|quais|quanto|quantos|tem|mostre|mostrar)\b/.test(message))
  if (input.referenceType === "lead" && hasLeadContactValue) {
    return { act: "execute" as const, confidence: 0.9, evidence: ["active_lead_contact_followup"] }
  }
  const querySignal = /\?$/.test(message) || hasAny(message, [
    "tenho ", "qual ", "quais ", "quanto ", "quantos ", "quantas ", "como esta", "como ficam", "me mostra", "mostre", "mostrar", "liste", "listar",
    "buscar", "busque", "encontre", "consultar", "ver meus", "ver minhas", "proximo compromisso",
  ])
  const switchSignal = /^(agora|e (?:os|as|quantos|quantas)|vamos falar|mudando de assunto)\b/.test(message)
  const currentDomain = topicDomain(input.snapshot?.currentTopic?.domain)
  const explicitOtherDomain = input.mentionedDomains.some((domain) => domain !== currentDomain && domain !== "analytics")
  if ((switchSignal || Boolean(input.pendingInput && querySignal)) && explicitOtherDomain) {
    evidence.push("topic_switch_marker", executeSignal ? "execute_signal" : "query_signal")
    return { act: "switch_topic" as const, confidence: 0.92, evidence }
  }

  if (executeSignal) return { act: "execute" as const, confidence: 0.9, evidence: ["explicit_execution_verb"] }
  if (querySignal) return { act: "query" as const, confidence: 0.88, evidence: ["query_structure"] }

  if (input.pendingInput) {
    const hasAttachmentAnswer = input.attachments.length > 0 && ["attachments", "document", "imageUrls"].includes(input.pendingInput.field)
    const pendingDomainValue = pendingDomain(input.pendingInput)
    const unrelatedDomain = input.mentionedDomains.some((domain) => domain !== pendingDomainValue && domain !== "analytics")
    if (hasAttachmentAnswer || !unrelatedDomain) {
      return { act: "provide_input" as const, confidence: 0.9, evidence: ["pending_input_present", hasAttachmentAnswer ? "expected_attachment" : "compatible_reply"] }
    }
  }

  if (input.referenceResolved) return { act: "query" as const, confidence: 0.72, evidence: ["resolved_reference"] }
  return { act: "unknown" as const, confidence: 0.25, evidence: ["insufficient_dialogue_signals"] }
}

function capabilityOperation(descriptor: CosCapabilityDescriptor): "execute" | "query" | "explain" {
  if (descriptor.id.startsWith("help.")) return "explain"
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

function helpCapabilityBoost(descriptor: CosCapabilityDescriptor, domains: CosConversationDomain[]) {
  if (!descriptor.id.startsWith("help.")) return 0
  if (domains.includes("property") && descriptor.id === "help.register_properties") return 9
  if (domains.includes("lead") && descriptor.id === "help.manage_clients") return 9
  if ((domains.includes("contract") || domains.includes("proposal")) && descriptor.id === "help.contracts_proposals") return 9
  if (domains.includes("studio") && descriptor.id === "help.marketing_studio") return 9
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
  if (descriptor.id === "agenda.create" && /\b(crie|criar|marque|marcar|agende|agendar|novo compromisso)\b/.test(message)) add(8, "agenda_create")
  if (descriptor.id === "agenda.update" && /\b(altere|alterar|reagende|reagendar|mude o horario)\b/.test(message)) add(9, "agenda_update")
  if (descriptor.id === "agenda.cancel" && /\b(cancele|cancelar|desmarque|desmarcar)\b/.test(message)) add(9, "agenda_cancel")
  if (descriptor.id === "agenda.complete" && /\b(conclua|concluir|marque como concluido|feito)\b/.test(message)) add(9, "agenda_complete")

  if (descriptor.id === "property.get" && referenceType === "property") add(9, "active_property_detail")
  if (descriptor.id === "lead.find" && referenceType === "lead") add(9, "active_lead_detail")
  if (descriptor.id === "contract.get" && referenceType === "contract") add(9, "active_contract_detail")
  if (descriptor.id === "proposal.summary" && referenceType === "proposal") add(7, "active_proposal_detail")
  if (descriptor.id === "property.get" && /\b(metros|metragem|area|quartos|banheiros|vagas)\b/.test(message)) add(8, "property_detail_field")
  if (descriptor.id === "lead.find" && /\b(telefone|whatsapp|email|e mail|contato)\b/.test(message)) add(8, "lead_detail_field")
  if (descriptor.id === "lead.update" && (message.replace(/\D/g, "").length >= 10 || (/\bemail\b/.test(message) && !/^(qual|quais|quanto|quantos|tem|mostre|mostrar)\b/.test(message)))) add(10, "lead_contact_update")
  if (descriptor.id === "lead.summary" && /\bquant(?:os|as) (?:leads|clientes)\b/.test(message)) add(12, "lead_count_query")
  if (descriptor.id === "proposal.summary" && /\b(valor|status|proposta)\b/.test(message)) add(4, "proposal_detail_field")

  if (descriptor.id === "lead.create" && /\b(cadastre|cadastrar|novo cliente|nova cliente|novo lead)\b/.test(message)) add(8, "lead_create")
  if (descriptor.id === "property.create" && (/(?:cadastre|cadastrar).{0,30}\bimovel\b/.test(message) || /\b(novo imovel|crie um imovel)\b/.test(message))) add(8, "property_create")
  if (descriptor.id === "proposal.create" && /\b(crie|criar|gere|gerar|nova proposta)\b/.test(message)) add(8, "proposal_create")
  if (descriptor.id === "contract.create" && /\b(crie|criar|gere|gerar|novo contrato)\b/.test(message)) add(8, "contract_create")
  if (descriptor.id === "property.search" && /\b(mostre|mostrar|buscar|busque|encontre|listar|imoveis em)\b/.test(message)) add(7, "property_search")
  if (descriptor.id === "lead.find" && /\b(mostre|mostrar|buscar|busque|encontre|cliente)\b/.test(message)) add(5, "lead_query")

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
  targetOperation?: "execute" | "query" | "explain"
}) {
  const messageTokens = tokenize(input.message)
  const operation = input.targetOperation ?? (
    input.act === "explain" ? "explain" : input.act === "execute" ? "execute" : "query"
  )
  const eligibleDomains = new Set(input.act === "explain" ? ["help"] : input.domains)

  return listCosRoutableCapabilityDescriptors(input.surface)
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
      let score = (input.domains.includes(domain) ? 6 : 0) + overlap.length * 1.15
      const evidence = [input.domains.includes(domain) ? `domain:${domain}` : "", overlap.length ? `tokens:${overlap.join(",")}` : ""].filter(Boolean)
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
      score += semantic.score + helpCapabilityBoost(descriptor, input.domains)
      evidence.push(...semantic.evidence)
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
  const legacyHint = mentionedDomains.length === 0
    ? /\b(metros|metragem|area|quartos|banheiros|vagas)\b/.test(normalized) && (input.memory?.propertyId || input.memory?.selectedProperty?.id)
      ? "property"
      : (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input.message) || input.message.replace(/\D/g, "").length >= 10) && (input.memory?.leadId || input.memory?.selectedClient?.id)
        ? "lead"
        : null
    : null
  const hintedDomain = mentionedDomains[0] ?? legacyHint ?? pendingDomain(pendingInput) ?? topicDomain(input.snapshot?.currentTopic?.domain) ?? null
  const legacyEntity = hintedDomain ? legacyReference(input.memory, hintedDomain) : null
  const referenceEntity = snapshotReference.entity ?? legacyEntity
  const actResolution = inferDialogueAct({
    normalized,
    requestedDescriptor,
    pendingInput,
    activeWorkflow: input.activeWorkflow,
    snapshot: input.snapshot,
    mentionedDomains,
    referenceResolved: Boolean(referenceEntity),
    referenceType: referenceEntity?.type ?? null,
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
  const domains = [...mentionedDomains]
  const addDomain = (domain: CosConversationDomain | null) => {
    if (domain && !domains.includes(domain)) domains.push(domain)
  }
  addDomain(referenceDomain)
  if (act === "provide_input" || act === "correct" || act === "confirm" || act === "reject" || act === "cancel") addDomain(pendingDomain(pendingInput))
  addDomain(topicValueDomain)
  if (domains.length === 0) addDomain(workspaceDomain(input.workspace?.entity))
  if (act === "explain" && !domains.includes("help")) domains.push("help")
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
  if (requestedDescriptor) {
    candidates = [directCandidate(requestedDescriptor, ["requested_action_explicit"])]
    selectedCapabilityId = requestedDescriptor.id
    selectedAction = requestedDescriptor.action
    objectiveMode = act === "explain" ? "explain" : requestedDescriptor.mutatesData ? "execute" : "query"
  } else if (["provide_input", "correct", "confirm", "reject", "cancel"].includes(act) && activeDescriptor) {
    candidates = [directCandidate(activeDescriptor, [`active_workflow:${act}`])]
    selectedCapabilityId = activeDescriptor.id
    selectedAction = activeDescriptor.action
    objectiveMode = "continue"
    source = "snapshot_context"
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
  } else if (act === "capability_question") {
    const targetOperation = hasAny(normalized, ["buscar", "consultar", "mostrar", "listar", "ver "]) ? "query" : "execute"
    candidates = toDecisionCandidates(scoreCandidates({ message: normalized, act, domains, surface: input.surface, referenceType: referenceEntity?.type ?? null, targetOperation }))
    const descriptor = getCosCapabilityDescriptorById("general.chat")!
    selectedCapabilityId = descriptor.id
    selectedAction = descriptor.action
    objectiveMode = "respond"
    source = "registry"
  } else if (act === "explain") {
    candidates = toDecisionCandidates(scoreCandidates({ message: normalized, act, domains, surface: input.surface, referenceType: referenceEntity?.type ?? null }))
    const top = candidates[0]
    selectedCapabilityId = top?.capabilityId ?? "help.general_question"
    selectedAction = top?.action ?? "help_general_question"
    objectiveMode = "explain"
    source = "registry"
  } else if (["execute", "query", "switch_topic"].includes(act)) {
    const targetOperation = act === "execute" || (act === "switch_topic" && hasAny(normalized, ["crie", "criar", "cadastre", "cadastrar", "publique", "publicar"]))
      ? "execute"
      : "query"
    candidates = toDecisionCandidates(scoreCandidates({ message: normalized, act, domains, surface: input.surface, referenceType: referenceEntity?.type ?? null, targetOperation }))
    const top = candidates[0]
    const runnerUp = candidates[1]
    const threshold = top?.mutatesData ? COS_DECISION_CONFIDENCE.mutationMinimum : COS_DECISION_CONFIDENCE.queryMinimum
    const margin = top && runnerUp ? top.confidence - runnerUp.confidence : 1
    if (top && top.confidence >= threshold && (margin >= COS_DECISION_CONFIDENCE.ambiguityMargin || top.confidence >= COS_DECISION_CONFIDENCE.high)) {
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

  const workflowDecision: CosDialogueDecision["workflowDecision"] = !input.activeWorkflow
    ? selectedAction ? "start_new" : "none"
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
      targetCapabilityId: act === "capability_question" ? candidates[0]?.capabilityId ?? null : selectedCapabilityId,
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
