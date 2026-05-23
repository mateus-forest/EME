import { SubscriptionOwnerType, SubscriptionStatus, UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

const BROKER_PLAN_MONTHLY_VALUE = 89.9

function formatAssessorStatus(status?: string | null) {
  if (!status) return "Canal em preparação"
  if (status === "ACTIVE" || status === "Ativo") return "Ativo"
  if (status === "PAUSED" || status === "Pausado") return "Pausado"
  return "Em preparação"
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const [
      totalBrokers,
      totalProperties,
      totalLeads,
      subscriptions,
      brokerCredits,
      activeCorretorEme,
      preparingCorretorEme,
      assessorConfig,
    ] = await Promise.all([
      prisma.broker.count(),
      prisma.property.count(),
      prisma.lead.count(),
      prisma.subscription.findMany({
        where: {
          ownerType: SubscriptionOwnerType.BROKER,
        },
        select: {
          status: true,
        },
      }),
      prisma.broker.aggregate({
        _sum: {
          assistantCredits: true,
          aiCreditsUsedThisMonth: true,
        },
      }),
      prisma.brokerEmeConfig.count({
        where: {
          status: "ACTIVE",
        },
      }),
      prisma.brokerEmeConfig.count({
        where: {
          status: {
            in: ["IN_PREPARATION", "NOT_CONFIGURED"],
          },
        },
      }),
      prisma.assessorEmeConfig.findFirst({
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          status: true,
          officialNumber: true,
        },
      }),
    ])

    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE).length
    const evaluationSubscriptions = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.TRIALING).length
    const pendingSubscriptions = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.PAST_DUE).length
    const canceledSubscriptions = subscriptions.filter((subscription) => subscription.status === SubscriptionStatus.CANCELED).length

    return NextResponse.json({
      overview: {
        brokers: totalBrokers,
        properties: totalProperties,
        leads: totalLeads,
        subscriptions: {
          total: subscriptions.length,
          active: activeSubscriptions,
          evaluation: evaluationSubscriptions,
          pending: pendingSubscriptions,
          canceled: canceledSubscriptions,
        },
        ai: {
          creditsAvailable: brokerCredits._sum.assistantCredits ?? 0,
          creditsUsedThisMonth: brokerCredits._sum.aiCreditsUsedThisMonth ?? 0,
        },
        revenue: {
          predicted: activeSubscriptions * BROKER_PLAN_MONTHLY_VALUE,
        },
        corretorEme: {
          active: activeCorretorEme,
          preparing: preparingCorretorEme,
        },
        assessorEme: {
          status: formatAssessorStatus(assessorConfig?.status),
          hasOfficialNumber: Boolean(assessorConfig?.officialNumber),
        },
      },
    })
  } catch (caughtError) {
    console.error("[api][admin][overview] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao carregar o dashboard admin." }, { status: 500 })
  }
}
