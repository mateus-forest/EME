import { NextRequest, NextResponse } from "next/server"

import { UserRole } from "@/lib/prisma-enums"
import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits } from "@/lib/eme-plan-service"
import { getOpenAIEnv } from "@/lib/env.server"
import { formatCurrencyFromCents, propertyPurposeLabel, propertyStatusLabel, propertyTypeLabel } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { createStudioCampaign } from "@/lib/studio-campaigns"
import { generateBuyerStrategy, studioBuyerGenerationErrorCodes, studioBuyerRequestSchema } from "@/lib/studio-ia-buyers"

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

async function resolveApprovedMaterial(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  return prisma.studioCampaignAsset.findFirst({
    where: {
      id,
      status: "APPROVED",
      type: { in: ["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL"] },
      campaign: {
        brokerId: user.role === UserRole.BROKER ? user.broker?.id : undefined,
        agencyId: user.role === UserRole.AGENCY ? user.ownedAgency?.id : undefined,
      },
    },
    select: {
      id: true,
      type: true,
      fileUrl: true,
      campaign: { select: { id: true, propertyId: true } },
    },
  })
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
    const material = await resolveApprovedMaterial(payload.sourceAssetId, user)
    if (!material?.fileUrl) return NextResponse.json({ error: "Escolha um material aprovado da Biblioteca." }, { status: 400 })
    const materialUrl = material.fileUrl
    const accessible = material.campaign.propertyId
      ? await resolveAccessibleProperty(material.campaign.propertyId, user)
      : { error: null, property: null }
    if (accessible.error) return accessible.error
    const property = accessible.property
    const actionType = "studio_buyers_campaign"
    const creditsUsed = 3

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

    const location = property ? [property.neighborhood, property.city].filter(Boolean).join(", ") : "Não informada"
    const generationStartedAt = Date.now()
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
          id: property?.id ?? null,
          title: property?.title ?? "Material aprovado do Studio",
          city: property?.city ?? "",
          neighborhood: property?.neighborhood ?? "",
          location,
          type: property ? propertyTypeLabel(property.type) : "Não informado",
          purpose: property ? propertyPurposeLabel(property.purpose) : "Não informada",
          price: property ? formatCurrencyFromCents(property.price) : "Não informado",
          bedrooms: property?.bedrooms ?? 0,
          bathrooms: property?.bathrooms ?? 0,
          parkingSpots: property?.parkingSpots ?? 0,
          description: property?.description ?? "",
          status: property ? propertyStatusLabel(property.status) : "Não informado",
        }, { type: material.type, url: materialUrl }),
    )
    const generationDurationMs = Date.now() - generationStartedAt

    if (user.role === UserRole.BROKER && user.broker) {
      await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType,
        description: "Studio IA: atrair compradores",
        metadata: {
          source: "api/studio-ia/buyers",
          sourceAssetId: material.id,
        },
      })
    }

    const { model } = getOpenAIEnv()
    const campaign = await createStudioCampaign(user, {
      kind: "BUYERS",
      status: "PENDING_REVIEW",
      goal: payload.objective,
      visualIdentity: payload.channel,
      version: payload.version,
      provider: "openai",
      model,
      sourceRoute: "/api/studio-ia/buyers",
      propertyId: property?.id ?? null,
      metadata: {
        channel: payload.channel,
        objective: payload.objective,
        propertyTitle: property?.title ?? null,
        sourceAssetId: material.id,
        sourceCampaignId: material.campaign.id,
        provider: "openai",
        model,
        capability: "ad.structured_content",
        durationMs: generationDurationMs,
        externalCostUsd: null,
        externalRequestId: null,
      },
      assets: [
        { assetKey: "title", label: "Titulo", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.title },
        { assetKey: "primary_text", label: "Texto principal", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.primaryText },
        { assetKey: "audience", label: "Publico", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.audience },
        { assetKey: "approach", label: "Abordagem", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.approach },
        { assetKey: "cta", label: "CTA", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.cta },
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

    if (caughtError instanceof Error && caughtError.message === studioBuyerGenerationErrorCodes.maxOutputTokensExceeded) {
      return NextResponse.json(
        { error: "A geração foi interrompida antes de concluir a estratégia. Tente novamente." },
        { status: 502 },
      )
    }

    if (
      caughtError instanceof Error &&
      (caughtError.message === studioBuyerGenerationErrorCodes.emptyResponse ||
        caughtError.message === studioBuyerGenerationErrorCodes.incompleteResponse ||
        caughtError.message === studioBuyerGenerationErrorCodes.invalidStructuredResponse)
    ) {
      return NextResponse.json(
        { error: "Não foi possível gerar a estratégia agora, tente novamente." },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { error: "Não foi possível gerar o anúncio agora. Tente novamente." },
      { status: 500 },
    )
  }
}
