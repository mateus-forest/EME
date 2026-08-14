import type { AssessorAction } from "@/lib/eme-backend"
import type {
  CosCapabilityDomain,
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

export function getCosSnapshotActionDomain(action: AssessorAction | null): CosCapabilityDomain {
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
  if (action.includes("DOCUMENT")) return "document"
  return "general"
}

function domainEntityType(domain: CosCapabilityDomain): CosConversationEntityType | null {
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
      const entity = makeEntity({ type: "lead", id: message.leadId, label: null, source: "message", confidence: 0.95, evidence: `message:${message.id}`, lastMentionedAt: message.createdAt }, nowIso)
      activeEntities.lead = entity
      recentEntities = upsertRecentEntity(recentEntities, entity)
    }
    if (message.propertyId) {
      const entity = makeEntity({ type: "property", id: message.propertyId, label: null, source: "message", confidence: 0.95, evidence: `message:${message.id}`, lastMentionedAt: message.createdAt }, nowIso)
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
      const entities = uniqueIds.map((id) => makeEntity({
        type,
        id,
        label: typeof options.find((option) => option.id === id)?.label === "string"
          ? options.find((option) => option.id === id)?.label as string
          : null,
        source: "message",
        confidence: 0.9,
        evidence: `message_metadata:${message.id}`,
        lastMentionedAt: message.createdAt,
      }, nowIso))
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
  if (!input.result) return snapshot

  const activeEntities = { ...snapshot.activeEntities }
  let recentEntities = [...snapshot.recentEntities]
  let currentTopic = snapshot.currentTopic
  let recentTopics = [...snapshot.recentTopics]
  let selectionSets = [...snapshot.selectionSets]
  let lastExecution: CosConversationExecutionReference | null = null

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

    const ids = entityIdsFromResult(type, step.result)
    const pendingInput = step.result.status === "awaiting_input" ? step.result.pendingInput : null
    const selectionSet = type ? buildSelectionSet({ type, ids, pendingInput, message: input.message, topicId: topic.id, now }) : null
    if (selectionSet) {
      topic.selectionSetId = selectionSet.id
      selectionSets = [selectionSet, ...selectionSets.filter((set) => set.id !== selectionSet.id)].slice(0, COS_SELECTION_SET_LIMIT)
    }

    const entities = ids.slice(0, 20).map((id, index) => makeEntity({
      type: type as CosConversationEntityType,
      id,
      label: selectionSet?.items[index]?.entity.label ?? null,
      source: "execution",
      confidence: 1,
      evidence: `${step.capabilityId}:${step.status}`,
    }, nowIso))
    if (type && entities.length === 1) activeEntities[type] = entities[0]
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
    lastExecution,
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

function mentionedEntityType(message: string): CosConversationEntityType | null {
  if (/\b(imovel|imoveis|apartamento|casa|terreno)\b/.test(message)) return "property"
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

export function resolveCosConversationReference(message: string, snapshot: CosConversationSnapshot): CosResolvedConversationReference {
  const normalized = normalizeText(message)
  const explicitType = mentionedEntityType(normalized)
  const returnToTopic = /\b(voltando|volta|retomando|de volta)\b/.test(normalized)
  const topic = returnToTopic
    ? [snapshot.currentTopic, ...snapshot.recentTopics].find((item) => item && (!explicitType || item.entityType === explicitType)) ?? null
    : snapshot.currentTopic
  const type = explicitType ?? topic?.entityType ?? null
  const ordinal = findOrdinal(normalized)
  const selectionSet = [
    ...(topic?.selectionSetId ? snapshot.selectionSets.filter((set) => set.id === topic.selectionSetId) : []),
    ...snapshot.selectionSets,
  ].find((set, index, all) => all.findIndex((candidate) => candidate.id === set.id) === index && (!type || set.type === type)) ?? null

  if (ordinal !== null && selectionSet) {
    const index = ordinal < 0 ? selectionSet.items.length + ordinal : ordinal
    return {
      entity: selectionSet.items[index]?.entity ?? null,
      selectionSet,
      ambiguous: [],
      reason: selectionSet.items[index] ? "selection_ordinal" : "selection_ordinal_out_of_range",
    }
  }

  const hasReference = /\b(ele|ela|dele|dela|esse|essa|este|esta|aquele|aquela)\b/.test(normalized) || returnToTopic
  if (!hasReference) return { entity: null, selectionSet, ambiguous: [], reason: "no_reference" }
  if (type && snapshot.activeEntities[type]) {
    return { entity: snapshot.activeEntities[type] ?? null, selectionSet, ambiguous: [], reason: "active_entity" }
  }

  const candidates = snapshot.recentEntities.filter((entity) => !type || entity.type === type).slice(0, 4)
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
  const isCorrection = /^(nao\s+|na verdade\s+|corrige para\s+|muda para\s+|troca para\s+|quis dizer\s+)/.test(normalized)
  if (isCorrection && input.activeWorkflow?.pendingInput) {
    const value = parseCorrectionValue(input.message)
    const pendingInput = {
      ...input.activeWorkflow.pendingInput,
      parsedData: {
        ...input.activeWorkflow.pendingInput.parsedData,
        ...(value !== null ? { price: value, correctedValue: value } : {}),
      },
    }
    return {
      requestedAction: pendingInput.action,
      payload: value !== null ? { price: value } : {},
      workflow: { ...input.activeWorkflow, pendingInput },
      reference,
      reason: "active_workflow_correction",
    }
  }

  const activeLead = reference.entity?.type === "lead" ? reference.entity : input.snapshot.activeEntities.lead
  const hasContactValue = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input.message) || input.message.replace(/\D/g, "").length >= 10
  if (!input.activeWorkflow && activeLead && hasContactValue) {
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
