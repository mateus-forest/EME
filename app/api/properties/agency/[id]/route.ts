import {
  type PropertyType,
  UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { mapPropertyType, parsePriceInput, serializeProperty } from "@/lib/property-contract"
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
  price?: number
  bedrooms?: number
  bathrooms?: number
  parkingSpots?: number
  type?: PropertyType
  imageUrls?: string[]
  broker?: {
    connect: {
      id: string
    }
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params
    const property = await prisma.property.findFirst({
      where: {
        id,
        agencyId: user.ownedAgency.id,
      },
      include: propertyInclude,
    })

    if (!property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const data: PropertyUpdateData = {}

    if (typeof body?.title === "string") {
      const title = body.title.trim()
      if (!title) {
        return NextResponse.json({ error: "Informe um título válido." }, { status: 400 })
      }
      data.title = title
    }

    if (typeof body?.description === "string") {
      data.description = body.description.trim() || null
    }

    if (typeof body?.city === "string") {
      const city = body.city.trim()
      if (!city) {
        return NextResponse.json({ error: "Informe uma cidade válida." }, { status: 400 })
      }
      data.city = city
    }

    if (typeof body?.neighborhood === "string") {
      const neighborhood = body.neighborhood.trim()
      if (!neighborhood) {
        return NextResponse.json({ error: "Informe um bairro válido." }, { status: 400 })
      }
      data.neighborhood = neighborhood
    }

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

    if (body?.images !== undefined) {
      if (!Array.isArray(body.images)) {
        return NextResponse.json({ error: "As imagens precisam estar em uma lista." }, { status: 400 })
      }

      data.imageUrls = body.images
        .filter((image: unknown): image is string => typeof image === "string")
        .slice(0, 6)
    }

    if (body?.brokerId !== undefined) {
      if (typeof body.brokerId !== "string" || !body.brokerId.trim()) {
        return NextResponse.json({ error: "Corretor responsável inválido." }, { status: 400 })
      }

      const broker = await prisma.broker.findFirst({
        where: {
          id: body.brokerId,
          agencyId: user.ownedAgency.id,
        },
      })

      if (!broker) {
        return NextResponse.json({ error: "Corretor responsável não encontrado nesta imobiliária." }, { status: 400 })
      }

      data.broker = {
        connect: {
          id: broker.id,
        },
      }
    }

    const updatedProperty = await prisma.property.update({
      where: {
        id: property.id,
      },
      data,
      include: propertyInclude,
    })

    return NextResponse.json({ property: serializeProperty(updatedProperty) })
  } catch (caughtError) {
    console.error("[api][properties][agency][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar imóvel da imobiliária." }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params
    const property = await prisma.property.findFirst({
      where: {
        id,
        agencyId: user.ownedAgency.id,
      },
    })

    if (!property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    await prisma.property.delete({
      where: {
        id: property.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (caughtError) {
    console.error("[api][properties][agency][id] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao excluir imóvel da imobiliária." }, { status: 500 })
  }
}
