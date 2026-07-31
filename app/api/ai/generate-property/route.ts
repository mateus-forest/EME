import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  consumeBrokerAiCredits,
  createInsufficientCreditsPayload,
  hasBrokerAiCredits,
  refundBrokerAiCredits,
} from "@/lib/eme-plan-service"
import { getEmeCreditCost } from "@/lib/eme-plans"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { UserRole } from "@/lib/prisma-enums"
import { generatePropertyCopy, propertyGenerationSchema } from "@/lib/property-ai"

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let stage = "auth"
  let payloadForLog: unknown = null
  let creditsConsumed = false
  const actionType = "generate_property_ai"
  const creditsUsed = getEmeCreditCost(actionType)
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (roleError) return roleError

  try {
    stage = "parse_payload"
    const payload = await request.json().catch(() => null)
    payloadForLog = payload

    console.info("[api][ai][generate-property][stage]", {
      stage,
      userId: user.id,
      role: user.role,
      hasPayload: Boolean(payload),
    })

    const input = propertyGenerationSchema.parse({
      title: payload?.title,
      type: payload?.type,
      city: payload?.city,
      neighborhood: payload?.neighborhood,
      price: payload?.price,
      bedrooms: payload?.bedrooms,
      bathrooms: payload?.bathrooms,
      parkingSpots: payload?.parkingSpots,
      description: payload?.description,
    })

    if (user.role === UserRole.BROKER && user.broker) {
      stage = "check_ai_credits"
      const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }
    }

    stage = "openai_generate"
    console.info("[api][ai][generate-property][stage]", {
      stage,
      userId: user.id,
      type: input.type,
      city: input.city,
      hasDescription: Boolean(input.description),
    })

    const result = await runWithAiOperationContext(
      {
        route: "/api/ai/generate-property",
        source: "portal",
        userId: user.id,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? null,
        planKey: user.plan ?? null,
        creditsConsumed: creditsUsed,
      },
      () => generatePropertyCopy(input),
    )

    if (user.role === UserRole.BROKER && user.broker) {
      stage = "consume_ai_credits"
      await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType,
        description: "Criar anuncio com IA",
        metadata: {
          source: "api/ai/generate-property",
          title: input.title,
          type: input.type,
          city: input.city,
        },
      })
      creditsConsumed = true
    }

    console.info("[api][ai][generate-property][success]", {
      stage: "completed",
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      resultKeys: Object.keys(result),
    })

    return NextResponse.json(result)
  } catch (caughtError) {
    if (creditsConsumed && user.role === UserRole.BROKER && user.broker) {
      try {
        await refundBrokerAiCredits({
          brokerId: user.broker.id,
          amount: creditsUsed,
          actionType,
          description: "Estorno automatico por falha na geracao com IA",
          metadata: {
            source: "api/ai/generate-property",
            stage,
          },
        })
      } catch (refundError) {
        console.error("[api][ai][generate-property][refund-failed]", {
          userId: user.id,
          stage,
          elapsedMs: Date.now() - startedAt,
          message: refundError instanceof Error ? refundError.message : "unknown",
        })
      }
    }

    if (caughtError instanceof ZodError) {
      console.error("[api][ai][generate-property][validation-failed]", {
        stage,
        userId: user.id,
        elapsedMs: Date.now() - startedAt,
        issues: caughtError.issues,
        payload: payloadForLog,
      })
      return NextResponse.json(
        { error: "Preencha os dados obrigatórios do imóvel antes de gerar o anúncio com IA." },
        { status: 400 },
      )
    }

    console.error("[api][ai][generate-property] failed", {
      stage,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      payload: payloadForLog,
      message: caughtError instanceof Error ? caughtError.message : "unknown",
      stack: caughtError instanceof Error ? caughtError.stack : undefined,
    })

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_DISABLED_OR_NOT_CONFIGURED")) {
      return NextResponse.json(
        { error: "A geração com IA não está configurada neste ambiente." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_EMPTY_RESPONSE")) {
      return NextResponse.json(
        { error: "A IA não retornou um anúncio válido. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_INVALID_JSON")) {
      return NextResponse.json(
        { error: "A resposta da IA veio em um formato inválido. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Não foi possível gerar o anúncio com IA no momento." }, { status: 500 })
  }
}
