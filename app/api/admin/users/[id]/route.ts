import {
  BrokerAccountStatus,
  UserRole,
} from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import {
  BILLING_PLAN,
  BILLING_USER_SUBSCRIPTION_STATUS,
  type BillingPlan,
  type BillingUserSubscriptionStatus,
} from "@/lib/billing-types"
import { serializeAdminUser } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

const userInclude = {
  broker: true,
  ownedAgency: true,
} as const

function parseStatus(value: unknown) {
  if (value === "Ativo" || value === "Ativa") return "active"
  if (value === "Inativo" || value === "Inativa") return "inactive"
  return null
}

function parsePlan(value: unknown, role: UserRole) {
  if (value === undefined) return undefined
  if (value === "Corretor") return role === UserRole.BROKER ? BILLING_PLAN.BROKER : null
  if (value === "Plano Imobiliária") return role === UserRole.AGENCY ? BILLING_PLAN.AGENCY : null
  if (value === "Sem plano") return BILLING_PLAN.NONE
  if (value === "Admin") return role === UserRole.ADMIN ? BILLING_PLAN.NONE : null
  return null
}

function normalizePayload(body: unknown) {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

  return {
    name: typeof data.name === "string" ? data.name.trim() : undefined,
    email: typeof data.email === "string" ? data.email.trim().toLowerCase() : undefined,
    phone:
      typeof data.whatsApp === "string"
        ? data.whatsApp.trim()
        : typeof data.phone === "string"
          ? data.phone.trim()
          : undefined,
    status: parseStatus(data.status),
    plan: data.plan,
  }
}

async function loadUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: userInclude,
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user: admin } = await getAuthenticatedUser()

  if (error || !admin) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(admin.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const target = await loadUser(id)

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    const payload = normalizePayload(await request.json().catch(() => null))
    const data: {
      name?: string
      email?: string
      phone?: string
      plan?: BillingPlan
      subscriptionStatus?: BillingUserSubscriptionStatus
    } = {}

    if (payload.name !== undefined) {
      if (!payload.name) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400 })
      data.name = payload.name
    }

    if (payload.email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return NextResponse.json({ error: "Informe um email válido." }, { status: 400 })
      }

      const emailOwner = await prisma.user.findFirst({
        where: {
          email: payload.email,
          NOT: { id: target.id },
        },
        select: { id: true },
      })

      if (emailOwner) {
        return NextResponse.json({ error: "Já existe uma conta com este email." }, { status: 409 })
      }

      data.email = payload.email
    }

    if (payload.phone !== undefined) data.phone = payload.phone

    const nextPlan = parsePlan(payload.plan, target.role)
    if (nextPlan === null) {
      return NextResponse.json({ error: "Plano inválido para este perfil." }, { status: 400 })
    }
    if (nextPlan !== undefined) data.plan = nextPlan

    if (payload.status) {
      if (target.id === admin.id && payload.status === "inactive") {
        return NextResponse.json({ error: "O administrador não pode desativar a própria conta." }, { status: 400 })
      }

      if (target.role === UserRole.AGENCY) {
        data.subscriptionStatus =
          payload.status === "active"
            ? BILLING_USER_SUBSCRIPTION_STATUS.ACTIVE
            : BILLING_USER_SUBSCRIPTION_STATUS.INACTIVE
        if (payload.status === "active" && data.plan === undefined) data.plan = BILLING_PLAN.AGENCY
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data,
      })

      if (target.role === UserRole.BROKER && target.broker) {
        await tx.broker.update({
          where: { id: target.broker.id },
          data: {
            ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
            ...(payload.status
              ? { status: payload.status === "active" ? BrokerAccountStatus.ACTIVE : BrokerAccountStatus.INACTIVE }
              : {}),
          },
        })
      }

      if (target.role === UserRole.AGENCY && target.ownedAgency && payload.phone !== undefined) {
        await tx.agency.update({
          where: { id: target.ownedAgency.id },
          data: { phone: payload.phone },
        })
      }
    })

    const updated = await loadUser(target.id)
    if (!updated) {
      return NextResponse.json({ error: "Usuário não encontrado após atualização." }, { status: 404 })
    }

    return NextResponse.json({ user: serializeAdminUser(updated) })
  } catch (caughtError) {
    console.error("[api][admin][users][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar usuário." }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user: admin } = await getAuthenticatedUser()

  if (error || !admin) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(admin.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const target = await loadUser(id)

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    if (target.id === admin.id) {
      return NextResponse.json({ error: "O administrador não pode excluir a própria conta." }, { status: 400 })
    }

    const [brokerProperties, agencyRelations] = await Promise.all([
      target.broker
        ? prisma.property.count({
            where: { brokerId: target.broker.id },
          })
        : Promise.resolve(0),
      target.ownedAgency
        ? Promise.all([
            prisma.property.count({ where: { agencyId: target.ownedAgency.id } }),
            prisma.broker.count({ where: { agencyId: target.ownedAgency.id } }),
          ])
        : Promise.resolve([0, 0]),
    ])

    const hasCriticalRelations =
      brokerProperties > 0 ||
      agencyRelations[0] > 0 ||
      agencyRelations[1] > 0 ||
      target.role === UserRole.ADMIN

    if (hasCriticalRelations) {
      const updated = await prisma.$transaction(async (tx) => {
        if (target.broker) {
          await tx.broker.update({
            where: { id: target.broker.id },
            data: { status: BrokerAccountStatus.INACTIVE },
          })
        }

        return tx.user.update({
          where: { id: target.id },
          data: {
            subscriptionStatus: BILLING_USER_SUBSCRIPTION_STATUS.INACTIVE,
          },
          include: userInclude,
        })
      })

      return NextResponse.json({
        deleted: false,
        user: serializeAdminUser(updated),
        message: "Usuário possui relações importantes e foi inativado.",
      })
    }

    await prisma.user.delete({
      where: { id: target.id },
    })

    return NextResponse.json({ deleted: true })
  } catch (caughtError) {
    console.error("[api][admin][users][id] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao excluir usuário." }, { status: 500 })
  }
}
