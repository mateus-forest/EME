import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { applyAdminBonus } from "@/lib/eme-plan-service"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

type AdminBonusType = "credit" | "property"

function cleanQuery(value: string | null) {
  return value?.trim().slice(0, 120) ?? ""
}

const bonusTransactionInclude = {
  broker: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} as const

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const query = cleanQuery(searchParams.get("q"))

    const transactions = await prisma.aiCreditTransaction.findMany({
      where: {
        type: "admin_bonus",
        ...(query
          ? {
              OR: [
                { brokerId: { contains: query, mode: "insensitive" } },
                { broker: { user: { name: { contains: query, mode: "insensitive" } } } },
                { broker: { user: { email: { contains: query, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: bonusTransactionInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    })

    return NextResponse.json({
      bonuses: transactions.map((transaction) => {
        const metadata =
          transaction.metadata && typeof transaction.metadata === "object"
            ? (transaction.metadata as Record<string, unknown>)
            : {}
        const brokerUser = transaction.broker?.user

        if (!brokerUser) {
          return {
            id: transaction.id,
            brokerId: transaction.brokerId,
            userId: "",
            userName: "",
            userEmail: "",
            amount: transaction.amount,
            balanceBefore: Number(metadata.balanceBefore ?? 0),
            balanceAfter: transaction.balanceAfter,
            reason: transaction.description ?? "",
            adminUserId: typeof metadata.adminUserId === "string" ? metadata.adminUserId : "",
            adminName: typeof metadata.adminName === "string" ? metadata.adminName : "",
            createdAt: transaction.createdAt.toISOString(),
          }
        }

        return {
          id: transaction.id,
          brokerId: transaction.brokerId,
          userId: brokerUser.id,
          userName: brokerUser.name,
          userEmail: brokerUser.email,
          amount: transaction.amount,
          balanceBefore: Number(metadata.balanceBefore ?? 0),
          balanceAfter: transaction.balanceAfter,
          reason: transaction.description ?? "",
          adminUserId: typeof metadata.adminUserId === "string" ? metadata.adminUserId : "",
          adminName: typeof metadata.adminName === "string" ? metadata.adminName : "",
          createdAt: transaction.createdAt.toISOString(),
        }
      }),
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço administrativo indisponível." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível carregar o histórico de bonificações." }, { status: 500 })
  }
}

function parseBonusPayload(body: unknown): {
  userId: string
  bonusType: AdminBonusType | null
  quantity: number
  reason: string
} {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

  return {
    userId: typeof data.userId === "string" ? data.userId.trim() : "",
    bonusType: data.bonusType === "property" ? "property" : data.bonusType === "credit" ? "credit" : null,
    quantity: typeof data.quantity === "number" ? data.quantity : Number(data.quantity),
    reason: typeof data.reason === "string" ? data.reason.trim().slice(0, 240) : "",
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const payload = parseBonusPayload(await request.json().catch(() => null))

    if (!payload.userId) {
      return NextResponse.json({ error: "Selecione um usuário válido." }, { status: 400 })
    }

    if (!payload.bonusType) {
      return NextResponse.json({ error: "Selecione o tipo de bonificação." }, { status: 400 })
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
      return NextResponse.json({ error: "Informe uma quantidade válida." }, { status: 400 })
    }

    if (!payload.reason) {
      return NextResponse.json({ error: "Informe o motivo da bonificação." }, { status: 400 })
    }

    const bonusType = payload.bonusType

    const targetUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        broker: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!targetUser?.broker) {
      return NextResponse.json({ error: "O usuário selecionado não possui carteira de corretor vinculada." }, { status: 400 })
    }

    const result = await applyAdminBonus({
      brokerId: targetUser.broker.id,
      bonusType,
      quantity: payload.quantity,
      reason: payload.reason,
      adminUserId: user.id,
      adminName: user.name,
    })

    return NextResponse.json({
      success: true,
      bonus: {
        userId: targetUser.id,
        userName: targetUser.name,
        bonusType,
        quantity: result.quantity,
        reason: payload.reason,
        transactionId: result.transactionId,
      },
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço administrativo indisponível." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível aplicar a bonificação." }, { status: 500 })
  }
}
