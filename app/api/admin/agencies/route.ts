import { UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { serializeAdminAgency } from "@/lib/admin-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const agencies = await prisma.agency.findMany({
      include: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      agencies: agencies.map(serializeAdminAgency),
    })
  } catch (caughtError) {
    console.error("[api][admin][agencies] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar imobiliárias." }, { status: 500 })
  }
}
