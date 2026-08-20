import { retrieveCosKnowledge, selectCosKnowledgeFacts } from "@/lib/cos/knowledge/retrieval"
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
  return retrieveCosKnowledge({
    message: input.message,
    decision: knowledgeDecision({
      domain: input.domain ?? "general",
      secondaryDomains: input.secondaryDomains,
      turnType: input.turnType,
      capabilityId: helpKnowledge?.capabilityId ?? input.capabilityId,
    }),
    filters: helpKnowledge?.documentIds.length ? { documentIds: helpKnowledge.documentIds } : undefined,
  })
}

export function getCosV2KnowledgeFacts(context: CosKnowledgeContext | null, message: string) {
  if (!context) return []
  return selectCosKnowledgeFacts({ message, context, limit: 6 })
    .map((fact) => ({ source: fact.sourceId, topic: fact.heading, fact: fact.text.slice(0, 360) }))
}
