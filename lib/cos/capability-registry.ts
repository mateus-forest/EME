import "server-only"

import { cosEntityModules } from "@/lib/cos/entities"
import { getCosCapabilityDescriptorByAction } from "@/lib/cos/capability-catalog"
import { capabilityHandlers } from "@/lib/cos/capability-handlers"
import { assertCosCapabilityRegistry } from "@/lib/cos/capability-invariants"
import { assessorActions, type AssessorAction } from "@/lib/eme-backend"

import type { CosCapabilityDefinition, CosCapabilityDescriptor } from "@/lib/cos/types"

const descriptors = cosEntityModules.flatMap((module) => module.capabilities.map((capability) => capability.descriptor))
assertCosCapabilityRegistry({
  descriptors,
  handlerIds: Object.keys(capabilityHandlers),
  validActions: assessorActions,
})

function attachHandler(descriptor: CosCapabilityDescriptor): CosCapabilityDefinition {
  return {
    ...descriptor,
    handler: capabilityHandlers[descriptor.id],
  }
}

export function listCosCapabilities() {
  return cosEntityModules.flatMap((entityModule) => entityModule.capabilities.map((capability) => attachHandler(capability.descriptor)))
}

export function getCosCapabilityByAction(action: AssessorAction) {
  return attachHandler(getCosCapabilityDescriptorByAction(action))
}
