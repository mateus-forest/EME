import { UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { enforceBrokerPropertyCreation } from "@/lib/billing-enforcement"
import { mapPropertyPurpose, mapPropertyStatus, mapPropertyType, parsePriceInput, serializeProperty } from "@/lib/property-contract"
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
    const price = parsePriceInput(body?.price)
    const bedrooms = typeof body?.bedrooms === "number" ? Math.max(0, Math.trunc(body.bedrooms)) : 0
    const bathrooms = typeof body?.bathrooms === "number" ? Math.max(0, Math.trunc(body.bathrooms)) : 0
    const parkingSpots =
      typeof body?.parkingSpots === "number" ? Math.max(0, Math.trunc(body.parkingSpots)) : 0
    const propertyType = mapPropertyType(body?.type)
    const purpose = mapPropertyPurpose(body?.purpose)
    const statusPayload = mapPropertyStatus(body?.status ?? (body?.published ? "Publicado" : "Rascunho"))
    const images = Array.isArray(body?.images)
      ? body.images.filter((image: unknown): image is string => typeof image === "string").slice(0, 6)
      : []

    if (!user.broker) {
      return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
    }

    if (!title || !city || !neighborhood || price === null || !propertyType || !statusPayload) {
      return NextResponse.json(
        { error: "Título, cidade, bairro, preço, tipo e status são obrigatórios." },
        { status: 400 },
      )
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
        bedrooms,
        bathrooms,
        parkingSpots,
        type: propertyType,
        purpose,
        status: statusPayload.status,
        published: statusPayload.published,
        imageUrls: images,
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
