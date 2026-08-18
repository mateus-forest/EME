import type {
  CosConversationDomain,
  CosConversationEntityType,
  CosDialogueAct,
  CosPendingInputType,
} from "@/lib/cos/types"

export type CosGoldenClassification =
  | "SUPPORTED_NOW"
  | "SUPPORTED_WITH_KNOWN_GAP"
  | "PRODUCT_EXISTS_COS_GAP"
  | "KNOWLEDGE_ONLY"
  | "NOT_SUPPORTED"

export type CosGoldenPriority = "P0" | "P1" | "P2" | "P3"

export type CosGoldenDomain =
  | CosConversationDomain
  | "account"
  | "history"
  | "library"
  | "plan"
  | "security"

export type CosGoldenEvaluationLayer =
  | "dialogue_act"
  | "domain"
  | "entity_resolution"
  | "reference_resolution"
  | "working_set"
  | "context_continuity"
  | "capability_reference"
  | "capability_selection"
  | "capability_execution"
  | "pending_input"
  | "confirmation"
  | "persistence"
  | "partial_success"
  | "knowledge_correctness"
  | "gap_recognition"
  | "failure_classification"
  | "entitlement_security"
  | "credit_correctness"
  | "response_quality"
  | "forbidden_behaviors"

export type CosGoldenBehaviorAssertions = {
  fixture?: string[]
  stateBefore?: string[]
  stateAfter?: string[]
  workingSet?: Record<string, string>
  persistence?: string[]
  partialSuccess?: string[]
  expectedTrace?: string[]
  expectedArtifacts?: string[]
  requiredFacts?: string[]
  responseIncludes?: string[]
  responseExcludes?: string[]
  forbidden?: string[]
  creditCharge?: number
  failureClass?: string
  entitlement?: string
  knownGap?: string
  knownGapLayer?: CosGoldenEvaluationLayer
  gracefulDegradation?: string[]
  futureContract?: string[]
  sourceIssues?: string[]
}

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
  /** @deprecated Fixtures anteriores ao Golden V1.1 usam `domain`. */
  domain?: CosGoldenDomain
  primaryDomain?: CosGoldenDomain
  secondaryDomains?: CosGoldenDomain[]
  /** @deprecated Fixtures anteriores ao Golden V1.1 usam `capabilityId`. */
  capabilityId?: string | null
  referencedCapabilityId?: string | null
  referencedProductFunction?: string | null
  selectedCapabilityId?: string | null
  executedCapabilityId?: string | null
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
  baseScenarioId?: string
  sourceNumber?: string
  title?: string
  classifications?: CosGoldenClassification[]
  priorities?: CosGoldenPriority[]
  domains?: CosGoldenDomain[]
  assertions?: CosGoldenBehaviorAssertions
  requiredLayers?: CosGoldenEvaluationLayer[]
  initial?: CosGoldenStatePatch
  turns: CosGoldenConversationTurn[]
}

export type CosGoldenFailure = {
  suite:
    | "routing"
    | "context"
    | "knowledge"
    | "execution"
    | "response"
    | "localization"
    | "safety"
    | "conversation"
    | "dataset"
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

export type CosGoldenAssertionStatus = "pass" | "fail" | "not_evaluated"

export type CosGoldenLayerResult = {
  layer: CosGoldenEvaluationLayer
  status: CosGoldenAssertionStatus
  turn: number | null
  expected: string | null
  actual: string | null
  reason: string | null
}

export type CosGoldenCaseResult = {
  id: string
  baseScenarioId: string
  sourceNumber: string
  title: string
  classifications: CosGoldenClassification[]
  priorities: CosGoldenPriority[]
  status: "pass" | "fail" | "incomplete"
  firstFailureTurn: number | null
  knownGap: string | null
  knownGapLayer: CosGoldenEvaluationLayer | null
  forbiddenBehaviors: string[]
  layers: CosGoldenLayerResult[]
}

export type CosGoldenCoverageMetric = {
  eligible: number
  evaluated: number
  passed: number
  failed: number
  notEvaluated: number
  accuracy: number | null
  coverage: number | null
}
