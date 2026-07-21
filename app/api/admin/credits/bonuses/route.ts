import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

function cleanQuery(value: string | null) {
  return value?.trim().slice(0, 120) ?? ""
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })

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
      include: {
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
      },
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

        return {
          id: transaction.id,
          brokerId: transaction.brokerId,
          userId: transaction.broker.user.id,
          userName: transaction.broker.user.name,
          userEmail: transaction.broker.user.email,
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
      return NextResponse.json({ error: "Servico administrativo indisponivel." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel carregar o historico de bonificacoes." }, { status: 500 })
  }
}
