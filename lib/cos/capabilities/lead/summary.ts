import { LeadStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const leadSummaryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const [leadTotal, leadNew, contacted, negotiating, won, lost] = await Promise.all([
    prisma.lead.count({ where: { brokerId } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.NEW } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.CONTACTED } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.NEGOTIATING } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.LOST } }),
  ])
  const inProgress = contacted + negotiating

  return {
    response: `Seus leads:\n\n• Total: ${leadTotal}\n• Novos: ${leadNew}\n• Em atendimento: ${inProgress}\n• Convertidos: ${won}\n• Perdidos: ${lost}`,
    metadata: { total: leadTotal, newLeads: leadNew, inProgress, won, lost },
  }
}
