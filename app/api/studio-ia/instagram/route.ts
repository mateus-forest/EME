import { NextRequest, NextResponse } from "next/server"

import { UserRole } from "@/lib/prisma-enums"
import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { formatCurrencyFromCents, propertyPurposeLabel, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"
import {
  generateInstagramCampaign,
  studioInstagramRequestSchema,
} from "@/lib/studio-ia-instagram"

export const dynamic = "force-dynamic"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
} as const

async function resolveAccessibleProperty(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  })

  if (!property) {
    return {
      error: NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 }),
      property: null,
    }
  }

  if (user.role === UserRole.BROKER) {
    if (!user.broker || property.brokerId !== user.broker.id) {
      return {
        error: NextResponse.json({ error: "Acesso nao permitido a este imovel." }, { status: 403 }),
        property: null,
      }
    }
  }

  if (user.role === UserRole.AGENCY) {
    if (!user.ownedAgency || property.agencyId !== user.ownedAgency.id) {
      return {
        error: NextResponse.json({ error: "Acesso nao permitido a este imovel." }, { status: 403 }),
        property: null,
      }
    }
  }

  return { error: null, property }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso nao permitido para este perfil." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const payload = studioInstagramRequestSchema.parse(body)
    const accessible = await resolveAccessibleProperty(payload.propertyId, user)

    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 })
    }

    const property = accessible.property
    const location = [property.neighborhood, property.city].filter(Boolean).join(", ")
    const result = await generateInstagramCampaign(payload, {
      id: property.id,
      title: property.title,
      city: property.city,
      neighborhood: property.neighborhood ?? "",
      location,
      type: propertyTypeLabel(property.type),
      purpose: propertyPurposeLabel(property.purpose),
      price: formatCurrencyFromCents(property.price),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parkingSpots: property.parkingSpots,
      description: property.description ?? "",
      status: propertyStatusLabel(property.status),
    })

    const response = NextResponse.json(result, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][instagram] generation failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de imoveis esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "OPENAI_DISABLED_OR_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "A geracao de campanhas do Studio IA nao esta configurada neste ambiente." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED") {
      return NextResponse.json(
        { error: "A resposta da OpenAI foi interrompida antes de concluir a campanha. Ajuste aplicado, tente novamente." },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao gerar a campanha do Studio IA." },
      { status: 500 },
    )
  }
}
