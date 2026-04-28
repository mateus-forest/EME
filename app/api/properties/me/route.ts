import { UserRole } from "@/lib/prisma-enums"
import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { serializeProperty } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
  _count: {
    select: {
      leads: true,
    },
  },
} as const

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    if (!user.broker) {
      return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
    }

    const properties = await prisma.property.findMany({
      where: {
        brokerId: user.broker.id,
      },
      include: propertyInclude,
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ properties: properties.map(serializeProperty) })
  } catch (caughtError) {
    console.error("[api][properties][me] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar imóveis." }, { status: 500 })
  }
}
