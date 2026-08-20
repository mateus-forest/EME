import { getCosV2KnowledgeFacts } from "@/lib/cos-v2/knowledge"
import { COS_V2_CREATED_ENTITY_TYPES, type CosV2CompactContext } from "@/lib/cos-v2/types"
import type { CosAttachmentInput, CosConversationSnapshot, CosKnowledgeContext, CosPendingInput, CosWorkspaceContext } from "@/lib/cos/types"

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
