import type { AssessorAction } from "@/lib/eme-backend"
import type { CosCapabilityDescriptor, CosCapabilityId } from "@/lib/cos/types"

export type CosCapabilityRegistryIssue = {
  code:
    | "DUPLICATE_CAPABILITY_ID"
    | "DUPLICATE_ACTION"
    | "INVALID_ACTION"
    | "MISSING_HANDLER"
    | "ORPHAN_HANDLER"
  capabilityId?: string
  action?: string
}

export function validateCosCapabilityRegistry(input: {
  descriptors: CosCapabilityDescriptor[]
  handlerIds: string[]
  validActions: readonly AssessorAction[]
}): CosCapabilityRegistryIssue[] {
  const issues: CosCapabilityRegistryIssue[] = []
  const ids = new Set<string>()
  const actions = new Set<string>()
  const validActions = new Set<string>(input.validActions)
  const descriptorIds = new Set<CosCapabilityId>()

  for (const descriptor of input.descriptors) {
    if (ids.has(descriptor.id)) {
      issues.push({ code: "DUPLICATE_CAPABILITY_ID", capabilityId: descriptor.id })
    }
    if (actions.has(descriptor.action)) {
      issues.push({ code: "DUPLICATE_ACTION", capabilityId: descriptor.id, action: descriptor.action })
    }
    if (!validActions.has(descriptor.action)) {
      issues.push({ code: "INVALID_ACTION", capabilityId: descriptor.id, action: descriptor.action })
    }
    ids.add(descriptor.id)
    actions.add(descriptor.action)
    descriptorIds.add(descriptor.id)
  }

  const handlerIds = new Set(input.handlerIds)
  for (const descriptor of input.descriptors) {
    if (!handlerIds.has(descriptor.id)) {
      issues.push({ code: "MISSING_HANDLER", capabilityId: descriptor.id, action: descriptor.action })
    }
  }
  for (const handlerId of handlerIds) {
    if (!descriptorIds.has(handlerId as CosCapabilityId)) {
      issues.push({ code: "ORPHAN_HANDLER", capabilityId: handlerId })
    }
  }

  return issues
}

export function assertCosCapabilityRegistry(input: Parameters<typeof validateCosCapabilityRegistry>[0]) {
  const issues = validateCosCapabilityRegistry(input)
  if (issues.length > 0) {
    throw new Error(`COS_CAPABILITY_REGISTRY_INVALID:${JSON.stringify(issues)}`)
  }
}

