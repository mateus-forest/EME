import "server-only"
import { emitJourney, getJourneyContext } from "@/lib/journey/server"

type PropertyFact = { id: string; brokerId?: string | null; published?: boolean; marketplacePublished?: boolean; updatedAt?: Date | string }
export function propertyCreatedJourney(property: PropertyFact, channel = "manual") {
  emitJourney("property_created", { dedupeKey: property.id, propertyId: property.id, brokerId: property.brokerId, module: "properties", outcome: "completed", metadata: { channel } })
  propertyPublishedJourney({}, property)
}
export function propertyPublishedJourney(previous: Partial<PropertyFact>, property: PropertyFact) {
  for (const [field, channel] of [["published", "catalog"], ["marketplacePublished", "marketplace"]] as const) {
    if (property[field] && !previous[field]) emitJourney("property_published", { dedupeKey: `${property.id}:${channel}:${property.updatedAt instanceof Date ? property.updatedAt.toISOString() : property.updatedAt ?? "initial"}`, propertyId: property.id, brokerId: property.brokerId, module: "properties", outcome: "completed", metadata: { channel } })
  }
}
export function leadCreatedJourney(lead: { id: string; brokerId?: string | null; propertyId?: string | null; catalogSlug?: string | null }, channel = "manual") {
  // brokerId is the recipient, never the actor. Public traffic remains anonymous.
  emitJourney("lead_created", { dedupeKey: lead.id, brokerId: lead.brokerId, propertyId: lead.propertyId, catalogId: lead.catalogSlug, module: "clients", outcome: "completed", metadata: { leadId: lead.id, channel } })
}
export function documentCreatedJourney(document: { id: string; type?: string; brokerId?: string | null; propertyId?: string | null }) {
  if (document.type === "proposal") emitJourney("proposal_created", { dedupeKey: document.id, brokerId: document.brokerId, propertyId: document.propertyId, module: "proposals", outcome: "completed", metadata: { documentId: document.id } })
}
export function studioJourney(operationId: string, status: "started" | "completed" | "failed", fields: { userId?: string; brokerId?: string | null; propertyId?: string | null; errorCode?: string; durationMs?: number } = {}) {
  const context = getJourneyContext()
  if (status === "started" && context?.route.startsWith("/api/studio-ia")) context.studioOperationId = operationId
  emitJourney(`studio_generation_${status}`, { ...fields, dedupeKey: operationId, module: "studio", step: "generation", outcome: status, metadata: { operationId, durationMs: fields.durationMs ?? 0, legacySource: "AiOperationTelemetry" } })
}
export function startStudioJourney() {
  const context = getJourneyContext()
  if (context && !context.studioOperationId) { context.studioOperationId = context.requestId; studioJourney(context.studioOperationId, "started") }
}
export function failStudioJourney() {
  const operationId = getJourneyContext()?.studioOperationId
  if (operationId) studioJourney(operationId, "failed", { errorCode: "STUDIO_GENERATION_FAILED" })
}
