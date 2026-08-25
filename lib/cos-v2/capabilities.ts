import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"
import { resolveCosConversationReference } from "@/lib/cos/conversation-snapshot"
import {
  getCosCapabilityDescriptorByAliasOrAction,
  getCosCapabilityDescriptorById,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
import { getCosLaunchCapabilityStatus } from "@/lib/cos/launch-capabilities"
import type { CosCapabilityDescriptor, CosCapabilityId, CosConversationSnapshot, CosWorkspaceContext } from "@/lib/cos/types"
import { COS_V2_CREATED_ENTITY_TYPES, type CosV2EntityType, type CosV2Interpretation, type CosV2Validation } from "@/lib/cos-v2/types"

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

const REQUIRED_INPUT_ALIASES: Record<string, string[]> = {
  name: ["name", "nome", "clientname", "personname"],
  price: ["price", "value", "valor", "preco"],
  client: ["client", "cliente", "lead", "person", "pessoa", "clientid", "leadid", "personname"],
  property: ["property", "imovel", "propertyid", "publiccode"],
  time: ["time", "hora", "horario"],
}

const CONTEXTUAL_UPDATE_CAPABILITIES: Partial<Record<string, CosCapabilityId>> = {
  lead: "lead.update",
  agenda: "agenda.update",
}

function normalizeInputField(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "")
}

function isRequiredInput(field: string, descriptors: CosCapabilityDescriptor[]) {
  const normalized = normalizeInputField(field)
  return descriptors.some((descriptor) => descriptor.inputContract?.required.some((requirement) => {
    const aliases = REQUIRED_INPUT_ALIASES[requirement] ?? [requirement]
    return aliases.includes(normalized)
  })) ?? false
}

function contextualContinuationCapability(input: {
  interpretation: CosV2Interpretation
  snapshot: CosConversationSnapshot
  surface: "portal" | "cos_home"
}) {
  if (input.interpretation.turnType !== "correction" || input.interpretation.intendedAction || input.interpretation.steps.length > 0) return null
  const latest = input.snapshot.recentResults[0]
  if (!latest || latest.status !== "success") return null
  const createdEntityType = COS_V2_CREATED_ENTITY_TYPES[latest.capabilityId]
  const createdEntities = createdEntityType ? latest.entities.filter((entity) => entity.type === createdEntityType) : []
  if (createdEntities.length !== 1) return null
  const capabilityId = CONTEXTUAL_UPDATE_CAPABILITIES[createdEntities[0].type]
  return capabilityId ? resolveCosV2Capability(capabilityId, input.surface) : null
}

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

function conversationEntityTypeToV2(value: string): CosV2EntityType | null {
  if (value === "lead") return "client"
  if (value === "property") return "property"
  if (value === "proposal") return "proposal"
  if (value === "agenda") return "appointment"
  return null
}

function relationFromReferenceReason(reason: string): CosV2Interpretation["references"][number]["relation"] {
  if (reason.includes("alternative")) return "alternative"
  if (reason.includes("selection") || reason.includes("ordinal")) return "selection"
  if (reason.includes("previous") || reason.includes("recent")) return "previous"
  return "active"
}

function applySnapshotReference(input: {
  message: string
  interpretation: CosV2Interpretation
  snapshot: CosConversationSnapshot
}) {
  const resolution = resolveCosConversationReference(input.message, input.snapshot)
  const type = resolution.entity ? conversationEntityTypeToV2(resolution.entity.type) : null
  if (!resolution.entity || !type) return { interpretation: input.interpretation, reason: null }

  let applied = false
  const references = input.interpretation.references.map((reference) => {
    if (reference.id || (reference.type && reference.type !== type)) return reference
    applied = true
    return {
      ...reference,
      type,
      id: resolution.entity!.id,
      relation: relationFromReferenceReason(resolution.reason),
    }
  })
  if (!applied) {
    references.push({
      expression: resolution.entity.label ?? input.message.slice(0, 180),
      type,
      id: resolution.entity.id,
      relation: relationFromReferenceReason(resolution.reason),
    })
  }
  return {
    interpretation: { ...input.interpretation, references },
    reason: resolution.reason,
  }
}

function buildPayload(input: {
  interpretation: CosV2Interpretation
  descriptors: CosCapabilityDescriptor[]
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

  for (const descriptor of input.descriptors) {
    const entityType: CosV2EntityType | null = descriptor.entity === "lead"
      ? "client"
      : descriptor.entity === "property"
        ? "property"
        : descriptor.entity === "agenda"
          ? "appointment"
          : descriptor.entity === "document" && descriptor.domain === "proposal"
            ? "proposal"
            : null
    if (!entityType || !descriptor.requiresSelection || descriptor.id === "proposal.create") continue
    const field = ENTITY_ID_FIELDS[entityType]
    const entityId = activeEntityId({ type: entityType, snapshot: input.snapshot, workspace: input.workspace })
    if (entityId && !payload[field]) {
      payload[field] = entityId
      evidence.push(`active_entity:${entityType}:${entityId}`)
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

  const continuationDescriptor = contextualContinuationCapability(input)
  const baseInterpretation: CosV2Interpretation = continuationDescriptor
    ? {
        ...input.interpretation,
        objective: { kind: "execute", summary: input.interpretation.objective.summary },
        intendedAction: continuationDescriptor.id,
        steps: [{ action: continuationDescriptor.id, goal: input.interpretation.objective.summary }],
      }
    : input.interpretation
  if (continuationDescriptor) evidence.push(`contextual_continuation:${continuationDescriptor.id}`)
  const contextualReference = applySnapshotReference({
    message: input.message,
    interpretation: baseInterpretation,
    snapshot: input.snapshot,
  })
  const interpretation = contextualReference.interpretation
  if (contextualReference.reason) evidence.push(`snapshot_reference:${contextualReference.reason}`)

  const requestedSteps = interpretation.steps.length > 0
    ? interpretation.steps.map((step) => step.action)
    : interpretation.intendedAction
      ? [interpretation.intendedAction]
      : []
  const descriptors = requestedSteps.map((value) => resolveCosV2Capability(value, input.surface))
  if (requestedSteps.some((_, index) => !descriptors[index])) errors.push("capability_not_in_v2_registry_scope")

  const referencedDescriptor = resolveCosV2Capability(interpretation.intendedAction, input.surface) ?? continuationDescriptor
  const validDescriptors = descriptors.filter((item): item is CosCapabilityDescriptor => Boolean(item))
  if (validDescriptors.some((descriptor) => getCosLaunchCapabilityStatus(descriptor.id) === "NOT_AVAILABLE")) {
    errors.push("capability_not_available_at_launch")
  }
  const isOperationalObjective = interpretation.objective.kind === "query" || interpretation.objective.kind === "execute"
  const isOperationalTurn = ["execution", "correction", "selection", "confirmation"].includes(interpretation.turnType)
  const canExecuteTurn = isOperationalTurn && interpretation.objective.kind !== "answer" && (isOperationalObjective || validDescriptors.length > 0)
  const operationalDescriptors = canExecuteTurn ? validDescriptors : []

  if (interpretation.turnType === "question" && interpretation.objective.kind === "execute") {
    errors.push("question_cannot_start_execution")
  }
  if (interpretation.turnType === "context" && isOperationalObjective) {
    errors.push("context_cannot_start_execution")
  }
  if (interpretation.turnType === "confirmation") {
    const pendingCapability = input.snapshot.pendingInput?.capabilityId
    if (input.snapshot.pendingInput?.field !== "confirmation") errors.push("confirmation_without_pending_operation")
    if (pendingCapability && referencedDescriptor?.id !== pendingCapability) errors.push("confirmation_capability_mismatch")
  }
  if (interpretation.objective.kind === "query" && validDescriptors.some((descriptor) => descriptor.mutatesData)) {
    errors.push("query_cannot_execute_mutation")
  }
  if (canExecuteTurn && interpretation.source === "openai" && interpretation.confidence < 0.62) {
    errors.push("confidence_below_execution_threshold")
  }
  if (operationalDescriptors.length > 4) errors.push("too_many_steps")

  const ids = knownEntityIds(input.snapshot, input.workspace)
  const unresolvedMissingData = interpretation.missingData.filter((field) => !missingDataIsAlreadyKnown(field, input.snapshot, input.workspace))
  const usesExplicitInputContracts = validDescriptors.length > 0 && validDescriptors.every((descriptor) => Boolean(descriptor.inputContract))
  const missingData = usesExplicitInputContracts
    ? unresolvedMissingData.filter((field) => isRequiredInput(field, validDescriptors))
    : unresolvedMissingData
  const primaryOperationalDescriptor = operationalDescriptors[0]
  const adjusted: CosV2Interpretation = {
    ...interpretation,
    objective: primaryOperationalDescriptor
      ? {
          kind: primaryOperationalDescriptor.mutatesData ? "execute" : "query",
          summary: interpretation.objective.summary,
        }
      : interpretation.objective,
    missingData,
    clarificationQuestion: interpretation.missingData.length > 0 && missingData.length === 0
      ? null
      : interpretation.clarificationQuestion,
    entities: interpretation.entities.map((entity) => ({
      ...entity,
      id: entity.id && ids.has(entity.id) ? entity.id : null,
    })),
    references: interpretation.references.map((reference) => ({
      ...reference,
      id: reference.id && ids.has(reference.id) ? reference.id : null,
    })),
  }
  if (interpretation.entities.some((entity) => entity.id && !ids.has(entity.id)) || interpretation.references.some((reference) => reference.id && !ids.has(reference.id))) {
    evidence.push("untrusted_entity_ids_removed")
  }

  const built = buildPayload({ interpretation: adjusted, descriptors: operationalDescriptors, snapshot: input.snapshot, workspace: input.workspace, knownIds: ids })
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
