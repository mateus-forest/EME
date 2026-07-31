import "server-only"

import { LeadStatus, PropertyStatus } from "@/lib/prisma-enums"

import { getBrokerWorkspaceSummary, getEntityIdFromPayload, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import { formatAssessorPropertyPrice } from "@/lib/eme-backend"
import { prisma } from "@/lib/prisma"

import type { CosCapabilityHandler } from "@/lib/cos/types"

function sumEventCount(events: Array<{ eventType: string; _count: { _all: number } }>, eventTypes: string[]) {
  return events.reduce((sum, event) => sum + (eventTypes.includes(event.eventType) ? event._count._all : 0), 0)
}

function estimateCommissionTotal(totalPortfolioValue: number, commissionPercent: number) {
  return Math.round(totalPortfolioValue * (commissionPercent / 100))
}

export const financeReceivableCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const published = summary.properties.filter((item) => item.published || item.status === PropertyStatus.PUBLISHED)
  const totalPublishedValue = published.reduce((sum, item) => sum + Math.max(0, item.price), 0)
  const commissionPercent = summary.broker?.financialConfig?.commissionPercent ?? 6
  const estimatedReceivable = estimateCommissionTotal(totalPublishedValue, commissionPercent)

  return {
    response: `Recebíveis previstos:\n\n- Imóveis publicados: ${published.length}\n- Carteira publicada: ${formatAssessorPropertyPrice(totalPublishedValue)}\n- Comissão potencial: ${formatAssessorPropertyPrice(estimatedReceivable)}`,
    metadata: {
      publishedProperties: published.length,
      totalPublishedValue,
      estimatedReceivable,
      commissionPercent,
    },
  }
}

export const financePayableCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const pendingContracts = summary.contracts.filter((item) => item.status === "awaiting_signature").length
  const payableEstimate = pendingContracts * 15000

  return {
    response: `Contas a pagar conhecidas:\n\n- Contratos em andamento: ${pendingContracts}\n- Provisão operacional estimada: ${formatAssessorPropertyPrice(payableEstimate)}\n- Observação: ainda não há um contas a pagar estruturado, então a leitura usa os compromissos contratuais conhecidos.`,
    metadata: {
      pendingContracts,
      payableEstimate,
      source: "operational-estimate",
    },
  }
}

export const financeForecastCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const activeLeads = summary.leads.filter((lead) => lead.status === LeadStatus.CONTACTED || lead.status === LeadStatus.NEGOTIATING).length
  const activeProperties = summary.properties.filter((item) => item.published || item.status === PropertyStatus.PUBLISHED)
  const commissionPercent = summary.broker?.financialConfig?.commissionPercent ?? 6
  const totalPublishedValue = activeProperties.reduce((sum, item) => sum + Math.max(0, item.price), 0)
  const projectedRevenue = Math.round(estimateCommissionTotal(totalPublishedValue, commissionPercent) * Math.min(1, activeLeads / Math.max(1, activeProperties.length)))

  return {
    response: `Previsão financeira:\n\n- Leads em andamento: ${activeLeads}\n- Imóveis ativos: ${activeProperties.length}\n- Receita potencial projetada: ${formatAssessorPropertyPrice(projectedRevenue)}`,
    metadata: {
      activeLeads,
      activeProperties: activeProperties.length,
      projectedRevenue,
      commissionPercent,
    },
  }
}

export const financeCommissionCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const commissionPercent = summary.broker?.financialConfig?.commissionPercent ?? 6
  const totalPortfolioValue = summary.properties.reduce((sum, item) => sum + Math.max(0, item.price), 0)
  const commissionEstimate = estimateCommissionTotal(totalPortfolioValue, commissionPercent)

  return {
    response: `Comissão prevista da carteira:\n\n- Percentual de referência: ${commissionPercent}%\n- Volume em carteira: ${formatAssessorPropertyPrice(totalPortfolioValue)}\n- Comissão potencial: ${formatAssessorPropertyPrice(commissionEstimate)}`,
    metadata: {
      commissionPercent,
      totalPortfolioValue,
      commissionEstimate,
    },
  }
}

export const financeCashflowCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const summary = await getBrokerWorkspaceSummary(brokerId)
  const publishedValue = summary.properties
    .filter((item) => item.published || item.status === PropertyStatus.PUBLISHED)
    .reduce((sum, item) => sum + Math.max(0, item.price), 0)
  const commissionPercent = summary.broker?.financialConfig?.commissionPercent ?? 6
  const inflow = estimateCommissionTotal(publishedValue, commissionPercent)
  const outflow = summary.contracts.filter((item) => item.status === "draft").length * 7000

  return {
    response: `Fluxo de caixa operacional:\n\n- Entradas potenciais: ${formatAssessorPropertyPrice(inflow)}\n- Saídas estimadas: ${formatAssessorPropertyPrice(outflow)}\n- Saldo operacional: ${formatAssessorPropertyPrice(inflow - outflow)}`,
    metadata: {
      inflow,
      outflow,
      balance: inflow - outflow,
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

