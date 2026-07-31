import { UserRole } from "@/lib/prisma-enums"

import { NextResponse } from "next/server"

import {
  ensureRole,
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { leadInclude, serializeLead } from "@/lib/lead-contract"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: {
        agencyId: user.ownedAgency.id,
      },
      include: leadInclude,
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ leads: leads.map(serializeLead) })
  } catch (caughtError) {
    console.error("[api][agencies][leads] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de leads está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Clientes / leads da imobiliaria")
    }

    return NextResponse.json({ error: "Erro interno ao listar leads da imobiliaria." }, { status: 500 })
  }
}
