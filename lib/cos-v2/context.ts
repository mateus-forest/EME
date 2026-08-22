import { getCosV2KnowledgeFacts } from "@/lib/cos-v2/knowledge"
import { COS_V2_CREATED_ENTITY_TYPES, type CosV2CompactContext, type CosV2EntityType, type CosV2Interpretation } from "@/lib/cos-v2/types"
import type { CosAttachmentInput, CosCapabilityDescriptor, CosConversationSnapshot, CosKnowledgeContext, CosPendingInput, CosWorkspaceContext } from "@/lib/cos/types"

const SNAPSHOT_ENTITY_BY_V2_TYPE: Record<CosV2EntityType, "lead" | "property" | "proposal" | "agenda"> = {
  client: "lead",
  property: "property",
  proposal: "proposal",
  appointment: "agenda",
}

function normalizeInputField(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "")
}

function inputEntityType(value: string): CosV2EntityType | null {
  const normalized = normalizeInputField(value)
  if (["client", "cliente", "lead", "clientid", "leadid"].includes(normalized)) return "client"
  if (["property", "imovel", "propertyid"].includes(normalized)) return "property"
  if (["proposal", "proposta", "proposalid", "documentid"].includes(normalized)) return "proposal"
  if (["appointment", "compromisso", "agenda", "agendaeventid"].includes(normalized)) return "appointment"
  return null
}

function descriptorEntityType(capability: CosCapabilityDescriptor): CosV2EntityType | null {
  if (capability.entity === "lead") return "client"
  if (capability.entity === "property") return "property"
  if (capability.entity === "agenda") return "appointment"
  if (capability.entity === "document" && capability.domain === "proposal") return "proposal"
  return null
}

export function getCosV2StructuredContextEntities(input: {
  snapshot: CosConversationSnapshot
  capability: CosCapabilityDescriptor | null
}): CosV2Interpretation["entities"] {
  if (!input.capability) return []

  const acceptedTypes = new Set<CosV2EntityType>()
  for (const field of [
    ...(input.capability.inputContract?.required ?? []),
    ...(input.capability.inputContract?.optional ?? []),
  ]) {
    const type = inputEntityType(field)
    if (type) acceptedTypes.add(type)
  }
  if (input.capability.requiresSelection) {
    const type = descriptorEntityType(input.capability)
    if (type) acceptedTypes.add(type)
  }

  return [...acceptedTypes].flatMap((type) => {
    const entity = input.snapshot.activeEntities[SNAPSHOT_ENTITY_BY_V2_TYPE[type]]
    return entity
      ? [{ type, id: entity.id, name: entity.label, role: "context" as const }]
      : []
  })
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function compactRecord(value: Record<string, unknown>, limit = 12) {
  return Object.fromEntries(Object.entries(value).slice(0, limit).map(([key, item]) => {
    if (typeof item === "string") return [key, item.slice(0, 240)]
    if (typeof item === "number" || typeof item === "boolean" || item === null) return [key, item]
    if (Array.isArray(item)) return [key, item.slice(0, 8)]
    return [key, record(item)]
  }))
}

export function buildCosV2CompactContext(input: {
  message: string
  snapshot: CosConversationSnapshot
  pendingInput: CosPendingInput | null
  workspace: CosWorkspaceContext | null
  attachments: CosAttachmentInput[]
  knowledge: CosKnowledgeContext | null
}): CosV2CompactContext {
  const latestResultData = record(input.snapshot.lastExecution?.metadata)
  const currentFilters = record(latestResultData.parsedData)
  const latestResult = input.snapshot.recentResults[0]
  const createdEntityType = latestResult ? COS_V2_CREATED_ENTITY_TYPES[latestResult.capabilityId] : null
  const createdEntities = latestResult?.status === "success" && createdEntityType
    ? latestResult.entities.filter((entity) => entity.type === createdEntityType)
    : []
  const latestCreationEntity = createdEntities.length === 1 ? createdEntities[0] : null

  return {
    recentMessages: input.snapshot.recentMessages
      .filter((item) => item.userMessage.trim() || item.assistantResponse?.trim())
      .slice(-6)
      .map((item) => ({
        user: item.userMessage.slice(0, 420),
        assistant: item.assistantResponse?.slice(0, 420) ?? null,
        action: item.action,
        status: item.status,
      })),
    activeEntities: Object.entries(input.snapshot.activeEntities)
      .flatMap(([type, entity]) => entity ? [{ type, id: entity.id, label: entity.label }] : []),
    recentEntities: input.snapshot.recentEntities.slice(0, 8).map((entity) => ({
      type: entity.type,
      id: entity.id,
      label: entity.label,
    })),
    currentTopic: input.snapshot.currentTopic
      ? {
          domain: input.snapshot.currentTopic.domain,
          label: input.snapshot.currentTopic.label,
          entityType: input.snapshot.currentTopic.entityType,
          selectionSetId: input.snapshot.currentTopic.selectionSetId,
        }
      : null,
    selectionSets: input.snapshot.selectionSets.slice(0, 3).map((selectionSet) => ({
      id: selectionSet.id,
      type: selectionSet.type,
      items: selectionSet.items.slice(0, 12).map((item) => ({
        index: item.index,
        id: item.entity.id,
        label: item.entity.label,
      })),
    })),
    pending: input.pendingInput
      ? {
          capabilityId: input.pendingInput.capabilityId ?? null,
          action: input.pendingInput.action,
          entity: input.pendingInput.entity,
          field: input.pendingInput.field,
          type: input.pendingInput.type,
          label: input.pendingInput.label,
          options: (input.pendingInput.options ?? []).slice(0, 12).map(({ id, label }) => ({ id, label })),
          knownData: compactRecord(input.pendingInput.parsedData),
        }
      : null,
    currentFilters: compactRecord(currentFilters),
    recentResults: input.snapshot.recentResults.slice(0, 4).map((result) => ({
      capabilityId: result.capabilityId,
      action: result.action,
      status: result.status,
      entityIds: result.entities.map((entity) => entity.id).slice(0, 10),
    })),
    recentCompletedCreation: latestCreationEntity && latestResult
      ? {
          capabilityId: latestResult.capabilityId,
          entityType: latestCreationEntity.type,
          entityId: latestCreationEntity.id,
        }
      : null,
    workspace: input.workspace
      ? {
          page: input.workspace.page,
          entity: input.workspace.entity,
          entityId: input.workspace.entityId ?? null,
          selection: input.workspace.selection.slice(0, 8),
        }
      : null,
    attachments: input.attachments.slice(0, 8).map((attachment) => ({
      name: attachment.name.slice(0, 180),
      type: attachment.type.slice(0, 100),
      category: attachment.category,
      textExcerpt: attachment.textContent?.slice(0, 600) ?? null,
    })),
    knowledgeFacts: getCosV2KnowledgeFacts(input.knowledge, input.message),
  }
}
