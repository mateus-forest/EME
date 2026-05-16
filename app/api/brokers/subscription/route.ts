import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function formatDate(date: Date | null) {
  if (!date) return "Assinatura Stripe ativa"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
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
    const subscription = await prisma.subscription.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: SubscriptionOwnerType.BROKER,
          ownerId: user.broker.id,
        },
      },
    })

    const isBrokerPlan = user.plan === BILLING_PLAN.BROKER
    const isActive =
      isBrokerPlan &&
      user.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE &&
      subscription?.status === "ACTIVE"
    const requiresRegularization = isBrokerPlan && !isActive
    const nextCharge = isActive
      ? formatDate(subscription?.nextBillingAt ?? null)
      : requiresRegularization
        ? "Regularização pendente"
        : "Ambiente de avaliação"

    const response = NextResponse.json({
      subscription: {
        id: 5001,
        ownerId: 101,
        ownerType: "broker",
        brokerId: user.broker.id,
        agencyId: null,
        accountType: "BROKER_INDEPENDENT",
        tipoPlano: isBrokerPlan ? "Corretor" : "Plano em teste",
        ultimoPagamento: isActive
          ? "Pagamento confirmado pelo Stripe"
          : requiresRegularization
            ? "Pagamento pendente"
            : "Modo teste",
        proximaCobranca: nextCharge,
        planName: isBrokerPlan ? "Corretor" : "Plano em teste",
        isUpgraded: isActive,
        isAgencyLinked: false,
        propertyLimit: isActive ? null : 3,
        limitLabel: isActive ? "Publicações do plano Corretor" : "3 imóveis no ambiente de avaliação",
        billingPlan: user.plan,
        billingStatus: user.subscriptionStatus,
        requiresRegularization,
        isProfileResolved: true,
        currentPrice: isActive ? "R$ 49,90" : "Modo teste",
        previousPrice: "R$ 89,90",
        status: requiresRegularization ? "Pendente" : isActive ? "Ativo" : "Ambiente de avaliação",
        nextCharge,
        paymentMethod: isActive ? "Stripe" : "Configurar plano",
      },
    })

    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][brokers][subscription] get failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de assinatura está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao consultar assinatura do corretor." }, { status: 500 })
  }
}
