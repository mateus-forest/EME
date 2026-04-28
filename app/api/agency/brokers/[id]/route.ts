import { BrokerAccountStatus, UserRole } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { buildAgencyBrokerHighlight, serializeAgencyBroker } from "@/lib/agency-broker-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { enforceAgencyOperationalAccess } from "@/lib/billing-enforcement"
import { prisma } from "@/lib/prisma"

const brokerInclude = {
  user: true,
  properties: true,
} as const

function getOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin
}

async function getAgencyBroker(agencyId: string, brokerId: string) {
  return prisma.broker.findFirst({
    where: {
      id: brokerId,
      agencyId,
    },
    include: brokerInclude,
  })
}

function parseStatus(value: unknown) {
  if (value === "Ativo" || value === BrokerAccountStatus.ACTIVE) return BrokerAccountStatus.ACTIVE
  if (value === "Pendente" || value === BrokerAccountStatus.PENDING) return BrokerAccountStatus.PENDING
  if (value === "Inativo" || value === BrokerAccountStatus.INACTIVE) return BrokerAccountStatus.INACTIVE
  return null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  const billingBlocked = enforceAgencyOperationalAccess(user)
  if (billingBlocked) return billingBlocked

  try {
    const { id } = await context.params
    const broker = await getAgencyBroker(user.ownedAgency.id, id)

    if (!broker) {
      return NextResponse.json({ error: "Corretor não encontrado neste contexto." }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
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

    if (
      name === undefined &&
      email === undefined &&
      whatsApp === undefined &&
      creci === undefined &&
      status === null
    ) {
      return NextResponse.json({ error: "Nenhum campo válido foi informado para atualização." }, { status: 400 })
    }

    if (email && email !== broker.user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser && existingUser.id !== broker.userId) {
        return NextResponse.json({ error: "Já existe uma conta com este email." }, { status: 409 })
      }
    }

    const updated = await prisma.user.update({
      where: { id: broker.userId },
      data: {
        name: name ?? broker.user.name,
        email: email ?? broker.user.email,
        phone: whatsApp ?? broker.user.phone,
        broker: {
          update: {
            phone: whatsApp ?? broker.phone,
            creci: creci ?? broker.creci,
            status: status ?? broker.status,
          },
        },
      },
      include: {
        broker: {
          include: {
            user: true,
            properties: true,
          },
        },
      },
    })

    const serialized = buildAgencyBrokerHighlight([
      serializeAgencyBroker(updated.broker!, { origin: getOrigin(request) }),
    ])[0]

    return NextResponse.json({ broker: serialized })
  } catch (caughtError) {
    console.error("[api][agency][brokers] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de corretores está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar corretor da imobiliária." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  const billingBlocked = enforceAgencyOperationalAccess(user)
  if (billingBlocked) return billingBlocked

  try {
    const { id } = await context.params
    const broker = await getAgencyBroker(user.ownedAgency.id, id)

    if (!broker) {
      return NextResponse.json({ error: "Corretor não encontrado neste contexto." }, { status: 404 })
    }

    if (broker.properties.length > 0) {
      return NextResponse.json(
        { error: "Exclua ou transfira os imóveis deste corretor antes de removê-lo da imobiliária." },
        { status: 400 },
      )
    }

    await prisma.user.delete({
      where: {
        id: broker.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (caughtError) {
    console.error("[api][agency][brokers] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de corretores está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao excluir corretor da imobiliária." }, { status: 500 })
  }
}
