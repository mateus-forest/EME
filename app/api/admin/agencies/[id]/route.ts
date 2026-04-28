import { BillingPlan, BillingUserSubscriptionStatus, UserRole } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { serializeAdminAgency } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

const agencyInclude = {
  ownerUser: true,
  brokers: {
    select: {
      status: true,
    },
  },
  properties: {
    select: {
      status: true,
    },
  },
} as const

function parseStatus(value: unknown) {
  if (value === "Ativa" || value === "Ativo") return "active"
  if (value === "Inativa" || value === "Inativo") return "inactive"
  return null
}

async function loadAgency(id: string) {
  return prisma.agency.findUnique({
    where: { id },
    include: agencyInclude,
  })
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
    const agency = await loadAgency(id)

    if (!agency) {
      return NextResponse.json({ error: "Imobiliária não encontrada." }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = typeof body?.name === "string" ? body.name.trim() : undefined
    const owner = typeof body?.owner === "string" ? body.owner.trim() : undefined
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined
    const whatsApp =
      typeof body?.whatsApp === "string"
        ? body.whatsApp.trim()
        : typeof body?.phone === "string"
          ? body.phone.trim()
          : undefined
    const status = parseStatus(body?.status)

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Informe um nome válido para a imobiliária." }, { status: 400 })
    }

    if (owner !== undefined && !owner) {
      return NextResponse.json({ error: "Informe um responsável válido." }, { status: 400 })
    }

    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Informe um email válido." }, { status: 400 })
      }

      const emailOwner = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: agency.ownerUserId },
        },
        select: { id: true },
      })

      if (emailOwner) {
        return NextResponse.json({ error: "Já existe uma conta com este email." }, { status: 409 })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: agency.ownerUserId },
        data: {
          ...(owner !== undefined ? { name: owner } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(whatsApp !== undefined ? { phone: whatsApp } : {}),
          ...(status
            ? {
                subscriptionStatus:
                  status === "active"
                    ? BillingUserSubscriptionStatus.ACTIVE
                    : BillingUserSubscriptionStatus.INACTIVE,
                ...(status === "active" ? { plan: BillingPlan.AGENCY } : {}),
              }
            : {}),
        },
      })

      await tx.agency.update({
        where: { id: agency.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(whatsApp !== undefined ? { phone: whatsApp } : {}),
        },
      })
    })

    const updated = await loadAgency(agency.id)
    if (!updated) {
      return NextResponse.json({ error: "Imobiliária não encontrada após atualização." }, { status: 404 })
    }

    return NextResponse.json({ agency: serializeAdminAgency(updated) })
  } catch (caughtError) {
    console.error("[api][admin][agencies][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar imobiliária." }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const agency = await loadAgency(id)

    if (!agency) {
      return NextResponse.json({ error: "Imobiliária não encontrada." }, { status: 404 })
    }

    if (agency.brokers.length > 0 || agency.properties.length > 0) {
      const updated = await prisma.user.update({
        where: { id: agency.ownerUserId },
        data: { subscriptionStatus: BillingUserSubscriptionStatus.INACTIVE },
      })

      const reloaded = await loadAgency(agency.id)

      return NextResponse.json({
        deleted: false,
        agency: reloaded ? serializeAdminAgency(reloaded) : undefined,
        message: updated ? "Imobiliária possui relações importantes e foi inativada." : undefined,
      })
    }

    await prisma.user.delete({
      where: { id: agency.ownerUserId },
    })

    return NextResponse.json({ deleted: true })
  } catch (caughtError) {
    console.error("[api][admin][agencies][id] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao excluir imobiliária." }, { status: 500 })
  }
}
