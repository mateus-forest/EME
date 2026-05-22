import type { Agency, Broker, Property } from "@/lib/prisma-model-types"
import {
  PropertyStatus,
  PropertyType } from "@/lib/prisma-enums"
import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"

type PropertyContractUser = {
  name: string
}

type PropertyWithRelations = Property & {
  broker: Broker & {
    user: PropertyContractUser
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
  type: "Apartamento" | "Casa" | "Comercial" | "Terreno" | "Sala comercial" | "Loja" | "Cobertura"
  purpose: "Venda" | "Locação"
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
  return formatCurrencyBRLFromCents(value)
}

export function parsePriceInput(value: unknown) {
  return parseCurrencyInputToCents(value)
}

export function mapPropertyType(value: unknown): PropertyType | null {
  if (value === "Casa" || value === "HOUSE") return "HOUSE"
  if (value === "Comercial" || value === "COMMERCIAL") return "COMMERCIAL"
  if (value === "Terreno" || value === "LAND") return "LAND"
  if (value === "Sala comercial" || value === "OFFICE") return "OFFICE"
  if (value === "Loja" || value === "STORE") return "STORE"
  if (value === "Cobertura" || value === "PENTHOUSE") return "PENTHOUSE"
  if (value === "Apartamento" || value === "APARTMENT") return "APARTMENT"
  return null
}

export function mapPropertyPurpose(value: unknown) {
  if (value === "Locação" || value === "RENT" || value === "rent") return "RENT"
  return "SALE"
}

export function mapPropertyStatus(value: unknown): { status: PropertyStatus; published: boolean } | null {
  if (value === "Publicado" || value === "PUBLISHED") {
    return { status: "PUBLISHED", published: true }
  }

  if (value === "Pausado" || value === "PAUSED") {
    return { status: "PAUSED", published: false }
  }

  if (value === "Rascunho" || value === "DRAFT") {
    return { status: "DRAFT", published: false }
  }

  return null
}

export function propertyTypeLabel(type: PropertyType): PropertyApiItem["type"] {
  if (type === "HOUSE") return "Casa"
  if (type === "COMMERCIAL") return "Comercial"
  if (type === "LAND") return "Terreno"
  if (type === "OFFICE") return "Sala comercial"
  if (type === "STORE") return "Loja"
  if (type === "PENTHOUSE") return "Cobertura"
  return "Apartamento"
}

export function propertyPurposeLabel(purpose?: string | null): PropertyApiItem["purpose"] {
  if (purpose === "RENT") return "Locação"
  return "Venda"
}

export function propertyStatusLabel(status: PropertyStatus): PropertyApiItem["status"] {
  if (status === "PUBLISHED") return "Publicado"
  if (status === "PAUSED") return "Pausado"
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
    purpose: propertyPurposeLabel(property.purpose),
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
