import { PropertyStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { formatAssessorPropertyPrice } from "@/lib/eme-backend"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const financialSummaryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const properties = await prisma.property.findMany({ where: { brokerId } })
  const total = properties.reduce((sum, property) => sum + Math.max(0, property.price), 0)
  const active = properties.filter((property) => property.published || property.status === PropertyStatus.PUBLISHED).length
  const inactive = properties.length - active
  const average = properties.length ? Math.round(total / properties.length) : 0

  return {
    response: `Resumo financeiro:\n\n• Imóveis cadastrados: ${properties.length}\n• Valor da carteira: ${formatAssessorPropertyPrice(total)}\n• Ticket médio: ${formatAssessorPropertyPrice(average)}\n• Ativos: ${active}\n• Inativos/rascunhos: ${inactive}`,
    metadata: { totalProperties: properties.length, activeProperties: active, inactiveProperties: inactive, averageTicket: average, totalPortfolioValue: total },
  }
}
