import type { Prisma } from "@prisma/client"

import type { AssessorAction, PendingAssessorContext } from "@/lib/eme-backend"

export type CosCapabilityId =
  | "general.chat"
  | "property.create"
  | "property.search"
  | "property.description.improve"
  | "lead.create"
  | "lead.summary"
  | "lead.summarize"
  | "operation.summary"
  | "finance.summary"
  | "analytics.summary"
  | "catalog.summary"
  | "catalog.analyze"
  | "agenda.create"
  | "agenda.list"
  | "agenda.complete"
  | "proposal.create"
  | "contract.create"
  | "document.list"
  | "document.get"
  | "contract.list"
  | "contract.get"

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

export type CosCapabilityPlanSource = "catalog" | "legacy"

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

export type CosExecutionPlanSource = "single" | "recipe"

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
  interruptedStep: CosExecutionStep | null
  interruptedReason: string | null
  unresolvedGoals: CosExecutionPlanGap[]
  metadata: Prisma.InputJsonObject
  leadId?: string
  propertyId?: string
  totalDurationMs: number
}
