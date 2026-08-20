import type { Prisma } from "@prisma/client"

import type { AssessorAction } from "@/lib/eme-backend"

export type CosCapabilityId =
  | "general.chat"
  | "property.create"
  | "property.search"
  | "property.get"
  | "property.description.improve"
  | "property.publish"
  | "property.unpublish"
  | "property.media.update"
  | "property.price.suggest"
  | "property.archive"
  | "lead.create"
  | "lead.summary"
  | "lead.summarize"
  | "lead.update"
  | "lead.delete"
  | "lead.find"
  | "lead.timeline"
  | "lead.convert"
  | "lead.attach_document"
  | "operation.summary"
  | "finance.summary"
  | "finance.receivable"
  | "finance.payable"
  | "finance.forecast"
  | "finance.commission"
  | "finance.cashflow"
  | "analytics.summary"
  | "analytics.performance"
  | "analytics.sales"
  | "analytics.properties"
  | "analytics.leads"
  | "catalog.summary"
  | "catalog.analyze"
  | "catalog.publish"
  | "catalog.unpublish"
  | "catalog.share"
  | "catalog.stats"
  | "agenda.create"
  | "agenda.list"
  | "agenda.complete"
  | "agenda.update"
  | "agenda.cancel"
  | "agenda.today"
  | "agenda.week"
  | "agenda.month"
  | "proposal.create"
  | "proposal.summary"
  | "contract.create"
  | "contract.preview"
  | "contract.update"
  | "contract.send"
  | "contract.sign"
  | "contract.cancel"
  | "contract.download"
  | "contract.history"
  | "document.list"
  | "document.get"
  | "contract.list"
  | "contract.get"
  | "studio.generateDescription"
  | "studio.generateCampaign"
  | "studio.generateInstagram"
  | "studio.generateFacebook"
  | "studio.generateVideo"
  | "studio.generateStory"
  | "studio.improveText"
  | "studio.regenerate"
  | "help.first_steps"
  | "help.use_cos"
  | "help.register_properties"
  | "help.manage_clients"
  | "help.contracts_proposals"
  | "help.marketing_studio"
  | "help.general_question"

export type CosActionResultBase = {
  response: string
  metadata: Prisma.InputJsonObject
  leadId?: string
  propertyId?: string
}

export type CosActionSuccessResult = CosActionResultBase & {
  status: "success"
}

export type CosActionAwaitingInputResult = CosActionResultBase & {
  status: "awaiting_input"
  pendingInput: CosPendingInput
}

export type CosActionErrorResult = CosActionResultBase & {
  status: "error"
  errorCode: string
}

export type CosRuntimeActionResult =
  | CosActionSuccessResult
  | CosActionAwaitingInputResult
  | CosActionErrorResult

/**
 * Contrato temporário para handlers ainda não migrados. A normalização acontece
 * uma única vez no executor e nunca infere estado a partir do texto da resposta.
 */
export type CosLegacyActionResult = CosActionResultBase & {
  status?: never
}

export type CosActionResult = CosRuntimeActionResult | CosLegacyActionResult
export type CosCapabilityHandlerResult = CosActionResult

export type CosAttachmentCategory = "image" | "document" | "video" | "files"

export type CosAttachmentInput = {
  id: string
  name: string
  type: string
  size: number
  category: CosAttachmentCategory
  dataUrl?: string
  textContent?: string
}

export type CosCapabilitySurface = "portal" | "cos_home" | "whatsapp" | "demo"

export type CosCapabilityDomain =
  | "general"
  | "property"
  | "lead"
  | "proposal"
  | "contract"
  | "agenda"
  | "finance"
  | "analytics"
  | "catalog"
  | "studio"
  | "operation"
  | "document"

export type CosDialogueAct =
  | "execute"
  | "query"
  | "explain"
  | "capability_question"
  | "context"
  | "correct"
  | "confirm"
  | "reject"
  | "cancel"
  | "select"
  | "switch_topic"
  | "return_topic"
  | "provide_input"
  | "social"
  | "unknown"

export type CosConversationDomain =
  | "lead"
  | "property"
  | "proposal"
  | "contract"
  | "agenda"
  | "catalog"
  | "marketplace"
  | "account"
  | "plan"
  | "library"
  | "history"
  | "security"
  | "finance"
  | "analytics"
  | "studio"
  | "help"
  | "general"

export type CosKnowledgeType = "module" | "rule" | "glossary" | "procedure" | "capability"

export type CosKnowledgeDocumentRef = {
  id: string
  title: string
  version: string
}

export type CosKnowledgeChunk = {
  id: string
  sourceId: string
  documentTitle: string
  heading: string
  domains: CosConversationDomain[]
  knowledgeTypes: CosKnowledgeType[]
  version: string
  order: number
  text: string
  score: number
  reason: string[]
}

export type CosKnowledgeContext = {
  schemaVersion: 1
  required: boolean
  query: string
  reason: string[]
  selectedDocuments: CosKnowledgeDocumentRef[]
  chunks: CosKnowledgeChunk[]
  knowledgeMiss: boolean
  sourceVersion: string
  limits: {
    maxChunks: number
    maxChunkChars: number
    maxContextChars: number
    selectedChars: number
  }
}

export type CosDialogueDecisionCandidate = {
  capabilityId: CosCapabilityId
  action: AssessorAction
  title: string
  domain: CosConversationDomain
  score: number
  confidence: number
  evidence: string[]
  mutatesData: boolean
}

export type CosSemanticEntity = {
  type: CosConversationEntityType
  id: string | null
  label: string | null
  role: "subject" | "beneficiary" | "target" | "comparison" | "context"
}

export type CosSemanticReference = {
  expression: string
  type: CosConversationEntityType | null
  id: string | null
  label: string | null
  relation: "active" | "previous" | "alternative" | "selection" | "named" | "unknown"
}

export type CosSemanticFilter = {
  field: string
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains" | "in" | "between"
  value: string | number | boolean | null
  secondaryValue: string | number | boolean | null
}

export type CosSemanticCorrection = {
  field: string
  from: string | null
  to: string
}

export type CosSemanticInterpretationInput = {
  dialogueAct: CosDialogueAct
  objective: {
    mode: "execute" | "query" | "explain" | "respond" | "continue" | "clarify"
    summary: string
    targetCapabilityId: string | null
  }
  primaryDomain: CosConversationDomain
  secondaryDomains: CosConversationDomain[]
  entities: CosSemanticEntity[]
  references: CosSemanticReference[]
  filters: CosSemanticFilter[]
  corrections: CosSemanticCorrection[]
  confidence: number
  needsClarification: boolean
  clarificationQuestion: string | null
}

export type CosSemanticInterpretation = Omit<CosSemanticInterpretationInput, "objective"> & {
  objective: Omit<CosSemanticInterpretationInput["objective"], "targetCapabilityId"> & {
    targetCapabilityId: CosCapabilityId | null
  }
  validationEvidence: string[]
}

export type CosDialogueDecision = {
  schemaVersion: 1
  dialogueAct: CosDialogueAct
  dialogueActConfidence: number
  dialogueActEvidence: string[]
  primaryDomain: CosConversationDomain
  secondaryDomains: CosConversationDomain[]
  objective: {
    mode: "execute" | "query" | "explain" | "respond" | "continue" | "clarify"
    summary: string
    targetCapabilityId: CosCapabilityId | null
  }
  reference: {
    type: CosConversationEntityType | null
    id: string | null
    label: string | null
    reason: string
    ambiguousIds: string[]
  }
  selectedCapabilityId: CosCapabilityId | null
  selectedAction: AssessorAction | null
  candidateCapabilities: CosDialogueDecisionCandidate[]
  workflowDecision: "continue_workflow" | "start_new" | "none"
  needsClarification: boolean
  clarificationReason: string | null
  source: "explicit_interface" | "dialogue_rules" | "snapshot_context" | "registry" | "ai_interpretation" | "fallback"
  semanticInterpretation?: CosSemanticInterpretation | null
}

export type CosCapabilityEntity =
  | "conversation"
  | "property"
  | "lead"
  | "agenda"
  | "financial"
  | "analytics"
  | "catalog"
  | "document"
  | "contract"
  | "operation"
  | "studio"

export type CosCapabilityExecutionInput = {
  brokerId: string
  userId: string
  message: string
  action: AssessorAction
  confirm?: boolean
  payload?: Record<string, unknown>
  context?: CosNormalizedContext | null
  pendingInput?: CosPendingInput | null
}

export type CosCapabilityHandler = (input: CosCapabilityExecutionInput) => Promise<CosCapabilityHandlerResult>

export type CosCapabilityDefinition = {
  id: CosCapabilityId
  action: AssessorAction
  title: string
  description: string
  domain: CosCapabilityDomain
  entity: CosCapabilityEntity
  aliases: string[]
  responseMode: "raw" | "nlg"
  source: "modular" | "legacy"
  mutatesData: boolean
  requiresConfirmation: boolean
  requiresSelection: boolean
  inputContract?: {
    required: string[]
    optional: string[]
  }
  surfaces: CosCapabilitySurface[]
  confirmationMessage?: string
  handler?: CosCapabilityHandler
}

export type CosCapabilityDescriptor = Omit<CosCapabilityDefinition, "handler">

export type CosEntityModuleId =
  | "lead"
  | "property"
  | "proposal"
  | "contract"
  | "agenda"
  | "finance"
  | "analytics"
  | "catalog"
  | "studio_ia"
  | "operation"
  | "general"

export type CosEntityMetadata = {
  id: CosEntityModuleId
  title: string
  description: string
}

export type CosEntityCapabilityRegistration = {
  descriptor: CosCapabilityDescriptor
  handler?: CosCapabilityHandler
}

export type CosEntityModule = {
  entity: CosEntityMetadata
  capabilities: CosEntityCapabilityRegistration[]
}

export type CosWorkspaceEntity =
  | CosEntityModuleId
  | "document"
  | "conversation"

export type CosWorkspaceSelection = {
  entity: CosWorkspaceEntity
  entityId: string
  label?: string
}

export type CosWorkspaceContext = {
  surface: CosCapabilitySurface
  page: string
  entity: CosWorkspaceEntity
  entityId?: string | null
  selection: CosWorkspaceSelection[]
  pendingEntity?: CosWorkspaceEntity | null
  pendingEntityId?: string | null
  metadata: Record<string, unknown>
}

export type CosCapabilityPlanSource = "catalog" | "legacy" | "ai"
export type CosPlannerKind = "deterministic" | "ai"

export type CosCapabilityPlanTelemetry = {
  capabilityId: CosCapabilityId
  entity: CosEntityModuleId
  confidence: number
  source: CosCapabilityPlanSource
  reason: string
  fallbackUsed: boolean
  pendingInputUsed: boolean
  surface: CosCapabilitySurface
  resolutionMs: number
  requestedAction: string | null
  contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy"
  workspaceReceived: boolean
  workspacePage: string | null
  workspaceEntity: CosWorkspaceEntity | null
  workspaceEntityId: string | null
  workspaceEntityUsed: CosWorkspaceEntity | null
  workspaceEntityIdUsed: string | null
}

export type CosCapabilityPlan = {
  action: AssessorAction
  payload: Record<string, unknown>
  pendingInput: CosPendingInput | null
  context: CosNormalizedContext | null
  workspace: CosWorkspaceContext | null
  capability: CosCapabilityDefinition
  capabilityId: CosCapabilityId
  entity: CosEntityModuleId
  confidence: number
  source: CosCapabilityPlanSource
  reason: string
  contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy"
  telemetry: CosCapabilityPlanTelemetry
}

export type CosExecutionPlanSource = "single" | "recipe" | "ai"
export type CosExecutionPlanBuilder = "deterministic" | "ai"

export type CosExecutionPlanStatus =
  | "pending"
  | "needs_confirmation"
  | "running"
  | "completed"
  | "awaiting_input"
  | "failed"

export type CosExecutionStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "awaiting_input"
  | "failed"
  | "skipped"

export type CosExecutionPlanGap = {
  id: string
  title: string
  reason: string
}

export type CosExecutionStep = {
  id: string
  order: number
  entity: CosEntityModuleId
  capabilityId: CosCapabilityId
  action: AssessorAction
  status: CosExecutionStepStatus
  dependsOn: string[]
  durationMs: number | null
  result: CosRuntimeActionResult | null
  errorMessage: string | null
  plan: CosCapabilityPlan
}

export type CosExecutionPlanTelemetry = {
  planId: string
  source: CosExecutionPlanSource
  planner: CosExecutionPlanBuilder
  reason: string
  surface: CosCapabilitySurface
  stepCount: number
  steps: Array<{
    id: string
    capabilityId: CosCapabilityId
    action: AssessorAction
    entity: CosEntityModuleId
    source: CosCapabilityPlanSource
    mutatesData: boolean
    requiresConfirmation: boolean
  }>
  unresolvedGoals: CosExecutionPlanGap[]
  requestedAction: string | null
  messageLength: number
  workspaceReceived: boolean
  workspaceEntity: CosWorkspaceEntity | null
  workspaceEntityId: string | null
  contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy"
  resolutionMs: number
  orchestrator: Prisma.InputJsonObject | null
}

export type CosExecutionPlan = {
  id: string
  source: CosExecutionPlanSource
  reason: string
  status: CosExecutionPlanStatus
  message: string
  requestedAction?: string
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  pendingInput: CosPendingInput | null
  context: CosNormalizedContext | null
  primaryStep: CosExecutionStep
  steps: CosExecutionStep[]
  unresolvedGoals: CosExecutionPlanGap[]
  requiresConfirmation: boolean
  confirmationMessage: string | null
  telemetry: CosExecutionPlanTelemetry
}

export type CosExecutionPlanResult = {
  planId: string
  status: CosExecutionPlanStatus
  primaryAction: AssessorAction
  primaryCapabilityId: CosCapabilityId
  steps: CosExecutionStep[]
  completedSteps: CosExecutionStep[]
  executedSteps: CosExecutionStep[]
  interruptedStep: CosExecutionStep | null
  interruptedReason: string | null
  unresolvedGoals: CosExecutionPlanGap[]
  metadata: Prisma.InputJsonObject
  leadId?: string
  propertyId?: string
  totalDurationMs: number
}

export type CosPendingInputType =
  | "text"
  | "phone"
  | "currency"
  | "time"
  | "selection"
  | "confirmation"

export type CosPendingInputOption = {
  id: string
  label: string
  description?: string
}

export type CosPendingInput = {
  schemaVersion?: 2
  createdAt?: string
  expiresAt?: string
  source?: "handler" | "confirmation" | "legacy_adapter"
  reason?: string
  capabilityId?: CosCapabilityId
  field: string
  label: string
  type: CosPendingInputType
  required: boolean
  entity: CosEntityModuleId
  action: AssessorAction
  parsedData: Record<string, unknown>
  options?: CosPendingInputOption[]
}

export type CosWorkflowStatus =
  | "created"
  | "processing"
  | "running"
  | "awaiting_input"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export type CosWorkflowStepState = {
  id: string
  order: number
  entity: CosEntityModuleId
  capabilityId: CosCapabilityId
  action: AssessorAction
  status: CosExecutionStepStatus
  dependsOn: string[]
  durationMs: number | null
  errorMessage: string | null
  resultResponse: string | null
  resultMetadata: Prisma.InputJsonObject | null
  resultStatus?: CosRuntimeActionResult["status"] | null
  resultErrorCode?: string | null
  leadId?: string
  propertyId?: string
}

export type CosWorkflow = {
  id: string
  conversationId: string
  status: CosWorkflowStatus
  executionPlan: {
    id: string
    source: CosExecutionPlanSource
    reason: string
    message: string
    requestedAction?: string
    surface: CosCapabilitySurface
    workspace: CosWorkspaceContext | null
    unresolvedGoals: CosExecutionPlanGap[]
  }
  currentStep: number
  steps: CosWorkflowStepState[]
  pendingInput: CosPendingInput | null
  startedAt: string
  updatedAt: string
  completedAt: string | null
  pausedAt: string | null
  totalPausedMs: number
}

export type CosConversationMemoryAttachment = CosAttachmentInput

export type CosNormalizedContext = {
  brokerId: string
  userId: string
  actor?: {
    firstName: string | null
  }
  surface: CosCapabilitySurface
  runtimeVersion?: "v1" | "v2"
  message: string
  workspace: CosWorkspaceContext | null
  workflow: CosWorkflow | null
  memory: CosConversationMemory | null
  snapshot: CosConversationSnapshot | null
  decision: CosDialogueDecision | null
  knowledge: CosKnowledgeContext | null
  attachments: CosAttachmentInput[]
  selectedEntityIds: Partial<Record<CosWorkspaceEntity, string>>
}

export type CosConversationMemory = {
  workflowId?: string | null
  workflowType?: string | null
  currentStep?: number | null
  pendingAction?: AssessorAction | null
  pendingEntity?: CosEntityModuleId | null
  awaitingConfirmation?: boolean
  awaitingSelection?: boolean
  awaitingUpload?: boolean
  lastAction?: AssessorAction | null
  lastUserMessage?: string
  lastResult?: string | null
  leadId?: string | null
  propertyId?: string | null
  documentId?: string | null
  contractId?: string | null
  proposalId?: string | null
  campaignId?: string | null
  selectedClient?: { id: string; label?: string | null } | null
  selectedProperty?: { id: string; label?: string | null } | null
  selectedContract?: { id: string; label?: string | null } | null
  selectedProposal?: { id: string; label?: string | null } | null
  attachments?: CosConversationMemoryAttachment[]
  uploadedImages?: CosConversationMemoryAttachment[]
  uploadedDocuments?: CosConversationMemoryAttachment[]
  uploadedVideos?: CosConversationMemoryAttachment[]
  extractedEntities?: Record<string, unknown>
  updatedAt: string
}

export type CosConversationEntityType = "lead" | "property" | "proposal" | "contract" | "agenda"

export type CosConversationEntityReference = {
  type: CosConversationEntityType
  id: string
  label: string | null
  source: "workspace" | "workflow" | "execution" | "message" | "legacy_memory" | "selection"
  lastMentionedAt: string
  confidence: number
  evidence: string
}

export type CosConversationSelectionItem = {
  index: number
  entity: CosConversationEntityReference
  description?: string
}

export type CosConversationSelectionSet = {
  id: string
  type: CosConversationEntityType
  items: CosConversationSelectionItem[]
  query: string | null
  topicId: string | null
  createdAt: string
  expiresAt: string
}

export type CosConversationTopic = {
  id: string
  domain: CosConversationDomain
  label: string
  entityType: CosConversationEntityType | null
  selectionSetId: string | null
  startedAt: string
  lastMentionedAt: string
}

export type CosConversationRecentMessage = {
  id: string
  userMessage: string
  assistantResponse: string | null
  action: AssessorAction | null
  status: string | null
  leadId: string | null
  propertyId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type CosConversationExecutionReference = {
  capabilityId: CosCapabilityId
  action: AssessorAction
  status: "success" | "awaiting_input" | "error" | "cancelled"
  entities: CosConversationEntityReference[]
  selectionSetId: string | null
  metadata: Record<string, unknown>
  executedAt: string
}

export type CosTemporalContext = {
  today: string
  references: Partial<Record<"today" | "tomorrow" | "yesterday" | "this_week" | "last_week" | "next_month", {
    from: string
    to: string
  }>>
}

export type CosConversationSnapshot = {
  schemaVersion: 1
  conversationId: string
  recentMessages: CosConversationRecentMessage[]
  activeWorkflow: CosWorkflow | null
  pendingInput: CosPendingInput | null
  currentTopic: CosConversationTopic | null
  recentTopics: CosConversationTopic[]
  activeEntities: Partial<Record<CosConversationEntityType, CosConversationEntityReference>>
  recentEntities: CosConversationEntityReference[]
  recentResults: CosConversationExecutionReference[]
  selectionSets: CosConversationSelectionSet[]
  lastAction: AssessorAction | null
  lastExecution: CosConversationExecutionReference | null
  temporalContext: CosTemporalContext
  workspace: CosWorkspaceContext | null
  updatedAt: string
}
