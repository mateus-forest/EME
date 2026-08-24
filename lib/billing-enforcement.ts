import { NextResponse } from "next/server"

import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { isServerBillingBypassEnabled } from "@/lib/billing-config"
import { canPlanAccessMarketplace } from "@/lib/billing-lifecycle-policy"
import {
  canCreateBrokerProperties,
  canPublishBrokerProperty,
  createPropertyLimitErrorPayload,
  getBrokerPlanSnapshot,
} from "@/lib/eme-plan-service"

type AuthenticatedUser = User & {
  broker: { id: string } | null
}

type User = {
  plan: string
  subscriptionStatus: string
}

export const billingMessages = {
  brokerInactive:
    "Seu plano Corretor não está ativo para criar novos imóveis. Regularize sua assinatura para continuar.",
  brokerFreeLimit:
    "Seu plano atual atingiu o limite permitido de imóveis. Faça upgrade para continuar.",
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

export async function enforceBrokerPropertyCreation(user: AuthenticatedUser, amount = 1) {
  if (isServerBillingBypassEnabled()) {
    return null
  }

  if (user.broker) {
    const limit = await canCreateBrokerProperties(user.broker.id, amount)
    if (limit.allowed) return null
    return NextResponse.json(createPropertyLimitErrorPayload(), { status: 403 })
  }

  return createBillingBlockedResponse(
    billingMessages.brokerInactive,
    "/corretor/plano",
    "Regularizar plano",
  )
}

export async function enforceBrokerPropertyPublication(
  user: AuthenticatedUser,
  options: { increasesActivePropertyCount?: boolean } = {},
) {
  if (isServerBillingBypassEnabled()) {
    return null
  }

  if (user.broker) {
    const limit = await canPublishBrokerProperty(
      user.broker.id,
      options.increasesActivePropertyCount ?? false,
    )
    if (limit.allowed) return null
    return NextResponse.json(createPropertyLimitErrorPayload(), { status: 403 })
  }

  return createBillingBlockedResponse(
    billingMessages.brokerInactive,
    "/corretor/plano",
    "Regularizar plano",
  )
}

export async function enforceBrokerMarketplaceAccess(user: AuthenticatedUser) {
  if (isServerBillingBypassEnabled()) return null

  if (user.broker) {
    const snapshot = await getBrokerPlanSnapshot(user.broker.id)
    if (canPlanAccessMarketplace(snapshot.planKey)) return null

    return NextResponse.json(
      {
        error: "O Marketplace está disponível nos planos Pro e Scale.",
        code: "MARKETPLACE_PLAN_REQUIRED",
        planKey: snapshot.planKey,
      },
      { status: 403 },
    )
  }

  return createBillingBlockedResponse(
    billingMessages.brokerInactive,
    "/corretor/plano",
    "Regularizar plano",
  )
}

export function enforceAgencyOperationalAccess(user: User) {
  if (isServerBillingBypassEnabled()) {
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
