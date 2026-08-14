import type { AssessorAction } from "@/lib/eme-backend"

import { cosEntityModules } from "@/lib/cos/entities"
import type { CosCapabilityDescriptor, CosCapabilityId, CosCapabilitySurface, CosEntityModule, CosEntityModuleId } from "@/lib/cos/types"

const entityModules = cosEntityModules
const descriptors = entityModules.flatMap((module) => module.capabilities.map((capability) => capability.descriptor))

export function listCosEntityModules(): CosEntityModule[] {
  return entityModules
}

export function listCosCapabilityCatalog(): CosCapabilityDescriptor[] {
  return descriptors
}

export function getCosCapabilityDescriptorByAction(action: AssessorAction) {
  const descriptor = descriptors.find((capability) => capability.action === action)
  if (!descriptor) throw new Error(`COS_CAPABILITY_NOT_FOUND:${action}`)
  return descriptor
}

export function getCosCapabilityDescriptorByAliasOrAction(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return null

  return (
    descriptors.find((capability) => {
      return capability.action.toLowerCase() === normalized || capability.aliases.some((alias) => alias.toLowerCase() === normalized)
    }) ?? null
  )
}

export function getCosCapabilityDescriptorById(id: CosCapabilityId) {
  return descriptors.find((capability) => capability.id === id) ?? null
}

export function getCosEntityModuleIdByCapabilityId(id: CosCapabilityId): CosEntityModuleId | null {
  const entityModule = entityModules.find((module) => module.capabilities.some((capability) => capability.descriptor.id === id))
  return entityModule?.entity.id ?? null
}

export function getCosCapabilityLabel(action: string | null | undefined) {
  return getCosCapabilityDescriptorByAliasOrAction(action)?.title ?? "Ação do COS"
}

export function getCosCapabilityActionsForSurface(surface: CosCapabilitySurface) {
  return descriptors.filter((capability) => capability.surfaces.includes(surface)).map((capability) => capability.action)
}

export function isCosCapabilityAvailableOnSurface(action: AssessorAction, surface: CosCapabilitySurface) {
  return getCosCapabilityDescriptorByAction(action).surfaces.includes(surface)
}

export function doesCosCapabilityMutateData(action: AssessorAction) {
  return getCosCapabilityDescriptorByAction(action).mutatesData
}

export function doesCosCapabilityRequireConfirmation(id: CosCapabilityId) {
  return getCosCapabilityDescriptorById(id)?.requiresConfirmation ?? false
}

export function getCosCapabilityConfirmationMessage(action: AssessorAction) {
  const capability = getCosCapabilityDescriptorByAction(action)
  return capability.confirmationMessage ?? `Posso executar "${capability.title}" agora. Deseja confirmar?`
}
