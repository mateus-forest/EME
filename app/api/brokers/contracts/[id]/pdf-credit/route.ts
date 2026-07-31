import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits } from "@/lib/eme-plan-service"
import { getEmeCreditCost } from "@/lib/eme-plans"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const { id } = await context.params
    const document = await prisma.brokerDocument.findFirst({
      where: { id, brokerId: user.broker.id, type: "contract" },
      select: { id: true, title: true },
    })

    if (!document) {
      return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
    }

    const actionType = "generate_contract_pdf"
    const creditsUsed = getEmeCreditCost(actionType)
    const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)

    if (!credits.allowed) {
      return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
    }

    const updatedCredits = await consumeBrokerAiCredits({
      brokerId: user.broker.id,
      amount: creditsUsed,
      actionType,
      description: "Gerar contrato PDF",
      metadata: {
        source: "api/brokers/contracts/pdf-credit",
        documentId: document.id,
        documentTitle: document.title,
      },
    })

    return NextResponse.json({
      creditsUsed,
      credits: updatedCredits,
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de contratos indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível preparar o PDF." }, { status: 500 })
  }
}
