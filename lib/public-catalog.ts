import { CatalogOwnerType, PropertyStatus } from "@/lib/prisma-enums"

import { formatCurrencyFromCents } from "@/lib/property-contract"
import { getPropertyImage, getPropertyImages } from "@/lib/property-media"
import { prisma } from "@/lib/prisma"

export type PublicBrokerCatalogProperty = {
  id: string
  publicCode: number | null
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
  purpose: string
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

export type PublicCatalogLoadState =
  | {
      status: "ready"
      catalog: PublicBrokerCatalogData
    }
  | {
      status:
        | "missing_slug"
        | "catalog_not_found"
        | "broker_without_catalog"
        | "incomplete_data"
        | "service_unavailable"
      message: string
    }

type PublicCatalogErrorStatus = Exclude<PublicCatalogLoadState["status"], "ready">

export type PublicAgencyCatalogProperty = {
  id: string
  publicCode: number | null
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
  purpose: string
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
  if (type === "LAND") return "Terreno"
  if (type === "OFFICE") return "Sala Comercial"
  if (type === "STORE") return "Loja"
  if (type === "PENTHOUSE") return "Cobertura"
  return "Apartamento"
}

function propertyPurposeLabel(purpose: string) {
  return purpose === "RENT" ? "Locação" : "Venda"
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
    properties: broker.properties.map((property: any) => ({
      id: property.id,
      publicCode: property.publicCode ?? null,
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
      purpose: propertyPurposeLabel(property.purpose),
      description: property.description ?? "",
      images: getPropertyImages(
        Array.isArray(property.imageUrls) ? (property.imageUrls as string[]) : [],
        property.id,
      ),
      views: property.viewsCount,
      interested: property._count.leads,
      brokerId: property.brokerId,
      agencyId: property.agencyId,
    })),
  }
}

function buildCatalogUnavailableState(
  status: PublicCatalogErrorStatus,
  slug: string,
): Exclude<PublicCatalogLoadState, { status: "ready"; catalog: PublicBrokerCatalogData }> {
  if (status === "missing_slug") {
    return {
      status,
      message: "O link do catálogo está incompleto. Confira o endereço e tente novamente.",
    }
  }

  if (status === "catalog_not_found") {
    return {
      status,
      message: "Não encontramos este catálogo público. Verifique o link ou peça um novo acesso ao corretor.",
    }
  }

  if (status === "broker_without_catalog") {
    return {
      status,
      message: "Este corretor ainda não publicou um catálogo público disponível.",
    }
  }

  if (status === "incomplete_data") {
    return {
      status,
      message: "Este catálogo ainda não está pronto para compartilhamento. Tente novamente em instantes.",
    }
  }

  console.error("[public-catalog][broker][load-failed]", {
    slug,
    status,
  })

  return {
    status,
    message: "O catálogo está temporariamente indisponível. Tente novamente em alguns instantes.",
  }
}

function isCompleteBrokerCatalog(catalog: PublicBrokerCatalogData | null) {
  return Boolean(catalog?.slug?.trim() && catalog.displayName?.trim() && Array.isArray(catalog.properties))
}

export async function getPublicBrokerCatalogPageState(slug: string): Promise<PublicCatalogLoadState> {
  const normalizedSlug = slug.trim()

  if (!normalizedSlug) {
    return buildCatalogUnavailableState("missing_slug", normalizedSlug)
  }

  try {
    const catalog = await getPublicBrokerCatalogBySlug(normalizedSlug)

    if (!catalog) {
      const broker = await prisma.broker.findUnique({
        where: {
          catalogSlug: normalizedSlug,
        },
        select: {
          id: true,
        },
      })

      return buildCatalogUnavailableState(
        broker ? "broker_without_catalog" : "catalog_not_found",
        normalizedSlug,
      )
    }

    if (!isCompleteBrokerCatalog(catalog)) {
      console.error("[public-catalog][broker][incomplete-data]", {
        slug: normalizedSlug,
        hasDisplayName: Boolean(catalog.displayName?.trim()),
        hasCatalogSlug: Boolean(catalog.slug?.trim()),
        propertiesCount: catalog.properties.length,
      })
      return buildCatalogUnavailableState("incomplete_data", normalizedSlug)
    }

    return {
      status: "ready",
      catalog,
    }
  } catch (error) {
    console.error("[public-catalog][broker][exception]", {
      slug: normalizedSlug,
      message: error instanceof Error ? error.message : "unknown",
      stack: error instanceof Error ? error.stack : undefined,
    })

    return buildCatalogUnavailableState("service_unavailable", normalizedSlug)
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
    properties: agency.properties.map((property: any) => ({
      id: property.id,
      publicCode: property.publicCode ?? null,
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
      purpose: propertyPurposeLabel(property.purpose),
      description: property.description ?? "",
      status: "Publicado",
      views: property.viewsCount,
      leads: property._count.leads,
      brokerId: property.brokerId,
      agencyId: property.agencyId,
      image: getPropertyImage(
        Array.isArray(property.imageUrls) ? (property.imageUrls[0] as string | undefined) : undefined,
        property.id,
      ),
      images: getPropertyImages(
        Array.isArray(property.imageUrls) ? (property.imageUrls as string[]) : [],
        property.id,
      ),
      broker: {
        name: property.broker.user.name,
        initials: getInitials(property.broker.user.name),
      },
    })),
  }
}
