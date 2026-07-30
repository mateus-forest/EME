import { prisma } from "@/lib/prisma"
import { parseFixedAgendaListRange } from "@/lib/eme-backend"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const listAgendaCapability: CosCapabilityHandler = async ({ brokerId, message }) => {
  const range = parseFixedAgendaListRange(message)
  const events = await prisma.agendaEvent.findMany({
    where: {
      brokerId,
      ...(range.pendingOnly ? { status: "pending" } : { date: { gte: range.start, lt: range.end }, status: { not: "cancelled" } }),
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    take: 8,
  })

  return {
    response: events.length
      ? `Sua agenda ${range.label}:\n\n${events.map((event) => `• ${event.time || "Sem horário"} — ${event.title}`).join("\n")}`
      : "Você não tem compromissos nessa data.",
    metadata: { resultsCount: events.length, agendaEventIds: events.map((event) => event.id), parsedData: { range } },
  }
}
