import { PropertyStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { buildBrokerContext } from "@/lib/eme-backend"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const analyticsSummaryCapability: CosCapabilityHandler = async ({ brokerId, action }) => {
  const context = await buildBrokerContext(brokerId)
  const views = context.events.reduce((sum, item) => sum + (item.eventType.includes("view") ? item._count._all : 0), 0)
  const whatsappClicks = context.events.reduce((sum, item) => sum + (item.eventType === "whatsapp_click" ? item._count._all : 0), 0)
  const published = context.properties.filter((property) => property.published || property.status === PropertyStatus.PUBLISHED).length
  const searches = await prisma.searchEvent.count({ where: { brokerId } })

  return {
    response:
      action === "getAnalyticsSummary"
        ? `Relatório Analytics:\n\n• Visualizações do catálogo: ${views}\n• Cliques no WhatsApp: ${whatsappClicks}\n• Leads recebidos: ${context.leads.length}\n• Imóveis monitorados: ${context.properties.length}`
        : `Seu catálogo tem ${published} imóveis publicados, ${views} visualizações e ${searches} buscas recentes.`,
    metadata: { properties: context.properties.length, published, leads: context.leads.length, views, whatsappClicks, searches },
  }
}
