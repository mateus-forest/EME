import { CatalogOwnerType, CreciValidationStatus, UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { authUserSelect, ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { slugify } from "@/lib/catalog-slug"
import { prisma, type PrismaTransaction } from "@/lib/prisma"
import { deleteBrokerCatalogStorageFile } from "@/lib/property-storage"

const MAX_LIST_ITEMS = 16
const MAX_LIST_ITEM_LENGTH = 120

type AuthenticatedCatalogUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.slice(0, MAX_LIST_ITEM_LENGTH)),
  )].slice(0, MAX_LIST_ITEMS)
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback
}

function optionalCount(value: unknown, fallback: number | null, maximum: number) {
  if (value === null || value === "") return null
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) return Number.NaN
  return parsed
}

function validPublicMediaUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === "https:"
  } catch {
    return false
  }
}

function serialize(user: AuthenticatedCatalogUser) {
  const broker = user.broker

  return {
    settings: {
      slug: broker?.catalogSlug ?? "",
      displayName: user.name,
      photoUrl: user.photoUrl ?? "",
      description: broker?.description ?? "",
      bannerUrl: broker?.catalogBannerUrl ?? "",
      headline: broker?.catalogHeadline ?? broker?.description ?? "",
      bio: broker?.catalogBio ?? "",
      experienceYears: broker?.catalogExperienceYears ?? null,
      soldProperties: broker?.catalogSoldProperties ?? null,
      serviceArea: broker?.catalogServiceArea ?? "",
      cities: stringList(broker?.catalogCities),
      priceRange: broker?.catalogPriceRange ?? "",
      specialties: stringList(broker?.catalogSpecialties),
      differentials: stringList(broker?.catalogDifferentials),
      videoUrl: broker?.catalogVideoUrl ?? "",
      creci: broker?.creci ?? "",
      creciUf: broker?.creciUf ?? "",
      creciValidationStatus: broker?.creciValidationStatus ?? CreciValidationStatus.PENDING,
      creciVerified: broker?.creciValidationStatus === CreciValidationStatus.VERIFIED,
      email: user.email,
      whatsApp: user.phone || broker?.phone || "",
    },
  }
}

export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })

  const response = NextResponse.json(serialize(user))
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })

  try {
    const body = await request.json().catch(() => null)
    const displayName = cleanText(body?.displayName, user.name, 120)
    const requestedSlug = typeof body?.slug === "string" && body.slug.trim()
      ? slugify(body.slug)
      : user.broker.catalogSlug
    const photoUrl = cleanText(body?.photoUrl, user.photoUrl ?? "", 800_000)
    const description = cleanText(body?.description, user.broker.description ?? "", 600)
    const bannerUrl = cleanText(body?.bannerUrl, user.broker.catalogBannerUrl ?? "", 2_048)
    const headline = cleanText(body?.headline, user.broker.catalogHeadline ?? "", 180)
    const bio = cleanText(body?.bio, user.broker.catalogBio ?? "", 2_500)
    const experienceYears = optionalCount(body?.experienceYears, user.broker.catalogExperienceYears, 100)
    const soldProperties = optionalCount(body?.soldProperties, user.broker.catalogSoldProperties, 1_000_000)
    const serviceArea = cleanText(body?.serviceArea, user.broker.catalogServiceArea ?? "", 180)
    const cities = body?.cities === undefined ? stringList(user.broker.catalogCities) : stringList(body.cities)
    const priceRange = cleanText(body?.priceRange, user.broker.catalogPriceRange ?? "", 120)
    const specialties = body?.specialties === undefined
      ? stringList(user.broker.catalogSpecialties)
      : stringList(body.specialties)
    const differentials = body?.differentials === undefined
      ? stringList(user.broker.catalogDifferentials)
      : stringList(body.differentials)
    const videoUrl = cleanText(body?.videoUrl, user.broker.catalogVideoUrl ?? "", 2_048)

    if (!displayName || !requestedSlug) {
      return NextResponse.json({ error: "Nome e endereço do catálogo são obrigatórios." }, { status: 400 })
    }
    if (Number.isNaN(experienceYears) || Number.isNaN(soldProperties)) {
      return NextResponse.json({ error: "Revise os valores de tempo de atuação e imóveis vendidos." }, { status: 400 })
    }
    if (!validPublicMediaUrl(bannerUrl) || !validPublicMediaUrl(videoUrl)) {
      return NextResponse.json({ error: "Banner ou vídeo possuem um endereço inválido." }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const [brokerConflict, catalogConflict] = await Promise.all([
        tx.broker.findFirst({
          where: { catalogSlug: requestedSlug, NOT: { id: user.broker!.id } },
          select: { id: true },
        }),
        tx.catalog.findFirst({ where: { slug: requestedSlug }, select: { ownerType: true, ownerId: true } }),
      ])
      const ownCatalog = catalogConflict?.ownerType === CatalogOwnerType.BROKER
        && catalogConflict.ownerId === user.broker!.id
      if (brokerConflict || (catalogConflict && !ownCatalog)) throw new Error("CATALOG_SLUG_IN_USE")

      await tx.broker.update({
        where: { id: user.broker!.id },
        data: {
          catalogSlug: requestedSlug,
          description: description || null,
          catalogBannerUrl: bannerUrl || null,
          catalogHeadline: headline || null,
          catalogBio: bio || null,
          catalogExperienceYears: experienceYears,
          catalogSoldProperties: soldProperties,
          catalogServiceArea: serviceArea || null,
          catalogCities: cities,
          catalogPriceRange: priceRange || null,
          catalogSpecialties: specialties,
          catalogDifferentials: differentials,
          catalogVideoUrl: videoUrl || null,
        },
      })
      await tx.catalog.upsert({
        where: { slug: user.broker!.catalogSlug },
        update: { slug: requestedSlug, ownerType: CatalogOwnerType.BROKER, ownerId: user.broker!.id },
        create: { slug: requestedSlug, ownerType: CatalogOwnerType.BROKER, ownerId: user.broker!.id },
      })
      return tx.user.update({
        where: { id: user.id },
        data: { name: displayName, photoUrl: photoUrl || null },
        select: authUserSelect,
      })
    })

    await Promise.all([
      user.broker.catalogBannerUrl && user.broker.catalogBannerUrl !== bannerUrl
        ? deleteBrokerCatalogStorageFile(user.broker.id, user.broker.catalogBannerUrl)
        : Promise.resolve(),
      user.broker.catalogVideoUrl && user.broker.catalogVideoUrl !== videoUrl
        ? deleteBrokerCatalogStorageFile(user.broker.id, user.broker.catalogVideoUrl)
        : Promise.resolve(),
    ])

    const response = NextResponse.json(serialize(updated))
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caught) {
    if (caught instanceof Error && caught.message === "CATALOG_SLUG_IN_USE") {
      return NextResponse.json({ error: "Este endereço de catálogo já está em uso." }, { status: 409 })
    }
    if (isPrismaUnavailable(caught)) {
      return NextResponse.json({ error: "O serviço de catálogo está indisponível." }, { status: 503 })
    }
    console.error("[api][brokers][catalog] update failed", {
      message: caught instanceof Error ? caught.message : "unknown",
    })
    return NextResponse.json({ error: "Erro interno ao atualizar o catálogo." }, { status: 500 })
  }
}
