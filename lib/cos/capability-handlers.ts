import "server-only"

import { analyticsSummaryCapability } from "@/lib/cos/capabilities/analytics/summary"
import { completeAgendaCapability } from "@/lib/cos/capabilities/agenda/complete"
import { listAgendaCapability } from "@/lib/cos/capabilities/agenda/list"
import { financialSummaryCapability } from "@/lib/cos/capabilities/finance/summary"
import { leadSummaryCapability } from "@/lib/cos/capabilities/lead/summary"
import { operationSummaryCapability } from "@/lib/cos/capabilities/operation/summary"
import type { CosCapabilityHandler, CosCapabilityId } from "@/lib/cos/types"

export const capabilityHandlers: Partial<Record<CosCapabilityId, CosCapabilityHandler>> = {
  "lead.summary": leadSummaryCapability,
  "operation.summary": operationSummaryCapability,
  "finance.summary": financialSummaryCapability,
  "analytics.summary": analyticsSummaryCapability,
  "catalog.summary": analyticsSummaryCapability,
  "catalog.analyze": analyticsSummaryCapability,
  "agenda.list": listAgendaCapability,
  "agenda.complete": completeAgendaCapability,
}
