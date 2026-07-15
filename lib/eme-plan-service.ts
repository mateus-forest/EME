import "server-only"

import type { Prisma } from "@prisma/client"

import {
  EME_EXTRA_PACKAGES,
  EME_INSUFFICIENT_CREDITS_MESSAGE,
  EME_PLANS,
  EME_PROPERTY_LIMIT_MESSAGE,
  getEmeCreditCost,
  normalizeEmePlanKey,
  type EmeExtraPackageKey,
  type EmePlanKey,
} from "@/lib/eme-plans"
import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { prisma } from "@/lib/prisma"

type BrokerBillingUser = {
  plan?: string | null
  subscriptionStatus?: string | null
}

function planFromLegacyBilling(user?: BrokerBillingUser | null): EmePlanKey {
  if (
    user?.plan === BILLING_PLAN.BROKER &&
    user.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE
  ) {
    return "pro"
  }

  return "free"
}

export function createPropertyLimitErrorPayload() {
  return {
    error: EME_PROPERTY_LIMIT_MESSAGE,
    billingBlocked: true,
    ctaHref: "/corretor/plano",
    ctaLabel: "Ver planos",
  }
}

export function createInsufficientCreditsPayload() {
  return {
    error: EME_INSUFFICIENT_CREDITS_MESSAGE,
    creditsBlocked: true,
    ctaHref: "/corretor/plano",
    ctaLabel: "Comprar créditos",
  }
}

export async function ensureBrokerPlanAccount(brokerId: string) {
  const broker = await prisma.broker.findUnique({
    where: { id: brokerId },
    select: {
      id: true,
      aiCreditsBalance: true,
      user: {
        select: {
          plan: true,
          subscriptionStatus: true,
        },
      },
      planAccount: true,
    },
  })

  if (!broker) throw new Error("BROKER_NOT_FOUND")

  const defaultPlanKey = planFromLegacyBilling(broker.user)
  const account = await prisma.brokerPlanAccount.upsert({
    where: { brokerId },
    create: {
      brokerId,
      planKey: defaultPlanKey,
    },
    update: {},
  })

  if (!account.initialCreditsGrantedAt) {
    const plan = EME_PLANS[normalizeEmePlanKey(account.planKey)]
    const creditsToGrant = Math.max(0, plan.initialAiCredits - broker.aiCreditsBalance)
    return prisma.$transaction(async (tx) => {
      const updatedBroker = creditsToGrant > 0
        ? await tx.broker.update({
            where: { id: brokerId },
            data: {
              aiCreditsBalance: { increment: creditsToGrant },
            },
            select: { aiCreditsBalance: true },
          })
        : await tx.broker.findUniqueOrThrow({
            where: { id: brokerId },
            select: { aiCreditsBalance: true },
          })

      await tx.brokerPlanAccount.update({
        where: { brokerId },
        data: { initialCreditsGrantedAt: new Date() },
      })

      await tx.aiCreditTransaction.create({
        data: {
          brokerId,
          type: "plan_initial_grant",
          amount: creditsToGrant,
          balanceAfter: updatedBroker.aiCreditsBalance,
          description: `${plan.name}: créditos IA iniciais`,
          metadata: { planKey: plan.key } satisfies Prisma.InputJsonObject,
        },
      })

      return tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
    })
  }

  return account
}

export async function getBrokerPlanSnapshot(brokerId: string) {
  const account = await ensureBrokerPlanAccount(brokerId)
  const planKey = normalizeEmePlanKey(account.planKey)
  const plan = EME_PLANS[planKey]
  const [propertyCount, broker] = await Promise.all([
    prisma.property.count({ where: { brokerId } }),
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    }),
  ])
  const propertyLimit = plan.propertyLimit + account.propertyExtraLimit

  return {
    plan,
    planKey,
    account,
    propertyCount,
    propertyLimit,
    propertyExtraLimit: account.propertyExtraLimit,
    remainingProperties: Math.max(0, propertyLimit - propertyCount),
    aiCreditsBalance: broker?.aiCreditsBalance ?? 0,
    aiCreditsUsedThisMonth: broker?.aiCreditsUsedThisMonth ?? 0,
  }
}

export async function canCreateBrokerProperties(brokerId: string, amount = 1) {
  const snapshot = await getBrokerPlanSnapshot(brokerId)
  const requested = Math.max(1, Math.trunc(amount))
  const allowed = snapshot.propertyCount + requested <= snapshot.propertyLimit

  return {
    allowed,
    message: allowed ? "" : EME_PROPERTY_LIMIT_MESSAGE,
    ...snapshot,
    requested,
  }
}

export async function canPublishBrokerProperty(brokerId: string) {
  const snapshot = await getBrokerPlanSnapshot(brokerId)
  const allowed = snapshot.propertyCount <= snapshot.propertyLimit

  return {
    allowed,
    message: allowed ? "" : EME_PROPERTY_LIMIT_MESSAGE,
    ...snapshot,
  }
}

export async function getBrokerAiCreditBalance(brokerId: string) {
  await ensureBrokerPlanAccount(brokerId)
  const broker = await prisma.broker.findUnique({
    where: { id: brokerId },
    select: {
      aiCreditsBalance: true,
      aiCreditsUsedThisMonth: true,
    },
  })

  return {
    balance: broker?.aiCreditsBalance ?? 0,
    usedThisMonth: broker?.aiCreditsUsedThisMonth ?? 0,
  }
}

export async function hasBrokerAiCredits(brokerId: string, amountOrAction: number | string) {
  const amount = typeof amountOrAction === "number" ? amountOrAction : getEmeCreditCost(amountOrAction)
  const credits = await getBrokerAiCreditBalance(brokerId)
  return {
    allowed: credits.balance >= amount,
    amount,
    ...credits,
    message: credits.balance >= amount ? "" : EME_INSUFFICIENT_CREDITS_MESSAGE,
  }
}

export async function consumeBrokerAiCredits({
  brokerId,
  amount,
  actionType,
  description,
  metadata,
}: {
  brokerId: string
  amount: number
  actionType: string
  description: string
  metadata?: Prisma.InputJsonObject
}) {
  const credits = Math.max(0, Math.trunc(amount))
  if (credits === 0) {
    return getBrokerAiCreditBalance(brokerId)
  }

  await ensureBrokerPlanAccount(brokerId)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.broker.updateMany({
      where: {
        id: brokerId,
        aiCreditsBalance: { gte: credits },
      },
      data: {
        aiCreditsBalance: { decrement: credits },
        aiCreditsUsedThisMonth: { increment: credits },
        aiMonthlyUsage: { increment: credits },
        aiLastInteractionAt: new Date(),
      },
    })

    if (updated.count === 0) {
      throw new Error("INSUFFICIENT_AI_CREDITS")
    }

    const broker = await tx.broker.findUniqueOrThrow({
      where: { id: brokerId },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    })

    await tx.aiCreditTransaction.create({
      data: {
        brokerId,
        type: "usage",
        amount: -credits,
        balanceAfter: broker.aiCreditsBalance,
        actionType,
        description,
        metadata,
      },
    })

    return {
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
    }
  })
}

export async function refundBrokerAiCredits({
  brokerId,
  amount,
  actionType,
  description,
  metadata,
}: {
  brokerId: string
  amount: number
  actionType: string
  description: string
  metadata?: Prisma.InputJsonObject
}) {
  const credits = Math.max(0, Math.trunc(amount))
  if (credits === 0) {
    return getBrokerAiCreditBalance(brokerId)
  }

  await ensureBrokerPlanAccount(brokerId)

  return prisma.$transaction(async (tx) => {
    const broker = await tx.broker.update({
      where: { id: brokerId },
      data: {
        aiCreditsBalance: { increment: credits },
        aiCreditsUsedThisMonth: { decrement: credits },
        aiMonthlyUsage: { decrement: credits },
        aiLastInteractionAt: new Date(),
      },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    })

    await tx.aiCreditTransaction.create({
      data: {
        brokerId,
        type: "refund",
        amount: credits,
        balanceAfter: broker.aiCreditsBalance,
        actionType,
        description,
        metadata,
      },
    })

    return {
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
    }
  })
}

export async function registerExtraPackagePurchase({
  brokerId,
  packageKey,
  status = "registered",
  metadata,
}: {
  brokerId: string
  packageKey: EmeExtraPackageKey
  status?: string
  metadata?: Prisma.InputJsonObject
}) {
  const pack = EME_EXTRA_PACKAGES[packageKey]
  if (!pack) throw new Error("INVALID_EXTRA_PACKAGE")

  return prisma.$transaction(async (tx) => {
    await tx.brokerPlanAccount.upsert({
      where: { brokerId },
      create: { brokerId, planKey: "free" },
      update: {},
    })

    const purchase = await tx.extraPackagePurchase.create({
      data: {
        brokerId,
        packageKey,
        packageType: pack.type,
        quantity: pack.quantity,
        amountCents: pack.priceCents,
        status,
        metadata,
      },
    })

    if (status === "completed" || status === "registered") {
      if (pack.type === "credit") {
        const broker = await tx.broker.update({
          where: { id: brokerId },
          data: {
            aiCreditsBalance: { increment: pack.quantity },
          },
          select: { aiCreditsBalance: true },
        })

        await tx.aiCreditTransaction.create({
          data: {
            brokerId,
            type: "package_purchase",
            amount: pack.quantity,
            balanceAfter: broker.aiCreditsBalance,
            description: pack.label,
            metadata: { packageKey, purchaseId: purchase.id } satisfies Prisma.InputJsonObject,
          },
        })
      } else {
        await tx.brokerPlanAccount.update({
          where: { brokerId },
          data: {
            propertyExtraLimit: { increment: pack.quantity },
          },
        })
      }
    }

    return purchase
  })
}
