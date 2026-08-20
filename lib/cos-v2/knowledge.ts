import { normalizeCosKnowledgeText, retrieveCosKnowledge, selectCosKnowledgeFacts } from "@/lib/cos/knowledge/retrieval"
import type { CosCapabilityId, CosConversationDomain, CosDialogueDecision, CosKnowledgeContext } from "@/lib/cos/types"
import type { CosV2Domain, CosV2HelpTopic, CosV2TurnType } from "@/lib/cos-v2/types"

const DOMAIN_MAP: Record<CosV2Domain, CosConversationDomain> = {
  clients: "lead",
  properties: "property",
  proposals: "proposal",
  agenda: "agenda",
  general: "general",
}

const HELP_KNOWLEDGE: Partial<Record<CosV2HelpTopic, { capabilityId: CosCapabilityId; documentIds: string[] }>> = {
  first_steps: { capabilityId: "help.first_steps", documentIds: ["eme", "cos"] },
  using_cos: { capabilityId: "help.use_cos", documentIds: ["cos", "capacidades-cos"] },
  registering_properties: { capabilityId: "help.register_properties", documentIds: ["imoveis"] },
  managing_clients: { capabilityId: "help.manage_clients", documentIds: ["clientes"] },
  proposals: { capabilityId: "help.contracts_proposals", documentIds: ["propostas"] },
}

const OPERATIONAL_KNOWLEDGE_DOCUMENT_ID = "operacao-cos-v2"
const OPERATIONAL_DOMAIN_SIGNAL = /\b(cliente|clientes|lead|leads|crm|imovel|imoveis|propriedade|catalogo|marketplace|studio|campanha|instagram|anuncio|video|biblioteca|criativo|proposta|contrato|documento|agenda|compromisso|visita|desempenho|analytics|metrica|historico|conversa|plano|credito|limite|conta|creci|seguranca|pin|dispositivo|notificacao|suporte|corretor eme|whatsapp)\b/
const DIAGNOSIS_SIGNAL = /\b(nao consigo|por que|porque|erro|falha|falhou|bloque|imped|pendenc|incomplet|nao aparece|nao publica|nao publicou|nao subiu|indisponivel|rejeitad|nao valid|problema)\b/
const ACTION_SIGNAL = /\b(faca|faz|crie|criar|cadastre|cadastrar|atualize|editar|edite|exclua|publique|despublique|gere|gerar|marque|cancele|anexe|envie|abra|renomeie|mostre|liste|busque|consulte)\b/
const CURRENT_DATA_SIGNAL = /\b(quantos?|qual|quais|saldo|status|estado|tenho|vieram|teve mais|hoje|amanha|esta semana|este mes|agora)\b.*\b(meu|minha|meus|minhas|eu|clientes?|leads?|imoveis?|creditos?|compromissos?|agenda|catalogo|marketplace|campanhas?|contratos?|propostas?)\b|\b(por que|porque)\s+(meu|minha|meus|minhas)\b/

export type CosV2KnowledgeLayer = "KNOWLEDGE" | "DIAGNOSIS" | "ACTION"

function classifyOperationalLayer(message: string, turnType?: CosV2TurnType): CosV2KnowledgeLayer {
  const normalized = normalizeCosKnowledgeText(message)
  if (DIAGNOSIS_SIGNAL.test(normalized)) return "DIAGNOSIS"
  if (turnType === "execution" || ACTION_SIGNAL.test(normalized)) return "ACTION"
  return "KNOWLEDGE"
}

function layerFromHeading(heading: string): CosV2KnowledgeLayer {
  const normalized = normalizeCosKnowledgeText(heading)
  if (/\bdiagnosis\b/.test(normalized)) return "DIAGNOSIS"
  if (/\baction\b/.test(normalized)) return "ACTION"
  return "KNOWLEDGE"
}

function knowledgeDecision(input: {
  domain: CosV2Domain
  secondaryDomains?: CosV2Domain[]
  turnType?: CosV2TurnType
  capabilityId?: CosCapabilityId | null
}): CosDialogueDecision {
  const dialogueAct = input.turnType === "execution" ? "execute" : "explain"
  const targetCapabilityId = input.capabilityId ?? "help.general_question"
  return {
    schemaVersion: 1,
    dialogueAct,
    dialogueActConfidence: 1,
    dialogueActEvidence: ["cos_v2_knowledge_query"],
    primaryDomain: DOMAIN_MAP[input.domain],
    secondaryDomains: (input.secondaryDomains ?? []).map((domain) => DOMAIN_MAP[domain]),
    objective: {
      mode: dialogueAct === "execute" ? "execute" : "explain",
      summary: "Recuperar somente fatos relevantes para o turno do COS V2.",
      targetCapabilityId,
    },
    reference: { type: null, id: null, label: null, reason: "cos_v2", ambiguousIds: [] },
    selectedCapabilityId: null,
    selectedAction: null,
    candidateCapabilities: [],
    workflowDecision: "none",
    needsClarification: false,
    clarificationReason: null,
    source: "explicit_interface",
  }
}

export async function retrieveCosV2Knowledge(input: {
  message: string
  domain?: CosV2Domain
  secondaryDomains?: CosV2Domain[]
  turnType?: CosV2TurnType
  capabilityId?: CosCapabilityId | null
  helpTopic?: CosV2HelpTopic | null
}) {
  const helpKnowledge = input.helpTopic ? HELP_KNOWLEDGE[input.helpTopic] : null
  const normalizedMessage = normalizeCosKnowledgeText(input.message)
  const operationalDocumentIds = OPERATIONAL_DOMAIN_SIGNAL.test(normalizedMessage)
    ? [OPERATIONAL_KNOWLEDGE_DOCUMENT_ID]
    : []
  const documentIds = [...new Set([
    ...operationalDocumentIds,
    ...(helpKnowledge?.documentIds ?? []),
  ])]
  return retrieveCosKnowledge({
    message: input.message,
    decision: knowledgeDecision({
      domain: input.domain ?? "general",
      secondaryDomains: input.secondaryDomains,
      turnType: input.turnType,
      capabilityId: helpKnowledge?.capabilityId ?? input.capabilityId,
    }),
    filters: documentIds.length ? { documentIds } : undefined,
  })
}

export function getCosV2KnowledgeFacts(context: CosKnowledgeContext | null, message: string) {
  if (!context) return []
  const normalizedMessage = normalizeCosKnowledgeText(message)
  const requestedLayer = classifyOperationalLayer(message)
  const liveDataRequest = CURRENT_DATA_SIGNAL.test(normalizedMessage)
  const layerPriority: Record<CosV2KnowledgeLayer, number> = requestedLayer === "DIAGNOSIS"
    ? { DIAGNOSIS: 0, ACTION: 1, KNOWLEDGE: 2 }
    : requestedLayer === "ACTION"
      ? { ACTION: 0, DIAGNOSIS: 1, KNOWLEDGE: 2 }
      : { KNOWLEDGE: 0, DIAGNOSIS: 1, ACTION: 2 }

  return selectCosKnowledgeFacts({ message, context, limit: 12 })
    .map((fact) => ({
      source: fact.sourceId,
      topic: fact.heading,
      fact: fact.text.slice(0, 420),
      layer: layerFromHeading(fact.heading),
      order: fact.order,
    }))
    .filter((fact) => !liveDataRequest || fact.layer !== "KNOWLEDGE")
    .sort((left, right) => layerPriority[left.layer] - layerPriority[right.layer] || left.order - right.order)
    .slice(0, requestedLayer === "KNOWLEDGE" ? 4 : 6)
    .map(({ source, topic, fact, layer }) => ({ source, topic, fact, layer }))
}
