import { analyticsSummaryCapability } from "@/lib/cos/capabilities/analytics/summary"
import { completeAgendaCapability } from "@/lib/cos/capabilities/agenda/complete"
import { listAgendaCapability } from "@/lib/cos/capabilities/agenda/list"
import { financialSummaryCapability } from "@/lib/cos/capabilities/finance/summary"
import { leadSummaryCapability } from "@/lib/cos/capabilities/lead/summary"
import { operationSummaryCapability } from "@/lib/cos/capabilities/operation/summary"
import {
  getCosCapabilityDescriptorByAction,
  getCosCapabilityDescriptorByAliasOrAction,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
import type { AssessorAction } from "@/lib/eme-backend"

import type { CosCapabilityDefinition, CosCapabilityDescriptor, CosCapabilityHandler, CosCapabilityId } from "@/lib/cos/types"

const handlers: Partial<Record<CosCapabilityId, CosCapabilityHandler>> = {
  "lead.summary": leadSummaryCapability,
  "operation.summary": operationSummaryCapability,
  "finance.summary": financialSummaryCapability,
  "analytics.summary": analyticsSummaryCapability,
  "catalog.summary": analyticsSummaryCapability,
  "catalog.analyze": analyticsSummaryCapability,
  "agenda.list": listAgendaCapability,
  "agenda.complete": completeAgendaCapability,
}

function attachHandler(descriptor: CosCapabilityDescriptor): CosCapabilityDefinition {
  return {
    ...descriptor,
    handler: handlers[descriptor.id],
  }
}

export function listCosCapabilities() {
  return listCosCapabilityCatalog().map(attachHandler)
}

export function getCosCapabilityByAction(action: AssessorAction) {
  return attachHandler(getCosCapabilityDescriptorByAction(action))
}

export function getCosCapabilityByAliasOrAction(value: string | null | undefined) {
  const descriptor = getCosCapabilityDescriptorByAliasOrAction(value)
  return descriptor ? attachHandler(descriptor) : null
}
