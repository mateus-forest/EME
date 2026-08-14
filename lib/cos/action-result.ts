import type { Prisma } from "@prisma/client"

import { extractPendingInputFromMetadata } from "@/lib/cos/pending-input"
import type {
  CosActionAwaitingInputResult,
  CosActionErrorResult,
  CosRuntimeActionResult,
  CosActionSuccessResult,
  CosCapabilityHandlerResult,
  CosEntityModuleId,
  CosPendingInput,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

type ResultBaseInput = {
  response: string
  metadata?: Prisma.InputJsonObject
  leadId?: string
  propertyId?: string
}

export function createCosSuccessResult(input: ResultBaseInput): CosActionSuccessResult {
  return {
    status: "success",
    response: input.response,
    metadata: input.metadata ?? {},
    leadId: input.leadId,
    propertyId: input.propertyId,
  }
}

export function createCosAwaitingInputResult(input: ResultBaseInput & {
  pendingInput: CosPendingInput
}): CosActionAwaitingInputResult {
  return {
    status: "awaiting_input",
    response: input.response,
    metadata: {
      ...(input.metadata ?? {}),
      pendingInput: input.pendingInput as unknown as Prisma.InputJsonObject,
    },
    pendingInput: input.pendingInput,
    leadId: input.leadId,
    propertyId: input.propertyId,
  }
}

export function createCosErrorResult(input: ResultBaseInput & {
  errorCode: string
}): CosActionErrorResult {
  return {
    status: "error",
    response: input.response,
    errorCode: input.errorCode,
    metadata: input.metadata ?? {},
    leadId: input.leadId,
    propertyId: input.propertyId,
  }
}

/**
 * Único adaptador de compatibilidade para handlers legados. O estado é extraído
 * apenas de metadata estruturada; frases da resposta nunca controlam o runtime.
 */
export function normalizeCosActionResult(input: {
  result: CosCapabilityHandlerResult
  action: AssessorAction
  entity: CosEntityModuleId
}): CosRuntimeActionResult {
  if ("status" in input.result && input.result.status) {
    return input.result as CosRuntimeActionResult
  }

  const pendingInput = extractPendingInputFromMetadata({
    metadata: input.result.metadata,
    action: input.action,
    entity: input.entity,
  })

  if (pendingInput) {
    return createCosAwaitingInputResult({
      ...input.result,
      pendingInput,
    })
  }

  return createCosSuccessResult(input.result)
}
