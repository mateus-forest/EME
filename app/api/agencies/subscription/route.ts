import { BillingPlan, BillingUserSubscriptionStatus, SubscriptionOwnerType, UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function formatDate(date: Date | null) {
  if (!date) return "Aguardando checkout Stripe"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliaria nao encontrada para esta conta." }, { status: 404 })
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: SubscriptionOwnerType.AGENCY,
          ownerId: user.ownedAgency.id,
        },
      },
    })

    const isActive =
      user.plan === BillingPlan.AGENCY &&
      user.subscriptionStatus === BillingUserSubscriptionStatus.ACTIVE &&
      subscription?.status === "ACTIVE"

    return NextResponse.json({
      subscription: {
        planName: "Plano Imobiliária",
        status: isActive ? "Ativa" : "Inativa",
        currentPrice: "R$ 109,90 / mês",
        brokerRule: "Gestão de corretores incluída no plano",
        nextCharge: isActive ? formatDate(subscription?.nextBillingAt ?? null) : "Aguardando checkout Stripe",
        isActive,
      },
    })
  } catch (caughtError) {
    console.error("[api][agencies][subscription] get failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "Servico de assinatura indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao consultar assinatura da imobiliaria." }, { status: 500 })
  }
}
