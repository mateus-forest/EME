import type { Prisma } from "@prisma/client"

import type {
  CosActionResult,
  CosEntityModuleId,
  CosPendingInput,
  CosPendingInputOption,
  CosPendingInputType,
  CosWorkflowStatus,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

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
}): CosPendingInput {
  return {
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
}): Prisma.InputJsonObject {
  const pendingInput = createPendingInput({
    field: input.field,
    action: input.action,
    entity: input.entity,
    parsedData: input.parsedData,
    options: input.options,
    label: input.label,
    type: input.type,
  })

  return {
    required: [input.field],
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
    return createPendingInput({
      field: explicit.field,
      action: (typeof explicit.action === "string" ? explicit.action : input.action) as AssessorAction,
      entity: (typeof explicit.entity === "string" ? explicit.entity : input.entity) as CosEntityModuleId,
      parsedData: asRecord(explicit.parsedData),
      label: typeof explicit.label === "string" ? explicit.label : undefined,
      type: typeof explicit.type === "string" ? (explicit.type as CosPendingInputType) : undefined,
      options: parseOptions(explicit.options),
    })
  }

  const required = Array.isArray(metadata.required) ? metadata.required : []
  const field = typeof required[0] === "string" ? required[0] : ""
  if (!field) return null

  const parsedData = asRecord(metadata.parsedData)
  const fallbackOptions = parseOptions(parsedData.options ?? metadata.options)
  return createPendingInput({
    field,
    action: input.action,
    entity: input.entity,
    parsedData,
    options: fallbackOptions,
  })
}

export function isAwaitingInputResult(result: CosActionResult) {
  if (extractPendingInputFromMetadata({
    metadata: result.metadata,
    action: "general",
    entity: "general",
  })) {
    return true
  }

  return (
    result.response.includes("preciso de confirmacao") ||
    result.response.includes("confirmacao") ||
    result.response.includes("Qual ") ||
    result.response.includes("Pode confirmar")
  )
}

export function normalizeWorkflowStatus(status: CosWorkflowStatus): Exclude<CosWorkflowStatus, "running"> {
  if (status === "running") return "processing"
  return status
}
