import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import {
  brokerAssistantSchema,
  generateBrokerAssistantResponse,
  getBrokerAssistantCreditCost,
} from "@/lib/broker-assistant"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, getBrokerAiCreditBalance, hasBrokerAiCredits } from "@/lib/eme-plan-service"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { getOpenAIClient } from "@/lib/openai-server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function creditsResponse(broker: { aiCreditsBalance: number; aiCreditsUsedThisMonth: number }) {
  return {
    credits: {
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
    },
  }
}

async function getBrokerCredits(brokerId: string) {
  const credits = await getBrokerAiCreditBalance(brokerId)
  return {
    aiCreditsBalance: credits.balance,
    aiCreditsUsedThisMonth: credits.usedThisMonth,
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  try {
    const brokerCredits = await getBrokerCredits(user.broker.id)
    if (!brokerCredits) {
      return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
    }

    const response = NextResponse.json(creditsResponse(brokerCredits))
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço do Assessor EME está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Não foi possível carregar os créditos do Assessor EME." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => null)
    const input = brokerAssistantSchema.parse({
      prompt: body?.prompt,
      actionType: body?.actionType,
    })

    if (!getOpenAIClient()) {
      return NextResponse.json({ error: "O Assessor EME precisa da IA ativada para responder." }, { status: 503 })
    }

    const creditsUsed = getBrokerAssistantCreditCost(input.actionType)
    const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)
    if (!credits.allowed) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          ...createInsufficientCreditsPayload(),
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 } }),
        },
        { status: 402 },
      )
    }

    try {
      const assistantResponse = await runWithAiOperationContext(
        {
          route: "/api/ai/broker-assistant",
          source: "portal",
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          creditsConsumed: creditsUsed,
        },
        () => generateBrokerAssistantResponse(input.prompt, input.actionType),
      )
      const updatedCredits = await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType: input.actionType,
        description: `Assessor EME: ${input.actionType}`,
        metadata: {
          source: "api/ai/broker-assistant",
          actionType: input.actionType,
        },
      })
      const updatedBroker = {
        aiCreditsBalance: updatedCredits.balance,
        aiCreditsUsedThisMonth: updatedCredits.usedThisMonth,
      }

      if (!updatedBroker) {
        return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
      }

      await prisma.aiAssistantInteraction.create({
        data: {
          userId: user.id,
          brokerId: user.broker.id,
          prompt: input.prompt,
          response: assistantResponse,
          actionType: input.actionType,
          creditsUsed,
        },
      })

      const response = NextResponse.json({
        response: assistantResponse,
        creditsUsed,
        ...creditsResponse(updatedBroker),
      })
      response.headers.set("Cache-Control", "no-store, max-age=0")
      return response
    } catch (assistantError) {
      const isOpenAIUnavailable =
        assistantError instanceof Error && assistantError.message.includes("OPENAI_DISABLED_OR_NOT_CONFIGURED")

      if (isOpenAIUnavailable) {
        return NextResponse.json({ error: "O Assessor EME precisa da IA ativada para responder." }, { status: 503 })
      }

      throw assistantError
    }
  } catch (caughtError) {
    console.error("[api][ai][broker-assistant] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço do Assessor EME está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Não foi possível acionar o Assessor EME agora." }, { status: 500 })
  }
}
