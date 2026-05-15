import { CatalogOwnerType, PropertyStatus } from "@/lib/prisma-enums"

import { getPropertyImage, getPropertyImages } from "@/lib/property-media"
import { formatCurrencyFromCents } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"

export type PublicBrokerCatalogProperty = {
  id: string
  title: string
  location: string
  city: string
  neighborhood: string
  price: string
  priceValue: number
  bedrooms: number
  bathrooms: number
  parking: number
  type: string
  description: string
  images: string[]
  views: number
  interested: number
  brokerId: string
  agencyId: string | null
}

export type PublicBrokerCatalogData = {
  slug: string
  displayName: string
  photoUrl: string
  description: string
  creci: string
  whatsApp: string
  properties: PublicBrokerCatalogProperty[]
  brokerId: string
}

export type PublicAgencyCatalogProperty = {
  id: string
  title: string
  location: string
  city: string
  neighborhood: string
  price: string
  priceValue: number
  bedrooms: number
  bathrooms: number
  parking: number
  type: string
  description: string
  status: "Publicado"
  views: number
  leads: number
  brokerId: string
  agencyId: string | null
  image: string
  images: string[]
  broker: {
    name: string
    initials: string
  }
}

export type PublicAgencyCatalogData = {
  slug: string
  displayName: string
  logoUrl: string
  description: string
  whatsApp: string
  properties: PublicAgencyCatalogProperty[]
  agencyId: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function locationFromProperty(city: string, neighborhood: string | null) {
  return [neighborhood, city].filter(Boolean).join(", ")
}

function propertyTypeLabel(type: string) {
  if (type === "HOUSE") return "Casa"
  if (type === "COMMERCIAL") return "Comercial"
  return "Apartamento"
}

export async function getPublicBrokerCatalogBySlug(slug: string): Promise<PublicBrokerCatalogData | null> {
  const catalog = await prisma.catalog.findFirst({
    where: {
      slug,
      ownerType: CatalogOwnerType.BROKER,
    },
  })

  const broker = await prisma.broker.findFirst({
    where: catalog
      ? { id: catalog.ownerId }
      : {
          catalogSlug: slug,
        },
    include: {
      user: true,
      properties: {
        where: {
          published: true,
          status: PropertyStatus.PUBLISHED,
        },
        include: {
          _count: {
            select: {
              leads: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  if (!broker) {
    return null
  }

  return {
    slug: broker.catalogSlug,
    brokerId: broker.id,
    displayName: broker.user.name,
    photoUrl: broker.user.photoUrl ?? "",
    description: broker.description ?? `Confira os imóveis publicados por ${broker.user.name}.`,
    creci: broker.creci ?? "",
    whatsApp: broker.user.phone ?? broker.phone ?? "",
    properties: broker.properties.map((property) => ({
      id: property.id,
      title: property.title,
      location: locationFromProperty(property.city, property.neighborhood),
      city: property.city,
      neighborhood: property.neighborhood ?? "",
      price: formatCurrencyFromCents(property.price),
      priceValue: property.price,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parking: property.parkingSpots,
      type: propertyTypeLabel(property.type),
      description: property.description ?? "",
      images: getPropertyImages(Array.isArray(property.imageUrls) ? (property.imageUrls as string[]) : [], property.id),
      views: property.viewsCount,
      interested: property._count.leads,
      brokerId: property.brokerId,
      agencyId: property.agencyId,
    })),
  }
}

export async function getPublicAgencyCatalogBySlug(slug: string): Promise<PublicAgencyCatalogData | null> {
  const catalog = await prisma.catalog.findFirst({
    where: {
      slug,
      ownerType: CatalogOwnerType.AGENCY,
    },
  })

  const agency = await prisma.agency.findFirst({
    where: catalog
      ? { id: catalog.ownerId }
      : {
          catalogSlug: slug,
        },
    include: {
      ownerUser: true,
      properties: {
        where: {
          published: true,
          status: PropertyStatus.PUBLISHED,
        },
        include: {
          _count: {
            select: {
              leads: true,
            },
          },
          broker: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  if (!agency) {
    return null
  }

  return {
    slug: agency.catalogSlug,
    agencyId: agency.id,
    displayName: agency.name,
    logoUrl: agency.logoUrl ?? "",
    description: agency.description ?? `Imóveis publicados por ${agency.name}. Atendimento com ${agency.ownerUser.name}.`,
    whatsApp: agency.phone ?? agency.ownerUser.phone ?? "",
    properties: agency.properties.map((property) => ({
      id: property.id,
      title: property.title,
      location: locationFromProperty(property.city, property.neighborhood),
      city: property.city,
      neighborhood: property.neighborhood ?? "",
      price: formatCurrencyFromCents(property.price),
      priceValue: property.price,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parking: property.parkingSpots,
      type: propertyTypeLabel(property.type),
      description: property.description ?? "",
      status: "Publicado",
      views: property.viewsCount,
      leads: property._count.leads,
      brokerId: property.brokerId,
      agencyId: property.agencyId,
      image: getPropertyImage(Array.isArray(property.imageUrls) ? (property.imageUrls[0] as string | undefined) : undefined, property.id),
      images: getPropertyImages(Array.isArray(property.imageUrls) ? (property.imageUrls as string[]) : [], property.id),
      broker: {
        name: property.broker.user.name,
        initials: getInitials(property.broker.user.name),
      },
    })),
  }
}
