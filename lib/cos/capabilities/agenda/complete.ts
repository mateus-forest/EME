import { prisma } from "@/lib/prisma"
import { resolveAgendaEntity } from "@/lib/cos/entity-resolver"
import { createCosSuccessResult } from "@/lib/cos/action-result"
import { requiredSelectionResponse } from "@/lib/cos/capabilities/shared"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const completeAgendaCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const resolution = await resolveAgendaEntity({
    brokerId,
    payload: (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>,
  })
  const event = resolution.record

  if (!event) {
    return requiredSelectionResponse("compromisso", "agendaEventId", { resultsCount: 0 }, {
      action: "MARK_AGENDA_DONE",
      entity: "agenda",
      capabilityId: "agenda.complete",
    })
  }

  await prisma.agendaEvent.update({ where: { id: event.id }, data: { status: "done" } })

  return createCosSuccessResult({
    response: "Compromisso marcado como feito ✅",
    metadata: { agendaEventId: event.id, parsedData: { title: event.title }, status: "done" },
  })
}
