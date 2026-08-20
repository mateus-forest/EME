import type { CosAttachmentInput, CosCapabilityId, CosConversationSnapshot, CosKnowledgeContext, CosPendingInput, CosWorkspaceContext } from "@/lib/cos/types"

export const COS_V2_TURN_TYPES = [
  "question",
  "context",
  "execution",
  "correction",
  "selection",
  "confirmation",
  "cancellation",
] as const

export const COS_V2_DOMAINS = ["clients", "properties", "proposals", "agenda", "general"] as const

export type CosV2TurnType = (typeof COS_V2_TURN_TYPES)[number]
export type CosV2Domain = (typeof COS_V2_DOMAINS)[number]
export type CosV2ObjectiveKind = "answer" | "query" | "execute" | "context"
export type CosV2EntityType = "client" | "property" | "proposal" | "appointment"

export type CosV2Interpretation = {
  schemaVersion: 2
  turnType: CosV2TurnType
  objective: {
    kind: CosV2ObjectiveKind
    summary: string
  }
  primaryDomain: CosV2Domain
  secondaryDomains: CosV2Domain[]
  entities: Array<{
    type: CosV2EntityType
    id: string | null
    name: string | null
    role: "subject" | "beneficiary" | "target" | "comparison" | "context"
  }>
  references: Array<{
    expression: string
    type: CosV2EntityType | null
    id: string | null
    relation: "active" | "previous" | "alternative" | "selection" | "named" | "unknown"
  }>
  filters: Array<{
    field: string
    operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains" | "in" | "between"
    value: string
  }>
  providedData: Array<{
    field: string
    value: string
  }>
  corrections: Array<{
    field: string
    from: string | null
    to: string
  }>
  missingData: string[]
  intendedAction: string | null
  steps: Array<{
    action: string
    goal: string
  }>
  confidence: number
  clarificationQuestion: string | null
  responseFocus: "overview" | "how_to" | "comparison" | "status" | "direct"
  source: "structured_action" | "pending" | "openai"
}

export type CosV2CompactContext = {
  recentMessages: Array<{
    user: string
    assistant: string | null
    action: string | null
    status: string | null
  }>
  activeEntities: Array<{
    type: string
    id: string
    label: string | null
  }>
  pending: {
    capabilityId: string | null
    action: string
    entity: string
    field: string
    type: string
    label: string
    options: Array<{ id: string; label: string }>
    knownData: Record<string, unknown>
  } | null
  currentFilters: Record<string, unknown>
  recentResults: Array<{
    capabilityId: string
    action: string
    status: string
    entityIds: string[]
  }>
  workspace: {
    page: string
    entity: string
    entityId: string | null
    selection: Array<{ entity: string; entityId: string; label?: string }>
  } | null
  attachments: Array<{
    name: string
    type: string
    category: string
    textExcerpt: string | null
  }>
  knowledgeFacts: Array<{
    source: string
    topic: string
    fact: string
  }>
}

export type CosV2TurnInput = {
  message: string
  structuredAction: string | null
  optionActionId: string | null
  selectedOptionId: string | null
  confirm: boolean
  cancel: boolean
  surface: "portal" | "cos_home"
  workspace: CosWorkspaceContext | null
  snapshot: CosConversationSnapshot
  pendingInput: CosPendingInput | null
  attachments: CosAttachmentInput[]
  knowledge: CosKnowledgeContext | null
}

export type CosV2Validation = {
  accepted: boolean
  interpretation: CosV2Interpretation
  capabilityIds: CosCapabilityId[]
  referencedCapabilityId: CosCapabilityId | null
  payload: Record<string, unknown>
  errors: string[]
  evidence: string[]
}
