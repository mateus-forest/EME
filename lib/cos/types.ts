import type { Prisma } from "@prisma/client"

import type { AssessorAction, PendingAssessorContext } from "@/lib/eme-backend"

export type CosCapabilityId =
  | "general.chat"
  | "property.create"
  | "property.search"
  | "property.description.improve"
  | "lead.create"
  | "lead.summary"
  | "lead.summarize"
  | "operation.summary"
  | "finance.summary"
  | "analytics.summary"
  | "catalog.summary"
  | "catalog.analyze"
  | "agenda.create"
  | "agenda.list"
  | "agenda.complete"
  | "proposal.create"
  | "contract.create"
  | "document.list"
  | "document.get"
  | "contract.list"
  | "contract.get"

export type CosActionResult = {
  response: string
  metadata: Prisma.InputJsonObject
  leadId?: string
  propertyId?: string
}

export type CosCapabilityExecutionInput = {
  brokerId: string
  userId: string
  message: string
  action: AssessorAction
  confirm?: boolean
  payload?: Record<string, unknown>
  pendingContext?: Partial<PendingAssessorContext>
}

export type CosCapabilityHandler = (input: CosCapabilityExecutionInput) => Promise<CosActionResult>

export type CosCapabilityDefinition = {
  id: CosCapabilityId
  action: AssessorAction
  domain: "general" | "property" | "lead" | "proposal" | "contract" | "agenda" | "finance" | "analytics" | "catalog" | "operation" | "document"
  responseMode: "raw" | "nlg"
  source: "modular" | "legacy"
  handler?: CosCapabilityHandler
}

export type CosCapabilityPlan = {
  action: AssessorAction
  payload: Record<string, unknown>
  pendingContext: PendingAssessorContext | null
  capability: CosCapabilityDefinition
}
