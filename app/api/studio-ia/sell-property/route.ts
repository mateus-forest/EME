import { NextRequest, NextResponse } from "next/server"

import { UserRole } from "@/lib/prisma-enums"
import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { formatCurrencyFromCents, propertyPurposeLabel, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"
import {
  generateSellPropertyPlan,
  studioSellPropertyRequestSchema,
} from "@/lib/studio-ia-sell-property"

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

function detectConstructionScenario(property: { title: string; description: string | null; status: string }) {
  const haystack = [property.title, property.description ?? "", property.status]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return ["obra", "construcao", "lancamento", "em desenvolvimento", "na planta"].some((term) =>
    haystack.includes(term),
  )
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
    const payload = studioSellPropertyRequestSchema.parse(body)
    const accessible = await resolveAccessibleProperty(payload.propertyId, user)

    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 })
    }

    const property = accessible.property
    const location = [property.neighborhood, property.city].filter(Boolean).join(", ")
    const result = await generateSellPropertyPlan(payload, {
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
      hasImages: Array.isArray(property.imageUrls) && property.imageUrls.some((image) => typeof image === "string" && image.trim()),
      likelyUnderConstruction: detectConstructionScenario(property),
    })

    const response = NextResponse.json(result, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][sell-property] generation failed", {
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
        { error: "A geracao do plano comercial do Studio IA nao esta configurada neste ambiente." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao gerar o plano comercial do Studio IA." },
      { status: 500 },
    )
  }
}
