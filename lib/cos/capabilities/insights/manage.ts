import "server-only"

import { LeadStatus, PropertyStatus } from "@/lib/prisma-enums"

import { getBrokerFinancialSnapshot, getFinancialDateRange } from "@/lib/broker-finance"
import { getBrokerWorkspaceSummary, getEntityIdFromPayload, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import { formatAssessorPropertyPrice } from "@/lib/eme-backend"
import { prisma } from "@/lib/prisma"

import type { CosCapabilityHandler } from "@/lib/cos/types"

function sumEventCount(events: Array<{ eventType: string; _count: { _all: number } }>, eventTypes: string[]) {
  return events.reduce((sum, event) => sum + (eventTypes.includes(event.eventType) ? event._count._all : 0), 0)
}

export const financeReceivableCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const snapshot = await getBrokerFinancialSnapshot(brokerId)

  return {
    response: `Recebíveis operacionais:\n\n- A receber: ${formatAssessorPropertyPrice(snapshot.summary.receivable)}\n- Atrasado: ${formatAssessorPropertyPrice(snapshot.summary.overdue)}\n- Próximos 7 dias: ${formatAssessorPropertyPrice(snapshot.upcoming.next7Days.reduce((sum, item) => sum + item.amount, 0))}`,
    metadata: {
      receivable: snapshot.summary.receivable,
      overdue: snapshot.summary.overdue,
      next7Days: snapshot.upcoming.next7Days,
    },
  }
}

export const financePayableCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const snapshot = await getBrokerFinancialSnapshot(brokerId)
  const pendingExpenses = snapshot.expenses.filter((item) => item.status === "PENDING")
  const pendingTotal = pendingExpenses.reduce((sum, item) => sum + item.amount, 0)

  return {
    response: `Despesas operacionais:\n\n- Gasto neste mês: ${formatAssessorPropertyPrice(snapshot.summary.expensesThisMonth)}\n- Despesas previstas: ${formatAssessorPropertyPrice(pendingTotal)} (${pendingExpenses.length} lançamentos)`,
    metadata: {
      expensesThisMonth: snapshot.summary.expensesThisMonth,
      pendingExpenses: pendingExpenses.length,
      pendingTotal,
    },
  }
}

export const financeForecastCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const snapshot = await getBrokerFinancialSnapshot(brokerId)
  const next7Days = snapshot.upcoming.next7Days.reduce((sum, item) => sum + item.amount, 0)
  const next30Days = snapshot.upcoming.next30Days.reduce((sum, item) => sum + item.amount, 0)
  const overdue = snapshot.upcoming.overdue.reduce((sum, item) => sum + item.amount, 0)

  return {
    response: `Próximos recebimentos:\n\n- Próximos 7 dias: ${formatAssessorPropertyPrice(next7Days)} (${snapshot.upcoming.next7Days.length})\n- Próximos 30 dias: ${formatAssessorPropertyPrice(next30Days)} (${snapshot.upcoming.next30Days.length})\n- Atrasados: ${formatAssessorPropertyPrice(overdue)} (${snapshot.upcoming.overdue.length})`,
    metadata: {
      next7Days: snapshot.upcoming.next7Days,
      next30Days: snapshot.upcoming.next30Days,
      overdue: snapshot.upcoming.overdue,
    },
  }
}

export const financeCommissionCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const snapshot = await getBrokerFinancialSnapshot(brokerId)
  const { monthStart, monthEnd } = getFinancialDateRange()
  const pending = snapshot.commissions.filter((item) => item.status === "EXPECTED")
  const overdue = snapshot.commissions.filter((item) => item.status === "OVERDUE")
  const receivedThisMonth = snapshot.commissions.filter((item) => {
    if (!item.receivedAt || item.status !== "RECEIVED") return false
    const date = new Date(item.receivedAt)
    return date >= monthStart && date < monthEnd
  })

  return {
    response: `Comissões operacionais:\n\n- Previstas: ${formatAssessorPropertyPrice(pending.reduce((sum, item) => sum + item.commissionAmount, 0))}\n- Atrasadas: ${formatAssessorPropertyPrice(overdue.reduce((sum, item) => sum + item.commissionAmount, 0))} (${overdue.length})\n- Recebidas neste mês: ${formatAssessorPropertyPrice(receivedThisMonth.reduce((sum, item) => sum + item.commissionAmount, 0))}`,
    metadata: {
      pending,
      overdue,
      receivedThisMonth,
    },
  }
}

export const financeCashflowCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const snapshot = await getBrokerFinancialSnapshot(brokerId)

  return {
    response: `Fluxo de caixa operacional deste mês:\n\n- Recebido: ${formatAssessorPropertyPrice(snapshot.summary.receivedThisMonth)}\n- Gasto: ${formatAssessorPropertyPrice(snapshot.summary.expensesThisMonth)}\n- Resultado: ${formatAssessorPropertyPrice(snapshot.summary.monthResult)}\n\nO valor da carteira não entra neste cálculo.`,
    metadata: {
      receivedThisMonth: snapshot.summary.receivedThisMonth,
      expensesThisMonth: snapshot.summary.expensesThisMonth,
      result: snapshot.summary.monthResult,
    },
  }
}

export const analyticsPerformanceCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const views = sumEventCount(summary.events, ["catalog_view", "catalog_open", "property_view"])
  const whatsappClicks = sumEventCount(summary.events, ["whatsapp_click"])
  const leadsWon = summary.leads.filter((lead) => lead.status === LeadStatus.WON).length

  return {
    response: `Performance comercial:\n\n- Visualizações: ${views}\n- Cliques no WhatsApp: ${whatsappClicks}\n- Leads convertidos: ${leadsWon}\n- Imóveis publicados: ${summary.properties.filter((item) => item.published).length}`,
    metadata: {
      views,
      whatsappClicks,
      leadsWon,
    },
  }
}

export const analyticsSalesCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const negotiating = summary.leads.filter((lead) => lead.status === LeadStatus.NEGOTIATING).length
  const won = summary.leads.filter((lead) => lead.status === LeadStatus.WON).length
  const lost = summary.leads.filter((lead) => lead.status === LeadStatus.LOST).length

  return {
    response: `Análise de vendas:\n\n- Em negociação: ${negotiating}\n- Convertidos: ${won}\n- Perdidos: ${lost}`,
    metadata: {
      negotiating,
      won,
      lost,
    },
  }
}

export const analyticsPropertiesCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const published = summary.properties.filter((item) => item.published || item.status === PropertyStatus.PUBLISHED).length
  const drafts = summary.properties.filter((item) => item.status === PropertyStatus.DRAFT).length
  const paused = summary.properties.filter((item) => item.status === PropertyStatus.PAUSED).length

  return {
    response: `Análise de imóveis:\n\n- Publicados: ${published}\n- Rascunhos: ${drafts}\n- Pausados: ${paused}`,
    metadata: {
      published,
      drafts,
      paused,
    },
  }
}

export const analyticsLeadsCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const newLeads = summary.leads.filter((lead) => lead.status === LeadStatus.NEW).length
  const contacted = summary.leads.filter((lead) => lead.status === LeadStatus.CONTACTED).length
  const negotiating = summary.leads.filter((lead) => lead.status === LeadStatus.NEGOTIATING).length

  return {
    response: `Análise de leads:\n\n- Novos: ${newLeads}\n- Em atendimento: ${contacted}\n- Em negociação: ${negotiating}`,
    metadata: {
      newLeads,
      contacted,
      negotiating,
    },
  }
}

export const publishCatalogCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload })
  const propertyId = getEntityIdFromPayload(payloadRecord, "property")
  if (!propertyId) return requiredSelectionResponse("imóvel", "propertyId")

  const property = await prisma.property.findFirst({ where: { id: propertyId, brokerId } })
  if (!property) return requiredSelectionResponse("imóvel", "propertyId")

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      published: true,
      status: PropertyStatus.PUBLISHED,
    },
  })
  const broker = await prisma.broker.findUnique({ where: { id: brokerId }, select: { catalogSlug: true } })

  return {
    response: `Imóvel publicado no catálogo.\n\n${updated.title}\nhttps://www.meueme.com/catalogo/${broker?.catalogSlug ?? ""}`,
    metadata: {
      propertyId: updated.id,
      published: true,
      catalogUrl: broker?.catalogSlug ? `https://www.meueme.com/catalogo/${broker.catalogSlug}` : null,
    },
    propertyId: updated.id,
  }
}

export const unpublishCatalogCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload })
  const propertyId = getEntityIdFromPayload(payloadRecord, "property")
  if (!propertyId) return requiredSelectionResponse("imóvel", "propertyId")

  const property = await prisma.property.findFirst({ where: { id: propertyId, brokerId } })
  if (!property) return requiredSelectionResponse("imóvel", "propertyId")

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      published: false,
      status: PropertyStatus.PAUSED,
    },
  })

  return {
    response: `Imóvel removido do catálogo público.\n\n${updated.title}`,
    metadata: {
      propertyId: updated.id,
      published: false,
    },
    propertyId: updated.id,
  }
}

export const shareCatalogCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const broker = await prisma.broker.findUnique({ where: { id: brokerId }, select: { catalogSlug: true } })
  const url = broker?.catalogSlug ? `https://www.meueme.com/catalogo/${broker.catalogSlug}` : null

  return {
    response: url ? `Link público do catálogo:\n\n${url}` : "Ainda não encontrei um slug público para este catálogo.",
    metadata: {
      catalogUrl: url,
    },
  }
}

export const catalogStatsCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const published = summary.properties.filter((item) => item.published || item.status === PropertyStatus.PUBLISHED).length
  const views = sumEventCount(summary.events, ["catalog_view", "catalog_open", "property_view"])
  const whatsappClicks = sumEventCount(summary.events, ["whatsapp_click"])

  return {
    response: `Estatísticas do catálogo:\n\n- Imóveis publicados: ${published}\n- Visualizações: ${views}\n- Cliques no WhatsApp: ${whatsappClicks}`,
    metadata: {
      published,
      views,
      whatsappClicks,
    },
  }
}
