import {
  type Broker,
  type User,
} from "@prisma/client"
import { NextResponse } from "next/server"

import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { isBillingBypassEnabled } from "@/lib/billing-config"
import { prisma } from "@/lib/prisma"

const BROKER_FREE_PROPERTY_LIMIT = 3

type AuthenticatedUser = User & {
  broker: Broker | null
}

export const billingMessages = {
  brokerInactive:
    "Seu plano Corretor não está ativo para criar novos imóveis. Regularize sua assinatura para continuar.",
  brokerFreeLimit:
    "Seu plano atual atingiu o limite permitido de 3 imóveis. Faça upgrade para continuar.",
  agencyInactive:
    "Seu plano da imobiliária não está ativo para executar essa ação. Ative ou regularize sua assinatura para continuar.",
} as const

function createBillingBlockedResponse(error: string, ctaHref: string, ctaLabel: string) {
  return NextResponse.json(
    {
      error,
      billingBlocked: true,
      ctaHref,
      ctaLabel,
    },
    { status: 403 },
  )
}

export async function enforceBrokerPropertyCreation(user: AuthenticatedUser) {
  if (isBillingBypassEnabled()) {
    return null
  }

  const hasActiveBrokerPlan =
    user.plan === BILLING_PLAN.BROKER &&
    user.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE

  if (hasActiveBrokerPlan) {
    return null
  }

  if (user.plan === BILLING_PLAN.NONE && user.broker) {
    const totalProperties = await prisma.property.count({
      where: {
        brokerId: user.broker.id,
      },
    })

    if (totalProperties < BROKER_FREE_PROPERTY_LIMIT) {
      return null
    }

    return createBillingBlockedResponse(
      billingMessages.brokerFreeLimit,
      "/corretor/plano",
      "Fazer upgrade",
    )
  }

  return createBillingBlockedResponse(
    billingMessages.brokerInactive,
    "/corretor/plano",
    "Regularizar plano",
  )
}

export function enforceAgencyOperationalAccess(user: User) {
  if (isBillingBypassEnabled()) {
    return null
  }

  const hasActiveAgencyPlan =
    user.plan === BILLING_PLAN.AGENCY &&
    user.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE

  if (hasActiveAgencyPlan) {
    return null
  }

  return createBillingBlockedResponse(
    billingMessages.agencyInactive,
    "/imobiliaria/plano",
    "Ativar assinatura",
  )
}
