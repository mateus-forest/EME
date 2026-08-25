import { SubscriptionOwnerType, SubscriptionStatus, UserRole } from "@/lib/prisma-enums"

import type Stripe from "stripe"

import {
  BILLING_PLAN,
  BILLING_USER_SUBSCRIPTION_STATUS,
  type BillingPlan,
  type BillingUserSubscriptionStatus,
} from "@/lib/billing-types"
import { getStripeEnv } from "@/lib/env.server"
import {
  resolvePropertyCapacityQuantity,
  resolveStripeSubscriptionCancellationState,
  resolveStrictStripePlanKey,
} from "@/lib/billing-lifecycle-policy"
import {
  resolveEmePlanUpgradeTarget,
  type EmeExtraPackageKey,
  type EmePlanKey,
} from "@/lib/eme-plans"
import {
  syncBrokerPlanAccountFromStripe,
  syncBrokerPropertyCapacityAddon,
} from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"

export function getBillingPlanFromRole(role: UserRole) {
  if (role === UserRole.BROKER) return BILLING_PLAN.BROKER
  if (role === UserRole.AGENCY) return BILLING_PLAN.AGENCY
  return BILLING_PLAN.NONE
}

// Tiers de assinatura pagos que uma conta BROKER pode escolher no checkout.
// Contas AGENCY continuam fixas em "scale" (não mudado aqui, fora do escopo deste bug).
export type BrokerCheckoutPlanKey = Extract<EmePlanKey, "pro" | "scale">

export function isBrokerCheckoutPlanKey(value: unknown): value is BrokerCheckoutPlanKey {
  return value === "pro" || value === "scale"
}

// Substitui getCheckoutPriceIdForRole: o preço precisa depender do plano
// (Pro vs Scale) que o usuário de fato clicou, não só do role da conta —
// role sozinho não diferencia porque uma conta BROKER pode assinar Pro OU Scale.
export function getCheckoutPriceIdForPlan(planKey: BrokerCheckoutPlanKey) {
  const stripeEnv = getStripeEnv()
  return planKey === "scale" ? stripeEnv.scalePriceId : stripeEnv.proPriceId
}

export function resolveBrokerUpgradeCheckoutPlanKey(
  currentPlanKey: EmePlanKey,
  requestedPlanKey?: string | null,
): BrokerCheckoutPlanKey | null {
  return resolveEmePlanUpgradeTarget(currentPlanKey, requestedPlanKey)
}

// Deriva o tier (pro/scale) real a partir do price ID confirmado pelo Stripe,
// para sincronizar BrokerPlanAccount.planKey no webhook (ver syncBillingForUser).
export function mapStripePriceIdToEmePlanKey(priceId: string | null | undefined): BrokerCheckoutPlanKey | null {
  const normalizedPriceId = typeof priceId === "string" ? priceId.trim() : ""
  if (!normalizedPriceId) return null

  const stripeEnv = getStripeEnv()
  return resolveStrictStripePlanKey(normalizedPriceId, {
    pro: stripeEnv.proPriceId,
    scale: stripeEnv.scalePriceId,
  })
}

export function mapStripePriceIdToPropertyCapacity(priceId: string | null | undefined) {
  const stripeEnv = getStripeEnv()

  return resolvePropertyCapacityQuantity(priceId, {
    capacity100: stripeEnv.property50PriceId,
    capacity250: stripeEnv.property100PriceId,
    capacity500: stripeEnv.property200PriceId,
  })
}

export function getStripePlanItem(subscription: Stripe.Subscription) {
  return (
    subscription.items.data.find((item) => mapStripePriceIdToEmePlanKey(item.price.id) !== null) ??
    null
  )
}

export function getStripePropertyCapacityItems(subscription: Stripe.Subscription) {
  return subscription.items.data.filter(
    (item) => mapStripePriceIdToPropertyCapacity(item.price.id) !== null,
  )
}

export function getCheckoutPriceIdForPackage(packageKey: EmeExtraPackageKey) {
  const stripeEnv = getStripeEnv()

  switch (packageKey) {
    case "credit_250":
      return stripeEnv.credit250PriceId
    case "credit_750":
      return stripeEnv.credit750PriceId
    case "credit_1500":
      return stripeEnv.credit1500PriceId
    case "credit_3000":
      return stripeEnv.credit3000PriceId
    case "property_250":
      return stripeEnv.property50PriceId
    case "property_500":
      return stripeEnv.property100PriceId
    case "property_1000":
      return stripeEnv.property200PriceId
    default:
      return ""
  }
}

export function getPlanLabel(plan: BillingPlan) {
  if (plan === BILLING_PLAN.BROKER) return "PRO"
  if (plan === BILLING_PLAN.AGENCY) return "SCALE"
  return "NONE"
}

export function mapStripePriceIdToPlan(priceId: string | null | undefined) {
  const normalizedPriceId = typeof priceId === "string" ? priceId.trim() : ""
  if (!normalizedPriceId) return BILLING_PLAN.NONE

  const stripeEnv = getStripeEnv()

  if (normalizedPriceId === stripeEnv.proPriceId) {
    return BILLING_PLAN.BROKER
  }

  if (normalizedPriceId === stripeEnv.scalePriceId) {
    return BILLING_PLAN.AGENCY
  }

  return BILLING_PLAN.NONE
}

export async function activateBillingForUser(input: {
  userId: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  plan: BillingPlan
  nextBillingAt?: Date | null
  emePlanKey?: BrokerCheckoutPlanKey | null
}) {
  return syncBillingForUser({
    ...input,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
  })
}

function mapStripeStatusToSubscriptionStatus(status: Stripe.Subscription.Status | string | null | undefined) {
  if (status === "active" || status === "trialing") return SubscriptionStatus.ACTIVE
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return SubscriptionStatus.PAST_DUE
  return SubscriptionStatus.CANCELED
}

function mapSubscriptionStatusToUserStatus(status: SubscriptionStatus): BillingUserSubscriptionStatus {
  return status === SubscriptionStatus.ACTIVE
    ? BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE
    : BILLING_USER_SUBSCRIPTION_STATUS.INACTIVE
}

async function upsertOwnerSubscription(input: {
  ownerType: SubscriptionOwnerType
  ownerId: string
  status: SubscriptionStatus
  nextBillingAt?: Date | null
  cancelAtPeriodEnd?: boolean
  cancelAt?: Date | null
}) {
  return prisma.subscription.upsert({
    where: {
      ownerType_ownerId: {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
      },
    },
    update: {
      status: input.status,
      nextBillingAt: input.nextBillingAt ?? undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      cancelAt: input.cancelAt,
    },
    create: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      status: input.status,
      nextBillingAt: input.nextBillingAt ?? undefined,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      cancelAt: input.cancelAt ?? null,
    },
  })
}

export async function syncBillingForUser(input: {
  userId: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  plan: BillingPlan
  subscriptionStatus: SubscriptionStatus
  nextBillingAt?: Date | null
  cancelAtPeriodEnd?: boolean
  cancelAt?: Date | null
  emePlanKey?: BrokerCheckoutPlanKey | null
}) {
  const user = await prisma.user.update({
    where: { id: input.userId },
    data: {
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      plan: input.plan,
      subscriptionStatus: mapSubscriptionStatusToUserStatus(input.subscriptionStatus),
    },
    include: {
      broker: true,
      ownedAgency: true,
    },
  })

  if (user.role === UserRole.BROKER && user.broker) {
    await upsertOwnerSubscription({
      ownerType: SubscriptionOwnerType.BROKER,
      ownerId: user.broker.id,
      status: input.subscriptionStatus,
      nextBillingAt: input.nextBillingAt,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      cancelAt: input.cancelAt,
    })

    // BrokerPlanAccount.planKey é a fonte real lida pela tela de Plano e pelos
    // limites de uso (lib/eme-plans.ts) — precisa ser sincronizada aqui, e não só
    // no User.plan legado, senão upgrade/downgrade/cancelamento nunca refletem.
    await syncBrokerPlanAccountFromStripe({
      brokerId: user.broker.id,
      planKey: input.emePlanKey ?? null,
      subscriptionStatus: input.subscriptionStatus,
    })
  }

  if (user.role === UserRole.AGENCY && user.ownedAgency) {
    await upsertOwnerSubscription({
      ownerType: SubscriptionOwnerType.AGENCY,
      ownerId: user.ownedAgency.id,
      status: input.subscriptionStatus,
      nextBillingAt: input.nextBillingAt,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      cancelAt: input.cancelAt,
    })
  }

  return user
}

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = getStripePlanItem(subscription)?.current_period_end
  return periodEnd ? new Date(periodEnd * 1000) : null
}

export async function syncBillingFromStripeSubscription(subscription: Stripe.Subscription) {
  const userId = typeof subscription.metadata.userId === "string" ? subscription.metadata.userId : ""
  const priceId = getStripePlanItem(subscription)?.price.id ?? null
  const plan = mapStripePriceIdToPlan(priceId)
  const emePlanKey = mapStripePriceIdToEmePlanKey(priceId)
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null
  const status = mapStripeStatusToSubscriptionStatus(subscription.status)
  const periodEnd = getSubscriptionPeriodEnd(subscription)
  const cancellationState = resolveStripeSubscriptionCancellationState({
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAtUnix: subscription.cancel_at,
    periodEndUnix: periodEnd ? Math.floor(periodEnd.getTime() / 1_000) : null,
  })
  const nextBillingAt = cancellationState.nextBillingAtUnix
    ? new Date(cancellationState.nextBillingAtUnix * 1_000)
    : null
  const cancelAt = cancellationState.cancelAtUnix
    ? new Date(cancellationState.cancelAtUnix * 1_000)
    : null

  if (plan === BILLING_PLAN.NONE || emePlanKey === null) {
    console.error("[billing] Stripe subscription has an unmapped Price ID", {
      subscriptionId: subscription.id,
      priceId,
    })
    return null
  }

  let syncedUser: Awaited<ReturnType<typeof syncBillingForUser>> | null = null

  if (!userId) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) return null

    syncedUser = await syncBillingForUser({
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan: user.plan,
      subscriptionStatus: status,
      nextBillingAt,
      cancelAtPeriodEnd: cancellationState.cancelAtPeriodEnd,
      cancelAt,
      emePlanKey,
    })
  } else {
    syncedUser = await syncBillingForUser({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan,
      subscriptionStatus: status,
      nextBillingAt,
      cancelAtPeriodEnd: cancellationState.cancelAtPeriodEnd,
      cancelAt,
      emePlanKey,
    })
  }

  if (syncedUser.broker) {
    const capacityItem = getStripePropertyCapacityItems(subscription)[0] ?? null
    const capacityQuantity = mapStripePriceIdToPropertyCapacity(capacityItem?.price.id)
    const subscriptionIsActive =
      subscription.status === "active" || subscription.status === "trialing"

    await syncBrokerPropertyCapacityAddon({
      brokerId: syncedUser.broker.id,
      status:
        subscription.status === "canceled"
          ? "CANCELED"
          : subscriptionIsActive && capacityItem && capacityQuantity
            ? "ACTIVE"
            : "INACTIVE",
      quantity: capacityQuantity,
      stripePriceId: capacityItem?.price.id ?? null,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionItemId: capacityItem?.id ?? null,
      currentPeriodStart: capacityItem?.current_period_start
        ? new Date(capacityItem.current_period_start * 1000)
        : null,
      currentPeriodEnd: capacityItem?.current_period_end
        ? new Date(capacityItem.current_period_end * 1000)
        : null,
    })
  }

  return syncedUser
}

export function mapStripePlan(value: string | null | undefined) {
  if (value === "BROKER" || value === "PRO") return BILLING_PLAN.BROKER
  if (value === "AGENCY" || value === "SCALE") return BILLING_PLAN.AGENCY
  return BILLING_PLAN.NONE
}
