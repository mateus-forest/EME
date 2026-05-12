import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

const AGENCY_BASE_PRICE_CENTS = 10_990

function formatDate(date: Date | null) {
  if (!date) return "Aguardando checkout Stripe"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100)
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
      user.plan === BILLING_PLAN.AGENCY &&
      user.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE &&
      subscription?.status === "ACTIVE"
    const activeBrokerCount = await prisma.broker.count({
      where: {
        agencyId: user.ownedAgency.id,
        status: "ACTIVE",
      },
    })

    return NextResponse.json({
      subscription: {
        planName: "Plano Imobiliária",
        status: isActive ? "Ativa" : "Inativa",
        currentPrice: `${formatCurrency(AGENCY_BASE_PRICE_CENTS)} / mês + uso`,
        basePrice: `${formatCurrency(AGENCY_BASE_PRICE_CENTS)} / mês`,
        brokerUnitPrice: "Medidor configurado no Stripe",
        activeBrokerCount,
        brokerRule: `${activeBrokerCount} corretor${activeBrokerCount === 1 ? "" : "es"} ativo${activeBrokerCount === 1 ? "" : "s"} medido${activeBrokerCount === 1 ? "" : "s"} no Stripe`,
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
