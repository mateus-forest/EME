import { generateAssessorText, type AssessorAction } from "@/lib/eme-backend"

import type { CosCapabilityDefinition } from "@/lib/cos/types"

export async function formatCosCapabilityResponse(input: {
  message: string
  action: AssessorAction
  capability: CosCapabilityDefinition
  actionResponse: string
}) {
  if (input.capability.responseMode === "raw") {
    return input.actionResponse
  }

  return generateAssessorText(input.message, input.action, input.actionResponse)
}
