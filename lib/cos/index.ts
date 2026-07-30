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
export { planCosExecution } from "@/lib/cos/execution-planner"
export { buildCosCapabilityInventoryMarkdown, getCosCapabilityInventory } from "@/lib/cos/inventory"
export { planCosCapability } from "@/lib/cos/planner"
export { formatCosCapabilityResponse, formatCosExecutionPlanResponse } from "@/lib/cos/response-formatter"
export { deriveWorkspaceContextFromPathname, sanitizeWorkspaceContext } from "@/lib/cos/workspace-context"
export { cosEntityModules } from "@/lib/cos/entities"
export type {
  CosActionResult,
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
  CosExecutionPlan,
  CosExecutionPlanGap,
  CosExecutionPlanResult,
  CosExecutionPlanSource,
  CosExecutionPlanStatus,
  CosExecutionPlanTelemetry,
  CosExecutionStep,
  CosExecutionStepStatus,
  CosEntityCapabilityRegistration,
  CosEntityMetadata,
  CosEntityModule,
  CosEntityModuleId,
  CosWorkspaceContext,
  CosWorkspaceEntity,
  CosWorkspaceSelection,
} from "@/lib/cos/types"
