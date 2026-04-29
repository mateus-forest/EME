import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"
import type { Agency, Broker, Subscription, User } from "@/lib/prisma-model-types"

import { NextResponse } from "next/server"

import { BILLING_PLAN } from "@/lib/billing-types"
import { serializeAdminSubscription } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

type AdminSubscriptionBroker = Broker & {
  user: User
}

type AdminSubscriptionAgency = Agency & {
  ownerUser: User
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const subscriptions: Subscription[] = await prisma.subscription.findMany({
      orderBy: {
        createdAt: "desc",
      },
    })

    const brokerIds = subscriptions
      .filter((subscription: Subscription) => subscription.ownerType === SubscriptionOwnerType.BROKER)
      .map((subscription: Subscription) => subscription.ownerId)
    const agencyIds = subscriptions
      .filter((subscription: Subscription) => subscription.ownerType === SubscriptionOwnerType.AGENCY)
      .map((subscription: Subscription) => subscription.ownerId)

    const [brokers, agencies]: [AdminSubscriptionBroker[], AdminSubscriptionAgency[]] = await Promise.all([
      prisma.broker.findMany({
        where: {
          id: {
            in: brokerIds,
          },
        },
        include: {
          user: true,
        },
      }),
      prisma.agency.findMany({
        where: {
          id: {
            in: agencyIds,
          },
        },
        include: {
          ownerUser: true,
        },
      }),
    ])

    const brokerMap = new Map<string, AdminSubscriptionBroker>(
      brokers.map((broker: AdminSubscriptionBroker) => [broker.id, broker]),
    )
    const agencyMap = new Map<string, AdminSubscriptionAgency>(
      agencies.map((agency: AdminSubscriptionAgency) => [agency.id, agency]),
    )

    return NextResponse.json({
      subscriptions: subscriptions.map((subscription: Subscription) => {
        if (subscription.ownerType === SubscriptionOwnerType.AGENCY) {
          const agency = agencyMap.get(subscription.ownerId) ?? null
          return serializeAdminSubscription(subscription, agency, agency?.ownerUser.plan ?? BILLING_PLAN.NONE)
        }

        const broker = brokerMap.get(subscription.ownerId) ?? null
        return serializeAdminSubscription(subscription, broker?.user ?? null, broker?.user.plan ?? BILLING_PLAN.NONE)
      }),
    })
  } catch (caughtError) {
    console.error("[api][admin][subscriptions] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar assinaturas." }, { status: 500 })
  }
}
