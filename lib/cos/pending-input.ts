import type { Prisma } from "@prisma/client"

import type {
  CosRuntimeActionResult,
  CosCapabilityId,
  CosDialogueAct,
  CosEntityModuleId,
  CosPendingInput,
  CosPendingInputOption,
  CosPendingInputType,
  CosWorkflowStatus,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

export const COS_PENDING_INPUT_SCHEMA_VERSION = 2 as const
export const COS_PENDING_INPUT_TTL_MS = 24 * 60 * 60 * 1000

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function parsePendingInputType(field: string): CosPendingInputType {
  if (field === "phone") return "phone"
  if (field === "price") return "currency"
  if (field === "time") return "time"
  if (field === "lead" || field === "property" || field === "propertyChoice" || field === "campaignId") return "selection"
  if (field === "confirmation") return "confirmation"
  return "text"
}

function parsePendingInputLabel(field: string, action: string) {
  if (field === "name") return "Nome"
  if (field === "phone") return "Telefone"
  if (field === "price") return action === "createPropertyDraft" ? "Preço do imóvel" : "Preço"
  if (field === "time") return "Horário"
  if (field === "lead") return "Cliente"
  if (field === "propertyChoice" || field === "property") return "Imóvel"
  if (field === "campaignId") return "Campanha"
  if (field === "confirmation") return "Confirmação"
  return field
}

function parseOptions(value: unknown): CosPendingInputOption[] | undefined {
  if (!Array.isArray(value)) return undefined
  const options = value
    .map((item) => asRecord(item))
    .filter((item) => typeof item.id === "string" && typeof item.label === "string")
    .map((item) => ({
      id: item.id as string,
      label: item.label as string,
      description: typeof item.description === "string" ? item.description : undefined,
    }))
  return options.length > 0 ? options : undefined
}

export function createPendingInput(input: {
  field: string
  action: AssessorAction
  entity: CosEntityModuleId
  parsedData?: Record<string, unknown>
  label?: string
  type?: CosPendingInputType
  options?: CosPendingInputOption[]
  capabilityId?: CosCapabilityId
  source?: CosPendingInput["source"]
  reason?: string
  now?: Date
}): CosPendingInput {
  const now = input.now ?? new Date()
  return {
    schemaVersion: COS_PENDING_INPUT_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + COS_PENDING_INPUT_TTL_MS).toISOString(),
    source: input.source ?? "handler",
    reason: input.reason ?? `missing_${input.field}`,
    capabilityId: input.capabilityId,
    field: input.field,
    label: input.label ?? parsePendingInputLabel(input.field, input.action),
    type: input.type ?? parsePendingInputType(input.field),
    required: true,
    entity: input.entity,
    action: input.action,
    parsedData: input.parsedData ?? {},
    options: input.options,
  }
}

export function createPendingInputMetadata(input: {
  field: string
  action: AssessorAction
  entity: CosEntityModuleId
  parsedData?: Record<string, unknown>
  options?: CosPendingInputOption[]
  label?: string
  type?: CosPendingInputType
  noCharge?: boolean
  extra?: Record<string, unknown>
  capabilityId?: CosCapabilityId
  source?: CosPendingInput["source"]
  reason?: string
}): Prisma.InputJsonObject {
  const pendingInput = createPendingInput({
    field: input.field,
    action: input.action,
    entity: input.entity,
    parsedData: input.parsedData,
    options: input.options,
    label: input.label,
    type: input.type,
    capabilityId: input.capabilityId,
    source: input.source,
    reason: input.reason,
  })

  return {
    noCharge: input.noCharge ?? true,
    parsedData: pendingInput.parsedData,
    pendingInput,
    ...(input.extra ?? {}),
  } as Prisma.InputJsonObject
}

export function extractPendingInputFromMetadata(input: {
  metadata: Prisma.InputJsonObject | null | undefined
  action: AssessorAction
  entity: CosEntityModuleId
}): CosPendingInput | null {
  const metadata = asRecord(input.metadata)
  const explicit = asRecord(metadata.pendingInput)
  if (typeof explicit.field === "string") {
    return normalizeCosPendingInput({
      pendingInput: explicit,
      fallbackAction: input.action,
      fallbackEntity: input.entity,
    })
  }
  return null
}

export function normalizeCosPendingInput(input: {
  pendingInput: unknown
  fallbackAction: AssessorAction
  fallbackEntity: CosEntityModuleId
  now?: Date
}): CosPendingInput | null {
  const explicit = asRecord(input.pendingInput)
  if (typeof explicit.field !== "string") return null

  const normalized = createPendingInput({
      field: explicit.field,
      action: (typeof explicit.action === "string" ? explicit.action : input.fallbackAction) as AssessorAction,
      entity: (typeof explicit.entity === "string" ? explicit.entity : input.fallbackEntity) as CosEntityModuleId,
      parsedData: asRecord(explicit.parsedData),
      label: typeof explicit.label === "string" ? explicit.label : undefined,
      type: typeof explicit.type === "string" ? (explicit.type as CosPendingInputType) : undefined,
      options: parseOptions(explicit.options),
      capabilityId: typeof explicit.capabilityId === "string" ? explicit.capabilityId as CosCapabilityId : undefined,
      source: explicit.schemaVersion === COS_PENDING_INPUT_SCHEMA_VERSION ? explicit.source as CosPendingInput["source"] : "legacy_adapter",
      reason: typeof explicit.reason === "string" ? explicit.reason : undefined,
      now: input.now,
    })

  if (explicit.schemaVersion === COS_PENDING_INPUT_SCHEMA_VERSION) {
    normalized.createdAt = typeof explicit.createdAt === "string" ? explicit.createdAt : normalized.createdAt
    normalized.expiresAt = typeof explicit.expiresAt === "string" ? explicit.expiresAt : normalized.expiresAt
  }

  return normalized
}

export function isAwaitingInputResult(result: CosRuntimeActionResult) {
  return result.status === "awaiting_input"
}

export function isCosPendingInputExpired(pendingInput: CosPendingInput, now = new Date()) {
  if (!pendingInput.expiresAt) return false
  const expiresAt = Date.parse(pendingInput.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime()
}

export function buildCosPendingResumePayload(input: {
  pendingInput: CosPendingInput | null
  message: string
  payload?: Record<string, unknown>
}) {
  const payload: Record<string, unknown> = { ...(input.payload ?? {}) }
  const pendingInput = input.pendingInput
  if (!pendingInput) return payload

  if (pendingInput.type === "confirmation") {
    Object.assign(payload, pendingInput.parsedData)
    payload.confirmation = input.message.trim()
    return payload
  }

  if (pendingInput.type === "selection") payload.selection = input.message.trim()

  if (pendingInput.action === "createLead") {
    if (pendingInput.field === "name") {
      payload.name = input.message.trim()
    } else if (pendingInput.field === "phone") {
      payload.phone = input.message.trim()
      const extractedName = typeof pendingInput.parsedData.extractedName === "string" ? pendingInput.parsedData.extractedName : ""
      if (extractedName) payload.name = extractedName
    }
  }

  if (pendingInput.action === "createPropertyDraft" && pendingInput.field === "price") {
    payload.price = input.message.trim()
    const preservedDraftFields = ["city", "neighborhood", "bedrooms", "bathrooms", "parkingSpots", "area"]
    for (const field of preservedDraftFields) {
      if (pendingInput.parsedData[field] !== undefined) payload[field] = pendingInput.parsedData[field]
    }
  }

  if (pendingInput.type === "text" || pendingInput.type === "currency" || pendingInput.type === "time") {
    payload[pendingInput.field] = input.message.trim()
  }

  return payload
}

export type CosPendingReplyKind = "confirm" | "reject" | "cancel" | "correction" | "answer"

export function classifyCosPendingReply(message: string): CosPendingReplyKind {
  if (/^\s*n[aã]o\s*[,;:]\s*(?:deixa|cancelar|cancela|esquece)\b/i.test(message)) return "reject"
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (/^(?:sim|s|ok|pode|pode fazer|pode seguir|seguir|confirmo|confirmar|pode confirmar|confirma|vai|manda bala|beleza|ta|ta bom|esta bem|fechado|combinado|(?:ta|beleza) (?:pode )?(?:fazer|seguir))$/.test(normalized)) {
    return "confirm"
  }
  if (/^nao\s+(?:cancelar|cancela|deixa|esquece)\b/.test(normalized)) return "answer"
  if (/^(?:cancelar|cancela|deixa|deixa pra la|deixa para la|deixa pra depois|deixa para depois|deixa (?:a|o) .+ (?:pra|para) depois|esquece)$/.test(normalized)) return "cancel"
  if (/^nao\s+(?:so\s+)?(?:queria|quero|preciso|era|foi)\b/.test(normalized)) return "reject"
  if (/^(nao|n)$/.test(normalized)) return "reject"
  if (/^(nao\s+(?!(?:so\s+)?(?:queria|quero|preciso|era|foi)\b)|na verdade\s+|corrige para\s+|muda para\s+|troca para\s+|quis dizer\s+)/.test(normalized)) {
    return "correction"
  }
  return "answer"
}

export function hasCosPendingRejectionFollowUp(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return /^nao\s+so\s+(?:queria|quero)\s+/.test(normalized) &&
    /\b(?:ver|mostrar|consultar|abrir|cadastro|status|detalhes?)\b/.test(normalized)
}

export function shouldPreserveCosPendingWorkflow(input: {
  hasActiveWorkflow: boolean
  workflowDecision: "none" | "continue_workflow" | "start_new"
  dialogueAct: CosDialogueAct
  actionMutatesData: boolean
  rejectionStartsNewAction: boolean
  explicitlyDefersActiveWorkflow: boolean
}) {
  return input.hasActiveWorkflow &&
    input.workflowDecision === "start_new" &&
    ["query", "explain", "capability_question", "context", "switch_topic", "return_topic"].includes(input.dialogueAct) &&
    !input.actionMutatesData &&
    !input.rejectionStartsNewAction &&
    !input.explicitlyDefersActiveWorkflow
}

export function normalizeWorkflowStatus(status: CosWorkflowStatus): Exclude<CosWorkflowStatus, "running"> {
  if (status === "running") return "processing"
  return status
}
