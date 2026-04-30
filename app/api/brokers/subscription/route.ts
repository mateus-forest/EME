import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
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

    const isBrokerPlan = user.plan === BILLING_PLAN.BROKER
    const isActive =
      isBrokerPlan &&
      user.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE &&
      subscription?.status === "ACTIVE"
    const isAgencyLinked = Boolean(user.broker.agencyId)
    const requiresRegularization = isBrokerPlan && !isActive && !isAgencyLinked
    const nextCharge = isActive
      ? formatDate(subscription?.nextBillingAt ?? null)
      : isAgencyLinked
        ? "Gerenciado pela imobiliária"
      : requiresRegularization
        ? "Regularização pendente"
        : "Plano gratuito ativo"

    return NextResponse.json({
      subscription: {
        id: 5001,
        ownerId: 101,
        ownerType: "broker",
        tipoPlano: isAgencyLinked ? "Equipe da imobiliária" : isBrokerPlan ? "Corretor" : "Gratuito",
        ultimoPagamento: isAgencyLinked
          ? "Plano gerenciado pela imobiliária"
          : isActive
          ? "Pagamento confirmado pelo Stripe"
          : requiresRegularization
            ? "Pagamento pendente"
            : "Plano gratuito",
        proximaCobranca: nextCharge,
        planName: isAgencyLinked ? "Equipe da imobiliária" : isBrokerPlan ? "Corretor" : "Gratuito",
        isUpgraded: isActive,
        isAgencyLinked,
        propertyLimit: isActive || isAgencyLinked ? 999 : 3,
        limitLabel: isAgencyLinked
          ? "Publicações gerenciadas pela imobiliária"
          : isActive
            ? "Publicações do plano Corretor"
            : "3 imóveis gratuitos",
        billingPlan: user.plan,
        billingStatus: user.subscriptionStatus,
        requiresRegularization,
        currentPrice: isAgencyLinked ? "Plano da imobiliária" : "R$ 49,90",
        previousPrice: "R$ 89,90",
        status: requiresRegularization ? "Cancelado" : "Ativo",
        nextCharge,
        paymentMethod: isAgencyLinked ? "Imobiliária responsável" : isBrokerPlan ? "Stripe" : "Checkout Stripe",
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
