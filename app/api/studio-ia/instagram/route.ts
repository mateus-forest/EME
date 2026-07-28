import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { UserRole } from "@/lib/prisma-enums"
import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { getOpenAIEnv } from "@/lib/env.server"
import { formatCurrencyFromCents, propertyPurposeLabel, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"
import { createStudioCampaign } from "@/lib/studio-campaigns"
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

    const { model } = getOpenAIEnv()
    const campaign = await createStudioCampaign(user, {
      kind: "INSTAGRAM",
      status: "PENDING_REVIEW",
      goal: payload.goal,
      visualIdentity: payload.identity,
      version: payload.version,
      provider: "openai",
      model,
      sourceRoute: "/api/studio-ia/instagram",
      propertyId: property.id,
      metadata: {
        propertyTitle: property.title,
        city: property.city,
        neighborhood: property.neighborhood,
      },
      assets: [
        {
          assetKey: "post_feed",
          label: "Post feed",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.postFeed as Prisma.InputJsonValue,
        },
        {
          assetKey: "story",
          label: "Story",
          type: "STORY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.story as Prisma.InputJsonValue,
        },
        {
          assetKey: "carousel",
          label: "Carrossel",
          type: "CAROUSEL",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.carousel as Prisma.InputJsonValue,
        },
        {
          assetKey: "caption",
          label: "Legenda",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.caption,
        },
        {
          assetKey: "cta",
          label: "CTA",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.cta,
        },
        {
          assetKey: "hashtags",
          label: "Hashtags",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.hashtags as Prisma.InputJsonValue,
        },
      ],
    })

    const response = NextResponse.json({ ...result, campaign }, { status: 201 })
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
