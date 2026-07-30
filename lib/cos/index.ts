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
export { executeCosCapability } from "@/lib/cos/executor"
export { buildCosCapabilityInventoryMarkdown, getCosCapabilityInventory } from "@/lib/cos/inventory"
export { planCosCapability } from "@/lib/cos/planner"
export { formatCosCapabilityResponse } from "@/lib/cos/response-formatter"
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
  CosEntityCapabilityRegistration,
  CosEntityMetadata,
  CosEntityModule,
  CosEntityModuleId,
} from "@/lib/cos/types"
