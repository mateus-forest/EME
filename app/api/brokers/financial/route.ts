import { NextRequest, NextResponse } from "next/server"

import {
  ensureRole,
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import {
  FINANCIAL_EXPENSE_CATEGORIES,
  FINANCIAL_EXPENSE_STATUSES,
  FINANCIAL_INCOME_CATEGORIES,
  FINANCIAL_INCOME_STATUSES,
  getBrokerFinancialSnapshot,
} from "@/lib/broker-finance"
import { parseCurrencyInputToCents } from "@/lib/currency"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { parseDecimalInput } from "@/lib/structured-fields"

export const dynamic = "force-dynamic"

const defaultConfig = {
  commissionPercent: 6,
  calculationType: "Todos os imóveis",
  statusFilter: "Todos",
  typeFilter: "Todos",
  viewMode: "Geral",
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeString(value: unknown, fallback: string) {
  return cleanText(value, 80) || fallback
}

function normalizePercent(value: unknown) {
  const parsed = parseDecimalInput(value)
  if (parsed === null) return defaultConfig.commissionPercent
  return Math.min(100, Math.max(0, parsed))
}

function parseDate(value: unknown) {
  const text = cleanText(value, 40)
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) return null
  return date
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number])
}

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
  return user
}

async function resolveRelations(brokerId: string, body: Record<string, unknown>) {
  let leadId = cleanText(body.leadId, 120) || null
  let propertyId = cleanText(body.propertyId, 120) || null
  const brokerDocumentId = cleanText(body.brokerDocumentId, 120) || null
  const propertyRentalId = cleanText(body.propertyRentalId, 120) || null

  const [lead, property, document, rental] = await Promise.all([
    leadId ? prisma.lead.findFirst({ where: { id: leadId, brokerId }, select: { id: true } }) : null,
    propertyId ? prisma.property.findFirst({ where: { id: propertyId, brokerId }, select: { id: true } }) : null,
    brokerDocumentId
      ? prisma.brokerDocument.findFirst({
          where: { id: brokerDocumentId, brokerId, type: { in: ["proposal", "contract"] } },
          select: { id: true, leadId: true, propertyId: true },
        })
      : null,
    propertyRentalId
      ? prisma.propertyRental.findFirst({
          where: { id: propertyRentalId, brokerId },
          select: { id: true, tenantLeadId: true, propertyId: true },
        })
      : null,
  ])

  if (leadId && !lead) return { error: "Cliente não encontrado para este corretor." }
  if (propertyId && !property) return { error: "Imóvel não encontrado para este corretor." }
  if (brokerDocumentId && !document) return { error: "Proposta ou contrato não encontrado para este corretor." }
  if (propertyRentalId && !rental) return { error: "Locação não encontrada para este corretor." }

  leadId ||= rental?.tenantLeadId ?? document?.leadId ?? null
  propertyId ||= rental?.propertyId ?? document?.propertyId ?? null
  return { leadId, propertyId, brokerDocumentId, propertyRentalId }
}

function financeError(caughtError: unknown, fallback: string) {
  if (isPrismaUnavailable(caughtError)) {
    return NextResponse.json({ error: "Serviço financeiro indisponível no momento." }, { status: 503 })
  }
  if (isPrismaSchemaMismatch(caughtError)) return prismaSchemaMismatchResponse("Financeiro operacional")
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export async function GET() {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const snapshot = await getBrokerFinancialSnapshot(auth.broker!.id)
    const response = NextResponse.json(snapshot)
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][brokers][financial] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return financeError(caughtError, "Não foi possível carregar o financeiro operacional.")
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: "Dados do lançamento inválidos." }, { status: 400 })

    const entryType = cleanText(body.entryType, 20).toLowerCase()
    const relations = await resolveRelations(auth.broker!.id, body)
    if ("error" in relations) return NextResponse.json({ error: relations.error }, { status: 400 })
    const notes = cleanText(body.notes, 2000) || null
    const dueDate = parseDate(body.dueDate ?? body.date)
    if (!dueDate) return NextResponse.json({ error: "Informe uma data válida." }, { status: 400 })

    if (entryType === "commission") {
      const operationAmount = parseCurrencyInputToCents(body.operationAmount)
      const commissionPercent = parseDecimalInput(body.commissionPercent)
      const status = isOneOf(body.status, FINANCIAL_INCOME_STATUSES) ? body.status : "EXPECTED"
      if (!relations.leadId || !relations.propertyId) {
        return NextResponse.json({ error: "Selecione cliente e imóvel para registrar a comissão." }, { status: 400 })
      }
      if (!operationAmount || operationAmount <= 0) {
        return NextResponse.json({ error: "Informe o valor da operação." }, { status: 400 })
      }
      if (commissionPercent === null || commissionPercent <= 0 || commissionPercent > 100) {
        return NextResponse.json({ error: "Informe um percentual de comissão entre 0 e 100%." }, { status: 400 })
      }
      const receivedAt = status === "RECEIVED" ? parseDate(body.occurredAt ?? body.receivedAt) ?? new Date() : null
      const commissionAmount = Math.round(operationAmount * (commissionPercent / 100))
      const commission = await prisma.brokerFinancialCommission.create({
        data: {
          brokerId: auth.broker!.id,
          ...relations,
          operationAmount,
          commissionPercent,
          commissionAmount,
          dueDate,
          receivedAt,
          status,
          notes,
        },
        select: { id: true },
      })
      await prisma.notification.create({
        data: {
          userId: auth.id,
          title: "Comissão registrada",
          message: `Comissão de ${commissionPercent.toLocaleString("pt-BR")}% adicionada ao financeiro operacional.`,
        },
      })
      return NextResponse.json({ id: commission.id, type: "commission" }, { status: 201 })
    }

    if (entryType !== "income" && entryType !== "expense") {
      return NextResponse.json({ error: "Tipo de lançamento inválido." }, { status: 400 })
    }

    const direction = entryType === "income" ? "INCOME" : "EXPENSE"
    const category = cleanText(body.category, 40).toUpperCase()
    const validCategories = entryType === "income" ? FINANCIAL_INCOME_CATEGORIES : FINANCIAL_EXPENSE_CATEGORIES
    const description = cleanText(body.description, 180)
    const amount = parseCurrencyInputToCents(body.amount)
    if (!description) return NextResponse.json({ error: "Informe a descrição do lançamento." }, { status: 400 })
    if (!isOneOf(category, validCategories)) return NextResponse.json({ error: "Categoria inválida." }, { status: 400 })
    if (!amount || amount <= 0) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 })

    const allowedStatuses = entryType === "income" ? FINANCIAL_INCOME_STATUSES : FINANCIAL_EXPENSE_STATUSES
    const defaultStatus = entryType === "income" ? "EXPECTED" : "PENDING"
    const status = isOneOf(body.status, allowedStatuses) ? body.status : defaultStatus
    const occurredAt = status === "RECEIVED" || status === "PAID"
      ? parseDate(body.occurredAt ?? body.receivedAt ?? body.date) ?? new Date()
      : null
    const entry = await prisma.brokerFinancialEntry.create({
      data: {
        brokerId: auth.broker!.id,
        ...relations,
        direction,
        category,
        description,
        amount,
        dueDate,
        occurredAt,
        status,
        notes,
      },
      select: { id: true },
    })
    await prisma.notification.create({
      data: {
        userId: auth.id,
        title: entryType === "income" ? "Recebimento registrado" : "Despesa registrada",
        message: `${description} foi adicionado ao financeiro operacional.`,
      },
    })
    return NextResponse.json({ id: entry.id, type: entryType }, { status: 201 })
  } catch (caughtError) {
    console.error("[api][brokers][financial] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return financeError(caughtError, "Não foi possível registrar o lançamento.")
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })

    if (body.action === "updateStatus") {
      const id = cleanText(body.id, 120)
      const source = cleanText(body.source, 30).toUpperCase()
      const occurredAt = parseDate(body.occurredAt) ?? new Date()
      if (!id) return NextResponse.json({ error: "Lançamento não informado." }, { status: 400 })

      if (source === "COMMISSION") {
        if (!isOneOf(body.status, FINANCIAL_INCOME_STATUSES)) {
          return NextResponse.json({ error: "Status de comissão inválido." }, { status: 400 })
        }
        const existing = await prisma.brokerFinancialCommission.findFirst({ where: { id, brokerId: auth.broker!.id }, select: { id: true } })
        if (!existing) return NextResponse.json({ error: "Comissão não encontrada." }, { status: 404 })
        await prisma.brokerFinancialCommission.update({
          where: { id },
          data: { status: body.status, receivedAt: body.status === "RECEIVED" ? occurredAt : null },
        })
      } else if (source === "ENTRY") {
        const existing = await prisma.brokerFinancialEntry.findFirst({ where: { id, brokerId: auth.broker!.id }, select: { id: true, direction: true } })
        if (!existing) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 })
        const allowed = existing.direction === "INCOME" ? FINANCIAL_INCOME_STATUSES : FINANCIAL_EXPENSE_STATUSES
        if (!isOneOf(body.status, allowed)) return NextResponse.json({ error: "Status de lançamento inválido." }, { status: 400 })
        const completed = body.status === "RECEIVED" || body.status === "PAID"
        await prisma.brokerFinancialEntry.update({
          where: { id },
          data: { status: body.status, occurredAt: completed ? occurredAt : null },
        })
      } else {
        return NextResponse.json({ error: "Origem do lançamento inválida." }, { status: 400 })
      }

      return NextResponse.json({ updated: true })
    }

    const data = {
      commissionPercent: normalizePercent(body.commissionPercent),
      calculationType: normalizeString(body.calculationType, defaultConfig.calculationType),
      statusFilter: normalizeString(body.statusFilter, defaultConfig.statusFilter),
      typeFilter: normalizeString(body.typeFilter, defaultConfig.typeFilter),
      viewMode: normalizeString(body.viewMode, defaultConfig.viewMode),
    }
    const config = await prisma.brokerFinancialConfig.upsert({
      where: { brokerId: auth.broker!.id },
      create: { brokerId: auth.broker!.id, ...data },
      update: data,
      select: { commissionPercent: true, calculationType: true, statusFilter: true, typeFilter: true, viewMode: true },
    })
    return NextResponse.json({ config })
  } catch (caughtError) {
    console.error("[api][brokers][financial] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return financeError(caughtError, "Não foi possível atualizar o financeiro operacional.")
  }
}
