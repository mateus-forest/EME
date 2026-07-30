export { getCosCapabilityByAction, listCosCapabilities } from "@/lib/cos/capability-registry"
export { executeCosCapability } from "@/lib/cos/executor"
export { planCosCapability } from "@/lib/cos/planner"
export { formatCosCapabilityResponse } from "@/lib/cos/response-formatter"
export type {
  CosActionResult,
  CosCapabilityDefinition,
  CosCapabilityExecutionInput,
  CosCapabilityHandler,
  CosCapabilityId,
  CosCapabilityPlan,
} from "@/lib/cos/types"
