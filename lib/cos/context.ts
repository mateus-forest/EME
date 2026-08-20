import type { CosAttachmentInput, CosConversationMemory, CosConversationSnapshot, CosDialogueDecision, CosKnowledgeContext, CosNormalizedContext, CosWorkflow, CosWorkspaceContext, CosWorkspaceEntity } from "@/lib/cos/types"

function cleanId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function collectSelectedEntityIds(input: {
  workspace: CosWorkspaceContext | null
  memory: CosConversationMemory | null
  snapshot: CosConversationSnapshot | null
  decision: CosDialogueDecision | null
}) {
  const selected: Partial<Record<CosWorkspaceEntity, string>> = {}
  const workspaceSelection = input.workspace?.selection ?? []

  const decisionReference = input.decision?.reference
  if (decisionReference?.id && decisionReference.type) {
    if (decisionReference.type === "proposal") {
      selected.document = decisionReference.id
    } else {
      selected[decisionReference.type] = decisionReference.id
      if (decisionReference.type === "contract") selected.document = decisionReference.id
    }
  }

  for (const item of workspaceSelection) {
    if (item.entityId && !selected[item.entity]) selected[item.entity] = item.entityId
  }

  if (input.workspace?.entity && input.workspace.entityId && !selected[input.workspace.entity]) {
    selected[input.workspace.entity] = input.workspace.entityId
  }

  const memoryPairs: Array<[CosWorkspaceEntity, string | null]> = [
    ["lead", cleanId(input.memory?.selectedClient?.id ?? input.memory?.leadId)],
    ["property", cleanId(input.memory?.selectedProperty?.id ?? input.memory?.propertyId)],
    ["contract", cleanId(input.memory?.selectedContract?.id ?? input.memory?.contractId ?? input.memory?.documentId)],
    ["document", cleanId(input.memory?.documentId)],
  ]

  const snapshotPairs: Array<[CosWorkspaceEntity, string | null]> = [
    ["lead", cleanId(input.snapshot?.activeEntities.lead?.id)],
    ["property", cleanId(input.snapshot?.activeEntities.property?.id)],
    ["contract", cleanId(input.snapshot?.activeEntities.contract?.id ?? input.snapshot?.activeEntities.proposal?.id)],
    ["document", cleanId(input.snapshot?.activeEntities.contract?.id ?? input.snapshot?.activeEntities.proposal?.id)],
    ["agenda", cleanId(input.snapshot?.activeEntities.agenda?.id)],
  ]

  for (const [entity, entityId] of snapshotPairs) {
    if (entityId && !selected[entity]) selected[entity] = entityId
  }

  for (const [entity, entityId] of memoryPairs) {
    if (entityId && !selected[entity]) selected[entity] = entityId
  }

  return selected
}

export function createCosNormalizedContext(input: {
  brokerId: string
  userId: string
  actor?: {
    firstName?: string | null
  }
  surface: CosNormalizedContext["surface"]
  message: string
  workspace: CosWorkspaceContext | null
  workflow: CosWorkflow | null
  memory: CosConversationMemory | null
  snapshot?: CosConversationSnapshot | null
  decision?: CosDialogueDecision | null
  knowledge?: CosKnowledgeContext | null
  attachments?: CosAttachmentInput[]
}) {
  return {
    brokerId: input.brokerId,
    userId: input.userId,
    actor: {
      firstName: input.actor?.firstName ?? null,
    },
    surface: input.surface,
    message: input.message,
    workspace: input.workspace,
    workflow: input.workflow,
    memory: input.memory,
    snapshot: input.snapshot ?? null,
    decision: input.decision ?? null,
    knowledge: input.knowledge ?? null,
    attachments: input.attachments ?? [],
    selectedEntityIds: collectSelectedEntityIds({
      workspace: input.workspace,
      memory: input.memory,
      snapshot: input.snapshot ?? null,
      decision: input.decision ?? null,
    }),
  } satisfies CosNormalizedContext
}
