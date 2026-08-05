import type { Prisma } from "@prisma/client"

import type { AssessorAction, PendingAssessorContext } from "@/lib/eme-backend"

export type CosCapabilityId =
  | "general.chat"
  | "property.create"
  | "property.search"
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

export type CosActionResult = {
  response: string
  metadata: Prisma.InputJsonObject
  leadId?: string
  propertyId?: string
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
  pendingContext?: Partial<PendingAssessorContext>
}

export type CosCapabilityHandler = (input: CosCapabilityExecutionInput) => Promise<CosActionResult>

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
  pendingContextUsed: boolean
  surface: CosCapabilitySurface
  resolutionMs: number
  requestedAction: string | null
  contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy"
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
  pendingContext: PendingAssessorContext | null
  workspace: CosWorkspaceContext | null
  capability: CosCapabilityDefinition
  capabilityId: CosCapabilityId
  entity: CosEntityModuleId
  confidence: number
  source: CosCapabilityPlanSource
  reason: string
  contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy"
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
  result: CosActionResult | null
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
  contextOrigin: "workspace" | "pending_context" | "catalog" | "legacy"
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
  pendingContext: PendingAssessorContext | null
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

export type CosPendingInput = {
  field: string
  label: string
  type: CosPendingInputType
  required: boolean
  entity: CosEntityModuleId
  action: AssessorAction
  parsedData: Record<string, unknown>
}

export type CosWorkflowStatus =
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

export type CosConversationMemoryAttachment = {
  id: string
  name: string
  type: string
  size: number
  category: "image" | "document" | "video" | "files"
  dataUrl?: string
  textContent?: string
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
