import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"
import type { Broker, Subscription, User } from "@/lib/prisma-model-types"

import { NextResponse } from "next/server"

import { BILLING_PLAN } from "@/lib/billing-types"
import { serializeAdminSubscription } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

type AdminSubscriptionBroker = Broker & {
  user: User
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
      where: {
        ownerType: SubscriptionOwnerType.BROKER,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const brokerIds = subscriptions
      .map((subscription: Subscription) => subscription.ownerId)

    const brokers: AdminSubscriptionBroker[] = await prisma.broker.findMany({
      where: {
        id: {
          in: brokerIds,
        },
      },
      include: {
        user: true,
      },
    })

    const brokerMap = new Map<string, AdminSubscriptionBroker>(
      brokers.map((broker: AdminSubscriptionBroker) => [broker.id, broker]),
    )

    return NextResponse.json({
      subscriptions: subscriptions.map((subscription: Subscription) => {
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
