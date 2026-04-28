import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { serializeAdminBroker } from "@/lib/admin-contract"
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
    const brokers = await prisma.broker.findMany({
      include: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      brokers: brokers.map(serializeAdminBroker),
    })
  } catch (caughtError) {
    console.error("[api][admin][brokers] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar corretores." }, { status: 500 })
  }
}
