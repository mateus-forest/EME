import { BrokerAccountStatus, UserRole } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { serializeAdminBroker } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

const brokerInclude = {
  user: true,
  agency: true,
  properties: {
    select: {
      status: true,
      leadsCount: true,
      _count: {
        select: {
          leads: true,
        },
      },
    },
  },
} as const

function parseStatus(value: unknown) {
  if (value === "Ativo" || value === BrokerAccountStatus.ACTIVE) return BrokerAccountStatus.ACTIVE
  if (value === "Inativo" || value === BrokerAccountStatus.INACTIVE) return BrokerAccountStatus.INACTIVE
  return null
}

async function loadBroker(id: string) {
  return prisma.broker.findUnique({
    where: { id },
    include: brokerInclude,
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
    const broker = await loadBroker(id)

    if (!broker) {
      return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = typeof body?.name === "string" ? body.name.trim() : undefined
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined
    const whatsApp =
      typeof body?.whatsApp === "string"
        ? body.whatsApp.trim()
        : typeof body?.phone === "string"
          ? body.phone.trim()
          : undefined
    const creci = typeof body?.creci === "string" ? body.creci.trim() : undefined
    const status = parseStatus(body?.status)
    const agencyName = typeof body?.agencyName === "string" ? body.agencyName.trim() : undefined

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Informe um nome válido." }, { status: 400 })
    }

    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Informe um email válido." }, { status: 400 })
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: broker.userId },
        },
        select: { id: true },
      })

      if (existingUser) {
        return NextResponse.json({ error: "Já existe uma conta com este email." }, { status: 409 })
      }
    }

    let agencyId: string | null | undefined
    if (agencyName !== undefined) {
      if (!agencyName) {
        agencyId = null
      } else {
        const agency = await prisma.agency.findFirst({
          where: {
            name: {
              equals: agencyName,
              mode: "insensitive",
            },
          },
          select: { id: true },
        })

        if (!agency) {
          return NextResponse.json({ error: "Imobiliária informada não foi encontrada." }, { status: 400 })
        }

        agencyId = agency.id
      }
    }

    await prisma.user.update({
      where: { id: broker.userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(whatsApp !== undefined ? { phone: whatsApp } : {}),
        broker: {
          update: {
            ...(whatsApp !== undefined ? { phone: whatsApp } : {}),
            ...(creci !== undefined ? { creci } : {}),
            ...(status ? { status } : {}),
            ...(agencyId !== undefined ? { agencyId } : {}),
          },
        },
      },
    })

    const updated = await loadBroker(broker.id)
    if (!updated) {
      return NextResponse.json({ error: "Corretor não encontrado após atualização." }, { status: 404 })
    }

    return NextResponse.json({ broker: serializeAdminBroker(updated) })
  } catch (caughtError) {
    console.error("[api][admin][brokers][id] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar corretor." }, { status: 500 })
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
    const broker = await loadBroker(id)

    if (!broker) {
      return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
    }

    if (broker.properties.length > 0) {
      const updated = await prisma.broker.update({
        where: { id: broker.id },
        data: { status: BrokerAccountStatus.INACTIVE },
        include: brokerInclude,
      })

      return NextResponse.json({
        deleted: false,
        broker: serializeAdminBroker(updated),
        message: "Corretor possui imóveis vinculados e foi inativado.",
      })
    }

    await prisma.user.delete({
      where: { id: broker.userId },
    })

    return NextResponse.json({ deleted: true })
  } catch (caughtError) {
    console.error("[api][admin][brokers][id] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao excluir corretor." }, { status: 500 })
  }
}
