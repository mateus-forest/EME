import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

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
