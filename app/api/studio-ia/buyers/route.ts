import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { UserRole } from "@/lib/prisma-enums"
import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits } from "@/lib/eme-plan-service"
import { getOpenAIEnv } from "@/lib/env.server"
import { formatCurrencyFromCents, propertyPurposeLabel, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { createStudioCampaign } from "@/lib/studio-campaigns"
import { generateBuyerStrategy, studioBuyerRequestSchema } from "@/lib/studio-ia-buyers"

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
    const payload = studioBuyerRequestSchema.parse(body)
    const accessible = await resolveAccessibleProperty(payload.propertyId, user)

    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const property = accessible.property
    const actionType = "studio_buyers_campaign"
    const creditsUsed = 3

    if (user.role === UserRole.BROKER && user.broker) {
      const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }
    }

    const location = [property.neighborhood, property.city].filter(Boolean).join(", ")
    const result = await runWithAiOperationContext(
      {
        route: "/api/studio-ia/buyers",
        source: "portal",
        userId: user.id,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? null,
        planKey: user.plan ?? null,
        creditsConsumed: creditsUsed,
      },
      () =>
        generateBuyerStrategy(payload, {
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
        description: "Studio IA: atrair compradores",
        metadata: {
          source: "api/studio-ia/buyers",
          propertyId: property.id,
        },
      })
    }

    const { model } = getOpenAIEnv()
    const campaign = await createStudioCampaign(user, {
      kind: "BUYERS",
      status: "PENDING_REVIEW",
      goal: payload.audience,
      visualIdentity: payload.channel,
      version: payload.version,
      provider: "openai",
      model,
      sourceRoute: "/api/studio-ia/buyers",
      propertyId: property.id,
      metadata: {
        channel: payload.channel,
        propertyTitle: property.title,
      },
      assets: [
        { assetKey: "audience", label: "Publico", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.audience },
        { assetKey: "strategy", label: "Estrategia", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.strategy },
        { assetKey: "copy", label: "Copy", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.copy },
        { assetKey: "cta", label: "CTA", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.cta },
        { assetKey: "timeline", label: "Timeline", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.timeline as Prisma.InputJsonValue },
        { assetKey: "reach", label: "Alcance", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.reach },
        { assetKey: "leads", label: "Leads", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.leads },
      ],
    })

    const response = NextResponse.json({ ...result, campaign }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][buyers] generation failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "OPENAI_DISABLED_OR_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "A geração de estratégias do Studio IA não está configurada neste ambiente." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao gerar a estrategia do Studio IA." },
      { status: 500 },
    )
  }
}
