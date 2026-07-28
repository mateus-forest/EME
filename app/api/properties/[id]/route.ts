import {
  type PropertyType,
  UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { parseEntityDocuments } from "@/lib/legal-entities"
import { mapPropertyPurpose, mapPropertyType, parsePriceInput, serializeProperty } from "@/lib/property-contract"
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

type PropertyUpdateData = {
  title?: string
  description?: string | null
  city?: string
  neighborhood?: string
  ownerName?: string | null
  price?: number
  bedrooms?: number
  bathrooms?: number
  parkingSpots?: number
  type?: PropertyType
  purpose?: string
  imageUrls?: string[]
  legalData?: Record<string, string>
  documentsData?: Array<Record<string, string>>
}

async function resolveAccessibleProperty(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  })

  if (!property) {
    return { error: NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 }), property: null }
  }

  if (user.role === UserRole.BROKER) {
    if (!user.broker || property.brokerId !== user.broker.id) {
      return { error: NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 }), property: null }
    }
  }

  if (user.role === UserRole.AGENCY) {
    if (!user.ownedAgency || property.agencyId !== user.ownedAgency.id) {
      return { error: NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 }), property: null }
    }
  }

  return { error: null, property }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const accessible = await resolveAccessibleProperty(id, user)
    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const data: PropertyUpdateData = {}

    if (typeof body?.title === "string") data.title = body.title.trim()
    if (typeof body?.description === "string") data.description = body.description.trim() || null
    if (typeof body?.city === "string") data.city = body.city.trim()
    if (typeof body?.neighborhood === "string") data.neighborhood = body.neighborhood.trim()
    if (typeof body?.ownerName === "string") data.ownerName = body.ownerName.trim() || null

    if (body?.price !== undefined) {
      const price = parsePriceInput(body.price)
      if (price === null) {
        return NextResponse.json({ error: "Informe um preço válido." }, { status: 400 })
      }
      data.price = price
    }

    if (body?.bedrooms !== undefined) {
      if (typeof body.bedrooms !== "number") {
        return NextResponse.json({ error: "Quartos precisa ser numérico." }, { status: 400 })
      }
      data.bedrooms = Math.max(0, Math.trunc(body.bedrooms))
    }

    if (body?.bathrooms !== undefined) {
      if (typeof body.bathrooms !== "number") {
        return NextResponse.json({ error: "Banheiros precisa ser numérico." }, { status: 400 })
      }
      data.bathrooms = Math.max(0, Math.trunc(body.bathrooms))
    }

    if (body?.parkingSpots !== undefined) {
      if (typeof body.parkingSpots !== "number") {
        return NextResponse.json({ error: "Vagas precisa ser numérico." }, { status: 400 })
      }
      data.parkingSpots = Math.max(0, Math.trunc(body.parkingSpots))
    }

    if (body?.type !== undefined) {
      const propertyType = mapPropertyType(body.type)
      if (!propertyType) {
        return NextResponse.json({ error: "Tipo de imóvel inválido." }, { status: 400 })
      }
      data.type = propertyType
    }

    if (body?.purpose !== undefined) {
      data.purpose = mapPropertyPurpose(body.purpose)
    }

    if (body?.images !== undefined) {
      if (!Array.isArray(body.images)) {
        return NextResponse.json({ error: "As imagens precisam estar em uma lista." }, { status: 400 })
      }
      data.imageUrls = body.images.filter((image: unknown): image is string => typeof image === "string").slice(0, 6)
    }

    if (body?.legal !== undefined) {
      data.legalData = normalizePropertyLegalData(body.legal)
    }

    if (body?.documents !== undefined) {
      data.documentsData = normalizeDocuments(body.documents)
    }

    const property = await prisma.property.update({
      where: { id: accessible.property.id },
      data,
      include: propertyInclude,
    })

    const response = NextResponse.json({ property: serializeProperty(property) })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar imóvel." }, { status: 500 })
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

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const accessible = await resolveAccessibleProperty(id, user)
    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    await prisma.property.delete({
      where: { id: accessible.property.id },
    })

    const response = NextResponse.json({ success: true })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][id] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao excluir imóvel." }, { status: 500 })
  }
}
