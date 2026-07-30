import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { getOpenAIEnv } from "@/lib/env.server"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { UserRole } from "@/lib/prisma-enums"
import { createStudioCampaign } from "@/lib/studio-campaigns"
import { generateOwnerStrategy, studioOwnerRequestSchema } from "@/lib/studio-ia-owners"

export const dynamic = "force-dynamic"

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
    const payload = studioOwnerRequestSchema.parse(body)
    const result = await runWithAiOperationContext(
      {
        route: "/api/studio-ia/owners",
        source: "portal",
        userId: user.id,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? null,
        planKey: user.plan ?? null,
      },
      () => generateOwnerStrategy(payload),
    )
    const { model } = getOpenAIEnv()
    const campaign = await createStudioCampaign(user, {
      kind: "OWNERS",
      status: "PENDING_REVIEW",
      goal: payload.goal,
      visualIdentity: payload.ownerProfile,
      version: payload.version,
      provider: "openai",
      model,
      sourceRoute: "/api/studio-ia/owners",
      metadata: {
        city: payload.city,
        neighborhood: payload.neighborhood,
        operationRadius: payload.operationRadius,
      },
      assets: [
        { assetKey: "audience", label: "Publico", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.audience },
        { assetKey: "approach", label: "Abordagem", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.approach },
        { assetKey: "ad_copy", label: "Anuncio", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.adCopy },
        { assetKey: "instagram", label: "Instagram", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.instagramCaption },
        { assetKey: "video", label: "Roteiro de video", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.videoScript as unknown as Prisma.InputJsonValue },
        { assetKey: "whatsapp", label: "WhatsApp", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.whatsappText },
        { assetKey: "cta", label: "CTA", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.cta },
        { assetKey: "timeline", label: "Timeline", type: "COPY", provider: "openai", model, status: "PENDING_REVIEW", content: result.timeline as unknown as Prisma.InputJsonValue },
      ],
    })
    const response = NextResponse.json({ ...result, campaign }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][owners] generation failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (caughtError instanceof Error && caughtError.message === "OPENAI_DISABLED_OR_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "A geracao de estrategias do Studio IA nao esta configurada neste ambiente." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao gerar a estrategia do Studio IA." },
      { status: 500 },
    )
  }
}
