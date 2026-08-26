import "server-only"

import type { Prisma } from "@prisma/client"
import { addDays, endOfDay, startOfDay, subDays } from "date-fns"

import { agendaCard, clientCard, documentCard, propertyCard } from "@/lib/cos-launch/cards"
import type {
  CosLaunchAction,
  CosLaunchCard,
  CosLaunchOption,
  CosLaunchResponse,
} from "@/lib/cos-launch/types"
import { prisma } from "@/lib/prisma"
import { assessCatalogReadiness } from "@/lib/property-publication-readiness"

const propertySelect = {
  id: true,
  title: true,
  city: true,
  neighborhood: true,
  price: true,
  bedrooms: true,
  bathrooms: true,
  parkingSpots: true,
  status: true,
  imageUrls: true,
  legalData: true,
} as const

const clientSelect = {
  id: true,
  name: true,
  phone: true,
  whatsapp: true,
  source: true,
  status: true,
  property: { select: { title: true } },
} as const

const documentSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  lead: { select: { name: true } },
  property: { select: { title: true } },
} as const

const agendaSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  date: true,
  time: true,
  lead: { select: { name: true } },
  property: { select: { title: true } },
} as const

const propertyFilters: Record<string, { label: string; where: Prisma.PropertyWhereInput }> = {
  sale: { label: "À venda", where: { purpose: "SALE" } },
  rent: { label: "Para aluguel", where: { purpose: "RENT" } },
  "rental-active": {
    label: "Locações ativas",
    where: { rentals: { some: { status: "ACTIVE" } } },
  },
  apartments: { label: "Apartamentos", where: { type: "APARTMENT" } },
  houses: { label: "Casas", where: { type: "HOUSE" } },
  commercial: {
    label: "Comerciais",
    where: { type: { in: ["COMMERCIAL", "OFFICE", "STORE"] } },
  },
  land: { label: "Terrenos", where: { type: "LAND" } },
  published: {
    label: "Publicados",
    where: { OR: [{ published: true }, { status: "PUBLISHED" }] },
  },
  drafts: { label: "Rascunhos", where: { status: "DRAFT" } },
}

const clientStatusFilters: Record<string, { label: string; where: Prisma.LeadWhereInput }> = {
  new: { label: "Novo interessado", where: { status: "NEW" } },
  contacted: { label: "Em atendimento", where: { status: "CONTACTED" } },
  negotiating: { label: "Em negociação", where: { status: "NEGOTIATING" } },
  won: { label: "Vendido", where: { status: "WON" } },
  lost: { label: "Perdido", where: { status: "LOST" } },
}

const documentSignals = {
  contract: ["contract", "contrato"],
  proposal: ["proposal", "proposta"],
} as const

function documentKindWhere(kind: "contract" | "proposal"): Prisma.BrokerDocumentWhereInput {
  return {
    OR: documentSignals[kind].map((signal) => ({
      type: { contains: signal, mode: "insensitive" },
    })),
  }
}

const nonPrimaryDocumentWhere: Prisma.BrokerDocumentWhereInput = {
  NOT: [...documentSignals.contract, ...documentSignals.proposal].map((signal) => ({
    type: { contains: signal, mode: "insensitive" },
  })),
}

type ClientSourceCategory = "catalog" | "marketplace" | "cos" | "manual"

function sourceCategory(value: string | null): ClientSourceCategory {
  const normalized = value?.toLowerCase() ?? ""
  if (normalized.includes("marketplace")) return "marketplace"
  if (normalized.includes("catalog")) return "catalog"
  if (normalized.includes("cos") || normalized.includes("assessor")) return "cos"
  return "manual"
}

function sourceWhere(category: string): Prisma.LeadWhereInput | null {
  if (category === "marketplace") {
    return { source: { contains: "marketplace", mode: "insensitive" } }
  }
  if (category === "catalog") {
    return { source: { contains: "catalog", mode: "insensitive" } }
  }
  if (category === "cos") {
    return {
      OR: [
        { source: { contains: "cos", mode: "insensitive" } },
        { source: { contains: "assessor", mode: "insensitive" } },
      ],
    }
  }
  if (category === "manual") {
    return {
      NOT: [
        { source: { contains: "marketplace", mode: "insensitive" } },
        { source: { contains: "catalog", mode: "insensitive" } },
        { source: { contains: "cos", mode: "insensitive" } },
        { source: { contains: "assessor", mode: "insensitive" } },
      ],
    }
  }
  return null
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Rascunhos",
    pending: "Pendentes",
    sent: "Enviados",
    signed: "Assinados",
    accepted: "Aceitas",
    approved: "Aprovadas",
    rejected: "Recusadas",
    cancelled: "Cancelados",
    canceled: "Cancelados",
    completed: "Concluídos",
    active: "Ativos",
    open: "Abertos",
  }
  const normalized = value.trim().toLowerCase()
  return labels[normalized] ?? normalized.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase())
}

function action(id: string, label: string, href?: string): CosLaunchAction {
  return href ? { id, label, href } : { id, label }
}

function decodeActionSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function filteredListMessage(noun: string, total: number, shown: number) {
  if (total === 0) return `Nenhum ${noun} foi encontrado neste filtro.`
  if (total === shown) return `Encontrei ${total} ${noun}.`
  return `Encontrei ${total} ${noun}. Mostrando os ${shown} mais recentes.`
}

export async function listPropertyCards(
  brokerId: string,
  where: Prisma.PropertyWhereInput = {},
  take = 6,
): Promise<CosLaunchCard[]> {
  return (
    await prisma.property.findMany({
      where: { ...where, brokerId },
      orderBy: { updatedAt: "desc" },
      take,
      select: propertySelect,
    })
  ).map(propertyCard)
}

export async function listClientCards(
  brokerId: string,
  where: Prisma.LeadWhereInput = {},
  take = 6,
): Promise<CosLaunchCard[]> {
  return (
    await prisma.lead.findMany({
      where: { ...where, brokerId },
      orderBy: { updatedAt: "desc" },
      take,
      select: clientSelect,
    })
  ).map(clientCard)
}

export async function listDocumentCards(
  brokerId: string,
  kind?: "contract" | "proposal",
  extraWhere: Prisma.BrokerDocumentWhereInput = {},
  take = 6,
): Promise<CosLaunchCard[]> {
  const constraints = [extraWhere]
  if (kind) constraints.unshift(documentKindWhere(kind))

  return (
    await prisma.brokerDocument.findMany({
      where: { brokerId, AND: constraints },
      orderBy: { updatedAt: "desc" },
      take,
      select: documentSelect,
    })
  ).map(documentCard)
}

export async function listTodayAgendaCards(brokerId: string): Promise<CosLaunchCard[]> {
  const now = new Date()
  return listAgendaCards(brokerId, {
    date: { gte: startOfDay(now), lte: endOfDay(now) },
  })
}

async function listAgendaCards(
  brokerId: string,
  where: Prisma.AgendaEventWhereInput = {},
  take = 8,
) {
  return (
    await prisma.agendaEvent.findMany({
      where: { ...where, brokerId },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take,
      select: agendaSelect,
    })
  ).map(agendaCard)
}

export async function getPropertyCard(brokerId: string, id: string) {
  const record = await prisma.property.findFirst({
    where: { id, brokerId },
    select: propertySelect,
  })
  return record ? propertyCard(record) : null
}

export async function getClientCard(brokerId: string, id: string) {
  const record = await prisma.lead.findFirst({
    where: { id, brokerId },
    select: clientSelect,
  })
  return record ? clientCard(record) : null
}

export async function getDocumentCard(brokerId: string, id: string) {
  const record = await prisma.brokerDocument.findFirst({
    where: { id, brokerId },
    select: documentSelect,
  })
  return record ? documentCard(record) : null
}

export async function getAgendaCard(brokerId: string, id: string) {
  const record = await prisma.agendaEvent.findFirst({
    where: { id, brokerId },
    select: agendaSelect,
  })
  return record ? agendaCard(record) : null
}

export async function getFormOptions(
  brokerId: string,
): Promise<{ clients: CosLaunchOption[]; properties: CosLaunchOption[] }> {
  const [clients, properties] = await Promise.all([
    prisma.lead.findMany({
      where: { brokerId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, name: true, phone: true, whatsapp: true },
    }),
    prisma.property.findMany({
      where: { brokerId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true, title: true, city: true, neighborhood: true },
    }),
  ])
  return {
    clients: clients.map((client) => ({
      id: client.id,
      label: client.name?.trim() || "Cliente sem nome",
      subtitle: client.whatsapp ?? client.phone ?? undefined,
    })),
    properties: properties.map((property) => ({
      id: property.id,
      label: property.title,
      subtitle: [property.neighborhood, property.city].filter(Boolean).join(", ") || undefined,
    })),
  }
}

async function propertySummary(brokerId: string): Promise<CosLaunchResponse> {
  const entries = Object.entries(propertyFilters)
  const [total, ...counts] = await Promise.all([
    prisma.property.count({ where: { brokerId } }),
    ...entries.map(([, filter]) =>
      prisma.property.count({ where: { brokerId, ...filter.where } }),
    ),
  ])

  return {
    message: `Encontrei ${total} ${total === 1 ? "imóvel" : "imóveis"} na sua carteira. O que você quer ver?`,
    actions: entries
      .map(([id, filter], index) => ({
        id,
        label: filter.label,
        count: counts[index] ?? 0,
      }))
      .filter((item) => item.count > 0)
      .map((item) => action(`query:properties:${item.id}`, `${item.label} ${item.count}`)),
  }
}

async function propertyFiltered(brokerId: string, filterId: string): Promise<CosLaunchResponse> {
  const filter = propertyFilters[filterId]
  if (!filter) return propertySummary(brokerId)
  const [total, cards] = await Promise.all([
    prisma.property.count({ where: { brokerId, ...filter.where } }),
    listPropertyCards(brokerId, filter.where),
  ])
  return {
    message: filteredListMessage(
      total === 1 ? "imóvel" : "imóveis",
      total,
      cards.length,
    ),
    cards,
    actions: [action("query:properties", "Trocar filtro")],
  }
}

async function clientSummary(brokerId: string): Promise<CosLaunchResponse> {
  const [total, statusGroups, sourceGroups] = await Promise.all([
    prisma.lead.count({ where: { brokerId } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { brokerId },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { brokerId },
      _count: { _all: true },
    }),
  ])
  const statusCounts = new Map(
    statusGroups.map((group) => [group.status.toLowerCase(), group._count._all]),
  )
  const sourceCounts = { catalog: 0, marketplace: 0, cos: 0, manual: 0 }
  sourceGroups.forEach((group) => {
    sourceCounts[sourceCategory(group.source)] += group._count._all
  })

  const statusActions = Object.entries(clientStatusFilters)
    .map(([id, filter]) => ({
      id: `query:clients:status:${id}`,
      label: filter.label,
      count: statusCounts.get(id) ?? 0,
    }))
  const originActions = [
    { id: "catalog", label: "Catálogo", count: sourceCounts.catalog },
    { id: "marketplace", label: "Marketplace", count: sourceCounts.marketplace },
    { id: "cos", label: "COS", count: sourceCounts.cos },
    { id: "manual", label: "Manual", count: sourceCounts.manual },
  ].map((item) => ({
    ...item,
    id: `query:clients:source:${item.id}`,
  }))

  return {
    message: `Você tem ${total} cliente${total === 1 ? "" : "s"}. Como deseja refinar?`,
    actions: [...statusActions, ...originActions]
      .filter((item) => item.count > 0)
      .map((item) => action(item.id, `${item.label} ${item.count}`)),
  }
}

async function clientsFiltered(
  brokerId: string,
  mode: string,
  value: string,
): Promise<CosLaunchResponse> {
  let where: Prisma.LeadWhereInput | null = null
  if (mode === "status") {
    const filter = clientStatusFilters[value]
    if (filter) where = filter.where
  }
  if (mode === "source") where = sourceWhere(value)
  if (!where) return clientSummary(brokerId)

  const [total, cards] = await Promise.all([
    prisma.lead.count({ where: { brokerId, ...where } }),
    listClientCards(brokerId, where),
  ])
  return {
    message: filteredListMessage(
      total === 1 ? "cliente" : "clientes",
      total,
      cards.length,
    ),
    cards,
    actions: [action("query:clients", "Trocar filtro")],
  }
}

async function documentsSummary(brokerId: string): Promise<CosLaunchResponse> {
  const categories: Array<{
    id: string
    label: string
    where: Prisma.BrokerDocumentWhereInput
  }> = [
    { id: "contracts", label: "Contratos", where: documentKindWhere("contract") },
    { id: "proposals", label: "Propostas", where: documentKindWhere("proposal") },
    {
      id: "clients",
      label: "Documentos de clientes",
      where: { AND: [nonPrimaryDocumentWhere, { leadId: { not: null } }] },
    },
    {
      id: "others",
      label: "Outros",
      where: { AND: [nonPrimaryDocumentWhere, { leadId: null }] },
    },
  ]
  const [total, ...counts] = await Promise.all([
    prisma.brokerDocument.count({ where: { brokerId } }),
    ...categories.map((category) =>
      prisma.brokerDocument.count({ where: { brokerId, AND: [category.where] } }),
    ),
  ])

  return {
    message: `Você tem ${total} documento${total === 1 ? "" : "s"}. Qual grupo deseja consultar?`,
    actions: categories
      .map((category, index) => ({ ...category, count: counts[index] ?? 0 }))
      .filter((category) => category.count > 0)
      .map((category) =>
        action(`query:documents:${category.id}`, `${category.label} ${category.count}`),
      ),
  }
}

async function documentsFiltered(brokerId: string, categoryId: string): Promise<CosLaunchResponse> {
  if (categoryId === "contracts") return documentDomainSummary(brokerId, "contract")
  if (categoryId === "proposals") return documentDomainSummary(brokerId, "proposal")

  const where =
    categoryId === "clients"
      ? { AND: [nonPrimaryDocumentWhere, { leadId: { not: null } }] }
      : categoryId === "others"
        ? { AND: [nonPrimaryDocumentWhere, { leadId: null }] }
        : null
  if (!where) return documentsSummary(brokerId)

  const [total, cards] = await Promise.all([
    prisma.brokerDocument.count({ where: { brokerId, AND: [where] } }),
    listDocumentCards(brokerId, undefined, where),
  ])
  return {
    message: filteredListMessage(
      total === 1 ? "documento" : "documentos",
      total,
      cards.length,
    ),
    cards,
    actions: [action("query:documents", "Trocar grupo")],
  }
}

async function documentDomainSummary(
  brokerId: string,
  kind: "contract" | "proposal",
): Promise<CosLaunchResponse> {
  const where = documentKindWhere(kind)
  const [total, statusGroups] = await Promise.all([
    prisma.brokerDocument.count({ where: { brokerId, AND: [where] } }),
    prisma.brokerDocument.groupBy({
      by: ["status"],
      where: { brokerId, AND: [where] },
      _count: { _all: true },
    }),
  ])
  const singular = kind === "contract" ? "contrato" : "proposta"
  const plural = kind === "contract" ? "contratos" : "propostas"

  return {
    message: `Você tem ${total} ${total === 1 ? singular : plural}. Qual status deseja ver?`,
    actions: statusGroups
      .filter((group) => group._count._all > 0)
      .map((group) =>
        action(
          `query:${plural}:status:${encodeURIComponent(group.status)}`,
          `${statusLabel(group.status)} ${group._count._all}`,
        ),
      ),
  }
}

async function documentDomainFiltered(
  brokerId: string,
  kind: "contract" | "proposal",
  status: string,
): Promise<CosLaunchResponse> {
  const where = { status }
  const kindWhere = documentKindWhere(kind)
  const [total, cards] = await Promise.all([
    prisma.brokerDocument.count({ where: { brokerId, AND: [kindWhere, where] } }),
    listDocumentCards(brokerId, kind, where),
  ])
  const plural = kind === "contract" ? "contratos" : "propostas"
  const singular = kind === "contract" ? "contrato" : "proposta"
  return {
    message: filteredListMessage(total === 1 ? singular : plural, total, cards.length),
    cards,
    actions: [action(`query:${plural}`, "Trocar status")],
  }
}

async function agendaSummary(brokerId: string): Promise<CosLaunchResponse> {
  const today = new Date()
  const todayWhere = { date: { gte: startOfDay(today), lte: endOfDay(today) } }
  const nextWeekWhere = {
    date: { gte: startOfDay(today), lte: endOfDay(addDays(today, 7)) },
  }
  const [total, todayCount, nextWeekCount, statusGroups, typeGroups] = await Promise.all([
    prisma.agendaEvent.count({ where: { brokerId } }),
    prisma.agendaEvent.count({ where: { brokerId, ...todayWhere } }),
    prisma.agendaEvent.count({ where: { brokerId, ...nextWeekWhere } }),
    prisma.agendaEvent.groupBy({
      by: ["status"],
      where: { brokerId },
      _count: { _all: true },
    }),
    prisma.agendaEvent.groupBy({
      by: ["type"],
      where: { brokerId },
      _count: { _all: true },
    }),
  ])
  const periodActions = [
    { id: "today", label: "Hoje", count: todayCount },
    { id: "next-7", label: "Próximos 7 dias", count: nextWeekCount },
  ]
  const refiners = [
    ...periodActions.map((item) => ({
      id: `query:agenda:period:${item.id}`,
      label: item.label,
      count: item.count,
    })),
    ...statusGroups.slice(0, 3).map((group) => ({
      id: `query:agenda:status:${encodeURIComponent(group.status)}`,
      label: statusLabel(group.status),
      count: group._count._all,
    })),
    ...typeGroups
      .sort((first, second) => second._count._all - first._count._all)
      .slice(0, 3)
      .map((group) => ({
        id: `query:agenda:type:${encodeURIComponent(group.type)}`,
        label: group.type.replace(/_/g, " "),
        count: group._count._all,
      })),
  ]

  return {
    message: `Você tem ${total} compromisso${total === 1 ? "" : "s"} na agenda. O que deseja ver?`,
    actions: refiners
      .filter((item) => item.count > 0)
      .map((item) => action(item.id, `${item.label} ${item.count}`)),
  }
}

async function agendaFiltered(
  brokerId: string,
  mode: string,
  value: string,
): Promise<CosLaunchResponse> {
  const today = new Date()
  let where: Prisma.AgendaEventWhereInput | null = null
  if (mode === "period" && value === "today") {
    where = { date: { gte: startOfDay(today), lte: endOfDay(today) } }
  }
  if (mode === "period" && value === "next-7") {
    where = { date: { gte: startOfDay(today), lte: endOfDay(addDays(today, 7)) } }
  }
  if (mode === "status") where = { status: decodeActionSegment(value) }
  if (mode === "type") where = { type: decodeActionSegment(value) }
  if (!where) return agendaSummary(brokerId)

  const [total, cards] = await Promise.all([
    prisma.agendaEvent.count({ where: { brokerId, ...where } }),
    listAgendaCards(brokerId, where),
  ])
  return {
    message: filteredListMessage(
      total === 1 ? "compromisso" : "compromissos",
      total,
      cards.length,
    ),
    cards,
    actions: [action("query:agenda", "Trocar filtro")],
  }
}

function periodStart(days: number) {
  return startOfDay(subDays(new Date(), Math.max(1, days) - 1))
}

async function performanceMetrics(brokerId: string, days: number) {
  const createdAt = { gte: periodStart(days) }
  const [views, whatsappClicks, leads, published] = await Promise.all([
    prisma.catalogEvent.count({
      where: {
        brokerId,
        createdAt,
        eventType: { in: ["catalog_view", "marketplace_view", "property_view"] },
      },
    }),
    prisma.catalogEvent.count({
      where: { brokerId, createdAt, eventType: "whatsapp_click" },
    }),
    prisma.lead.count({ where: { brokerId, createdAt } }),
    prisma.property.count({
      where: {
        brokerId,
        OR: [{ published: true }, { marketplacePublished: true }, { status: "PUBLISHED" }],
      },
    }),
  ])
  return { views, whatsappClicks, leads, published }
}

async function performanceOverview(brokerId: string, days: number): Promise<CosLaunchResponse> {
  const metrics = await performanceMetrics(brokerId, days)
  return {
    message: `Últimos ${days} dias: ${metrics.views} visualizações, ${metrics.leads} lead${metrics.leads === 1 ? "" : "s"} e ${metrics.whatsappClicks} clique${metrics.whatsappClicks === 1 ? "" : "s"} no WhatsApp. Há ${metrics.published} imóveis publicados.`,
    actions: [
      action(`query:performance:most-viewed:${days}`, "Imóveis mais acessados"),
      action(`query:performance:leads:${days}`, `Leads ${metrics.leads}`),
      action(
        `query:performance:whatsapp:${days}`,
        `WhatsApp ${metrics.whatsappClicks}`,
      ),
      action(`query:performance:views:${days}`, `Visualizações ${metrics.views}`),
      action("query:performance:period:7", "7 dias"),
      action("query:performance:period:30", "30 dias"),
      action("query:performance:period:90", "90 dias"),
    ],
  }
}

async function mostViewedProperties(brokerId: string, days: number): Promise<CosLaunchResponse> {
  const groups = await prisma.catalogEvent.groupBy({
    by: ["propertyId"],
    where: {
      brokerId,
      createdAt: { gte: periodStart(days) },
      eventType: "property_view",
      propertyId: { not: null },
    },
    _count: { _all: true },
  })
  const ranking = groups
    .filter((group): group is typeof group & { propertyId: string } => Boolean(group.propertyId))
    .sort((first, second) => second._count._all - first._count._all)
    .slice(0, 6)
  const properties = await prisma.property.findMany({
    where: { brokerId, id: { in: ranking.map((item) => item.propertyId) } },
    select: propertySelect,
  })
  const byId = new Map(properties.map((property) => [property.id, property]))
  const cards = ranking
    .map((item) => byId.get(item.propertyId))
    .filter((property): property is NonNullable<typeof property> => Boolean(property))
    .map(propertyCard)

  return {
    message: cards.length
      ? `Estes foram os imóveis mais acessados nos últimos ${days} dias.`
      : `Não houve visualizações de imóveis nos últimos ${days} dias.`,
    cards,
    actions: [action(`query:performance:period:${days}`, "Voltar ao resumo")],
  }
}

async function performanceDetail(
  brokerId: string,
  metric: string,
  days: number,
): Promise<CosLaunchResponse> {
  if (metric === "most-viewed") return mostViewedProperties(brokerId, days)
  const metrics = await performanceMetrics(brokerId, days)
  if (metric === "leads") {
    const cards = await listClientCards(brokerId, {
      createdAt: { gte: periodStart(days) },
    })
    return {
      message: `Você recebeu ${metrics.leads} lead${metrics.leads === 1 ? "" : "s"} nos últimos ${days} dias.`,
      cards,
      actions: [action(`query:performance:period:${days}`, "Voltar ao resumo")],
    }
  }
  const value = metric === "whatsapp" ? metrics.whatsappClicks : metrics.views
  const label = metric === "whatsapp" ? "cliques no WhatsApp" : "visualizações"
  return {
    message: `Foram registrados ${value} ${label} nos últimos ${days} dias.`,
    actions: [action(`query:performance:period:${days}`, "Voltar ao resumo")],
  }
}

async function catalogSnapshot(brokerId: string) {
  const [broker, properties, published, views, leads] = await Promise.all([
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: { catalogSlug: true, creciValidationStatus: true },
    }),
    prisma.property.findMany({
      where: { brokerId },
      select: { id: true, title: true, price: true, city: true },
    }),
    prisma.property.count({
      where: { brokerId, OR: [{ published: true }, { status: "PUBLISHED" }] },
    }),
    prisma.catalogEvent.count({
      where: {
        brokerId,
        source: "catalog",
        eventType: { in: ["catalog_view", "property_view"] },
      },
    }),
    prisma.lead.count({
      where: { brokerId, source: { contains: "catalog", mode: "insensitive" } },
    }),
  ])
  const pendingIds = broker
    ? properties
        .filter(
          (property) =>
            !assessCatalogReadiness({
              ...property,
              broker: { creciValidationStatus: broker.creciValidationStatus },
            }).ready,
        )
        .map((property) => property.id)
    : []

  return {
    slug: broker?.catalogSlug ?? "",
    total: properties.length,
    published,
    views,
    leads,
    pendingIds,
  }
}

async function catalogSummary(brokerId: string): Promise<CosLaunchResponse> {
  const snapshot = await catalogSnapshot(brokerId)
  const actions = [
    action("query:catalog:published", `Publicados ${snapshot.published}`),
    action("query:catalog:views", `Visualizações ${snapshot.views}`),
    action("query:catalog:leads", `Leads ${snapshot.leads}`),
    action("query:catalog:pending", `Pendências ${snapshot.pendingIds.length}`),
  ]
  if (snapshot.slug) {
    actions.push(
      action(
        "query:catalog:open",
        "Abrir catálogo",
        `/catalogo/${encodeURIComponent(snapshot.slug)}`,
      ),
    )
  }
  return {
    message: `Seu Catálogo reúne ${snapshot.total} imóveis, com ${snapshot.published} publicados, ${snapshot.views} visualizações e ${snapshot.leads} leads registrados.`,
    actions,
  }
}

async function catalogDetail(brokerId: string, detail: string): Promise<CosLaunchResponse> {
  const snapshot = await catalogSnapshot(brokerId)
  if (detail === "published") {
    const cards = await listPropertyCards(brokerId, {
      OR: [{ published: true }, { status: "PUBLISHED" }],
    })
    return {
      message: filteredListMessage(
        snapshot.published === 1 ? "imóvel publicado" : "imóveis publicados",
        snapshot.published,
        cards.length,
      ),
      cards,
      actions: [action("query:catalog", "Voltar ao resumo")],
    }
  }
  if (detail === "pending") {
    const cards = snapshot.pendingIds.length
      ? await listPropertyCards(brokerId, { id: { in: snapshot.pendingIds } })
      : []
    return {
      message: snapshot.pendingIds.length
        ? `${snapshot.pendingIds.length} ${snapshot.pendingIds.length === 1 ? "imóvel possui" : "imóveis possuem"} pendências para publicação no Catálogo.`
        : "Nenhum imóvel possui pendências básicas para publicação no Catálogo.",
      cards,
      actions: [action("query:catalog", "Voltar ao resumo")],
    }
  }
  const value = detail === "leads" ? snapshot.leads : snapshot.views
  const label = detail === "leads" ? "leads recebidos pelo Catálogo" : "visualizações no Catálogo"
  return {
    message: `Foram registrados ${value} ${label}.`,
    actions: [action("query:catalog", "Voltar ao resumo")],
  }
}

async function marketplaceSnapshot(brokerId: string) {
  const [published, leads, conversations, openConversations, reviews, pendingReviews, views, pending] =
    await Promise.all([
      prisma.property.count({ where: { brokerId, marketplacePublished: true } }),
      prisma.lead.count({
        where: { brokerId, source: { contains: "marketplace", mode: "insensitive" } },
      }),
      prisma.marketplaceConversation.count({ where: { brokerId } }),
      prisma.marketplaceConversation.count({ where: { brokerId, status: "OPEN" } }),
      prisma.marketplaceReview.count({ where: { brokerId } }),
      prisma.marketplaceReview.count({ where: { brokerId, status: "PENDING_REVIEW" } }),
      prisma.catalogEvent.count({
        where: {
          brokerId,
          source: "marketplace",
          eventType: { in: ["marketplace_view", "property_view"] },
        },
      }),
      prisma.property.count({ where: { brokerId, marketplacePublished: false } }),
    ])
  return {
    published,
    leads,
    conversations,
    openConversations,
    reviews,
    pendingReviews,
    views,
    pending,
  }
}

async function marketplaceSummary(brokerId: string): Promise<CosLaunchResponse> {
  const snapshot = await marketplaceSnapshot(brokerId)
  return {
    message: `No Marketplace você tem ${snapshot.published} imóveis publicados, ${snapshot.leads} leads, ${snapshot.conversations} conversas e ${snapshot.reviews} avaliações.`,
    actions: [
      action("query:marketplace:published", `Publicados ${snapshot.published}`),
      action("query:marketplace:leads", `Leads ${snapshot.leads}`),
      action("query:marketplace:conversations", `Conversas ${snapshot.conversations}`),
      action("query:marketplace:reviews", `Avaliações ${snapshot.reviews}`),
      action("query:marketplace:performance", `Visualizações ${snapshot.views}`),
      action("query:marketplace:pending", `Pendências ${snapshot.pending}`),
      action("query:marketplace:open", "Abrir Marketplace", "/corretor/marketplace"),
    ],
  }
}

async function marketplaceDetail(
  brokerId: string,
  detail: string,
): Promise<CosLaunchResponse> {
  const snapshot = await marketplaceSnapshot(brokerId)
  if (detail === "published" || detail === "pending") {
    const total = detail === "published" ? snapshot.published : snapshot.pending
    const cards = await listPropertyCards(brokerId, {
      marketplacePublished: detail === "published",
    })
    return {
      message: filteredListMessage(
        total === 1 ? "imóvel" : "imóveis",
        total,
        cards.length,
      ),
      cards,
      actions: [action("query:marketplace", "Voltar ao resumo")],
    }
  }
  if (detail === "leads") {
    const cards = await listClientCards(brokerId, {
      source: { contains: "marketplace", mode: "insensitive" },
    })
    return {
      message: filteredListMessage(
        snapshot.leads === 1 ? "lead" : "leads",
        snapshot.leads,
        cards.length,
      ),
      cards,
      actions: [action("query:marketplace", "Voltar ao resumo")],
    }
  }
  if (detail === "conversations") {
    return {
      message: `Você tem ${snapshot.conversations} conversa${snapshot.conversations === 1 ? "" : "s"} no Marketplace, sendo ${snapshot.openConversations} em atendimento.`,
      actions: [
        action("query:marketplace:open", "Abrir conversas", "/corretor/marketplace"),
        action("query:marketplace", "Voltar ao resumo"),
      ],
    }
  }
  if (detail === "reviews") {
    return {
      message: `Você tem ${snapshot.reviews} ${snapshot.reviews === 1 ? "avaliação" : "avaliações"}, com ${snapshot.pendingReviews} pendente${snapshot.pendingReviews === 1 ? "" : "s"} de análise.`,
      actions: [
        action("query:marketplace:open", "Abrir avaliações", "/corretor/marketplace"),
        action("query:marketplace", "Voltar ao resumo"),
      ],
    }
  }
  return {
    message: `O Marketplace registrou ${snapshot.views} visualizações e ${snapshot.leads} leads.`,
    actions: [action("query:marketplace", "Voltar ao resumo")],
  }
}

export async function routeGuidedCosLaunchQuery(
  actionId: string,
  brokerId: string,
): Promise<CosLaunchResponse | null> {
  if (actionId === "query:properties") return propertySummary(brokerId)
  if (actionId.startsWith("query:properties:")) {
    return propertyFiltered(brokerId, actionId.slice("query:properties:".length))
  }

  if (actionId === "query:clients") return clientSummary(brokerId)
  if (actionId.startsWith("query:clients:")) {
    const [, , mode, value] = actionId.split(":")
    return clientsFiltered(brokerId, mode, value)
  }

  if (actionId === "query:documents") return documentsSummary(brokerId)
  if (actionId.startsWith("query:documents:")) {
    return documentsFiltered(brokerId, actionId.slice("query:documents:".length))
  }

  if (actionId === "query:proposals") return documentDomainSummary(brokerId, "proposal")
  if (actionId.startsWith("query:proposals:status:")) {
    return documentDomainFiltered(
      brokerId,
      "proposal",
      decodeActionSegment(actionId.slice("query:proposals:status:".length)),
    )
  }

  if (actionId === "query:contracts") return documentDomainSummary(brokerId, "contract")
  if (actionId.startsWith("query:contracts:status:")) {
    return documentDomainFiltered(
      brokerId,
      "contract",
      decodeActionSegment(actionId.slice("query:contracts:status:".length)),
    )
  }

  if (actionId === "query:agenda") return agendaSummary(brokerId)
  if (actionId.startsWith("query:agenda:")) {
    const [, , mode, value] = actionId.split(":")
    return agendaFiltered(brokerId, mode, value)
  }

  if (actionId === "query:performance") return performanceOverview(brokerId, 30)
  if (actionId.startsWith("query:performance:period:")) {
    const days = Number(actionId.slice("query:performance:period:".length))
    return performanceOverview(brokerId, [7, 30, 90].includes(days) ? days : 30)
  }
  if (actionId.startsWith("query:performance:")) {
    const [, , metric, rawDays] = actionId.split(":")
    const days = Number(rawDays)
    return performanceDetail(brokerId, metric, [7, 30, 90].includes(days) ? days : 30)
  }

  if (actionId === "query:catalog") return catalogSummary(brokerId)
  if (actionId.startsWith("query:catalog:")) {
    return catalogDetail(brokerId, actionId.slice("query:catalog:".length))
  }

  if (actionId === "query:marketplace") return marketplaceSummary(brokerId)
  if (actionId.startsWith("query:marketplace:")) {
    return marketplaceDetail(brokerId, actionId.slice("query:marketplace:".length))
  }

  return null
}
