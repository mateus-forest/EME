import type { AssessorAction } from "../../eme-backend"
import type { FastActionResolution } from "@/lib/cos/fast-action-resolver"
import type {
  CosAttachmentInput,
  CosCapabilityId,
  CosCapabilitySurface,
  CosConversationMemory,
  CosNormalizedContext,
  CosPendingInput,
  CosWorkflow,
  CosWorkspaceContext,
  CosEntityModuleId,
} from "@/lib/cos/types"
import type { CosIntentResolution } from "@/lib/cos/intent-resolver"

export type CosEvalExecutionPlan = {
  steps: Array<{
    action: AssessorAction
    entity: CosEntityModuleId
  }>
  requiresConfirmation: boolean
  primaryStep: {
    entity: CosEntityModuleId
    plan: {
      contextOrigin: "workspace" | "pending_input" | "catalog" | "legacy" | null
      capabilityId: CosCapabilityId | null
      requiresSelection: boolean
    }
  }
}

export type CosEvalAttachmentSeed = Pick<CosAttachmentInput, "name" | "type" | "category"> & {
  textContent?: string
}

export type CosEvalWorkflowSeed = {
  action: AssessorAction
  status?: CosWorkflow["status"]
  pendingInput?: Partial<CosPendingInput> | null
}

export type CosEvalScenario = {
  id: string
  category: string
  description: string
  message: string
  surface?: CosCapabilitySurface
  tags?: string[]
  workspace?: Partial<CosWorkspaceContext> | null
  memory?: Partial<CosConversationMemory> | null
  attachments?: CosEvalAttachmentSeed[]
  activeWorkflow?: CosEvalWorkflowSeed | null
  expected: {
    fastActionKind?: FastActionResolution["kind"]
    navigationHref?: string
    intentAction?: AssessorAction | "workflow_details" | null
    workflowDecision?: CosIntentResolution["workflowDecision"]
    capabilityId?: CosCapabilityId | null
    workflowActions?: AssessorAction[]
    minConfidence?: number
    requiresConfirmation?: boolean
    maxProjectedQuestions?: number
    contextOrigin?: CosEvalExecutionPlan["primaryStep"]["plan"]["contextOrigin"] | null
  }
}

export type CosEvalScenarioRuntime = {
  attachments: CosAttachmentInput[]
  workspace: CosWorkspaceContext | null
  memory: CosConversationMemory | null
  activeWorkflow: CosWorkflow | null
  normalizedContext: CosNormalizedContext
}

export type CosEvalScenarioResult = {
  scenario: CosEvalScenario
  durationMs: number
  success: boolean
  failures: string[]
  projectedQuestions: number
  fastAction: FastActionResolution
  intentResolution: CosIntentResolution
  capabilityId: CosCapabilityId | null
  executionPlan: CosEvalExecutionPlan | null
}
