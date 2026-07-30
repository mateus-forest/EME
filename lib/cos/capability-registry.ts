import { analyticsSummaryCapability } from "@/lib/cos/capabilities/analytics/summary"
import { completeAgendaCapability } from "@/lib/cos/capabilities/agenda/complete"
import { listAgendaCapability } from "@/lib/cos/capabilities/agenda/list"
import { financialSummaryCapability } from "@/lib/cos/capabilities/finance/summary"
import { leadSummaryCapability } from "@/lib/cos/capabilities/lead/summary"
import { operationSummaryCapability } from "@/lib/cos/capabilities/operation/summary"
import type { AssessorAction } from "@/lib/eme-backend"

import type { CosCapabilityDefinition } from "@/lib/cos/types"

const CAPABILITIES: CosCapabilityDefinition[] = [
  { id: "general.chat", action: "general", domain: "general", responseMode: "nlg", source: "legacy" },
  { id: "property.create", action: "createPropertyDraft", domain: "property", responseMode: "raw", source: "legacy" },
  { id: "property.search", action: "searchProperties", domain: "property", responseMode: "raw", source: "legacy" },
  { id: "property.description.improve", action: "improvePropertyDescription", domain: "property", responseMode: "nlg", source: "legacy" },
  { id: "lead.create", action: "createLead", domain: "lead", responseMode: "raw", source: "legacy" },
  { id: "lead.summary", action: "getLeadsSummary", domain: "lead", responseMode: "raw", source: "modular", handler: leadSummaryCapability },
  { id: "lead.summarize", action: "summarizeLead", domain: "lead", responseMode: "raw", source: "legacy" },
  { id: "operation.summary", action: "createInternalNotification", domain: "operation", responseMode: "raw", source: "modular", handler: operationSummaryCapability },
  { id: "finance.summary", action: "getFinancialSummary", domain: "finance", responseMode: "raw", source: "modular", handler: financialSummaryCapability },
  { id: "analytics.summary", action: "getAnalyticsSummary", domain: "analytics", responseMode: "raw", source: "modular", handler: analyticsSummaryCapability },
  { id: "catalog.summary", action: "getCatalogSummary", domain: "catalog", responseMode: "raw", source: "modular", handler: analyticsSummaryCapability },
  { id: "catalog.analyze", action: "analyzeCatalog", domain: "catalog", responseMode: "raw", source: "modular", handler: analyticsSummaryCapability },
  { id: "agenda.create", action: "CREATE_AGENDA_EVENT", domain: "agenda", responseMode: "raw", source: "legacy" },
  { id: "agenda.list", action: "LIST_AGENDA_EVENTS", domain: "agenda", responseMode: "raw", source: "modular", handler: listAgendaCapability },
  { id: "agenda.complete", action: "MARK_AGENDA_DONE", domain: "agenda", responseMode: "raw", source: "modular", handler: completeAgendaCapability },
  { id: "proposal.create", action: "CREATE_PROPOSAL", domain: "proposal", responseMode: "raw", source: "legacy" },
  { id: "contract.create", action: "CREATE_CONTRACT", domain: "contract", responseMode: "raw", source: "legacy" },
  { id: "document.list", action: "LIST_DOCUMENTS", domain: "document", responseMode: "raw", source: "legacy" },
  { id: "document.get", action: "GET_DOCUMENT", domain: "document", responseMode: "raw", source: "legacy" },
  { id: "contract.list", action: "LIST_CONTRACTS", domain: "contract", responseMode: "raw", source: "legacy" },
  { id: "contract.get", action: "GET_CONTRACT", domain: "contract", responseMode: "raw", source: "legacy" },
]

const capabilityByAction = new Map<AssessorAction, CosCapabilityDefinition>(CAPABILITIES.map((capability) => [capability.action, capability]))

export function listCosCapabilities() {
  return CAPABILITIES
}

export function getCosCapabilityByAction(action: AssessorAction) {
  return capabilityByAction.get(action) ?? capabilityByAction.get("general")!
}
