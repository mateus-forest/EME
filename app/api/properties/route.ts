import { UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { parseEntityDocuments } from "@/lib/legal-entities"
import { enforceBrokerPropertyCreation } from "@/lib/billing-enforcement"
import { mapPropertyPurpose, mapPropertyStatus, mapPropertyType, parsePriceInput, serializeProperty } from "@/lib/property-contract"
import { assessCatalogReadiness, propertyPublicationBlockedResponse } from "@/lib/property-publication-readiness"
import { getNextPropertyPublicCode } from "@/lib/property-public-code"
import { prisma } from "@/lib/prisma"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
  _count: {
    select: {
      leads: true,
    },
  },
} as const

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const description = typeof body?.description === "string" ? body.description.trim() : ""
    const city = typeof body?.city === "string" ? body.city.trim() : ""
    const neighborhood = typeof body?.neighborhood === "string" ? body.neighborhood.trim() : ""
    const parsedPrice = parsePriceInput(body?.price)
    const bedrooms = typeof body?.bedrooms === "number" ? Math.max(0, Math.trunc(body.bedrooms)) : 0
    const bathrooms = typeof body?.bathrooms === "number" ? Math.max(0, Math.trunc(body.bathrooms)) : 0
    const parkingSpots =
      typeof body?.parkingSpots === "number" ? Math.max(0, Math.trunc(body.parkingSpots)) : 0
    const propertyType = mapPropertyType(body?.type)
    const purpose = mapPropertyPurpose(body?.purpose)
    const statusPayload = mapPropertyStatus(body?.status ?? (body?.published ? "Publicado" : "Rascunho"))
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName.trim().slice(0, 160) : ""
    const legalData = normalizePropertyLegalData(body?.legal)
    const documentsData = normalizeDocuments(body?.documents)
    const images = Array.isArray(body?.images)
      ? body.images.filter((image: unknown): image is string => typeof image === "string").slice(0, 6)
      : []

    if (!user.broker) {
      return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
    }

    if (!title || !propertyType || !statusPayload) {
      return NextResponse.json(
        { error: "Título, tipo e status são obrigatórios para cadastrar o imóvel." },
        { status: 400 },
      )
    }

    const hasPriceInput = typeof body?.price === "number" || (typeof body?.price === "string" && Boolean(body.price.trim()))
    if (hasPriceInput && parsedPrice === null) {
      return NextResponse.json({ error: "Informe um preço válido ou deixe o valor em branco no rascunho." }, { status: 400 })
    }

    const price = parsedPrice ?? 0

    if (statusPayload.published) {
      const readiness = assessCatalogReadiness({
        title,
        price,
        city,
        broker: {
          creciValidationStatus: user.broker.creciValidationStatus,
        },
      })
      if (!readiness.ready) {
        return NextResponse.json(propertyPublicationBlockedResponse(readiness, "catalog"), { status: 422 })
      }
    }

    const billingBlocked = await enforceBrokerPropertyCreation(user)
    if (billingBlocked) return billingBlocked

    const publicCode = await getNextPropertyPublicCode(prisma, user.broker.id)
    const property = await prisma.property.create({
      data: {
        publicCode,
        title,
        description: description || null,
        price,
        city,
        neighborhood,
        ownerName: ownerName || null,
        bedrooms,
        bathrooms,
        parkingSpots,
        type: propertyType,
        purpose,
        status: statusPayload.status,
        published: statusPayload.published,
        imageUrls: images,
        legalData,
        documentsData,
        brokerId: user.broker.id,
        agencyId: null,
      },
      include: propertyInclude,
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: statusPayload.published ? "Novo imóvel publicado" : "Novo rascunho criado",
        message: `${title} foi ${statusPayload.published ? "publicado no catálogo" : "salvo como rascunho"}.`,
        read: false,
      },
    })

    const response = NextResponse.json({ property: serializeProperty(property) }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao criar imóvel." }, { status: 500 })
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

function normalizePropertyLegalData(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    code: cleanText(source.code, 64),
    registryNumber: cleanText(source.registryNumber, 64),
    registryOffice: cleanText(source.registryOffice, 160),
    registryBook: cleanText(source.registryBook, 64),
    registryPage: cleanText(source.registryPage, 64),
    municipalRegistration: cleanText(source.municipalRegistration, 64),
    taxRegistration: cleanText(source.taxRegistration, 64),
    cep: cleanText(source.cep, 16),
    street: cleanText(source.street, 160),
    number: cleanText(source.number, 24),
    complement: cleanText(source.complement, 120),
    district: cleanText(source.district, 120),
    city: cleanText(source.city, 120),
    state: cleanText(source.state, 32),
    privateArea: cleanText(source.privateArea, 64),
    totalArea: cleanText(source.totalArea, 64),
    idealFraction: cleanText(source.idealFraction, 64),
    condominiumName: cleanText(source.condominiumName, 160),
    condominiumFee: cleanText(source.condominiumFee, 64),
    iptuValue: cleanText(source.iptuValue, 64),
    additionalFees: cleanText(source.additionalFees, 120),
    legalNotes: cleanText(source.legalNotes, 1200),
  }
}

function normalizeDocuments(value: unknown) {
  return parseEntityDocuments(value).map((document) => ({
    ...document,
    label: cleanText(document.label, 64),
    name: cleanText(document.name, 160),
    url: cleanText(document.url, 5_000),
    mimeType: cleanText(document.mimeType, 120),
    uploadedAt: cleanText(document.uploadedAt, 64) || new Date().toISOString(),
  }))
}
