import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"
import {
  getCosCapabilityDescriptorByAliasOrAction,
  getCosCapabilityDescriptorById,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
import type { CosCapabilityDescriptor, CosCapabilityId, CosConversationSnapshot, CosWorkspaceContext } from "@/lib/cos/types"
import type { CosV2EntityType, CosV2Interpretation, CosV2Validation } from "@/lib/cos-v2/types"

const SCOPED_PREFIXES = ["lead.", "property.", "proposal.", "agenda."] as const

const CANONICAL_ACTION_ALIASES: Record<string, CosCapabilityId> = {
  create_client: "lead.create",
  find_client: "lead.find",
  search_clients: "lead.find",
  list_clients: "lead.summary",
  update_client: "lead.update",
  delete_client: "lead.delete",
  client_history: "lead.timeline",
  create_property: "property.create",
  search_properties: "property.search",
  get_property: "property.get",
  publish_property: "property.publish",
  unpublish_property: "property.unpublish",
  archive_property: "property.archive",
  create_proposal: "proposal.create",
  list_proposals: "proposal.summary",
  create_appointment: "agenda.create",
  list_appointments: "agenda.list",
  update_appointment: "agenda.update",
  complete_appointment: "agenda.complete",
  cancel_appointment: "agenda.cancel",
}

const ENTITY_TYPE_MAP: Record<CosV2EntityType, "lead" | "property" | "proposal" | "agenda"> = {
  client: "lead",
  property: "property",
  proposal: "proposal",
  appointment: "agenda",
}

const ENTITY_ID_FIELDS: Record<CosV2EntityType, string> = {
  client: "leadId",
  property: "propertyId",
  proposal: "documentId",
  appointment: "agendaEventId",
}

const RESERVED_PAYLOAD_FIELDS = new Set(["brokerId", "userId", "confirm", "action", "capabilityId", "context", "workspace"])

export function isCosV2CapabilityId(value: string): value is CosCapabilityId {
  return SCOPED_PREFIXES.some((prefix) => value.startsWith(prefix)) && Boolean(getCosCapabilityDescriptorById(value as CosCapabilityId))
}

export function listCosV2Capabilities(surface: "portal" | "cos_home") {
  return listCosCapabilityCatalog().filter((descriptor) => isCosV2CapabilityId(descriptor.id) && descriptor.surfaces.includes(surface))
}

export function resolveCosV2Capability(value: string | null | undefined, surface: "portal" | "cos_home"): CosCapabilityDescriptor | null {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return null

  const canonicalId = CANONICAL_ACTION_ALIASES[normalized]
  const descriptor = canonicalId
    ? getCosCapabilityDescriptorById(canonicalId)
    : isCosV2CapabilityId(normalized)
      ? getCosCapabilityDescriptorById(normalized)
      : getCosCapabilityDescriptorByAliasOrAction(value)

  return descriptor && isCosV2CapabilityId(descriptor.id) && descriptor.surfaces.includes(surface)
    ? descriptor
    : null
}

function knownEntityIds(snapshot: CosConversationSnapshot, workspace: CosWorkspaceContext | null) {
  const ids = new Set<string>()
  for (const entity of Object.values(snapshot.activeEntities)) if (entity?.id) ids.add(entity.id)
  for (const entity of snapshot.recentEntities) ids.add(entity.id)
  for (const selection of snapshot.selectionSets) for (const item of selection.items) ids.add(item.entity.id)
  for (const option of snapshot.pendingInput?.options ?? []) ids.add(option.id)
  if (workspace?.entityId) ids.add(workspace.entityId)
  for (const selection of workspace?.selection ?? []) ids.add(selection.entityId)
  return ids
}

function activeEntityId(input: {
  type: CosV2EntityType
  snapshot: CosConversationSnapshot
  workspace: CosWorkspaceContext | null
}) {
  const legacyType = ENTITY_TYPE_MAP[input.type]
  const workspaceType = input.workspace?.entity === "document" ? "proposal" : input.workspace?.entity
  if (workspaceType === legacyType && input.workspace?.entityId) return input.workspace.entityId
  return input.snapshot.activeEntities[legacyType]?.id ?? null
}

function missingDataIsAlreadyKnown(field: string, snapshot: CosConversationSnapshot, workspace: CosWorkspaceContext | null) {
  const normalized = field.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "")
  if (["client", "cliente", "lead", "clientid", "leadid"].includes(normalized)) {
    return Boolean(activeEntityId({ type: "client", snapshot, workspace }))
  }
  if (["property", "imovel", "propertyid"].includes(normalized)) {
    return Boolean(activeEntityId({ type: "property", snapshot, workspace }))
  }
  if (["proposal", "proposta", "proposalid", "documentid"].includes(normalized)) {
    return Boolean(activeEntityId({ type: "proposal", snapshot, workspace }))
  }
  if (["appointment", "compromisso", "agenda", "agendaeventid"].includes(normalized)) {
    return Boolean(activeEntityId({ type: "appointment", snapshot, workspace }))
  }
  return false
}

function buildPayload(input: {
  interpretation: CosV2Interpretation
  snapshot: CosConversationSnapshot
  workspace: CosWorkspaceContext | null
  knownIds: Set<string>
}) {
  const payload: Record<string, unknown> = {}
  const evidence: string[] = []

  for (const entity of input.interpretation.entities) {
    const entityId = entity.id && input.knownIds.has(entity.id)
      ? entity.id
      : activeEntityId({ type: entity.type, snapshot: input.snapshot, workspace: input.workspace })
    if (entityId) {
      payload[ENTITY_ID_FIELDS[entity.type]] = entityId
      evidence.push(`entity:${entity.type}:${entityId}`)
    }
    if (entity.type === "client" && entity.name && !payload.personName) payload.personName = entity.name
  }

  for (const reference of input.interpretation.references) {
    if (!reference.type) continue
    const entityId = reference.id && input.knownIds.has(reference.id)
      ? reference.id
      : activeEntityId({ type: reference.type, snapshot: input.snapshot, workspace: input.workspace })
    if (entityId && !payload[ENTITY_ID_FIELDS[reference.type]]) {
      payload[ENTITY_ID_FIELDS[reference.type]] = entityId
      evidence.push(`reference:${reference.type}:${entityId}`)
    }
  }

  for (const item of input.interpretation.providedData) {
    if (!RESERVED_PAYLOAD_FIELDS.has(item.field)) payload[item.field] = item.value
  }
  for (const correction of input.interpretation.corrections) {
    if (!RESERVED_PAYLOAD_FIELDS.has(correction.field)) payload[correction.field] = correction.to
  }
  if (input.interpretation.filters.length > 0) {
    payload.filters = input.interpretation.filters
    for (const filter of input.interpretation.filters) {
      if (!RESERVED_PAYLOAD_FIELDS.has(filter.field) && filter.operator === "eq") payload[filter.field] = filter.value
    }
  }
  return { payload, evidence }
}

export function validateCosV2Interpretation(input: {
  message: string
  interpretation: CosV2Interpretation
  surface: "portal" | "cos_home"
  snapshot: CosConversationSnapshot
  workspace: CosWorkspaceContext | null
  attachments?: Array<{ name: string; textContent?: string }>
}): CosV2Validation {
  const errors: string[] = []
  const evidence: string[] = []
  const security = evaluateCosDecisionSecurity({ message: input.message, attachments: input.attachments })
  if (security.flagged) errors.push(...security.reasons)

  const requestedSteps = input.interpretation.steps.length > 0
    ? input.interpretation.steps.map((step) => step.action)
    : input.interpretation.intendedAction
      ? [input.interpretation.intendedAction]
      : []
  const descriptors = requestedSteps.map((value) => resolveCosV2Capability(value, input.surface))
  if (requestedSteps.some((_, index) => !descriptors[index])) errors.push("capability_not_in_v2_registry_scope")

  const referencedDescriptor = resolveCosV2Capability(input.interpretation.intendedAction, input.surface)
  const isOperational = input.interpretation.objective.kind === "query" || input.interpretation.objective.kind === "execute"
  const operationalDescriptors = isOperational ? descriptors.filter((item): item is CosCapabilityDescriptor => Boolean(item)) : []

  if (input.interpretation.turnType === "question" && input.interpretation.objective.kind === "execute") {
    errors.push("question_cannot_start_execution")
  }
  if (input.interpretation.turnType === "context" && isOperational) {
    errors.push("context_cannot_start_execution")
  }
  if (input.interpretation.turnType === "confirmation") {
    const pendingCapability = input.snapshot.pendingInput?.capabilityId
    if (input.snapshot.pendingInput?.field !== "confirmation") errors.push("confirmation_without_pending_operation")
    if (pendingCapability && referencedDescriptor?.id !== pendingCapability) errors.push("confirmation_capability_mismatch")
  }
  if (input.interpretation.objective.kind === "query" && operationalDescriptors.some((descriptor) => descriptor.mutatesData)) {
    errors.push("query_cannot_execute_mutation")
  }
  if (isOperational && input.interpretation.source === "openai" && input.interpretation.confidence < 0.62) {
    errors.push("confidence_below_execution_threshold")
  }
  if (operationalDescriptors.length > 4) errors.push("too_many_steps")

  const ids = knownEntityIds(input.snapshot, input.workspace)
  const missingData = input.interpretation.missingData.filter((field) => !missingDataIsAlreadyKnown(field, input.snapshot, input.workspace))
  const adjusted: CosV2Interpretation = {
    ...input.interpretation,
    missingData,
    clarificationQuestion: input.interpretation.missingData.length > 0 && missingData.length === 0
      ? null
      : input.interpretation.clarificationQuestion,
    entities: input.interpretation.entities.map((entity) => ({
      ...entity,
      id: entity.id && ids.has(entity.id) ? entity.id : null,
    })),
    references: input.interpretation.references.map((reference) => ({
      ...reference,
      id: reference.id && ids.has(reference.id) ? reference.id : null,
    })),
  }
  if (input.interpretation.entities.some((entity) => entity.id && !ids.has(entity.id)) || input.interpretation.references.some((reference) => reference.id && !ids.has(reference.id))) {
    evidence.push("untrusted_entity_ids_removed")
  }

  const built = buildPayload({ interpretation: adjusted, snapshot: input.snapshot, workspace: input.workspace, knownIds: ids })
  evidence.push(...built.evidence)
  evidence.push(...operationalDescriptors.map((descriptor) => `registry:${descriptor.id}`))
  if (input.workspace) built.payload.workspace = input.workspace

  return {
    accepted: errors.length === 0,
    interpretation: adjusted,
    capabilityIds: operationalDescriptors.map((descriptor) => descriptor.id),
    referencedCapabilityId: referencedDescriptor?.id ?? null,
    payload: built.payload,
    errors,
    evidence,
  }
}
