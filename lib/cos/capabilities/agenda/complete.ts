import { prisma } from "@/lib/prisma"
import { resolveAgendaEntity } from "@/lib/cos/entity-resolver"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const completeAgendaCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const resolution = await resolveAgendaEntity({
    brokerId,
    payload: (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>,
  })
  const event =
    resolution.record ??
    (await prisma.agendaEvent.findFirst({
      where: { brokerId, status: "pending" },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }))

  if (!event) {
    return { response: "Não encontrei compromisso pendente para marcar como feito.", metadata: { resultsCount: 0 } }
  }

  await prisma.agendaEvent.update({ where: { id: event.id }, data: { status: "done" } })

  return {
    response: "Compromisso marcado como feito ✅",
    metadata: { agendaEventId: event.id, parsedData: { title: event.title }, status: "done" },
  }
}
