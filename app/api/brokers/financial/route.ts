import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

const defaultConfig = {
  commissionPercent: 6,
  calculationType: "Todos os imóveis",
  statusFilter: "Todos",
  typeFilter: "Todos",
  viewMode: "Geral",
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback
}

function normalizePercent(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return defaultConfig.commissionPercent
  return Math.min(100, Math.max(0, parsed))
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const config = await prisma.brokerFinancialConfig.findUnique({
      where: { brokerId: user.broker.id },
      select: {
        commissionPercent: true,
        calculationType: true,
        statusFilter: true,
        typeFilter: true,
        viewMode: true,
      },
    })

    return NextResponse.json({ config: config ?? defaultConfig })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço financeiro indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível carregar a configuração financeira." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const body = await request.json().catch(() => null)
    const data = {
      commissionPercent: normalizePercent(body?.commissionPercent),
      calculationType: normalizeString(body?.calculationType, defaultConfig.calculationType),
      statusFilter: normalizeString(body?.statusFilter, defaultConfig.statusFilter),
      typeFilter: normalizeString(body?.typeFilter, defaultConfig.typeFilter),
      viewMode: normalizeString(body?.viewMode, defaultConfig.viewMode),
    }

    const config = await prisma.brokerFinancialConfig.upsert({
      where: { brokerId: user.broker.id },
      create: {
        brokerId: user.broker.id,
        ...data,
      },
      update: data,
      select: {
        commissionPercent: true,
        calculationType: true,
        statusFilter: true,
        typeFilter: true,
        viewMode: true,
      },
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "Financeiro atualizado",
        message: "Sua configuração de comissão e filtros financeiros foi salva.",
        read: false,
      },
    })

    return NextResponse.json({ config })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço financeiro indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível salvar a configuração financeira." }, { status: 500 })
  }
}
