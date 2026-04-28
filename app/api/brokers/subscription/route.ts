import { BillingPlan, BillingUserSubscriptionStatus, SubscriptionOwnerType, UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

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

    const isBrokerPlan = user.plan === BillingPlan.BROKER
    const isActive =
      isBrokerPlan &&
      user.subscriptionStatus === BillingUserSubscriptionStatus.ACTIVE &&
      subscription?.status === "ACTIVE"
    const requiresRegularization = isBrokerPlan && !isActive
    const nextCharge = isActive
      ? formatDate(subscription?.nextBillingAt ?? null)
      : requiresRegularization
        ? "Regularização pendente"
        : "Plano gratuito ativo"

    return NextResponse.json({
      subscription: {
        id: 5001,
        ownerId: 101,
        ownerType: "broker",
        tipoPlano: isBrokerPlan ? "Corretor" : "Gratuito",
        ultimoPagamento: isActive
          ? "Pagamento confirmado pelo Stripe"
          : requiresRegularization
            ? "Pagamento pendente"
            : "Plano gratuito",
        proximaCobranca: nextCharge,
        planName: isBrokerPlan ? "Corretor" : "Gratuito",
        isUpgraded: isActive,
        propertyLimit: isActive ? 999 : 3,
        billingPlan: user.plan,
        billingStatus: user.subscriptionStatus,
        requiresRegularization,
        currentPrice: "R$ 49,90",
        previousPrice: "R$ 89,90",
        status: requiresRegularization ? "Cancelado" : "Ativo",
        nextCharge,
        paymentMethod: isBrokerPlan ? "Stripe" : "Checkout Stripe",
      },
    })
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
