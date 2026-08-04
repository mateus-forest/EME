import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits } from "@/lib/eme-plan-service"
import { getOpenAIEnv } from "@/lib/env.server"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { createStudioCampaign } from "@/lib/studio-campaigns"
import { generateConstructionToListingImage, studioConstructionRequestSchema } from "@/lib/studio-ia-construction"

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

function getExistingImages(property: { imageUrls: unknown }) {
  return Array.isArray(property.imageUrls)
    ? property.imageUrls.filter((image): image is string => typeof image === "string")
    : []
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
    const payload = studioConstructionRequestSchema.parse(body)
    const accessible = await resolveAccessibleProperty(payload.propertyId, user)

    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 })
    }

    const actionType = "studio_construction_image"
    const creditsUsed = 40

    if (user.role === UserRole.BROKER && user.broker) {
      const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }
    }

    const existingImages = getExistingImages(accessible.property)
    if (!existingImages.includes(payload.imageUrl)) {
      return NextResponse.json({ error: "A imagem selecionada nao pertence a este imovel." }, { status: 400 })
    }

    const result = await runWithAiOperationContext(
      {
        route: "/api/studio-ia/construction",
        source: "portal",
        userId: user.id,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? null,
        planKey: user.plan ?? null,
        creditsConsumed: creditsUsed,
      },
      () => generateConstructionToListingImage(payload),
    )

    if (user.role === UserRole.BROKER && user.broker) {
      await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType,
        description: "Studio IA: transformar obra em imovel pronto",
        metadata: {
          source: "api/studio-ia/construction",
          propertyId: accessible.property.id,
        },
      })
    }

    const { model } = getOpenAIEnv()
    const campaign = await createStudioCampaign(user, {
      kind: "CONSTRUCTION",
      status: "PENDING_REVIEW",
      goal: "Transformar obra em imovel pronto",
      visualIdentity: payload.style,
      version: 1,
      provider: "openai",
      model,
      sourceRoute: "/api/studio-ia/construction",
      propertyId: accessible.property.id,
      metadata: {
        sourceImageUrl: payload.imageUrl,
        propertyTitle: accessible.property.title,
      },
      assets: [
        {
          assetKey: "construction_image",
          label: "Imagem final",
          type: "IMAGE",
          provider: "openai",
          model,
          fileUrl: result.imageUrl,
          thumbnailUrl: result.imageUrl,
          status: "PENDING_REVIEW",
          content: {
            sourceImageUrl: payload.imageUrl,
            style: payload.style,
          },
        },
      ],
    })
    const response = NextResponse.json({ ...result, campaign }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][construction] generation failed", {
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
        { error: "A geracao de imagem do Studio IA nao esta configurada neste ambiente." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao gerar a imagem do Studio IA." },
      { status: 500 },
    )
  }
}
