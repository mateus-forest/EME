import { UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { serializeAdminUser } from "@/lib/admin-contract"
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
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.BROKER, UserRole.ADMIN],
        },
      },
      include: {
        broker: true,
        ownedAgency: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      users: users.map(serializeAdminUser),
    })
  } catch (caughtError) {
    console.error("[api][admin][users] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar usuários." }, { status: 500 })
  }
}
