import { UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { leadInclude, serializeLead } from "@/lib/lead-contract"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        brokerId: user.broker.id,
      },
      include: leadInclude,
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ leads: leads.map(serializeLead) })
  } catch (caughtError) {
    console.error("[api][brokers][leads] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de leads está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar leads do corretor." }, { status: 500 })
  }
}
