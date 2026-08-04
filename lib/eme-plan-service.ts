import "server-only"

import type { Prisma } from "@prisma/client"

import {
  EME_ACTIVE_PROPERTY_STATUSES,
  EME_COS_CONTEXT_ACTIONS,
  EME_COS_SIMPLE_QUERY_ACTIONS,
  EME_EXTRA_PACKAGES,
  EME_FREE_COS_ACTIONS,
  EME_INSUFFICIENT_CREDITS_MESSAGE,
  EME_PLANS,
  EME_PROPERTY_LIMIT_MESSAGE,
  getEmeCreditCost,
  normalizeEmePlanKey,
  type EmeCreditActionKey,
  type EmeExtraPackageKey,
  type EmePlanKey,
} from "@/lib/eme-plans"
import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { prisma } from "@/lib/prisma"

type BrokerBillingUser = {
  plan?: string | null
  subscriptionStatus?: string | null
}

type BrokerPlanAccountRecord = Awaited<ReturnType<typeof prisma.brokerPlanAccount.findUniqueOrThrow>>

const ACTIVE_PROPERTY_WHERE = {
  status: {
    in: [...EME_ACTIVE_PROPERTY_STATUSES],
  },
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

function getCurrentPeriodStart(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0)
}

function isSamePeriodMonth(a: Date | null | undefined, b: Date) {
  if (!a) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function resolveCurrentMonthlyCredits({
  balance,
  usedThisMonth,
  monthlyCredits,
}: {
  balance: number
  usedThisMonth: number
  monthlyCredits: number
}) {
  return Math.max(0, Math.min(balance, monthlyCredits - Math.max(0, usedThisMonth)))
}

function normalizeCredits(value: number) {
  return Math.max(0, Math.trunc(value))
}

function resolveCreditBuckets({
  balance,
  usedThisMonth,
  monthlyCredits,
}: {
  balance: number
  usedThisMonth: number
  monthlyCredits: number
}) {
  const monthlyRemaining = resolveCurrentMonthlyCredits({ balance, usedThisMonth, monthlyCredits })
  const extraCredits = Math.max(0, balance - monthlyRemaining)

  return {
    monthlyRemaining,
    extraCredits,
  }
}

async function grantInitialPlanCredits({
  brokerId,
  planKey,
}: {
  brokerId: string
  planKey: EmePlanKey
}) {
  const plan = EME_PLANS[planKey]
  const initialGrantedAt = new Date()
  const currentPeriodStart = getCurrentPeriodStart(initialGrantedAt)

  return prisma.$transaction(async (tx) => {
    const claimedInitialGrant = await tx.brokerPlanAccount.updateMany({
      where: {
        brokerId,
        initialCreditsGrantedAt: null,
      },
      data: {
        planKey,
        initialCreditsGrantedAt: initialGrantedAt,
        currentPeriodCreditsGrantedAt: currentPeriodStart,
      },
    })

    if (claimedInitialGrant.count === 0) {
      return tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
    }

    const broker = await tx.broker.findUniqueOrThrow({
      where: { id: brokerId },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    })

    const { extraCredits } = resolveCreditBuckets({
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
      monthlyCredits: plan.monthlyAiCredits,
    })
    const nextBalance = extraCredits + plan.initialAiCredits
    const grantedAmount = Math.max(0, nextBalance - broker.aiCreditsBalance)

    const updatedBroker = await tx.broker.update({
      where: { id: brokerId },
      data: {
        aiCreditsBalance: nextBalance,
        aiCreditsUsedThisMonth: 0,
      },
      select: { aiCreditsBalance: true },
    })

    await tx.aiCreditTransaction.create({
      data: {
        brokerId,
        type: "plan_initial_grant",
        amount: grantedAmount,
        balanceAfter: updatedBroker.aiCreditsBalance,
        description: `${plan.name}: creditos IA iniciais`,
        metadata: {
          planKey: plan.key,
          monthlyCredits: plan.monthlyAiCredits,
          initialCredits: plan.initialAiCredits,
          extraCreditsCarried: extraCredits,
        } satisfies Prisma.InputJsonObject,
      },
    })

    return tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
  })
}

async function renewMonthlyPlanCreditsIfNeeded({
  brokerId,
  account,
}: {
  brokerId: string
  account: BrokerPlanAccountRecord
}) {
  const planKey = normalizeEmePlanKey(account.planKey)
  const plan = EME_PLANS[planKey]
  const currentPeriodStart = getCurrentPeriodStart()

  if (isSamePeriodMonth(account.currentPeriodCreditsGrantedAt, currentPeriodStart)) {
    return account
  }

  return prisma.$transaction(async (tx) => {
    const claimedRenewal = await tx.brokerPlanAccount.updateMany({
      where: {
        brokerId,
        OR: [
          { currentPeriodCreditsGrantedAt: null },
          { currentPeriodCreditsGrantedAt: { lt: currentPeriodStart } },
        ],
      },
      data: {
        planKey,
        currentPeriodCreditsGrantedAt: currentPeriodStart,
      },
    })

    if (claimedRenewal.count === 0) {
      return tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
    }

    const broker = await tx.broker.findUniqueOrThrow({
      where: { id: brokerId },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    })

    const { extraCredits, monthlyRemaining } = resolveCreditBuckets({
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
      monthlyCredits: plan.monthlyAiCredits,
    })
    const nextBalance = extraCredits + plan.monthlyAiCredits
    const delta = nextBalance - broker.aiCreditsBalance

    const updatedBroker = await tx.broker.update({
      where: { id: brokerId },
      data: {
        aiCreditsBalance: nextBalance,
        aiCreditsUsedThisMonth: 0,
      },
      select: { aiCreditsBalance: true },
    })

    await tx.aiCreditTransaction.create({
      data: {
        brokerId,
        type: "plan_monthly_grant",
        amount: delta,
        balanceAfter: updatedBroker.aiCreditsBalance,
        description: `${plan.name}: renovacao mensal de creditos IA`,
        metadata: {
          planKey: plan.key,
          monthlyCredits: plan.monthlyAiCredits,
          extraCreditsCarried: extraCredits,
          expiredMonthlyCredits: monthlyRemaining,
          renewedOnceForPeriod: currentPeriodStart.toISOString(),
        } satisfies Prisma.InputJsonObject,
      },
    })

    return tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
  })
}

async function countBrokerActiveProperties(brokerId: string) {
  return prisma.property.count({
    where: {
      brokerId,
      ...ACTIVE_PROPERTY_WHERE,
    },
  })
}

export function createPropertyLimitErrorPayload() {
  return {
    error: EME_PROPERTY_LIMIT_MESSAGE,
    billingBlocked: true,
    ctaHref: "/corretor/plano",
    ctaLabel: "Ver planos",
  }
}

export function createInsufficientCreditsPayload({
  availableCredits = 0,
  requiredCredits = 0,
}: {
  availableCredits?: number
  requiredCredits?: number
} = {}) {
  const missingCredits = Math.max(0, requiredCredits - availableCredits)
  const errorMessage =
    requiredCredits > 0
      ? `Creditos IA insuficientes. Disponivel: ${availableCredits}. Necessario: ${requiredCredits}. Faltam ${missingCredits}.`
      : EME_INSUFFICIENT_CREDITS_MESSAGE

  return {
    error: errorMessage,
    creditsBlocked: true,
    availableCredits,
    requiredCredits,
    missingCredits,
    ctaHref: "/corretor/plano",
    ctaLabel: "Ver plano",
  }
}

export function getCosInteractionCreditCost(actions: readonly string[]) {
  const normalizedActions = actions
    .map((action) => action.trim())
    .filter(Boolean) as EmeCreditActionKey[]

  if (normalizedActions.length === 0) return 0

  const chargedActions = normalizedActions.filter((action) => !EME_FREE_COS_ACTIONS.has(action))
  if (chargedActions.length === 0) return 0

  if (chargedActions.length === 1) {
    const [action] = chargedActions
    if (EME_COS_CONTEXT_ACTIONS.has(action)) return 2
    if (EME_COS_SIMPLE_QUERY_ACTIONS.has(action)) return 1
    return 5
  }

  if (chargedActions.length >= 4) return 8
  return 5
}

export async function ensureBrokerPlanAccount(brokerId: string) {
  const broker = await prisma.broker.findUnique({
    where: { id: brokerId },
    select: {
      id: true,
      user: {
        select: {
          plan: true,
          subscriptionStatus: true,
        },
      },
    },
  })

  if (!broker) throw new Error("BROKER_NOT_FOUND")

  const defaultPlanKey = planFromLegacyBilling(broker.user)
  let account = await prisma.brokerPlanAccount.upsert({
    where: { brokerId },
    create: {
      brokerId,
      planKey: defaultPlanKey,
    },
    update: {},
  })

  const normalizedPlanKey = normalizeEmePlanKey(account.planKey)
  if (account.planKey !== normalizedPlanKey) {
    account = await prisma.brokerPlanAccount.update({
      where: { brokerId },
      data: { planKey: normalizedPlanKey },
    })
  }

  if (!account.initialCreditsGrantedAt) {
    return grantInitialPlanCredits({
      brokerId,
      planKey: normalizedPlanKey,
    })
  }

  return renewMonthlyPlanCreditsIfNeeded({
    brokerId,
    account,
  })
}

export async function getBrokerPlanSnapshot(brokerId: string) {
  const account = await ensureBrokerPlanAccount(brokerId)
  const planKey = normalizeEmePlanKey(account.planKey)
  const plan = EME_PLANS[planKey]
  const [activePropertyCount, broker] = await Promise.all([
    countBrokerActiveProperties(brokerId),
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    }),
  ])
  const propertyLimit = plan.propertyLimit + account.propertyExtraLimit
  const creditBuckets = resolveCreditBuckets({
    balance: broker?.aiCreditsBalance ?? 0,
    usedThisMonth: broker?.aiCreditsUsedThisMonth ?? 0,
    monthlyCredits: plan.monthlyAiCredits,
  })

  return {
    plan,
    planKey,
    account,
    propertyCount: activePropertyCount,
    activePropertyCount,
    propertyLimit,
    propertyExtraLimit: account.propertyExtraLimit,
    remainingProperties: Math.max(0, propertyLimit - activePropertyCount),
    aiCreditsBalance: broker?.aiCreditsBalance ?? 0,
    aiCreditsUsedThisMonth: broker?.aiCreditsUsedThisMonth ?? 0,
    monthlyAiCredits: plan.monthlyAiCredits,
    extraAiCredits: creditBuckets.extraCredits,
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
  const allowed = snapshot.propertyCount + 1 <= snapshot.propertyLimit

  return {
    allowed,
    message: allowed ? "" : EME_PROPERTY_LIMIT_MESSAGE,
    ...snapshot,
  }
}

export async function getBrokerAiCreditBalance(brokerId: string) {
  const snapshot = await getBrokerPlanSnapshot(brokerId)

  return {
    balance: snapshot.aiCreditsBalance,
    usedThisMonth: snapshot.aiCreditsUsedThisMonth,
    monthlyCredits: snapshot.monthlyAiCredits,
    extraCredits: snapshot.extraAiCredits,
  }
}

export async function hasBrokerAiCredits(brokerId: string, amountOrAction: number | string) {
  const amount =
    typeof amountOrAction === "number"
      ? normalizeCredits(amountOrAction)
      : getEmeCreditCost(amountOrAction)
  const credits = await getBrokerAiCreditBalance(brokerId)

  return {
    allowed: credits.balance >= amount,
    amount,
    missing: Math.max(0, amount - credits.balance),
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
  const credits = normalizeCredits(amount)
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

    const planAccount = await tx.brokerPlanAccount.findUniqueOrThrow({
      where: { brokerId },
      select: { planKey: true },
    })
    const creditBuckets = resolveCreditBuckets({
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
      monthlyCredits: EME_PLANS[normalizeEmePlanKey(planAccount.planKey)].monthlyAiCredits,
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
      monthlyCredits: creditBuckets.monthlyRemaining,
      extraCredits: creditBuckets.extraCredits,
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
  const credits = normalizeCredits(amount)
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

    const planAccount = await tx.brokerPlanAccount.findUniqueOrThrow({
      where: { brokerId },
      select: { planKey: true },
    })
    const creditBuckets = resolveCreditBuckets({
      balance: broker.aiCreditsBalance,
      usedThisMonth: broker.aiCreditsUsedThisMonth,
      monthlyCredits: EME_PLANS[normalizeEmePlanKey(planAccount.planKey)].monthlyAiCredits,
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
      monthlyCredits: creditBuckets.monthlyRemaining,
      extraCredits: creditBuckets.extraCredits,
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

    if (status === "completed") {
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
