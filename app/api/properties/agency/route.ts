import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { enforceAgencyOperationalAccess } from "@/lib/billing-enforcement"
import { mapPropertyStatus, mapPropertyType, parsePriceInput, serializeProperty } from "@/lib/property-contract"
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

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    if (!user.ownedAgency) {
      return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
    }

    const properties = await prisma.property.findMany({
      where: {
        agencyId: user.ownedAgency.id,
      },
      include: propertyInclude,
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ properties: properties.map(serializeProperty) })
  } catch (caughtError) {
    console.error("[api][properties][agency] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar imóveis da imobiliária." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const description = typeof body?.description === "string" ? body.description.trim() : ""
    const city = typeof body?.city === "string" ? body.city.trim() : ""
    const neighborhood = typeof body?.neighborhood === "string" ? body.neighborhood.trim() : ""
    const price = parsePriceInput(body?.price)
    const bedrooms = typeof body?.bedrooms === "number" ? Math.max(0, Math.trunc(body.bedrooms)) : 0
    const bathrooms = typeof body?.bathrooms === "number" ? Math.max(0, Math.trunc(body.bathrooms)) : 0
    const parkingSpots =
      typeof body?.parkingSpots === "number" ? Math.max(0, Math.trunc(body.parkingSpots)) : 0
    const propertyType = mapPropertyType(body?.type)
    const statusPayload = mapPropertyStatus(body?.status ?? (body?.published ? "Publicado" : "Rascunho"))
    const images = Array.isArray(body?.images)
      ? body.images.filter((image: unknown): image is string => typeof image === "string").slice(0, 6)
      : []

    if (!user.ownedAgency) {
      return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
    }

    if (!title || !city || !neighborhood || price === null || !propertyType || !statusPayload) {
      return NextResponse.json(
        { error: "Título, cidade, bairro, preço, tipo e status são obrigatórios." },
        { status: 400 },
      )
    }

    const billingBlocked = enforceAgencyOperationalAccess(user)
    if (billingBlocked) return billingBlocked

    const requestedBrokerId = typeof body?.brokerId === "string" ? body.brokerId : ""

    const broker = requestedBrokerId
      ? await prisma.broker.findFirst({
          where: {
            id: requestedBrokerId,
            agencyId: user.ownedAgency.id,
          },
        })
      : await prisma.broker.findFirst({
          where: {
            agencyId: user.ownedAgency.id,
          },
          orderBy: {
            createdAt: "asc",
          },
        })

    if (!broker) {
      return NextResponse.json(
        { error: "Cadastre ou vincule um corretor antes de criar imóveis pela imobiliária." },
        { status: 400 },
      )
    }

    const property = await prisma.property.create({
      data: {
        title,
        description: description || null,
        price,
        city,
        neighborhood,
        bedrooms,
        bathrooms,
        parkingSpots,
        type: propertyType,
        status: statusPayload.status,
        published: statusPayload.published,
        imageUrls: images,
        brokerId: broker.id,
        agencyId: user.ownedAgency.id,
      },
      include: propertyInclude,
    })

    return NextResponse.json({ property: serializeProperty(property) }, { status: 201 })
  } catch (caughtError) {
    console.error("[api][properties][agency] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao criar imóvel da imobiliária." }, { status: 500 })
  }
}
