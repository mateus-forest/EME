import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const amount = Math.trunc(Number(body?.amount))
    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 180)
        : "Bonificacao administrativa"

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Informe uma quantidade valida de creditos." }, { status: 400 })
    }

    const broker = await prisma.broker.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!broker) return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })

    const updated = await prisma.$transaction(async (tx) => {
      const refreshedBroker = await tx.broker.update({
        where: { id },
        data: {
          aiCreditsBalance: {
            increment: amount,
          },
        },
        include: { user: true },
      })

      await Promise.all([
        tx.aiCreditTransaction.create({
          data: {
            brokerId: broker.id,
            type: "admin_bonus",
            amount,
            balanceAfter: refreshedBroker.aiCreditsBalance,
            actionType: "admin_credit_bonus",
            description: reason,
            metadata: {
              balanceBefore: broker.aiCreditsBalance,
              balanceAfter: refreshedBroker.aiCreditsBalance,
              adminUserId: user.id,
              adminName: user.name,
              brokerUserId: broker.userId,
              brokerName: broker.user.name,
              brokerEmail: broker.user.email,
            },
          },
        }),
        tx.aiAssistantInteraction.create({
          data: {
            userId: broker.userId,
            brokerId: broker.id,
            prompt: reason,
            response: `Adicionados ${amount} creditos pelo admin.`,
            actionType: "admin_credit_bonus",
            creditsUsed: 0,
            channel: "admin",
            actionStatus: "completed",
            metadata: { amount, reason, adminUserId: user.id, adminName: user.name },
          },
        }),
        tx.notification.create({
          data: {
            userId: broker.userId,
            title: "Creditos IA adicionados",
            message: `${amount} credito(s). Motivo: ${reason}.`,
            read: false,
          },
        }),
      ])

      return refreshedBroker
    })

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
      return NextResponse.json({ error: "Servico administrativo indisponivel." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel bonificar creditos." }, { status: 500 })
  }
}
