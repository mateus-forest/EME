import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import {
  brokerAssistantSchema,
  generateBrokerAssistantResponse,
  getBrokerAssistantCreditCost,
} from "@/lib/broker-assistant"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
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
  return prisma.broker.findUnique({
    where: { id: brokerId },
    select: {
      aiCreditsBalance: true,
      aiCreditsUsedThisMonth: true,
    },
  })
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
  }

  try {
    const brokerCredits = await getBrokerCredits(user.broker.id)
    if (!brokerCredits) {
      return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
    }

    const response = NextResponse.json(creditsResponse(brokerCredits))
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico do Assessor EME esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Nao foi possivel carregar os creditos do Assessor EME." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
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

    const reserved = await prisma.broker.updateMany({
      where: {
        id: user.broker.id,
        aiCreditsBalance: {
          gte: creditsUsed,
        },
      },
      data: {
        aiCreditsBalance: {
          decrement: creditsUsed,
        },
        aiCreditsUsedThisMonth: {
          increment: creditsUsed,
        },
      },
    })

    if (reserved.count === 0) {
      const brokerCredits = await getBrokerCredits(user.broker.id)
      return NextResponse.json(
        {
          error: "Creditos insuficientes para usar o Assessor EME.",
          ...(brokerCredits ? creditsResponse(brokerCredits) : { credits: { balance: 0, usedThisMonth: 0 } }),
        },
        { status: 402 },
      )
    }

    try {
      const assistantResponse = await generateBrokerAssistantResponse(input.prompt, input.actionType)
      const updatedBroker = await getBrokerCredits(user.broker.id)

      if (!updatedBroker) {
        return NextResponse.json({ error: "Corretor nao encontrado para esta conta." }, { status: 404 })
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
      await prisma.broker.update({
        where: { id: user.broker.id },
        data: {
          aiCreditsBalance: {
            increment: creditsUsed,
          },
          aiCreditsUsedThisMonth: {
            decrement: creditsUsed,
          },
        },
      })

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
        { error: "O servico do Assessor EME esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Nao foi possivel acionar o Assessor EME agora." }, { status: 500 })
  }
}
