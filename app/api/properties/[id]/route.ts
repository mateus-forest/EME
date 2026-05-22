import {
  type PropertyType,
  UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
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
  price?: number
  bedrooms?: number
  bathrooms?: number
  parkingSpots?: number
  type?: PropertyType
  purpose?: string
  imageUrls?: string[]
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
