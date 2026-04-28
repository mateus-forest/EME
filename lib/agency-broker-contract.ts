import type { Broker, BrokerAccountStatus, Property, User } from "@prisma/client"

import { formatCurrencyFromCents, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"

type BrokerWithRelations = Broker & {
  user: User
  properties: (Property & {
    _count?: {
      leads?: number
    }
  })[]
}

export type AgencyBrokerPropertyItem = {
  id: string
  title: string
  location: string
  price: string
  status: "Publicado" | "Rascunho" | "Pausado"
  image: string
}

export type AgencyBrokerApiItem = {
  id: string
  userId: string
  initials: string
  name: string
  creci: string
  email: string
  whatsApp: string
  catalogLink: string
  properties: number
  views: string
  clicks: string
  leads: number
  status: "Ativo" | "Inativo" | "Pendente"
  highlight: string
  actionLabel: string
  secondaryAction: string
  recentProperties: AgencyBrokerPropertyItem[]
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CR"
}

function mapBrokerStatus(status: BrokerAccountStatus): AgencyBrokerApiItem["status"] {
  if (status === "INACTIVE") return "Inativo"
  if (status === "PENDING") return "Pendente"
  return "Ativo"
}

function buildActionLabel(status: AgencyBrokerApiItem["status"]) {
  return status === "Ativo" ? "Desativar corretor" : "Ativar corretor"
}

function buildSecondaryAction(status: AgencyBrokerApiItem["status"]) {
  return status === "Pendente" ? "Reenviar convite" : "Redefinir acesso"
}

export function serializeAgencyBroker(
  broker: BrokerWithRelations,
  options?: { highlight?: string; origin?: string },
): AgencyBrokerApiItem {
  const status = mapBrokerStatus(broker.status)
  const totalViews = broker.properties.reduce((sum, property) => sum + property.viewsCount, 0)
  const totalLeads = broker.properties.reduce((sum, property) => sum + (property._count?.leads ?? property.leadsCount), 0)
  const recentProperties = [...broker.properties]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 3)
    .map((property) => {
      const images = Array.isArray(property.imageUrls)
        ? property.imageUrls.filter((image): image is string => typeof image === "string")
        : []

      return {
        id: property.id,
        title: property.title,
        location: [property.neighborhood, property.city].filter(Boolean).join(", "),
        price: formatCurrencyFromCents(property.price),
        status: propertyStatusLabel(property.status),
        image: images[0] ?? "",
      }
    })

  const origin = options?.origin?.replace(/\/$/, "") ?? ""

  return {
    id: broker.id,
    userId: broker.userId,
    initials: getInitials(broker.user.name),
    name: broker.user.name,
    creci: broker.creci ?? "",
    email: broker.user.email,
    whatsApp: broker.phone,
    catalogLink: `${origin}/catalogo/${broker.catalogSlug}`,
    properties: broker.properties.length,
    views: totalViews.toLocaleString("pt-BR"),
    clicks: "0",
    leads: totalLeads,
    status,
    highlight: options?.highlight ?? "",
    actionLabel: buildActionLabel(status),
    secondaryAction: buildSecondaryAction(status),
    recentProperties,
  }
}

export function buildAgencyBrokerHighlight(items: AgencyBrokerApiItem[]) {
  const sorted = [...items].sort((a, b) => b.leads - a.leads)
  const leader = sorted[0]

  return items.map((item) => ({
    ...item,
    highlight: leader && leader.id === item.id && item.leads > 0 ? "Melhor desempenho" : "",
  }))
}
