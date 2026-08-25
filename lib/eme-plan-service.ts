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
import { buildStripePeriodGrantKey } from "@/lib/billing-lifecycle-policy"
import { prisma } from "@/lib/prisma"

type BrokerBillingUser = {
  plan?: string | null
  subscriptionStatus?: string | null
}

type BrokerPlanAccountRecord = Awaited<ReturnType<typeof prisma.brokerPlanAccount.findUniqueOrThrow>>

const PLAN_SNAPSHOT_ACCOUNT_SELECT = {
  planKey: true,
  propertyExtraLimit: true,
} satisfies Prisma.BrokerPlanAccountSelect

const ACTIVE_PROPERTY_WHERE = {
  status: {
    in: [...EME_ACTIVE_PROPERTY_STATUSES],
  },
}

function planFromLegacyBilling(user?: BrokerBillingUser | null): EmePlanKey {
  if (user?.subscriptionStatus !== BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE) {
    return "free"
  }

  if (user.plan === BILLING_PLAN.AGENCY) return "scale"
  if (user.plan === BILLING_PLAN.BROKER) return "pro"

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

function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002")
}

function hasActivePlanSubscription(user?: BrokerBillingUser | null) {
  return user?.subscriptionStatus === BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE
}

function resolveActivePropertyExpansion({
  planKey,
  purchasedExtraLimit,
  user,
}: {
  planKey: EmePlanKey
  purchasedExtraLimit: number
  user?: BrokerBillingUser | null
}) {
  const normalizedPurchasedLimit = Math.max(0, purchasedExtraLimit)
  const isExpansionActive = planKey !== "free" && hasActivePlanSubscription(user)
  const activeExtraLimit = isExpansionActive ? normalizedPurchasedLimit : 0
  const suspendedExtraLimit = isExpansionActive ? 0 : normalizedPurchasedLimit

  return {
    isExpansionActive,
    activeExtraLimit,
    suspendedExtraLimit,
    purchasedExtraLimit: normalizedPurchasedLimit,
  }
}

export async function syncBrokerPropertyCapacityAddon({
  brokerId,
  stripeSubscriptionId,
  stripeSubscriptionItemId,
  stripePriceId,
  quantity,
  status,
  currentPeriodStart,
  currentPeriodEnd,
}: {
  brokerId: string
  stripeSubscriptionId: string
  stripeSubscriptionItemId?: string | null
  stripePriceId?: string | null
  quantity?: number | null
  status: "ACTIVE" | "INACTIVE" | "CANCELED"
  currentPeriodStart?: Date | null
  currentPeriodEnd?: Date | null
}) {
  if (
    status === "ACTIVE" &&
    stripeSubscriptionItemId &&
    stripePriceId &&
    quantity &&
    quantity > 0
  ) {
    return prisma.brokerPropertyCapacityAddon.upsert({
      where: { brokerId },
      create: {
        brokerId,
        quantity,
        stripePriceId,
        stripeSubscriptionId,
        stripeSubscriptionItemId,
        status,
        currentPeriodStart: currentPeriodStart ?? null,
        currentPeriodEnd: currentPeriodEnd ?? null,
      },
      update: {
        quantity,
        stripePriceId,
        stripeSubscriptionId,
        stripeSubscriptionItemId,
        status,
        currentPeriodStart: currentPeriodStart ?? null,
        currentPeriodEnd: currentPeriodEnd ?? null,
        endedAt: null,
      },
    })
  }

  return prisma.brokerPropertyCapacityAddon.updateMany({
    where: { brokerId, status: "ACTIVE" },
    data: {
      status,
      currentPeriodEnd: currentPeriodEnd ?? undefined,
      endedAt: new Date(),
    },
  })
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

function getCurrentPeriodEnd(periodStart: Date) {
  const periodEnd = new Date(periodStart)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
  return periodEnd
}

function isSameStripePeriod(
  account: Pick<
    BrokerPlanAccountRecord,
    "currentStripeSubscriptionId" | "currentStripePeriodStart" | "currentStripePeriodEnd"
  >,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return (
    account.currentStripeSubscriptionId === subscriptionId &&
    account.currentStripePeriodStart?.getTime() === periodStart.getTime() &&
    account.currentStripePeriodEnd?.getTime() === periodEnd.getTime()
  )
}

async function ensureFreePlanCreditsForCurrentPeriod(brokerId: string) {
  const account = await ensureBrokerPlanAccount(brokerId)
  if (normalizeEmePlanKey(account.planKey) !== "free") return account

  const periodStart = getCurrentPeriodStart()
  const periodEnd = getCurrentPeriodEnd(periodStart)
  const monthlyCredits = EME_PLANS.free.monthlyAiCredits
  const alreadyCurrent =
    account.currentPeriodGrantPlanKey === "free" &&
    account.currentStripeSubscriptionId === null &&
    isSamePeriodMonth(account.currentStripePeriodStart, periodStart) &&
    (account.currentPeriodGrantedCredits ?? 0) >= monthlyCredits

  if (alreadyCurrent) return account

  const grantKey = "free-period:" + brokerId + ":" + periodStart.toISOString()

  try {
    return await prisma.$transaction(async (tx) => {
      const existingGrant = await tx.aiCreditTransaction.findUnique({
        where: { grantKey },
        select: { id: true },
      })
      if (existingGrant) {
        return tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
      }

      const [currentAccount, broker] = await Promise.all([
        tx.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } }),
        tx.broker.findUniqueOrThrow({
          where: { id: brokerId },
          select: {
            aiCreditsBalance: true,
            aiCreditsUsedThisMonth: true,
          },
        }),
      ])

      const currentPlanKey = normalizeEmePlanKey(currentAccount.planKey)
      if (currentPlanKey !== "free") return currentAccount

      if (
        currentAccount.currentPeriodGrantPlanKey === "free" &&
        currentAccount.currentStripeSubscriptionId === null &&
        isSamePeriodMonth(currentAccount.currentStripePeriodStart, periodStart) &&
        currentAccount.currentPeriodGrantedCredits >= monthlyCredits
      ) {
        return currentAccount
      }

      const previousAllocation =
        currentAccount.currentPeriodGrantedCredits ||
        EME_PLANS[currentPlanKey].monthlyAiCredits
      const previousMonthlyRemaining = Math.max(
        0,
        previousAllocation - broker.aiCreditsUsedThisMonth,
      )
      const extraCredits = Math.max(
        0,
        broker.aiCreditsBalance - previousMonthlyRemaining,
      )
      const nextBalance = extraCredits + monthlyCredits
      const now = new Date()

      await tx.broker.update({
        where: { id: brokerId },
        data: {
          aiCreditsBalance: nextBalance,
          aiCreditsUsedThisMonth: 0,
        },
      })

      const updatedAccount = await tx.brokerPlanAccount.update({
        where: { brokerId },
        data: {
          planKey: "free",
          initialCreditsGrantedAt:
            currentAccount.initialCreditsGrantedAt ?? now,
          currentPeriodCreditsGrantedAt: now,
          currentStripeSubscriptionId: null,
          currentStripePeriodStart: periodStart,
          currentStripePeriodEnd: periodEnd,
          currentPeriodGrantedCredits: monthlyCredits,
          currentPeriodGrantPlanKey: "free",
        },
      })

      await tx.aiCreditTransaction.create({
        data: {
          brokerId,
          grantKey,
          type: "plan_period_grant",
          amount: nextBalance - broker.aiCreditsBalance,
          balanceAfter: nextBalance,
          description: "Créditos mensais do plano Free",
          metadata: {
            planKey: "free",
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
          },
        },
      })

      return updatedAccount
    })
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error
    return prisma.brokerPlanAccount.findUniqueOrThrow({ where: { brokerId } })
  }
}

export async function grantBrokerPlanCreditsForPaidPeriod(input: {
  brokerId: string
  subscriptionId: string
  planKey: Extract<EmePlanKey, "pro" | "scale">
  periodStart: Date
  periodEnd: Date
  stripeInvoiceId: string
  stripeEventId: string
}) {
  const monthlyCredits = EME_PLANS[input.planKey].monthlyAiCredits
  const grantKey = buildStripePeriodGrantKey(input)

  await ensureBrokerPlanAccount(input.brokerId)

  try {
    return await prisma.$transaction(async (tx) => {
      const existingGrant = await tx.aiCreditTransaction.findUnique({
        where: { grantKey },
        select: { id: true },
      })
      if (existingGrant) return { applied: false, grantKey }

      const [account, broker] = await Promise.all([
        tx.brokerPlanAccount.findUniqueOrThrow({
          where: { brokerId: input.brokerId },
        }),
        tx.broker.findUniqueOrThrow({
          where: { id: input.brokerId },
          select: {
            aiCreditsBalance: true,
            aiCreditsUsedThisMonth: true,
          },
        }),
      ])

      const samePeriod = isSameStripePeriod(
        account,
        input.subscriptionId,
        input.periodStart,
        input.periodEnd,
      )
      const previousAllocation = samePeriod
        ? account.currentPeriodGrantedCredits
        : account.currentPeriodGrantedCredits ||
          EME_PLANS[normalizeEmePlanKey(account.planKey)].monthlyAiCredits
      const previousMonthlyRemaining = Math.max(
        0,
        previousAllocation - broker.aiCreditsUsedThisMonth,
      )
      const extraCredits = Math.max(
        0,
        broker.aiCreditsBalance - previousMonthlyRemaining,
      )
      const nextUsed = samePeriod ? broker.aiCreditsUsedThisMonth : 0
      const targetMonthlyRemaining = Math.max(0, monthlyCredits - nextUsed)
      const calculatedBalance = extraCredits + targetMonthlyRemaining
      const nextBalance = samePeriod
        ? Math.max(broker.aiCreditsBalance, calculatedBalance)
        : calculatedBalance
      const grantedAllocation = samePeriod
        ? Math.max(previousAllocation, monthlyCredits)
        : monthlyCredits
      const now = new Date()

      await tx.broker.update({
        where: { id: input.brokerId },
        data: {
          aiCreditsBalance: nextBalance,
          aiCreditsUsedThisMonth: nextUsed,
        },
      })

      await tx.brokerPlanAccount.update({
        where: { brokerId: input.brokerId },
        data: {
          planKey: input.planKey,
          initialCreditsGrantedAt: account.initialCreditsGrantedAt ?? now,
          currentPeriodCreditsGrantedAt: now,
          currentStripeSubscriptionId: input.subscriptionId,
          currentStripePeriodStart: input.periodStart,
          currentStripePeriodEnd: input.periodEnd,
          currentPeriodGrantedCredits: grantedAllocation,
          currentPeriodGrantPlanKey: input.planKey,
        },
      })

      await tx.aiCreditTransaction.create({
        data: {
          brokerId: input.brokerId,
          grantKey,
          type: "plan_period_grant",
          amount: nextBalance - broker.aiCreditsBalance,
          balanceAfter: nextBalance,
          description:
            "Créditos do período pago do plano " + EME_PLANS[input.planKey].name,
          metadata: {
            planKey: input.planKey,
            subscriptionId: input.subscriptionId,
            stripeInvoiceId: input.stripeInvoiceId,
            stripeEventId: input.stripeEventId,
            periodStart: input.periodStart.toISOString(),
            periodEnd: input.periodEnd.toISOString(),
          },
        },
      })

      return {
        applied: true,
        grantKey,
        amount: nextBalance - broker.aiCreditsBalance,
        balanceAfter: nextBalance,
      }
    })
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error
    return { applied: false, grantKey }
  }
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

// Chamado pelo webhook do Stripe (via lib/billing.ts) sempre que uma assinatura de
// uma conta BROKER muda de estado. É a única escrita real em BrokerPlanAccount.planKey
// fora da criação inicial da conta — sem isso, pagar o Pro/Scale nunca atualizava o
// plano exibido nem os limites (imóveis, Créditos IA), que são lidos a partir daqui.
export async function syncBrokerPlanAccountFromStripe(input: {
  brokerId: string
  planKey: "pro" | "scale" | null
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"
}) {
  if (input.subscriptionStatus === "PAST_DUE") {
    return ensureBrokerPlanAccount(input.brokerId)
  }

  let targetPlanKey: EmePlanKey = "free"
  if (input.subscriptionStatus !== "CANCELED") {
    if (input.planKey === null) throw new Error("UNKNOWN_STRIPE_PLAN")
    targetPlanKey = input.planKey
  }

  await prisma.brokerPlanAccount.upsert({
    where: { brokerId: input.brokerId },
    create: {
      brokerId: input.brokerId,
      planKey: targetPlanKey,
    },
    update: {
      planKey: targetPlanKey,
    },
  })

  return ensureBrokerPlanAccount(input.brokerId)
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
  const freePeriodStart = getCurrentPeriodStart()
  const freePeriodEnd = getCurrentPeriodEnd(freePeriodStart)
  let account = await prisma.brokerPlanAccount.upsert({
    where: { brokerId },
    create: {
      brokerId,
      planKey: defaultPlanKey,
      ...(defaultPlanKey === "free"
        ? {
            initialCreditsGrantedAt: new Date(),
            currentPeriodCreditsGrantedAt: new Date(),
            currentStripePeriodStart: freePeriodStart,
            currentStripePeriodEnd: freePeriodEnd,
            currentPeriodGrantedCredits: EME_PLANS.free.monthlyAiCredits,
            currentPeriodGrantPlanKey: "free",
          }
        : {}),
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

  return account
}

async function ensureBrokerPlanSnapshotAccount(brokerId: string) {
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
      initialCreditsGrantedAt: defaultPlanKey === "free" ? new Date() : null,
      currentPeriodCreditsGrantedAt: defaultPlanKey === "free" ? new Date() : null,
    },
    update: {},
    select: PLAN_SNAPSHOT_ACCOUNT_SELECT,
  })

  const normalizedPlanKey = normalizeEmePlanKey(account.planKey)
  if (account.planKey !== normalizedPlanKey) {
    account = await prisma.brokerPlanAccount.update({
      where: { brokerId },
      data: { planKey: normalizedPlanKey },
      select: PLAN_SNAPSHOT_ACCOUNT_SELECT,
    })
  }

  return account
}

export async function getBrokerPlanSnapshot(brokerId: string) {
  // Plano e Faturamento só precisam dos campos-base da conta. Manter a seleção
  // explícita evita que uma janela de deploy entre migrations faça o Prisma
  // solicitar colunas de lifecycle antes de elas existirem no banco.
  const account = await ensureBrokerPlanSnapshotAccount(brokerId)
  const planKey = normalizeEmePlanKey(account.planKey)
  const plan = EME_PLANS[planKey]
  const [activePropertyCount, broker, brokerAccount, capacityAddon, adminPropertyBonuses] = await Promise.all([
    countBrokerActiveProperties(brokerId),
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: {
        aiCreditsBalance: true,
        aiCreditsUsedThisMonth: true,
      },
    }),
    prisma.broker.findUnique({
      where: { id: brokerId },
      select: {
        user: {
          select: {
            subscriptionStatus: true,
          },
        },
      },
    }),
    prisma.brokerPropertyCapacityAddon.findUnique({
      where: { brokerId },
    }),
    prisma.extraPackagePurchase.aggregate({
      where: {
        brokerId,
        packageType: "property",
        status: "completed",
        packageKey: { startsWith: "admin_property_bonus_" },
      },
      _sum: { quantity: true },
    }),
  ])
  // Expansão da Carteira é um complemento do plano ativo.
  // O volume comprado continua registrado em `propertyExtraLimit`,
  // mas só entra no limite efetivo enquanto a assinatura elegível estiver ativa.
  const expansion = resolveActivePropertyExpansion({
    planKey,
    purchasedExtraLimit:
      (capacityAddon?.status === "ACTIVE" ? capacityAddon.quantity : 0) +
      (adminPropertyBonuses._sum.quantity ?? 0),
    user: brokerAccount?.user,
  })
  const propertyLimit = plan.propertyLimit + expansion.activeExtraLimit
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
    propertyExtraLimit: expansion.activeExtraLimit,
    propertyPurchasedExtraLimit: account.propertyExtraLimit,
    propertySuspendedExtraLimit: expansion.suspendedExtraLimit,
    isPropertyExpansionActive: expansion.isExpansionActive,
    propertyCapacityAddon: capacityAddon,
    propertyAdminBonusExtraLimit: adminPropertyBonuses._sum.quantity ?? 0,
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

export async function canPublishBrokerProperty(
  brokerId: string,
  increasesActivePropertyCount = false,
) {
  const snapshot = await getBrokerPlanSnapshot(brokerId)
  const additionalProperties = increasesActivePropertyCount ? 1 : 0
  const allowed =
    snapshot.propertyCount + additionalProperties <= snapshot.propertyLimit

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
  await ensureFreePlanCreditsForCurrentPeriod(brokerId)
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

  await ensureFreePlanCreditsForCurrentPeriod(brokerId)

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
  userId,
  packageKey,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  stripeFulfilledEventId,
  amountCents,
  status = "registered",
  metadata,
}: {
  brokerId: string
  userId: string
  packageKey: EmeExtraPackageKey
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string | null
  stripeFulfilledEventId: string
  amountCents?: number | null
  status?: string
  metadata?: Prisma.InputJsonObject
}) {
  const pack = EME_EXTRA_PACKAGES[packageKey]
  if (!pack) throw new Error("INVALID_EXTRA_PACKAGE")
  if (pack.type === "property") throw new Error("RECURRING_CAPACITY_REQUIRES_SUBSCRIPTION_ITEM")

  try {
    return await prisma.$transaction(async (tx) => {
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
        amountCents: typeof amountCents === "number" ? Math.max(0, Math.trunc(amountCents)) : pack.priceCents,
        status,
        stripeCheckoutSessionId,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        stripeFulfilledEventId,
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

        await tx.notification.create({
          data: {
            userId,
            title: "Créditos IA adquiridos",
            message: `Você adquiriu +${pack.quantity} Créditos IA.`,
            read: false,
          },
        })
      }
    }

      return { purchase, applied: status === "completed" }
    })
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error

    const purchase = await prisma.extraPackagePurchase.findUnique({
      where: { stripeCheckoutSessionId },
    })
    if (!purchase) throw error

    return { purchase, applied: false }
  }
}

export async function applyAdminBonus({
  brokerId,
  bonusType,
  quantity,
  reason,
  adminUserId,
  adminName,
}: {
  brokerId: string
  bonusType: "credit" | "property"
  quantity: number
  reason: string
  adminUserId: string
  adminName: string
}) {
  const normalizedQuantity = normalizeCredits(quantity)
  if (normalizedQuantity <= 0) {
    throw new Error("INVALID_ADMIN_BONUS_QUANTITY")
  }

  await ensureBrokerPlanAccount(brokerId)

  if (bonusType === "credit") {
    return prisma.$transaction(async (tx) => {
      const broker = await tx.broker.update({
        where: { id: brokerId },
        data: {
          aiCreditsBalance: { increment: normalizedQuantity },
        },
        select: {
          aiCreditsBalance: true,
        },
      })

      const transaction = await tx.aiCreditTransaction.create({
        data: {
          brokerId,
          type: "admin_bonus",
          amount: normalizedQuantity,
          balanceAfter: broker.aiCreditsBalance,
          description: reason,
          metadata: {
            bonusType,
            quantity: normalizedQuantity,
            adminUserId,
            adminName,
          } satisfies Prisma.InputJsonObject,
        },
      })

      return {
        kind: "credit" as const,
        quantity: normalizedQuantity,
        transactionId: transaction.id,
      }
    })
  }

  return prisma.$transaction(async (tx) => {
    await tx.brokerPlanAccount.update({
      where: { brokerId },
      data: {
        propertyExtraLimit: { increment: normalizedQuantity },
      },
    })

    const purchase = await tx.extraPackagePurchase.create({
      data: {
        brokerId,
        packageKey: `admin_property_bonus_${normalizedQuantity}`,
        packageType: "property",
        quantity: normalizedQuantity,
        amountCents: 0,
        status: "completed",
        metadata: {
          source: "admin_bonus",
          reason,
          adminUserId,
          adminName,
        } satisfies Prisma.InputJsonObject,
      },
    })

    return {
      kind: "property" as const,
      quantity: normalizedQuantity,
      transactionId: purchase.id,
    }
  })
}
