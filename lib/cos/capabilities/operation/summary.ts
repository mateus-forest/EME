import { LeadStatus, PropertyStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { addDays, getDateOnly } from "@/lib/eme-backend"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const operationSummaryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const today = getDateOnly(new Date())
  const tomorrow = addDays(today, 1)
  const [draftProperties, upcomingEvents, pastEvents, draftDocuments, todayClicks, newLeads] = await Promise.all([
    prisma.property.count({ where: { brokerId, OR: [{ status: PropertyStatus.DRAFT }, { published: false }] } }),
    prisma.agendaEvent.count({ where: { brokerId, status: "pending", date: { gte: today, lt: addDays(today, 7) } } }),
    prisma.agendaEvent.count({ where: { brokerId, status: "pending", date: { lt: today } } }),
    prisma.brokerDocument.count({ where: { brokerId, status: "draft" } }),
    prisma.catalogEvent.count({ where: { brokerId, eventType: "whatsapp_click", createdAt: { gte: today, lt: tomorrow } } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.NEW } }),
  ])

  return {
    response: `Resumo da operação:\n\n• Imóveis em rascunho: ${draftProperties}\n• Compromissos próximos: ${upcomingEvents}\n• Compromissos atrasados: ${pastEvents}\n• Propostas em rascunho: ${draftDocuments}\n• Cliques do catálogo hoje: ${todayClicks}\n• Leads novos: ${newLeads}`,
    metadata: { draftProperties, upcomingEvents, pastEvents, draftDocuments, todayClicks, newLeads },
  }
}
