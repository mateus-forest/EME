import { SubscriptionOwnerType, SubscriptionStatus, UserRole } from "@/lib/prisma-enums"

import { NextRequest, NextResponse } from "next/server"

import { BILLING_PLAN, BILLING_USER_SUBSCRIPTION_STATUS } from "@/lib/billing-types"
import { serializeAdminSubscription } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function parseStatus(value: unknown) {
  if (value === "Ativo" || value === SubscriptionStatus.ACTIVE) return SubscriptionStatus.ACTIVE
  if (value === "Cancelado" || value === SubscriptionStatus.CANCELED) return SubscriptionStatus.CANCELED
  if (value === "Inadimplente" || value === SubscriptionStatus.PAST_DUE) return SubscriptionStatus.PAST_DUE
  return null
}

function planFromOwnerType(ownerType: SubscriptionOwnerType) {
  return ownerType === SubscriptionOwnerType.AGENCY ? BILLING_PLAN.AGENCY : BILLING_PLAN.BROKER
}

async function serializeSubscriptionById(id: string, flags?: { notificationSent?: boolean; awaitingRegularization?: boolean }) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  })

  if (!subscription) return null

  if (subscription.ownerType === SubscriptionOwnerType.AGENCY) {
    const agency = await prisma.agency.findUnique({
      where: { id: subscription.ownerId },
      include: { ownerUser: true },
    })

    return {
      subscription: {
        ...serializeAdminSubscription(subscription, agency, agency?.ownerUser.plan ?? BILLING_PLAN.NONE),
        ...flags,
      },
      ownerUserId: agency?.ownerUserId ?? null,
      ownerPlan: agency?.ownerUser.plan ?? BILLING_PLAN.NONE,
    }
  }

  const broker = await prisma.broker.findUnique({
    where: { id: subscription.ownerId },
    include: {
      user: true,
      planAccount: {
        select: {
          planKey: true,
        },
      },
    },
  })

  const serialized = serializeAdminSubscription(
    subscription,
    broker?.user ?? null,
    broker?.planAccount?.planKey ?? broker?.user.plan ?? BILLING_PLAN.NONE,
  )

  return {
    subscription: {
      ...serialized,
      ...flags,
    },
    ownerUserId: broker?.userId ?? null,
    ownerPlan: broker?.planAccount?.planKey ?? broker?.user.plan ?? BILLING_PLAN.NONE,
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const current = await prisma.subscription.findUnique({
      where: { id },
    })

    if (!current) {
      return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 })
    }

    if (body?.action === "notify") {
      const serialized = await serializeSubscriptionById(current.id)

      if (!serialized?.ownerUserId) {
        return NextResponse.json({ error: "Não foi possível localizar o responsável pela assinatura." }, { status: 404 })
      }

      await prisma.notification.create({
        data: {
          userId: serialized.ownerUserId,
          title: "Regularização de assinatura",
          message: "Sua assinatura requer atenção. Acesse seu plano para regularizar a situação.",
          read: false,
        },
      })

      return NextResponse.json({
        subscription: {
          ...serialized.subscription,
          notificationSent: true,
          awaitingRegularization: true,
        },
      })
    }

    const status = parseStatus(body?.status)
    if (!status) {
      return NextResponse.json({ error: "Informe um status de assinatura válido." }, { status: 400 })
    }

    const updated = await prisma.subscription.update({
      where: { id: current.id },
      data: {
        status,
      },
    })

    const serialized = await serializeSubscriptionById(updated.id)
    const ownerUserId = serialized?.ownerUserId

    if (ownerUserId) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: ownerUserId },
          data: {
            plan: status === SubscriptionStatus.ACTIVE ? planFromOwnerType(updated.ownerType) : BILLING_PLAN.NONE,
            subscriptionStatus:
              status === SubscriptionStatus.ACTIVE
                ? BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE
                : BILLING_USER_SUBSCRIPTION_STATUS.INACTIVE,
          },
        }),
        prisma.notification.create({
          data: {
            userId: ownerUserId,
            title: "Status da assinatura atualizado",
            message:
              status === SubscriptionStatus.ACTIVE
                ? "Sua assinatura foi ativada."
                : "O status da sua assinatura foi atualizado. Acesse a área de plano para conferir os detalhes.",
            read: false,
          },
        }),
      ])
    }

    const refreshed = await serializeSubscriptionById(updated.id)
    if (!refreshed) {
      return NextResponse.json({ error: "Assinatura não encontrada após atualização." }, { status: 404 })
    }

    return NextResponse.json({ subscription: refreshed.subscription })
  } catch (caughtError) {
    console.error("[api][admin][subscriptions][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar assinatura." }, { status: 500 })
  }
}
