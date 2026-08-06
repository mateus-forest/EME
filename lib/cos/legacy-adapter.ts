import {
  generateAssessorText,
  getPendingAssessorContext,
  inferAssessorAction,
  runLegacyAssessorAction,
  type AssessorAction,
  type PendingAssessorContext,
} from "@/lib/eme-backend"

export type CosLegacyDependencyInventoryItem = {
  area: "decision" | "execution" | "response" | "pending_context"
  dependency: "inferAssessorAction" | "runLegacyAssessorAction" | "generateAssessorText" | "getPendingAssessorContext"
  callers: string[]
  reason: string
  triggeredWhen: string
  equivalentCapabilities: string[]
  migrationEffort: "low" | "medium" | "high"
}

const COS_LEGACY_DEPENDENCY_INVENTORY: CosLegacyDependencyInventoryItem[] = [
  {
    area: "decision",
    dependency: "inferAssessorAction",
    callers: ["lib/cos/planner.ts"],
    reason: "Fallback residual para mensagens que ainda nao fecham com confianca no catalogo novo.",
    triggeredWhen: "Somente quando o planner nao encontra candidate forte via requestedAction, pending context ou catalog scoring.",
    equivalentCapabilities: ["general.chat", "property.create", "property.search", "lead.create", "proposal.create", "contract.create"],
    migrationEffort: "medium",
  },
  {
    area: "execution",
    dependency: "runLegacyAssessorAction",
    callers: ["lib/cos/executor.ts"],
    reason: "Mantem capacidades legadas funcionando enquanto nao existe handler modular equivalente.",
    triggeredWhen: "Somente quando a capability selecionada nao possui handler no novo engine.",
    equivalentCapabilities: ["property.create", "property.search", "property.description.improve", "proposal.create", "contract.create", "contract.list", "contract.get"],
    migrationEffort: "high",
  },
  {
    area: "pending_context",
    dependency: "getPendingAssessorContext",
    callers: ["app/api/assistant/eme/route.ts"],
    reason: "Recupera continuidade dos fluxos antigos que ainda nao foram convertidos para workflow persistido pleno.",
    triggeredWhen: "Somente quando nao existe workflow persistido retomavel na conversa atual.",
    equivalentCapabilities: ["lead.delete", "lead.attach_document", "studio.generateCampaign", "studio.generateInstagram", "studio.generateVideo"],
    migrationEffort: "medium",
  },
  {
    area: "response",
    dependency: "generateAssessorText",
    callers: ["lib/cos/response-formatter.ts"],
    reason: "Mantem a camada historica de NLG apenas para respostas genericas ainda sem formatter dedicado.",
    triggeredWhen: "Somente para respostaMode nlg ligada a action general.",
    equivalentCapabilities: ["general.chat"],
    migrationEffort: "low",
  },
]

export function inferLegacyCosAction(message: string, requestedAction?: string): AssessorAction {
  return inferAssessorAction(message, requestedAction)
}

export async function executeLegacyCosAction(input: {
  brokerId: string
  userId: string
  message: string
  action: AssessorAction
  confirm?: boolean
  payload?: Record<string, unknown>
}) {
  return runLegacyAssessorAction(input)
}

export async function loadLegacyPendingCosContext(brokerId: string, conversationId?: string | null): Promise<PendingAssessorContext | null> {
  return getPendingAssessorContext(brokerId, conversationId)
}

export async function formatLegacyCosText(message: string, action: AssessorAction, actionResponse: string) {
  return generateAssessorText(message, action, actionResponse)
}

export function getCosLegacyDependencyInventory() {
  return COS_LEGACY_DEPENDENCY_INVENTORY.map((item) => ({
    ...item,
    callers: [...item.callers],
    equivalentCapabilities: [...item.equivalentCapabilities],
  }))
}
