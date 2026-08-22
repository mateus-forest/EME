import type { AssessorAction } from "@/lib/eme-backend"
import { classifyCosPendingReply } from "@/lib/cos/pending-input"
import type {
  CosConversationDomain,
  CosConversationEntityReference,
  CosConversationEntityType,
  CosConversationExecutionReference,
  CosConversationMemory,
  CosConversationRecentMessage,
  CosConversationSelectionSet,
  CosConversationSnapshot,
  CosConversationTopic,
  CosExecutionPlanResult,
  CosPendingInput,
  CosTemporalContext,
  CosWorkflow,
  CosWorkspaceContext,
} from "@/lib/cos/types"

export const COS_RECENT_MESSAGE_LIMIT = 12
const COS_RECENT_ENTITY_LIMIT = 10
const COS_RECENT_RESULT_LIMIT = 8
const COS_RECENT_TOPIC_LIMIT = 4
const COS_SELECTION_SET_LIMIT = 5
const COS_SELECTION_SET_TTL_MS = 7 * 24 * 60 * 60 * 1000

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getUTCDay() || 7
  next.setUTCDate(next.getUTCDate() - day + 1)
  return next
}

export function buildCosTemporalContext(message: string, now = new Date()): CosTemporalContext {
  const normalized = normalizeText(message)
  const references: CosTemporalContext["references"] = {}
  const day = 24 * 60 * 60 * 1000
  const setDay = (key: "today" | "tomorrow" | "yesterday", date: Date) => {
    references[key] = { from: isoDate(date), to: isoDate(date) }
  }
  if (/\bhoje\b/.test(normalized)) setDay("today", now)
  if (/\bamanha\b/.test(normalized)) setDay("tomorrow", new Date(now.getTime() + day))
  if (/\bontem\b/.test(normalized)) setDay("yesterday", new Date(now.getTime() - day))
  if (/\besta semana\b/.test(normalized)) {
    const from = startOfWeek(now)
    references.this_week = { from: isoDate(from), to: isoDate(new Date(from.getTime() + 6 * day)) }
  }
  if (/\bsemana passada\b/.test(normalized)) {
    const thisWeek = startOfWeek(now)
    const from = new Date(thisWeek.getTime() - 7 * day)
    references.last_week = { from: isoDate(from), to: isoDate(new Date(from.getTime() + 6 * day)) }
  }
  if (/\bproximo mes\b/.test(normalized)) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0))
    references.next_month = { from: isoDate(from), to: isoDate(to) }
  }
  return { today: isoDate(now), references }
}

export function getCosSnapshotActionDomain(action: AssessorAction | null): CosConversationDomain {
  if (!action) return "general"
  if (action.startsWith("STUDIO_")) return "studio"
  if (action.includes("CONTRACT")) return "contract"
  if (action.includes("PROPOSAL")) return "proposal"
  if (action.includes("PROPERTY") || action === "searchProperties" || action === "createPropertyDraft" || action === "improvePropertyDescription") return "property"
  if (action.includes("LEAD") || action === "createLead" || action === "getLeadsSummary" || action === "summarizeLead") return "lead"
  if (action.includes("AGENDA")) return "agenda"
  if (action.includes("FINANCE") || action === "getFinancialSummary") return "finance"
  if (action.includes("ANALYTICS") || action === "getAnalyticsSummary") return "analytics"
  if (action.includes("CATALOG") || action === "getCatalogSummary" || action === "analyzeCatalog") return "catalog"
  if (action.includes("DOCUMENT")) return "contract"
  return "general"
}

function domainEntityType(domain: CosConversationDomain): CosConversationEntityType | null {
  if (domain === "lead") return "lead"
  if (domain === "property") return "property"
  if (domain === "proposal") return "proposal"
  if (domain === "contract") return "contract"
  if (domain === "agenda") return "agenda"
  return null
}

function makeEntity(input: Omit<CosConversationEntityReference, "lastMentionedAt"> & { lastMentionedAt?: string }, now: string) {
  return { ...input, lastMentionedAt: input.lastMentionedAt ?? now }
}

function upsertRecentEntity(list: CosConversationEntityReference[], entity: CosConversationEntityReference) {
  return [entity, ...list.filter((item) => !(item.type === entity.type && item.id === entity.id))]
    .slice(0, COS_RECENT_ENTITY_LIMIT)
}

function preserveEntityLabel(
  entity: CosConversationEntityReference,
  activeEntities: CosConversationSnapshot["activeEntities"],
  recentEntities: CosConversationEntityReference[],
) {
  if (entity.label) return entity
  const existing = activeEntities[entity.type]?.id === entity.id
    ? activeEntities[entity.type]
    : recentEntities.find((candidate) => candidate.type === entity.type && candidate.id === entity.id)
  return existing?.label ? { ...entity, label: existing.label } : entity
}

function legacyEntities(memory: CosConversationMemory | null, now: string) {
  const entities: CosConversationEntityReference[] = []
  const add = (type: CosConversationEntityType, id: string | null | undefined, label?: string | null) => {
    if (!id) return
    entities.push(makeEntity({ type, id, label: label ?? null, source: "legacy_memory", confidence: 0.82, evidence: "legacy_memory" }, now))
  }
  add("lead", memory?.selectedClient?.id ?? memory?.leadId, memory?.selectedClient?.label)
  add("property", memory?.selectedProperty?.id ?? memory?.propertyId, memory?.selectedProperty?.label)
  add("contract", memory?.selectedContract?.id ?? memory?.contractId, memory?.selectedContract?.label)
  add("proposal", memory?.selectedProposal?.id ?? memory?.proposalId, memory?.selectedProposal?.label)
  add("contract", memory?.documentId)
  return entities
}

function workspaceEntities(workspace: CosWorkspaceContext | null, now: string) {
  const entities: CosConversationEntityReference[] = []
  const add = (entity: string, id: string | null | undefined, label?: string | null) => {
    const type = entity === "document" ? "contract" : entity
    if (!id || !["lead", "property", "proposal", "contract", "agenda"].includes(type)) return
    entities.push(makeEntity({
      type: type as CosConversationEntityType,
      id,
      label: label ?? null,
      source: "workspace",
      confidence: 1,
      evidence: `workspace:${workspace?.page ?? "unknown"}`,
    }, now))
  }
  add(workspace?.entity ?? "", workspace?.entityId)
  for (const selection of workspace?.selection ?? []) add(selection.entity, selection.entityId, selection.label)
  return entities
}

export type CosSnapshotMessageInput = {
  id: string
  message: string
  response: string | null
  actionType: string | null
  actionStatus: string | null
  leadId: string | null
  propertyId: string | null
  metadata: unknown
  createdAt: Date | string
}

function normalizeRecentMessage(message: CosSnapshotMessageInput): CosConversationRecentMessage {
  return {
    id: message.id,
    userMessage: message.message,
    assistantResponse: message.response,
    action: (message.actionType || null) as AssessorAction | null,
    status: message.actionStatus,
    leadId: message.leadId,
    propertyId: message.propertyId,
    metadata: asRecord(message.metadata),
    createdAt: typeof message.createdAt === "string" ? message.createdAt : message.createdAt.toISOString(),
  }
}

export function buildCosConversationSnapshot(input: {
  conversationId: string
  message: string
  recentMessages: CosSnapshotMessageInput[]
  activeWorkflow: CosWorkflow | null
  memory: CosConversationMemory | null
  persistedSnapshot?: CosConversationSnapshot | null
  workspace: CosWorkspaceContext | null
  now?: Date
}): CosConversationSnapshot {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const persisted = input.persistedSnapshot?.schemaVersion === 1 ? input.persistedSnapshot : null
  const recentMessages = input.recentMessages
    .slice(-COS_RECENT_MESSAGE_LIMIT)
    .map(normalizeRecentMessage)
  const activeEntities = { ...(persisted?.activeEntities ?? {}) }
  let recentEntities = [...(persisted?.recentEntities ?? [])]
  let recentResults = [...(persisted?.recentResults ?? [])]
  let selectionSets = (persisted?.selectionSets ?? []).filter((set) => Date.parse(set.expiresAt) > now.getTime())

  for (const entity of [...legacyEntities(input.memory, nowIso), ...workspaceEntities(input.workspace, nowIso)]) {
    activeEntities[entity.type] = entity
    recentEntities = upsertRecentEntity(recentEntities, entity)
  }
  for (const message of recentMessages) {
    if (message.leadId) {
      const entity = preserveEntityLabel(makeEntity({ type: "lead", id: message.leadId, label: null, source: "message", confidence: 0.95, evidence: `message:${message.id}`, lastMentionedAt: message.createdAt }, nowIso), activeEntities, recentEntities)
      activeEntities.lead = entity
      recentEntities = upsertRecentEntity(recentEntities, entity)
    }
    if (message.propertyId) {
      const entity = preserveEntityLabel(makeEntity({ type: "property", id: message.propertyId, label: null, source: "message", confidence: 0.95, evidence: `message:${message.id}`, lastMentionedAt: message.createdAt }, nowIso), activeEntities, recentEntities)
      activeEntities.property = entity
      recentEntities = upsertRecentEntity(recentEntities, entity)
    }

    const stepRecords = Array.isArray(message.metadata.steps)
      ? message.metadata.steps.map(asRecord)
      : []
    const lastStep = stepRecords.at(-1)
    const stepMetadata = asRecord(lastStep?.metadata)
    const mergedMetadata = { ...stepMetadata, ...message.metadata }
    const domain = getCosSnapshotActionDomain(message.action)
    const type = domainEntityType(domain)
    if (message.action && type) {
      const idsKey = type === "property" ? "propertyIds" : type === "lead" ? "leadIds" : type === "agenda" ? "agendaEventIds" : "documentIds"
      const listIds = Array.isArray(mergedMetadata[idsKey]) ? mergedMetadata[idsKey] as unknown[] : []
      const directId = type === "property"
        ? message.propertyId ?? mergedMetadata.propertyId
        : type === "lead"
          ? message.leadId ?? mergedMetadata.leadId
          : type === "agenda"
            ? mergedMetadata.agendaEventId
            : mergedMetadata.contractId ?? mergedMetadata.documentId
      const ids = [directId, ...listIds].filter((id): id is string => typeof id === "string" && id.length > 0)
      const uniqueIds = [...new Set(ids)]
      const pending = asRecord(mergedMetadata.pendingInput)
      const options = Array.isArray(pending.options)
        ? pending.options.map(asRecord).filter((option) => typeof option.id === "string")
        : []
      const entities = uniqueIds.map((id) => preserveEntityLabel(makeEntity({
        type,
        id,
        label: typeof options.find((option) => option.id === id)?.label === "string"
          ? options.find((option) => option.id === id)?.label as string
          : null,
        source: "message",
        confidence: 0.9,
        evidence: `message_metadata:${message.id}`,
        lastMentionedAt: message.createdAt,
      }, nowIso), activeEntities, recentEntities))
      if (entities.length === 1) activeEntities[type] = entities[0]
      for (const entity of entities) recentEntities = upsertRecentEntity(recentEntities, entity)
      let selectionSetId: string | null = null
      if (entities.length > 1) {
        const set: CosConversationSelectionSet = {
          id: `selection:${type}:${message.id}`,
          type,
          items: entities.map((entity, index) => ({
            index: index + 1,
            entity,
            description: typeof options.find((option) => option.id === entity.id)?.description === "string"
              ? options.find((option) => option.id === entity.id)?.description as string
              : undefined,
          })),
          query: message.userMessage,
          topicId: null,
          createdAt: message.createdAt,
          expiresAt: new Date(Date.parse(message.createdAt) + COS_SELECTION_SET_TTL_MS).toISOString(),
        }
        selectionSetId = set.id
        selectionSets = [set, ...selectionSets.filter((candidate) => candidate.id !== set.id)]
      }
      const execution: CosConversationExecutionReference = {
        capabilityId: (typeof lastStep?.capabilityId === "string" ? lastStep.capabilityId : "general.chat") as CosConversationExecutionReference["capabilityId"],
        action: message.action,
        status: message.status === "error" ? "error" : message.status === "cancelled" ? "cancelled" : message.status === "processing" ? "awaiting_input" : "success",
        entities,
        selectionSetId,
        metadata: mergedMetadata,
        executedAt: message.createdAt,
      }
      recentResults = [execution, ...recentResults.filter((item) => !(item.action === execution.action && item.executedAt === execution.executedAt))]
    }
  }

  const reconstructedTopics: CosConversationTopic[] = []
  for (const message of [...recentMessages].reverse()) {
    const domain = getCosSnapshotActionDomain(message.action)
    const type = domainEntityType(domain)
    if (domain === "general" || reconstructedTopics.some((topic) => topic.domain === domain)) continue
    const relatedSet = selectionSets.find((set) => set.type === type && set.query === message.userMessage)
    reconstructedTopics.push({
      id: `topic:${domain}:${message.id}`,
      domain,
      label: message.userMessage.slice(0, 120),
      entityType: type,
      selectionSetId: relatedSet?.id ?? null,
      startedAt: message.createdAt,
      lastMentionedAt: message.createdAt,
    })
    if (reconstructedTopics.length >= COS_RECENT_TOPIC_LIMIT + 1) break
  }
  const currentTopic = persisted?.currentTopic ?? reconstructedTopics[0] ?? null
  const recentTopics = persisted?.recentTopics?.length
    ? persisted.recentTopics
    : reconstructedTopics.slice(1)

  return {
    schemaVersion: 1,
    conversationId: input.conversationId,
    recentMessages,
    activeWorkflow: input.activeWorkflow,
    pendingInput: input.activeWorkflow?.pendingInput ?? null,
    currentTopic,
    recentTopics: recentTopics.slice(0, COS_RECENT_TOPIC_LIMIT),
    activeEntities,
    recentEntities: recentEntities.slice(0, COS_RECENT_ENTITY_LIMIT),
    recentResults: recentResults.slice(0, COS_RECENT_RESULT_LIMIT),
    selectionSets: selectionSets.filter((set) => Date.parse(set.expiresAt) > now.getTime()).slice(0, COS_SELECTION_SET_LIMIT),
    lastAction: persisted?.lastAction ?? input.memory?.lastAction ?? null,
    lastExecution: persisted?.lastExecution ?? null,
    temporalContext: buildCosTemporalContext(input.message, now),
    workspace: input.workspace,
    updatedAt: nowIso,
  }
}

function entityIdsFromResult(type: CosConversationEntityType | null, result: NonNullable<CosExecutionPlanResult["steps"][number]["result"]>) {
  if (!type) return []
  const metadata = asRecord(result.metadata)
  const idsKey = type === "property" ? "propertyIds" : type === "lead" ? "leadIds" : type === "agenda" ? "agendaEventIds" : "documentIds"
  const ids = Array.isArray(metadata[idsKey]) ? metadata[idsKey] as unknown[] : []
  const directId = type === "property"
    ? result.propertyId ?? metadata.propertyId
    : type === "lead"
      ? result.leadId ?? metadata.leadId
      : type === "agenda"
        ? metadata.agendaEventId
        : metadata.contractId ?? metadata.documentId
  return [directId, ...ids].filter((id): id is string => typeof id === "string" && id.length > 0)
}

function linkedEntityIdsFromResult(
  domain: CosConversationDomain,
  result: NonNullable<CosExecutionPlanResult["steps"][number]["result"]>,
) {
  const metadata = asRecord(result.metadata)
  const values = (direct: unknown, list: unknown) => [...new Set([
    direct,
    ...(Array.isArray(list) ? list : []),
  ].filter((id): id is string => typeof id === "string" && id.length > 0))]

  return {
    lead: values(result.leadId ?? metadata.leadId, metadata.leadIds),
    property: values(result.propertyId ?? metadata.propertyId, metadata.propertyIds),
    proposal: values(
      metadata.proposalId ?? (domain === "proposal" ? metadata.documentId : null),
      metadata.proposalIds ?? (domain === "proposal" ? metadata.documentIds : null),
    ),
    contract: values(
      metadata.contractId ?? (domain === "contract" ? metadata.documentId : null),
      metadata.contractIds ?? (domain === "contract" ? metadata.documentIds : null),
    ),
    agenda: values(metadata.agendaEventId, metadata.agendaEventIds),
  } satisfies Record<CosConversationEntityType, string[]>
}

function buildSelectionSet(input: {
  type: CosConversationEntityType
  ids: string[]
  pendingInput: CosPendingInput | null
  message: string
  topicId: string | null
  now: Date
}): CosConversationSelectionSet | null {
  const options = input.pendingInput?.options ?? []
  const ids = input.ids.length > 1 ? input.ids : options.map((option) => option.id)
  if (ids.length < 2) return null
  const nowIso = input.now.toISOString()
  return {
    id: `selection:${input.type}:${input.now.getTime()}`,
    type: input.type,
    items: ids.slice(0, 20).map((id, index) => {
      const option = options.find((item) => item.id === id)
      return {
        index: index + 1,
        entity: makeEntity({
          type: input.type,
          id,
          label: option?.label ?? null,
          source: "selection",
          confidence: 1,
          evidence: `selection:${index + 1}`,
        }, nowIso),
        description: option?.description,
      }
    }),
    query: input.message || null,
    topicId: input.topicId,
    createdAt: nowIso,
    expiresAt: new Date(input.now.getTime() + COS_SELECTION_SET_TTL_MS).toISOString(),
  }
}

export function updateCosConversationSnapshot(input: {
  snapshot: CosConversationSnapshot
  message: string
  workflow: CosWorkflow
  result: CosExecutionPlanResult | null
  status: "success" | "awaiting_input" | "error" | "cancelled"
  now?: Date
}): CosConversationSnapshot {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const snapshot: CosConversationSnapshot = {
    ...input.snapshot,
    activeWorkflow: input.workflow,
    pendingInput: input.workflow.pendingInput,
    temporalContext: buildCosTemporalContext(input.message, now),
    updatedAt: nowIso,
  }
  const activeEntities = { ...snapshot.activeEntities }
  let recentEntities = [...snapshot.recentEntities]
  let currentTopic = snapshot.currentTopic
  let recentTopics = [...snapshot.recentTopics]
  let selectionSets = [...snapshot.selectionSets]
  let lastExecution: CosConversationExecutionReference | null = null

  if (!input.result) {
    const pending = input.workflow.pendingInput
    if (!pending) return snapshot
    const parsedData = pending.parsedData ?? {}
    const domain = getCosSnapshotActionDomain(pending.action)
    const pendingLinks: Array<[CosConversationEntityType, unknown]> = [
      ["lead", parsedData.leadId],
      ["property", parsedData.propertyId],
      ["proposal", parsedData.proposalId ?? (domain === "proposal" ? parsedData.documentId : null)],
      ["contract", parsedData.contractId ?? (domain === "contract" ? parsedData.documentId : null)],
      ["agenda", parsedData.agendaEventId],
    ]
    for (const [entityType, id] of pendingLinks) {
      if (typeof id !== "string" || !id) continue
      const entity = preserveEntityLabel(makeEntity({
        type: entityType,
        id,
        label: null,
        source: "workflow",
        confidence: 1,
        evidence: `pending:${pending.capabilityId ?? pending.action}`,
      }, nowIso), activeEntities, recentEntities)
      activeEntities[entityType] = entity
      recentEntities = upsertRecentEntity(recentEntities, entity)
    }

    const pendingSet = pendingSelectionSet({ ...snapshot, activeEntities, recentEntities })
    const topic: CosConversationTopic | null = domain === "general"
      ? currentTopic
      : {
          id: currentTopic?.domain === domain ? currentTopic.id : `topic:${domain}:${now.getTime()}`,
          domain,
          label: input.message.trim().slice(0, 120) || pending.label,
          entityType: pendingSet?.type ?? domainEntityType(domain),
          selectionSetId: pendingSet?.id ?? (currentTopic?.domain === domain ? currentTopic.selectionSetId : null),
          startedAt: currentTopic?.domain === domain ? currentTopic.startedAt : nowIso,
          lastMentionedAt: nowIso,
        }
    if (topic && currentTopic && topic.id !== currentTopic.id) {
      recentTopics = [currentTopic, ...recentTopics.filter((item) => item.id !== currentTopic?.id)].slice(0, COS_RECENT_TOPIC_LIMIT)
    }
    const linkedPendingSet = pendingSet && topic ? { ...pendingSet, topicId: topic.id } : pendingSet
    if (linkedPendingSet) selectionSets = [linkedPendingSet, ...selectionSets.filter((set) => set.id !== linkedPendingSet.id)].slice(0, COS_SELECTION_SET_LIMIT)
    return {
      ...snapshot,
      currentTopic: topic,
      recentTopics,
      activeEntities,
      recentEntities: recentEntities.slice(0, COS_RECENT_ENTITY_LIMIT),
      selectionSets,
      lastAction: pending.action,
    }
  }

  for (const step of input.result.executedSteps) {
    if (!step.result) continue
    const domain = getCosSnapshotActionDomain(step.action)
    const type = domainEntityType(domain)
    const topic: CosConversationTopic = {
      id: currentTopic?.domain === domain ? currentTopic.id : `topic:${domain}:${now.getTime()}`,
      domain,
      label: input.message.trim().slice(0, 120) || step.plan.capability.title,
      entityType: type,
      selectionSetId: currentTopic?.domain === domain ? currentTopic.selectionSetId : null,
      startedAt: currentTopic?.domain === domain ? currentTopic.startedAt : nowIso,
      lastMentionedAt: nowIso,
    }
    if (currentTopic && currentTopic.id !== topic.id) {
      recentTopics = [currentTopic, ...recentTopics.filter((item) => item.id !== currentTopic?.id)].slice(0, COS_RECENT_TOPIC_LIMIT)
    }

    const linkedIds = linkedEntityIdsFromResult(domain, step.result)
    const ids = type ? [...new Set([...entityIdsFromResult(type, step.result), ...linkedIds[type]])] : []
    const pendingInput = step.result.status === "awaiting_input" ? step.result.pendingInput : null
    const selectionType = pendingSelectionType(pendingInput) ?? type
    const selectionSet = selectionType ? buildSelectionSet({ type: selectionType, ids: selectionType === type ? ids : [], pendingInput, message: input.message, topicId: topic.id, now }) : null
    if (selectionSet) {
      topic.entityType = selectionSet.type
      topic.selectionSetId = selectionSet.id
      selectionSets = [selectionSet, ...selectionSets.filter((set) => set.id !== selectionSet.id)].slice(0, COS_SELECTION_SET_LIMIT)
    }

    const entities = (Object.entries(linkedIds) as Array<[CosConversationEntityType, string[]]>).flatMap(([entityType, entityIds]) =>
      entityIds.slice(0, 20).map((id) => preserveEntityLabel(makeEntity({
        type: entityType,
        id,
        label: entityType === selectionSet?.type ? selectionSet.items.find((item) => item.entity.id === id)?.entity.label ?? null : null,
        source: "execution",
        confidence: 1,
        evidence: `${step.capabilityId}:${step.status}`,
      }, nowIso), activeEntities, recentEntities)),
    )
    for (const entityType of ["lead", "property", "proposal", "contract", "agenda"] as const) {
      const typedEntities = entities.filter((entity) => entity.type === entityType)
      if (typedEntities.length === 1) activeEntities[entityType] = typedEntities[0]
    }
    for (const entity of entities) recentEntities = upsertRecentEntity(recentEntities, entity)

    lastExecution = {
      capabilityId: step.capabilityId,
      action: step.action,
      status: step.result.status,
      entities,
      selectionSetId: selectionSet?.id ?? null,
      metadata: asRecord(step.result.metadata),
      executedAt: nowIso,
    }
    currentTopic = topic
  }

  return {
    ...snapshot,
    currentTopic,
    recentTopics,
    activeEntities,
    recentEntities: recentEntities.slice(0, COS_RECENT_ENTITY_LIMIT),
    selectionSets,
    recentResults: lastExecution ? [lastExecution, ...snapshot.recentResults].slice(0, COS_RECENT_RESULT_LIMIT) : snapshot.recentResults,
    lastAction: input.result.primaryAction,
    lastExecution: lastExecution ?? snapshot.lastExecution,
  }
}

const ORDINALS: Record<string, number> = {
  primeiro: 0,
  primeira: 0,
  segundo: 1,
  segunda: 1,
  terceiro: 2,
  terceira: 2,
  ultimo: -1,
  ultima: -1,
  anterior: -2,
}

function explicitlyReferencedEntityType(message: string): CosConversationEntityType | null {
  const demonstrative = "(?:ess[ea]|est[ea]|aquel[ea]|dess[ea]|dest[ea]|ness[ea]|nest[ea]|daquel[ea]|naquel[ea]|meu|minha)"
  if (new RegExp(`\\b${demonstrative}\\s+(?:imovel|apartamento|casa|terreno)\\b`).test(message)) return "property"
  if (new RegExp(`\\b${demonstrative}\\s+(?:cliente|lead|contato)\\b`).test(message)) return "lead"
  if (new RegExp(`\\b${demonstrative}\\s+proposta\\b`).test(message)) return "proposal"
  if (new RegExp(`\\b${demonstrative}\\s+contrato\\b`).test(message)) return "contract"
  if (new RegExp(`\\b${demonstrative}\\s+(?:compromisso|evento|visita)\\b`).test(message)) return "agenda"
  return null
}

function mentionedTargetEntityType(message: string): CosConversationEntityType | null {
  if (/\b(imovel|imoveis|apartamento|apartamentos|casa|casas|terreno|terrenos)\b/.test(message)) return "property"
  if (/\b(cliente|clientes|lead|leads)\b/.test(message)) return "lead"
  if (/\b(proposta|propostas)\b/.test(message)) return "proposal"
  if (/\b(contrato|contratos)\b/.test(message)) return "contract"
  if (/\b(compromisso|agenda|evento|visita)\b/.test(message)) return "agenda"
  return null
}

function findOrdinal(message: string) {
  const numeric = message.match(/\b([1-9]|1\d|20)\b/)?.[1]
  if (numeric) return Number(numeric) - 1
  for (const [word, index] of Object.entries(ORDINALS)) {
    if (new RegExp(`\\b${word}\\b`).test(message)) return index
  }
  return null
}

export type CosResolvedConversationReference = {
  entity: CosConversationEntityReference | null
  selectionSet: CosConversationSelectionSet | null
  ambiguous: CosConversationEntityReference[]
  reason: string
}

const REFERENCE_LABEL_STOPWORDS = new Set([
  "abre", "abrir", "aquele", "aquela", "com", "da", "de", "do", "e", "esse", "essa", "este", "esta",
  "me", "meu", "minha", "no", "na", "o", "a", "os", "as", "para", "por", "pra", "pro", "que", "qual",
  "quero", "tem", "um", "uma", "ver", "mostra", "mostre", "entao",
])

function referenceLabelTokens(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !REFERENCE_LABEL_STOPWORDS.has(token))
}

function pendingSelectionType(pendingInput: CosPendingInput | null): CosConversationEntityType | null {
  if (!pendingInput || pendingInput.type !== "selection") return null
  if (/lead|client|contato/i.test(pendingInput.field)) return "lead"
  if (/propert|imovel/i.test(pendingInput.field)) return "property"
  if (/proposal|proposta/i.test(pendingInput.field)) return "proposal"
  if (/contract|contrato|document/i.test(pendingInput.field)) return "contract"
  if (/agenda|event|appointment|compromisso/i.test(pendingInput.field)) return "agenda"
  return null
}

function pendingSelectionSet(snapshot: CosConversationSnapshot): CosConversationSelectionSet | null {
  const pending = snapshot.pendingInput
  const options = pending?.options ?? []
  const type = pendingSelectionType(pending)
  if (!pending || pending.type !== "selection" || !type || options.length === 0) return null
  const createdAt = pending.createdAt ?? snapshot.updatedAt
  return {
    id: `pending:${pending.capabilityId}:${pending.field}`,
    type,
    items: options.map((option, index) => ({
      index: index + 1,
      entity: {
        type,
        id: option.id,
        label: option.label,
        source: "selection",
        lastMentionedAt: createdAt,
        confidence: 1,
        evidence: `pending_option:${index + 1}`,
      },
      ...(option.description ? { description: option.description } : {}),
    })),
    query: null,
    topicId: snapshot.currentTopic?.id ?? null,
    createdAt,
    expiresAt: pending.expiresAt ?? new Date(Date.parse(createdAt) + COS_SELECTION_SET_TTL_MS).toISOString(),
  }
}

function matchingSelectionItems(message: string, selectionSet: CosConversationSelectionSet | null) {
  if (!selectionSet) return []
  const messageTokens = referenceLabelTokens(message)
  if (messageTokens.length === 0) return []
  return selectionSet.items.filter((item) => {
    const candidateTokens = referenceLabelTokens(`${item.entity.label ?? ""} ${item.description ?? ""}`)
    return messageTokens.every((token) => candidateTokens.includes(token))
  })
}

function selectionItemPrice(description: string | undefined) {
  const rawPrice = description?.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1]
  if (!rawPrice) return null
  const value = Number(rawPrice.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(value) ? value : null
}

function lowestPricedSelectionItem(selectionSet: CosConversationSelectionSet) {
  const priced = selectionSet.items.map((item) => ({ item, price: selectionItemPrice(item.description) }))
  if (priced.length === 0 || priced.some((entry) => entry.price === null)) return null
  const ordered = priced.sort((left, right) => (left.price ?? 0) - (right.price ?? 0))
  if (ordered.length > 1 && ordered[0].price === ordered[1].price) return null
  return ordered[0].item
}

function pendingEntityReference(snapshot: CosConversationSnapshot, type: CosConversationEntityType | null) {
  const parsedData = snapshot.pendingInput?.parsedData ?? {}
  const entries: Array<[CosConversationEntityType, unknown]> = [
    ["lead", parsedData.leadId],
    ["property", parsedData.propertyId],
    ["proposal", parsedData.proposalId],
    ["contract", parsedData.contractId ?? parsedData.documentId],
    ["agenda", parsedData.agendaEventId],
  ]
  const match = entries.find(([candidateType, id]) => (!type || candidateType === type) && typeof id === "string" && id.length > 0)
  if (!match) return null
  const [matchedType, id] = match as [CosConversationEntityType, string]
  const active = snapshot.activeEntities[matchedType]
  return (active?.id === id ? active : null) ?? snapshot.recentEntities.find((entity) => entity.type === matchedType && entity.id === id) ?? {
    type: matchedType,
    id,
    label: null,
    source: "workflow" as const,
    lastMentionedAt: snapshot.pendingInput?.createdAt ?? snapshot.updatedAt,
    confidence: 1,
    evidence: "pending_parsed_data",
  }
}

function uniqueLabelReference(message: string, entities: CosConversationEntityReference[], type: CosConversationEntityType | null) {
  const genericEntityTokens = new Set(["cliente", "lead", "contato", "imovel", "apartamento", "casa", "terreno", "comercial", "residencial", "proposta", "contrato", "documento", "compromisso", "evento", "visita"])
  const messageTokens = referenceLabelTokens(message).filter((token) => !genericEntityTokens.has(token))
  if (messageTokens.length === 0) return { entity: null, ambiguous: [] as CosConversationEntityReference[] }
  const scored = entities
    .filter((entity, index, all) => (!type || entity.type === type) && all.findIndex((candidate) => candidate.type === entity.type && candidate.id === entity.id) === index)
    .map((entity) => {
      const labelTokens = referenceLabelTokens(entity.label ?? "").filter((token) => !genericEntityTokens.has(token))
      const overlap = messageTokens.filter((token) => labelTokens.includes(token)).length
      const normalizedLabel = labelTokens.join(" ")
      const fullLabel = normalizedLabel.length > 0 && ` ${normalizeText(message)} `.includes(` ${normalizedLabel} `)
      return { entity, score: overlap + (fullLabel ? 10 : 0) }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
  const topScore = scored[0]?.score ?? 0
  const matches = scored.filter((candidate) => candidate.score === topScore).map((candidate) => candidate.entity)
  return {
    entity: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1 ? matches : [],
  }
}

export function resolveCosConversationReference(message: string, snapshot: CosConversationSnapshot): CosResolvedConversationReference {
  const normalized = normalizeText(message)
  const explicitType = explicitlyReferencedEntityType(normalized)
  const returnToTopic = /\b(voltando|volta|retomando|de volta)\b/.test(normalized)
  const topic = returnToTopic
    ? [snapshot.currentTopic, ...snapshot.recentTopics].find((item) => item && (!explicitType || item.entityType === explicitType)) ?? null
    : snapshot.currentTopic
  const type = explicitType ?? null
  const ordinal = findOrdinal(normalized)
  const pendingSet = pendingSelectionSet(snapshot)
  const selectionSet = [
    ...(pendingSet ? [pendingSet] : []),
    ...(topic?.selectionSetId ? snapshot.selectionSets.filter((set) => set.id === topic.selectionSetId) : []),
    ...snapshot.selectionSets,
  ].find((set, index, all) => all.findIndex((candidate) => candidate.id === set.id) === index && (!type || set.type === type)) ?? null

  if (ordinal !== null && ordinal < 0 && (!selectionSet || /\banterior\b/.test(normalized))) {
    const recentType = type ?? topic?.entityType ?? null
    const recentCandidates = snapshot.recentEntities
      .filter((entity) => !recentType || entity.type === recentType)
      .filter((entity, index, all) => all.findIndex((candidate) => candidate.type === entity.type && candidate.id === entity.id) === index)
    const index = Math.abs(ordinal) - 1
    const entity = recentCandidates[index] ?? null
    return {
      entity,
      selectionSet: null,
      ambiguous: [],
      reason: entity
        ? ordinal === -1 ? "active_recent_ordinal" : "previous_recent_ordinal"
        : "recent_ordinal_out_of_range",
    }
  }

  if (ordinal !== null && selectionSet) {
    const index = ordinal < 0 ? selectionSet.items.length + ordinal : ordinal
    return {
      entity: selectionSet.items[index]?.entity ?? null,
      selectionSet,
      ambiguous: [],
      reason: selectionSet.items[index] ? "selection_ordinal" : "selection_ordinal_out_of_range",
    }
  }

  if (!/\?\s*$/.test(message) && /\b(?:mais barato|mais barata)\b/.test(normalized) && selectionSet) {
    const rankedItem = lowestPricedSelectionItem(selectionSet)
    return {
      entity: rankedItem?.entity ?? null,
      selectionSet,
      ambiguous: rankedItem ? [] : selectionSet.items.map((item) => item.entity).slice(0, 4),
      reason: rankedItem ? "selection_ranked_price" : "selection_rank_missing_data",
    }
  }

  if (!/\?\s*$/.test(message) && /\b(?:melhor opcao|mais completo|mais completa)\b/.test(normalized) && selectionSet) {
    return {
      entity: null,
      selectionSet,
      ambiguous: selectionSet.items.map((item) => item.entity).slice(0, 4),
      reason: "selection_rank_missing_metric",
    }
  }

  if (/\b(?:outro|outra)\b/.test(normalized) && selectionSet) {
    const activeId = snapshot.activeEntities[selectionSet.type]?.id
    const alternatives = activeId
      ? selectionSet.items.filter((item) => item.entity.id !== activeId)
      : selectionSet.items.slice(1)
    return {
      entity: alternatives.length === 1 ? alternatives[0].entity : null,
      selectionSet,
      ambiguous: alternatives.length > 1 ? alternatives.map((item) => item.entity) : [],
      reason: alternatives.length === 1 ? "selection_alternative" : "selection_alternative_ambiguous",
    }
  }

  const selectionMatches = matchingSelectionItems(normalized, selectionSet)
  if (selectionMatches.length > 0) {
    return {
      entity: selectionMatches.length === 1 ? selectionMatches[0].entity : null,
      selectionSet,
      ambiguous: selectionMatches.length > 1 ? selectionMatches.map((item) => item.entity) : [],
      reason: selectionMatches.length === 1 ? "selection_label" : "selection_label_ambiguous",
    }
  }

  const labelMatch = uniqueLabelReference(
    normalized,
    [...Object.values(snapshot.activeEntities).filter(Boolean), ...snapshot.recentEntities] as CosConversationEntityReference[],
    type,
  )
  if (labelMatch.entity || labelMatch.ambiguous.length > 0) {
    return {
      entity: labelMatch.entity,
      selectionSet,
      ambiguous: labelMatch.ambiguous,
      reason: labelMatch.entity ? "entity_label" : "entity_label_ambiguous",
    }
  }

  const hasReference = /\b(ele|ela|eles|elas|nele|nela|neles|nelas|dele|dela|deles|delas|isso|isto|aquilo|esse|essa|esses|essas|este|estes|estas|desse|dessa|desses|dessas|neste|nesta|nesse|nessa|daquele|daquela|daqueles|daquelas|aquele|aquela|aqueles|aquelas|naquele|naquela)\b/.test(normalized) || returnToTopic
  const hasNakedPronoun = !explicitType && /\b(?:ele|ela|eles|elas|nele|nela|neles|nelas|dele|dela|deles|delas)\b/.test(normalized)
  const hasPluralPronoun = /\b(?:eles|elas|neles|nelas|deles|delas)\b/.test(normalized)
  if (hasNakedPronoun && selectionSet && selectionSet.items.length > 1) {
    const activeInSet = snapshot.activeEntities[selectionSet.type]
    const selected = !hasPluralPronoun && activeInSet && selectionSet.items.some((item) => item.entity.id === activeInSet.id)
      ? activeInSet
      : null
    if (selected) return { entity: selected, selectionSet, ambiguous: [], reason: "active_selection_entity" }
    return { entity: null, selectionSet, ambiguous: selectionSet.items.map((item) => item.entity).slice(0, 4), reason: "ambiguous_selection_reference" }
  }
  if (hasNakedPronoun) {
    const salientActiveEntity = snapshot.recentEntities.find((entity) => snapshot.activeEntities[entity.type]?.id === entity.id)
    if (salientActiveEntity) {
      return { entity: salientActiveEntity, selectionSet, ambiguous: [], reason: "salient_active_entity" }
    }
  }
  const contextualType = explicitType ?? (hasReference || returnToTopic ? topic?.entityType ?? null : null)
  if (contextualType && snapshot.activeEntities[contextualType]) {
    return { entity: snapshot.activeEntities[contextualType] ?? null, selectionSet, ambiguous: [], reason: "active_entity" }
  }

  if (hasReference) {
    const salientEntities = snapshot.recentEntities
      .filter((entity, index, all) => all.findIndex((candidate) => candidate.id === entity.id) === index)
      .filter((entity) => !contextualType || entity.type === contextualType)
    if (selectionSet && selectionSet.items.length > 1) {
      const activeInSet = snapshot.activeEntities[selectionSet.type]
      const selected = activeInSet && selectionSet.items.some((item) => item.entity.id === activeInSet.id)
        ? activeInSet
        : null
      if (selected) return { entity: selected, selectionSet, ambiguous: [], reason: "active_selection_entity" }
      return { entity: null, selectionSet, ambiguous: selectionSet.items.map((item) => item.entity).slice(0, 4), reason: "ambiguous_selection_reference" }
    }
    if (salientEntities.length > 0) {
      if (salientEntities.length > 1) {
        return { entity: null, selectionSet, ambiguous: salientEntities.slice(0, 4), reason: "ambiguous_reference" }
      }
      return { entity: salientEntities[0], selectionSet, ambiguous: [], reason: "salient_recent_entity" }
    }
  }

  const pendingReference = pendingEntityReference(snapshot, contextualType ?? topic?.entityType ?? null)
  if (pendingReference) {
    return { entity: pendingReference, selectionSet, ambiguous: [], reason: "pending_entity" }
  }

  const activeEntities = Object.values(snapshot.activeEntities).filter(Boolean) as CosConversationEntityReference[]
  const mentionedTarget = mentionedTargetEntityType(normalized)
  const isContextDependentQuestion = /^(?:e\b|entao\b|ja\b|quanto\b|quantas?\b|por que\b|na verdade\b|antes\b|depois\b)|\b(?:dele|dela|isso|nisso)\b/.test(normalized)
  if (!hasReference && mentionedTarget === "proposal" && isContextDependentQuestion) {
    const relatedEntity = snapshot.activeEntities.lead ?? snapshot.activeEntities.property
    if (relatedEntity) return { entity: relatedEntity, selectionSet, ambiguous: [], reason: "proposal_related_entity" }
  }
  if (!hasReference && /\b(?:marca|marque|agende|agendar)\b/.test(normalized) && snapshot.activeEntities.lead) {
    return { entity: snapshot.activeEntities.lead, selectionSet, ambiguous: [], reason: "agenda_related_lead" }
  }
  const usesImplicitActiveProperty = activeEntities[0]?.type === "property" && /\b(campanha|video|descricao|publicar|catalogo|marketplace)\b/.test(normalized)
  const topicEntity = topic?.entityType ? snapshot.activeEntities[topic.entityType] : null
  if (!hasReference && topicEntity && isContextDependentQuestion && (!mentionedTarget || mentionedTarget === topicEntity.type)) {
    return { entity: topicEntity, selectionSet, ambiguous: [], reason: "topic_entity_question" }
  }
  const salientActiveEntity = snapshot.recentEntities.find((entity) => snapshot.activeEntities[entity.type]?.id === entity.id)
  if (!hasReference && salientActiveEntity && isContextDependentQuestion && (!mentionedTarget || mentionedTarget === salientActiveEntity.type)) {
    return { entity: salientActiveEntity, selectionSet, ambiguous: [], reason: "recent_entity_question" }
  }
  if (!hasReference && activeEntities.length === 1 && (isContextDependentQuestion || usesImplicitActiveProperty) && (!mentionedTarget || mentionedTarget === activeEntities[0].type)) {
    return { entity: activeEntities[0], selectionSet, ambiguous: [], reason: "single_active_entity_context" }
  }

  const isEllipticalContinuation = /^(?:e\b|so\b|com\b|ate\b|antes\b|depois\b|amanha\b|hoje\b)/.test(normalized)
  if (!hasReference && isEllipticalContinuation && topicEntity) {
    return { entity: topicEntity, selectionSet, ambiguous: [], reason: "topic_entity_continuation" }
  }
  if (!hasReference && isEllipticalContinuation) {
    if (activeEntities.length === 1) {
      return { entity: activeEntities[0], selectionSet, ambiguous: [], reason: "active_entity_continuation" }
    }
  }

  if (!hasReference) return { entity: null, selectionSet, ambiguous: [], reason: "no_reference" }
  const candidates = snapshot.recentEntities.filter((entity) => !contextualType || entity.type === contextualType).slice(0, 4)
  if (candidates.length === 1) return { entity: candidates[0], selectionSet, ambiguous: [], reason: "single_recent_entity" }
  return { entity: null, selectionSet, ambiguous: candidates, reason: candidates.length > 1 ? "ambiguous_reference" : "unresolved_reference" }
}

function parseCorrectionValue(message: string) {
  const normalized = normalizeText(message)
  const match = normalized.match(/(?:r\$\s*)?(\d[\d.,]*)(?:\s*(milhao|milhoes|mil|k|mi))?\b/)
  if (!match) return null
  const numeric = Number(match[1].replace(/\./g, "").replace(",", "."))
  if (!Number.isFinite(numeric)) return null
  const multiplier = match[2] === "mil" || match[2] === "k" ? 1_000 : match[2] ? 1_000_000 : 1
  return Math.round(numeric * multiplier * 100)
}

export type CosContextualTurnResolution = {
  requestedAction: AssessorAction | null
  payload: Record<string, unknown>
  workflow: CosWorkflow | null
  reference: CosResolvedConversationReference
  reason: string | null
}

export function resolveCosContextualTurn(input: {
  message: string
  snapshot: CosConversationSnapshot
  activeWorkflow: CosWorkflow | null
}): CosContextualTurnResolution {
  const normalized = normalizeText(input.message)
  const reference = resolveCosConversationReference(input.message, input.snapshot)
  const isCorrection = classifyCosPendingReply(input.message) === "correction" ||
    /^(na verdade\s+|corrige para\s+|muda para\s+|troca para\s+|quis dizer\s+)/.test(normalized)
  if (isCorrection && input.activeWorkflow?.pendingInput) {
    const activePending = input.activeWorkflow.pendingInput
    const hasCurrencyCue = /\b(?:preco|valor|mil|milhao|milhoes|mi)\b|r\$/.test(normalized)
    const isCurrencyField = activePending.type === "currency" ||
      /(?:price|preco|valor|amount)/i.test(activePending.field) ||
      hasCurrencyCue ||
      (getCosSnapshotActionDomain(activePending.action) === "proposal" && /\d/.test(normalized))
    const value = isCurrencyField ? parseCorrectionValue(input.message) : null
    const fieldCorrection = activePending.type !== "confirmation" && value === null
      ? { [activePending.field]: input.message.trim() }
      : {}
    const pendingInput = {
      ...activePending,
      parsedData: {
        ...activePending.parsedData,
        ...(value !== null ? { price: value, correctedValue: value } : {}),
        ...fieldCorrection,
      },
    }
    return {
      requestedAction: pendingInput.action,
      payload: value !== null ? { price: value } : fieldCorrection,
      workflow: { ...input.activeWorkflow, pendingInput },
      reference,
      reason: "active_workflow_correction",
    }
  }

  const activeLead = reference.entity?.type === "lead" ? reference.entity : input.snapshot.activeEntities.lead
  const hasContactValue = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input.message) || input.message.replace(/\D/g, "").length >= 10
  const contactQuestion = /\?\s*$/.test(input.message) || /^(?:qual|quais|quem|que|o que|onde)\b/.test(normalized)
  if (!input.activeWorkflow && activeLead && hasContactValue && !contactQuestion) {
    return {
      requestedAction: "UPDATE_LEAD",
      payload: { leadId: activeLead.id },
      workflow: null,
      reference,
      reason: "active_lead_contact_followup",
    }
  }

  if (reference.entity && !input.activeWorkflow) {
    const action: Partial<Record<CosConversationEntityType, AssessorAction>> = {
      property: "GET_PROPERTY" as AssessorAction,
      lead: "FIND_LEAD",
      contract: "GET_CONTRACT",
      proposal: "LIST_PROPOSALS",
      agenda: "LIST_AGENDA_EVENTS",
    }
    const idKey: Record<CosConversationEntityType, string> = {
      property: "propertyId",
      lead: "leadId",
      proposal: "documentId",
      contract: "contractId",
      agenda: "agendaEventId",
    }
    return {
      requestedAction: action[reference.entity.type] ?? null,
      payload: { [idKey[reference.entity.type]]: reference.entity.id },
      workflow: null,
      reference,
      reason: reference.reason,
    }
  }

  return { requestedAction: null, payload: {}, workflow: input.activeWorkflow, reference, reason: null }
}
