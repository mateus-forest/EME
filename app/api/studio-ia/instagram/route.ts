import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { UserRole } from "@/lib/prisma-enums"
import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits } from "@/lib/eme-plan-service"
import { getOpenAIEnv } from "@/lib/env.server"
import { formatCurrencyFromCents, propertyPurposeLabel, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"
import { createStudioCampaign } from "@/lib/studio-campaigns"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import {
  buildInstagramPrompt,
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
      error: NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 }),
      property: null,
    }
  }

  if (user.role === UserRole.BROKER) {
    if (!user.broker || property.brokerId !== user.broker.id) {
      return {
        error: NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 }),
        property: null,
      }
    }
  }

  if (user.role === UserRole.AGENCY) {
    if (!user.ownedAgency || property.agencyId !== user.ownedAgency.id) {
      return {
        error: NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 }),
        property: null,
      }
    }
  }

  return { error: null, property }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const payload = studioInstagramRequestSchema.parse(body)
    const accessible = await resolveAccessibleProperty(payload.propertyId, user)

    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const property = accessible.property
    const actionType = "studio_instagram_campaign"
    const creditsUsed = 10

    if (user.role === UserRole.BROKER && user.broker) {
      const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)
      if (!credits.allowed) {
        return NextResponse.json(
          createInsufficientCreditsPayload({
            availableCredits: credits.balance,
            requiredCredits: credits.amount,
          }),
          { status: 402 },
        )
      }
    }

    const location = [property.neighborhood, property.city].filter(Boolean).join(", ")
    const prompt = buildInstagramPrompt(payload, {
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
    const result = await runWithAiOperationContext(
      {
        route: "/api/studio-ia/instagram",
        source: "portal",
        userId: user.id,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? null,
        planKey: user.plan ?? null,
        creditsConsumed: creditsUsed,
      },
      () =>
        generateInstagramCampaign(payload, {
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
        }),
    )

    if (user.role === UserRole.BROKER && user.broker) {
      await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType,
        description: "Studio IA: campanha Instagram completa",
        metadata: {
          source: "api/studio-ia/instagram",
          propertyId: property.id,
        },
      })
    }

    const { model } = getOpenAIEnv()
    const campaign = await createStudioCampaign(user, {
      kind: "INSTAGRAM",
      status: "PENDING_REVIEW",
      goal: payload.goal,
      visualIdentity: payload.identity,
      version: payload.version,
      provider: "openai",
      model,
      prompt,
      sourceRoute: "/api/studio-ia/instagram",
      propertyId: property.id,
      metadata: {
        propertyTitle: property.title,
        city: property.city,
        neighborhood: property.neighborhood,
        propertyImageUrl: Array.isArray(property.imageUrls)
          ? property.imageUrls.find((image): image is string => typeof image === "string" && image.trim().length > 0) ?? null
          : null,
      },
      assets: [
        {
          assetKey: "post_feed",
          label: "Post feed",
          type: "IMAGE",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.postFeed as Prisma.InputJsonValue,
          metadata: {
            format: "instagram_post_feed",
            goal: payload.goal,
            identity: payload.identity,
          } as Prisma.InputJsonValue,
        },
        {
          assetKey: "story",
          label: "Story",
          type: "STORY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.story as Prisma.InputJsonValue,
          metadata: {
            format: "instagram_story",
            goal: payload.goal,
            identity: payload.identity,
          } as Prisma.InputJsonValue,
        },
        {
          assetKey: "carousel",
          label: "Carrossel",
          type: "CAROUSEL",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.carousel as Prisma.InputJsonValue,
          metadata: {
            format: "instagram_carousel",
            slideCount: result.carousel.length,
          } as Prisma.InputJsonValue,
        },
        {
          assetKey: "caption",
          label: "Legenda",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.caption,
          metadata: {
            format: "instagram_caption",
          } as Prisma.InputJsonValue,
        },
        {
          assetKey: "cta",
          label: "CTA",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.cta,
          metadata: {
            format: "instagram_cta",
          } as Prisma.InputJsonValue,
        },
        {
          assetKey: "hashtags",
          label: "Hashtags",
          type: "COPY",
          provider: "openai",
          model,
          status: "PENDING_REVIEW",
          content: result.hashtags as Prisma.InputJsonValue,
          metadata: {
            format: "instagram_hashtags",
          } as Prisma.InputJsonValue,
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
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Studio IA / geracao de campanha")
    }

    if (caughtError instanceof Error && caughtError.message === "OPENAI_DISABLED_OR_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "A geração de campanhas do Studio IA não está configurada neste ambiente." },
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
