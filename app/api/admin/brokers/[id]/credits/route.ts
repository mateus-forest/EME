import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const amount = Number(body?.amount)
    const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 180) : "Bonificação administrativa"

    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "Informe uma quantidade válida de créditos." }, { status: 400 })
    }

    const broker = await prisma.broker.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

    const creditsAmount = Math.trunc(amount)
    if (creditsAmount < 0 && broker.aiCreditsBalance < Math.abs(creditsAmount)) {
      return NextResponse.json({ error: "O corretor não possui créditos suficientes para remover." }, { status: 400 })
    }

    const updated = await prisma.broker.update({
      where: { id },
      data: {
        aiCreditsBalance: {
          increment: creditsAmount,
        },
      },
      include: { user: true },
    })

    await Promise.all([
      prisma.aiAssistantInteraction.create({
        data: {
          userId: broker.userId,
          brokerId: broker.id,
          prompt: reason,
          response: `${amount > 0 ? "Adicionados" : "Removidos"} ${Math.abs(creditsAmount)} créditos pelo admin.`,
          actionType: amount > 0 ? "admin_credit_bonus" : "admin_credit_adjustment",
          creditsUsed: 0,
          channel: "admin",
          actionStatus: "completed",
          metadata: { amount: creditsAmount, reason, adminUserId: user.id },
        },
      }),
      prisma.notification.create({
        data: {
          userId: broker.userId,
          title: amount > 0 ? "Créditos IA adicionados" : "Créditos IA ajustados",
          message: `${Math.abs(creditsAmount)} crédito(s). Motivo: ${reason}.`,
          read: false,
        },
      }),
    ])

    return NextResponse.json({
      broker: {
        id: updated.id,
        aiCreditsBalance: updated.aiCreditsBalance,
        aiAssistantEnabled: updated.aiAssistantEnabled,
        aiCreditsUsedThisMonth: updated.aiCreditsUsedThisMonth,
      },
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço administrativo indisponível." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível ajustar créditos." }, { status: 500 })
  }
}
