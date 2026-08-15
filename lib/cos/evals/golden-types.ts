import type {
  CosConversationDomain,
  CosConversationEntityType,
  CosDialogueAct,
  CosPendingInputType,
} from "@/lib/cos/types"

export type CosGoldenEntitySeed = {
  type: CosConversationEntityType
  id: string
  label: string
}

export type CosGoldenSelectionSeed = {
  type: CosConversationEntityType
  query: string
  items: Array<{ id: string; label: string; description?: string }>
}

export type CosGoldenPendingSeed = {
  capabilityId: string
  entity: "lead" | "property" | "proposal" | "contract" | "agenda" | "general"
  field: string
  label: string
  type: CosPendingInputType
  parsedData?: Record<string, unknown>
  options?: Array<{ id: string; label: string; description?: string }>
}

export type CosGoldenTopicSeed = {
  domain: Exclude<CosConversationDomain, "marketplace" | "help">
  label: string
  entityType?: CosConversationEntityType | null
  useLatestSelection?: boolean
}

export type CosGoldenStatePatch = {
  activate?: CosGoldenEntitySeed | null
  selection?: CosGoldenSelectionSeed | null
  topic?: CosGoldenTopicSeed | null
  pending?: CosGoldenPendingSeed | null
}

export type CosGoldenTurnExpectation = {
  act: CosDialogueAct
  domain: CosConversationDomain
  capabilityId?: string | null
  referenceId?: string | null
  knowledgeDocuments?: string[]
  knowledgeTextIncludes?: string[]
  knowledgeMiss?: boolean
  shouldMutate?: boolean
  requiresConfirmation?: boolean
  shouldClarify?: boolean
  responseKind?: "success" | "error" | "awaiting_input" | "confirmation_required" | "query_result" | "explanation" | "selection" | "partial_result" | "warning" | "cancelled"
}

export type CosGoldenConversationTurn = {
  message: string
  expected: CosGoldenTurnExpectation
  after?: CosGoldenStatePatch
}

export type CosGoldenConversation = {
  id: string
  category: string
  description: string
  tags: string[]
  initial?: CosGoldenStatePatch
  turns: CosGoldenConversationTurn[]
}

export type CosGoldenFailure = {
  suite: "routing" | "context" | "knowledge" | "execution" | "response" | "localization" | "safety" | "conversation"
  caseId: string
  turn: number | null
  message: string
  expected: string
  actual: string
}

export type CosEvalMetric = {
  evaluated: number
  passed: number
  failed: number
  accuracy: number
}
