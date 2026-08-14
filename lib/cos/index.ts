export { getCosCapabilityByAction, listCosCapabilities } from "@/lib/cos/capability-registry"
export {
  doesCosCapabilityMutateData,
  getCosCapabilityActionsForSurface,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityDescriptorByAction,
  getCosCapabilityDescriptorByAliasOrAction,
  getCosCapabilityDescriptorById,
  getCosEntityModuleIdByCapabilityId,
  getCosCapabilityLabel,
  isCosCapabilityAvailableOnSurface,
  listCosCapabilityCatalog,
  listCosEntityModules,
} from "@/lib/cos/capability-catalog"
export { executeCosCapability, executeCosExecutionPlan } from "@/lib/cos/executor"
export { createStepPlanForCapability, planCosExecution } from "@/lib/cos/execution-planner"
export { buildCosCapabilityInventoryMarkdown, getCosCapabilityInventory } from "@/lib/cos/inventory"
export { normalizeCosAttachments, runCosAttachmentPipeline, splitCosAttachmentsByCategory } from "@/lib/cos/attachment-pipeline"
export { createCosNormalizedContext } from "@/lib/cos/context"
export { buildCosConversationResponse, classifyCosSocialIntent, getSafeFirstName } from "@/lib/cos/conversation"
export { resolveAgendaEntity, resolveCampaignEntity, resolveContractEntity, resolveLeadEntity, resolvePropertyEntity } from "@/lib/cos/entity-resolver"
export { planCosCapability } from "@/lib/cos/planner"
export {
  classifyCosPendingReply,
  createPendingInput,
  createPendingInputMetadata,
  extractPendingInputFromMetadata,
  isAwaitingInputResult,
  isCosPendingInputExpired,
  normalizeWorkflowStatus,
} from "@/lib/cos/pending-input"
export { formatCosCapabilityResponse, formatCosExecutionPlanResponse } from "@/lib/cos/response-formatter"
export {
  cancelWorkflow,
  createWorkflowFromExecutionPlan,
  formatWorkflowOperationDetails,
  formatWorkflowProgress,
  getActiveWorkflow,
  getConversationMemory,
  parseConversationWorkflowContent,
  rebuildExecutionPlanFromWorkflow,
  resumeWorkflowExecution,
  resumeWorkflowState,
  shouldConfirmWorkflowMessage,
  shouldResumeWorkflow,
  stringifyConversationWorkflowContent,
  updateWorkflowFromExecutionResult,
} from "@/lib/cos/workflow-engine"
export { deriveWorkspaceContextFromPathname, sanitizeWorkspaceContext } from "@/lib/cos/workspace-context"
export { cosEntityModules } from "@/lib/cos/entities"
export type {
  CosActionResult,
  CosAttachmentCategory,
  CosAttachmentInput,
  CosCapabilityDefinition,
  CosCapabilityDescriptor,
  CosCapabilityDomain,
  CosCapabilityEntity,
  CosCapabilityExecutionInput,
  CosCapabilityHandler,
  CosCapabilityId,
  CosCapabilityPlan,
  CosCapabilityPlanSource,
  CosCapabilityPlanTelemetry,
  CosCapabilitySurface,
  CosConversationMemory,
  CosExecutionPlan,
  CosExecutionPlanGap,
  CosExecutionPlanResult,
  CosExecutionPlanSource,
  CosExecutionPlanStatus,
  CosExecutionPlanTelemetry,
  CosExecutionStep,
  CosExecutionStepStatus,
  CosPendingInput,
  CosPendingInputOption,
  CosPendingInputType,
  CosNormalizedContext,
  CosEntityCapabilityRegistration,
  CosEntityMetadata,
  CosEntityModule,
  CosEntityModuleId,
  CosWorkflow,
  CosWorkflowStatus,
  CosWorkflowStepState,
  CosWorkspaceContext,
  CosWorkspaceEntity,
  CosWorkspaceSelection,
} from "@/lib/cos/types"
