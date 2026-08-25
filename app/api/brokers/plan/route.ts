import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { EME_EXTRA_PACKAGES, EME_PLANS } from "@/lib/eme-plans"
import { getBrokerPlanSnapshot } from "@/lib/eme-plan-service"
import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function formatBRLFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100)
}

function serializePlan(plan: (typeof EME_PLANS)[keyof typeof EME_PLANS]) {
  const price = plan.priceCents === 0 ? "R$ 0" : `${formatBRLFromCents(plan.priceCents)}/mês`

  return {
    key: plan.key,
    name: plan.name,
    priceCents: plan.priceCents,
    price,
    propertyLimit: plan.propertyLimit,
    monthlyAiCredits: plan.monthlyAiCredits,
    initialAiCredits: plan.initialAiCredits,
    features: plan.features,
  }
}

function serializePackage(pack: (typeof EME_EXTRA_PACKAGES)[keyof typeof EME_EXTRA_PACKAGES]) {
  return {
    key: pack.key,
    type: pack.type,
    label: pack.label,
    quantity: pack.quantity,
    priceCents: pack.priceCents,
    price: formatBRLFromCents(pack.priceCents),
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const snapshot = await getBrokerPlanSnapshot(user.broker.id)
    const [creditHistoryResult, packageHistoryResult, capacityHistoryResult, subscriptionResult] = await Promise.allSettled([
      prisma.aiCreditTransaction.findMany({
        where: { brokerId: user.broker.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          actionType: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.extraPackagePurchase.findMany({
        where: { brokerId: user.broker.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          packageKey: true,
          packageType: true,
          quantity: true,
          amountCents: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.brokerPropertyCapacityEvent.findMany({
        where: { brokerId: user.broker.id },
        orderBy: { effectiveAt: "desc" },
        take: 24,
        select: {
          id: true,
          action: true,
          previousQuantity: true,
          quantity: true,
          effectiveAt: true,
        },
      }),
      prisma.subscription.findUnique({
        where: {
          ownerType_ownerId: {
            ownerType: SubscriptionOwnerType.BROKER,
            ownerId: user.broker.id,
          },
        },
        select: {
          status: true,
          nextBillingAt: true,
          cancelAtPeriodEnd: true,
          cancelAt: true,
        },
      }),
    ])
    const creditHistory = creditHistoryResult.status === "fulfilled" ? creditHistoryResult.value : []
    const packageHistory = packageHistoryResult.status === "fulfilled" ? packageHistoryResult.value : []
    const capacityHistory = capacityHistoryResult.status === "fulfilled" ? capacityHistoryResult.value : []
    const subscription = subscriptionResult.status === "fulfilled" ? subscriptionResult.value : null

    if (creditHistoryResult.status === "rejected") {
      console.error("[api][brokers][plan][credit-history] unavailable", {
        brokerId: user.broker.id,
        message: creditHistoryResult.reason instanceof Error ? creditHistoryResult.reason.message : "unknown",
      })
    }
    if (packageHistoryResult.status === "rejected") {
      console.error("[api][brokers][plan][package-history] unavailable", {
        brokerId: user.broker.id,
        message: packageHistoryResult.reason instanceof Error ? packageHistoryResult.reason.message : "unknown",
      })
    }
    if (capacityHistoryResult.status === "rejected") {
      console.error("[api][brokers][plan][capacity-history] unavailable", {
        brokerId: user.broker.id,
        message: capacityHistoryResult.reason instanceof Error ? capacityHistoryResult.reason.message : "unknown",
      })
    }
    if (subscriptionResult.status === "rejected") {
      console.error("[api][brokers][plan][subscription] unavailable", {
        brokerId: user.broker.id,
        message: subscriptionResult.reason instanceof Error ? subscriptionResult.reason.message : "unknown",
      })
    }

    const currentPlan = serializePlan(snapshot.plan)
    const activeCapacityPackage =
      snapshot.propertyCapacityAddon?.status === "ACTIVE"
        ? Object.values(EME_EXTRA_PACKAGES).find(
            (pack) =>
              pack.type === "property" &&
              pack.quantity === snapshot.propertyCapacityAddon?.quantity,
          ) ?? null
        : null

    const response = NextResponse.json({
      plan: currentPlan,
      currentPlan,
      subscription: subscription
        ? {
            status: subscription.status,
            nextBillingAt: subscription.nextBillingAt?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            cancelAt: subscription.cancelAt?.toISOString() ?? null,
          }
        : null,
      plans: Object.values(EME_PLANS).map(serializePlan),
      propertyLimits: {
        baseLimit: snapshot.plan.propertyLimit,
        extraLimit: snapshot.propertyExtraLimit,
        purchasedExtraLimit: snapshot.propertyPurchasedExtraLimit,
        suspendedExtraLimit: snapshot.propertySuspendedExtraLimit,
        isExpansionActive: snapshot.isPropertyExpansionActive,
        totalLimit: snapshot.propertyLimit,
        used: snapshot.propertyCount,
        remaining: snapshot.remainingProperties,
      },
      credits: {
        balance: snapshot.aiCreditsBalance,
        usedThisMonth: snapshot.aiCreditsUsedThisMonth,
        monthlyCredits: snapshot.plan.monthlyAiCredits,
        extraCredits: snapshot.extraAiCredits,
        history: creditHistory.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      },
      packages: Object.values(EME_EXTRA_PACKAGES).map(serializePackage),
      capacityAddon:
        snapshot.propertyCapacityAddon?.status === "ACTIVE"
          ? {
              quantity: snapshot.propertyCapacityAddon.quantity,
              status: snapshot.propertyCapacityAddon.status,
              priceCents: activeCapacityPackage?.priceCents ?? 0,
              price: activeCapacityPackage
                ? `${formatBRLFromCents(activeCapacityPackage.priceCents)}/mês`
                : null,
              startedAt: snapshot.propertyCapacityAddon.startedAt.toISOString(),
              currentPeriodEnd:
                snapshot.propertyCapacityAddon.currentPeriodEnd?.toISOString() ?? null,
            }
          : null,
      capacityHistory: capacityHistory.map((item) => {
        const quantity =
          item.action === "REMOVED" || item.action === "SUSPENDED"
            ? item.previousQuantity ?? item.quantity
            : item.quantity
        const capacityPackage = Object.values(EME_EXTRA_PACKAGES).find(
          (pack) => pack.type === "property" && pack.quantity === quantity,
        )

        return {
          id: item.id,
          action: item.action,
          previousQuantity: item.previousQuantity,
          quantity,
          price: capacityPackage
            ? `${formatBRLFromCents(capacityPackage.priceCents)}/mês`
            : null,
          effectiveAt: item.effectiveAt.toISOString(),
        }
      }),
      packageHistory: packageHistory.map((item) => ({
        ...item,
        billingMode: item.packageType === "property" ? "legacy_one_time" : "one_time",
        price: formatBRLFromCents(item.amountCents),
        createdAt: item.createdAt.toISOString(),
      })),
    })

    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][brokers][plan] get failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de planos indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível carregar o plano." }, { status: 500 })
  }
}
