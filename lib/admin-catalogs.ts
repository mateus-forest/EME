import "server-only"

import { prisma } from "@/lib/prisma"
import type { AdminCatalogRow, AdminCatalogsReport } from "@/lib/admin-catalogs-contract"

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export async function getAdminCatalogsReport(): Promise<AdminCatalogsReport> {
  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const [brokers, events, catalogLeads] = await Promise.all([
    prisma.broker.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        properties: { select: { published: true, updatedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.catalogEvent.findMany({
      where: { brokerId: { not: null } },
      select: { brokerId: true, eventType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { source: { contains: "catalog", mode: "insensitive" } },
      select: { brokerId: true },
    }),
  ])

  const eventsByBroker = new Map<string, typeof events>()
  events.forEach((event) => {
    if (!event.brokerId) return
    const current = eventsByBroker.get(event.brokerId) ?? []
    current.push(event)
    eventsByBroker.set(event.brokerId, current)
  })
  const leadsByBroker = new Map<string, number>()
  catalogLeads.forEach((lead) => leadsByBroker.set(lead.brokerId, (leadsByBroker.get(lead.brokerId) ?? 0) + 1))

  const catalogs: AdminCatalogRow[] = brokers.map((broker) => {
    const brokerEvents = eventsByBroker.get(broker.id) ?? []
    const views = brokerEvents.filter((event) => ["catalog_view", "profile_view"].includes(event.eventType)).length
    const shareEvents = brokerEvents.filter((event) => ["catalog_share", "share"].includes(event.eventType))
    const contacts = leadsByBroker.get(broker.id) ?? 0
    const publishedProperties = broker.properties.filter((property) => property.published).length
    const latestPropertyUpdate = broker.properties.map((property) => property.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0]
    const latestEvent = brokerEvents[0]?.createdAt
    const updatedAt = [latestPropertyUpdate, latestEvent, broker.createdAt].filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0]
    const issue = broker.creciValidationStatus !== "VERIFIED"
      ? "CRECI não verificado"
      : publishedProperties === 0
        ? "Sem imóveis publicados"
        : null
    const status: AdminCatalogRow["status"] = broker.status === "INACTIVE" ? "Inativo" : issue ? "Atenção" : "Ativo"
    return {
      brokerId: broker.id,
      userId: broker.user.id,
      brokerName: broker.user.name,
      brokerEmail: broker.user.email,
      slug: broker.catalogSlug,
      publicPath: `/catalogo/${broker.catalogSlug}`,
      status,
      creci: [broker.creciState, broker.creciOfficialRegistration || broker.creciNumber].filter(Boolean).join(" / ") || "Não informado",
      creciStatus: broker.creciValidationStatus,
      publishedProperties,
      views,
      contacts,
      shares: shareEvents.length ? shareEvents.length : null,
      conversion: views > 0 ? Number(((contacts / views) * 100).toFixed(2)) : null,
      updatedAt: updatedAt.toISOString(),
      issue,
    }
  })

  const growthMap = new Map<string, number>()
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date(since)
    date.setDate(date.getDate() + offset)
    growthMap.set(dayKey(date), 0)
  }
  events.filter((event) => event.createdAt >= since && ["catalog_view", "profile_view"].includes(event.eventType)).forEach((event) => {
    const key = dayKey(event.createdAt)
    growthMap.set(key, (growthMap.get(key) ?? 0) + 1)
  })

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      total: catalogs.length,
      active: catalogs.filter((catalog) => catalog.status === "Ativo").length,
      inactive: catalogs.filter((catalog) => catalog.status === "Inativo").length,
      attention: catalogs.filter((catalog) => catalog.status === "Atenção").length,
      views: catalogs.reduce((sum, catalog) => sum + catalog.views, 0),
      contacts: catalogs.reduce((sum, catalog) => sum + catalog.contacts, 0),
      shares: catalogs.some((catalog) => catalog.shares !== null) ? catalogs.reduce((sum, catalog) => sum + (catalog.shares ?? 0), 0) : null,
    },
    catalogs,
    topAccessed: [...catalogs].sort((a, b) => b.views - a.views).slice(0, 8),
    topConversion: [...catalogs].filter((catalog) => catalog.conversion !== null).sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0)).slice(0, 8),
    growth: [...growthMap.entries()].map(([date, value]) => ({ label: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value })),
    coverage: [
      { domain: "Clientes, imóveis e propostas", status: "Coberto", detail: "Admin consulta quantidades, vínculos, estados e listas operacionais reais." },
      { domain: "Catálogo e Marketplace", status: "Coberto", detail: "Publicação, readiness, acessos, leads e conversas estão disponíveis no Admin." },
      { domain: "Studio IA e providers", status: "Coberto", detail: "Campanhas, assets e telemetria por provider/modelo estão consolidados." },
      { domain: "Compartilhamentos do Catálogo", status: "Parcial", detail: "Só é contabilizado quando o evento de compartilhamento foi persistido; ausência não é tratada como zero real." },
      { domain: "Custos de providers", status: "Parcial", detail: "Operações sem costBrl/costUsd permanecem identificadas como custo não registrado." },
      { domain: "Agenda e documentos sensíveis", status: "Parcial", detail: "Contagens operacionais estão disponíveis; conteúdo integral permanece restrito por necessidade administrativa." },
    ],
  }
}
