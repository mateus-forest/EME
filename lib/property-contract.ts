import { PropertyStatus, PropertyType, type Property, type Broker, type Agency, type User } from "@prisma/client"

type PropertyWithRelations = Property & {
  broker: Broker & {
    user: User
  }
  agency: Agency | null
  _count?: {
    leads?: number
  }
}

export type PropertyApiItem = {
  id: string
  title: string
  description: string
  audioUrl: string
  price: number
  formattedPrice: string
  city: string
  neighborhood: string
  location: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  type: "Apartamento" | "Casa" | "Comercial"
  status: "Publicado" | "Rascunho" | "Pausado"
  published: boolean
  images: string[]
  views: number
  leads: number
  brokerId: string
  agencyId: string | null
  broker: {
    id: string
    name: string
    initials: string
  }
  createdAt: string
  updatedAt: string
}

export function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100)
}

export function parsePriceInput(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }

  if (typeof value !== "string") return null

  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  return Number(digits)
}

export function mapPropertyType(value: unknown) {
  if (value === "Casa" || value === PropertyType.HOUSE) return PropertyType.HOUSE
  if (value === "Comercial" || value === PropertyType.COMMERCIAL) return PropertyType.COMMERCIAL
  if (value === "Apartamento" || value === PropertyType.APARTMENT) return PropertyType.APARTMENT
  return null
}

export function mapPropertyStatus(value: unknown) {
  if (value === "Publicado" || value === PropertyStatus.PUBLISHED) {
    return { status: PropertyStatus.PUBLISHED, published: true }
  }

  if (value === "Pausado" || value === PropertyStatus.PAUSED) {
    return { status: PropertyStatus.PAUSED, published: false }
  }

  if (value === "Rascunho" || value === PropertyStatus.DRAFT) {
    return { status: PropertyStatus.DRAFT, published: false }
  }

  return null
}

export function propertyTypeLabel(type: PropertyType): PropertyApiItem["type"] {
  if (type === PropertyType.HOUSE) return "Casa"
  if (type === PropertyType.COMMERCIAL) return "Comercial"
  return "Apartamento"
}

export function propertyStatusLabel(status: PropertyStatus): PropertyApiItem["status"] {
  if (status === PropertyStatus.PUBLISHED) return "Publicado"
  if (status === PropertyStatus.PAUSED) return "Pausado"
  return "Rascunho"
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function serializeProperty(property: PropertyWithRelations): PropertyApiItem {
  const images = Array.isArray(property.imageUrls)
    ? property.imageUrls.filter((image): image is string => typeof image === "string")
    : []

  const location = [property.neighborhood, property.city].filter(Boolean).join(", ")

  return {
    id: property.id,
    title: property.title,
    description: property.description ?? "",
    audioUrl: property.audioUrl ?? "",
    price: property.price,
    formattedPrice: formatCurrencyFromCents(property.price),
    city: property.city,
    neighborhood: property.neighborhood ?? "",
    location,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parkingSpots: property.parkingSpots,
    type: propertyTypeLabel(property.type),
    status: propertyStatusLabel(property.status),
    published: property.published,
    images,
    views: property.viewsCount,
    leads: property._count?.leads ?? property.leadsCount,
    brokerId: property.brokerId,
    agencyId: property.agencyId,
    broker: {
      id: property.broker.id,
      name: property.broker.user.name,
      initials: getInitials(property.broker.user.name),
    },
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  }
}
