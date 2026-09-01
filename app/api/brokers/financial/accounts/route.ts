import { NextRequest, NextResponse } from "next/server"

import {
  ensureRole,
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { FINANCIAL_ACCOUNT_TYPES } from "@/lib/broker-finance"
import { parseCurrencyInputToCents } from "@/lib/currency"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function isAccountType(value: unknown): value is (typeof FINANCIAL_ACCOUNT_TYPES)[number] {
  return typeof value === "string" && FINANCIAL_ACCOUNT_TYPES.includes(value as (typeof FINANCIAL_ACCOUNT_TYPES)[number])
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: "Dados da conta inválidos." }, { status: 400 })

    const bank = cleanText(body.bank, 80)
    const name = cleanText(body.name, 100)
    const type = isAccountType(body.type) ? body.type : null
    const initialBalance = parseCurrencyInputToCents(body.initialBalance) ?? 0
    const notes = cleanText(body.notes, 1000) || null

    if (!bank) return NextResponse.json({ error: "Informe o banco." }, { status: 400 })
    if (!name) return NextResponse.json({ error: "Informe o nome ou apelido da conta." }, { status: 400 })
    if (!type) return NextResponse.json({ error: "Selecione um tipo de conta válido." }, { status: 400 })

    const account = await prisma.brokerFinancialAccount.create({
      data: { brokerId: user.broker.id, bank, name, type, initialBalance, notes },
      select: { id: true },
    })

    return NextResponse.json({ id: account.id }, { status: 201 })
  } catch (caughtError) {
    console.error("[api][brokers][financial][accounts] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço financeiro indisponível no momento." }, { status: 503 })
    }
    if (isPrismaSchemaMismatch(caughtError)) return prismaSchemaMismatchResponse("Contas do financeiro operacional")
    return NextResponse.json({ error: "Não foi possível cadastrar a conta." }, { status: 500 })
  }
}
