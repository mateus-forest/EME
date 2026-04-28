import {
  BillingPlan,
  BillingUserSubscriptionStatus,
  SubscriptionStatus,
  SubscriptionOwnerType,
  UserRole,
} from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"

export function getBillingPlanFromRole(role: UserRole) {
  if (role === UserRole.BROKER) return BillingPlan.BROKER
  if (role === UserRole.AGENCY) return BillingPlan.AGENCY
  return BillingPlan.NONE
}

export function getCheckoutPriceIdForRole(role: UserRole) {
  if (role === UserRole.BROKER) {
    return process.env.STRIPE_PRICE_BROKER ?? process.env.STRIPE_BROKER_PRICE_ID ?? ""
  }

  if (role === UserRole.AGENCY) {
    return process.env.STRIPE_PRICE_AGENCY ?? process.env.STRIPE_AGENCY_PRICE_ID ?? ""
  }

  return ""
}

export function getPlanLabel(plan: BillingPlan) {
  if (plan === BillingPlan.BROKER) return "BROKER"
  if (plan === BillingPlan.AGENCY) return "AGENCY"
  return "NONE"
}

export async function activateBillingForUser(input: {
  userId: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  plan: BillingPlan
  nextBillingAt?: Date | null
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

function mapSubscriptionStatusToUserStatus(status: SubscriptionStatus) {
  return status === SubscriptionStatus.ACTIVE
    ? BillingUserSubscriptionStatus.ACTIVE
    : BillingUserSubscriptionStatus.INACTIVE
}

async function upsertOwnerSubscription(input: {
  ownerType: SubscriptionOwnerType
  ownerId: string
  status: SubscriptionStatus
  nextBillingAt?: Date | null
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
    },
    create: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      status: input.status,
      nextBillingAt: input.nextBillingAt ?? undefined,
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
    })
  }

  if (user.role === UserRole.AGENCY && user.ownedAgency) {
    await upsertOwnerSubscription({
      ownerType: SubscriptionOwnerType.AGENCY,
      ownerId: user.ownedAgency.id,
      status: input.subscriptionStatus,
      nextBillingAt: input.nextBillingAt,
    })
  }

  return user
}

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end
  return periodEnd ? new Date(periodEnd * 1000) : null
}

export async function syncBillingFromStripeSubscription(subscription: Stripe.Subscription) {
  const userId = typeof subscription.metadata.userId === "string" ? subscription.metadata.userId : ""
  const plan = mapStripePlan(subscription.metadata.plan)
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null
  const status = mapStripeStatusToSubscriptionStatus(subscription.status)

  if (!userId || plan === BillingPlan.NONE) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    })

    if (!user) return null

    return syncBillingForUser({
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan: user.plan,
      subscriptionStatus: status,
      nextBillingAt: getSubscriptionPeriodEnd(subscription),
    })
  }

  return syncBillingForUser({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    plan,
    subscriptionStatus: status,
    nextBillingAt: getSubscriptionPeriodEnd(subscription),
  })
}

export function mapStripePlan(value: string | null | undefined) {
  if (value === "BROKER") return BillingPlan.BROKER
  if (value === "AGENCY") return BillingPlan.AGENCY
  return BillingPlan.NONE
}
