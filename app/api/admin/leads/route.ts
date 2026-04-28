import { UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { leadInclude, serializeLead } from "@/lib/lead-contract"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const leads = await prisma.lead.findMany({
      include: leadInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    })

    return NextResponse.json({ leads: leads.map(serializeLead) })
  } catch (caughtError) {
    console.error("[api][admin][leads] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço administrativo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar leads." }, { status: 500 })
  }
}
