export { getCosCapabilityByAction, listCosCapabilities } from "@/lib/cos/capability-registry"
export {
  doesCosCapabilityMutateData,
  getCosCapabilityActionsForSurface,
  getCosCapabilityConfirmationMessage,
  getCosCapabilityDescriptorByAction,
  getCosCapabilityDescriptorByAliasOrAction,
  getCosCapabilityLabel,
  isCosCapabilityAvailableOnSurface,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
export { executeCosCapability } from "@/lib/cos/executor"
export { buildCosCapabilityInventoryMarkdown, getCosCapabilityInventory } from "@/lib/cos/inventory"
export { planCosCapability } from "@/lib/cos/planner"
export { formatCosCapabilityResponse } from "@/lib/cos/response-formatter"
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
  CosCapabilitySurface,
} from "@/lib/cos/types"
