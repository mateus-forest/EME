import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })

  try {
    const { id } = await context.params
    const document = await prisma.brokerDocument.findFirst({
      where: { id, brokerId: user.broker.id, type: "contract" },
      select: { id: true },
    })

    if (!document) {
      return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 })
    }

    return NextResponse.json({
      creditsUsed: 0,
      credits: {
        balance: null,
        usedThisMonth: null,
      },
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel preparar o PDF." }, { status: 500 })
  }
}
