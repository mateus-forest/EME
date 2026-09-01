import "server-only"

import {
  FINANCIAL_EXPENSE_CATEGORIES,
  FINANCIAL_EXPENSE_STATUSES,
  FINANCIAL_INCOME_CATEGORIES,
  FINANCIAL_INCOME_STATUSES,
  getBrokerFinancialSnapshot,
} from "@/lib/broker-finance"
import type { CosLaunchFormKind, CosLaunchOption, CosLaunchResponse } from "@/lib/cos-launch/types"
import { prisma } from "@/lib/prisma"
import {
  formatCurrencyBRLFromCents,
  parseCurrencyInputToCents,
  parseDecimalInput,
} from "@/lib/structured-fields"

type FinancialFormKind = Extract<
  CosLaunchFormKind,
  "financial_income" | "financial_expense" | "financial_commission"
>

const incomeStatusLabels: Record<string, string> = {
  EXPECTED: "Previsto",
  RECEIVED: "Recebido",
  OVERDUE: "Atrasado",
}

const expenseStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value))
}

function openFinanceAction() {
  return { id: "open:finance", label: "Abrir Financeiro", href: "/corretor/financeiro" }
}

function listLines(
  items: Array<{ description: string; amount: number; status: string; dueDate?: string; date?: string }>,
  statusLabels: Record<string, string>,
) {
  return items.slice(0, 8).map((item) => {
    const date = item.dueDate ?? item.date
    return `• ${item.description} — ${formatCurrencyBRLFromCents(item.amount)} — ${statusLabels[item.status] ?? item.status}${date ? ` — ${formatDate(date)}` : ""}`
  })
}

export async function routeCosLaunchFinancialQuery(
  actionId: string,
  brokerId: string,
): Promise<CosLaunchResponse | null> {
  if (!actionId.startsWith("query:finance")) return null

  const snapshot = await getBrokerFinancialSnapshot(brokerId)
  const { portfolio, summary } = snapshot
  const actions = [openFinanceAction()]

  if (actionId === "query:finance") {
    return {
      message: `Resumo financeiro operacional:\n\n• Valor da carteira: ${formatCurrencyBRLFromCents(summary.portfolioValue)} (${portfolio.totalProperties} imóveis)\n• Entradas no mês: ${formatCurrencyBRLFromCents(summary.receivedThisMonth)}\n• Saídas no mês: ${formatCurrencyBRLFromCents(summary.expensesThisMonth)}\n• Resultado do mês: ${formatCurrencyBRLFromCents(summary.monthResult)}\n• A receber: ${formatCurrencyBRLFromCents(summary.receivable)}\n• Atrasado: ${formatCurrencyBRLFromCents(summary.overdue)}\n\nO valor da carteira é um indicador operacional e não entra no resultado.`,
      actions,
    }
  }

  if (actionId === "query:finance:receipts") {
    return {
      message: snapshot.receipts.length
        ? `Recebimentos registrados (${snapshot.receipts.length}):\n\n${listLines(snapshot.receipts, incomeStatusLabels).join("\n")}${snapshot.receipts.length > 8 ? "\n\nMostrando os 8 primeiros por vencimento." : ""}`
        : "Nenhum recebimento foi registrado no Financeiro.",
      actions: [{ id: "form:financial_income", label: "Novo recebimento" }, ...actions],
    }
  }

  if (actionId === "query:finance:expenses") {
    return {
      message: snapshot.expenses.length
        ? `Despesas registradas (${snapshot.expenses.length}):\n\n${listLines(snapshot.expenses, expenseStatusLabels).join("\n")}${snapshot.expenses.length > 8 ? "\n\nMostrando as 8 primeiras." : ""}`
        : "Nenhuma despesa foi registrada no Financeiro.",
      actions: [{ id: "form:financial_expense", label: "Nova despesa" }, ...actions],
    }
  }

  if (actionId === "query:finance:commissions") {
    const lines = snapshot.commissions.slice(0, 8).map((item) =>
      `• ${item.property?.title ?? "Comissão"} — ${formatCurrencyBRLFromCents(item.commissionAmount)} (${item.commissionPercent.toLocaleString("pt-BR")}%) — ${incomeStatusLabels[item.status] ?? item.status} — ${formatDate(item.dueDate)}`,
    )
    return {
      message: lines.length
        ? `Comissões registradas (${snapshot.commissions.length}):\n\n${lines.join("\n")}${snapshot.commissions.length > 8 ? "\n\nMostrando as 8 primeiras por vencimento." : ""}`
        : "Nenhuma comissão foi registrada no Financeiro.",
      actions: [{ id: "form:financial_commission", label: "Nova comissão" }, ...actions],
    }
  }

  if (actionId === "query:finance:accounts") {
    const lines = snapshot.accounts.items.map((account) =>
      `• ${account.bank} — ${account.name}: ${formatCurrencyBRLFromCents(account.balance)}`,
    )
    return {
      message: lines.length
        ? `Contas financeiras:\n\n${lines.join("\n")}\n\nTotal em contas: ${formatCurrencyBRLFromCents(snapshot.accounts.totalBalance)}`
        : "Nenhuma conta financeira foi cadastrada. Os lançamentos podem continuar sem conta vinculada.",
      actions,
    }
  }

  if (actionId === "query:finance:upcoming") {
    const total = (items: Array<{ amount: number }>) => items.reduce((sum, item) => sum + item.amount, 0)
    return {
      message: `Próximos recebimentos:\n\n• Próximos 7 dias: ${formatCurrencyBRLFromCents(total(snapshot.upcoming.next7Days))} (${snapshot.upcoming.next7Days.length})\n• Próximos 30 dias: ${formatCurrencyBRLFromCents(total(snapshot.upcoming.next30Days))} (${snapshot.upcoming.next30Days.length})\n• Atrasados: ${formatCurrencyBRLFromCents(total(snapshot.upcoming.overdue))} (${snapshot.upcoming.overdue.length})`,
      actions,
    }
  }

  if (actionId === "query:finance:portfolio") {
    return {
      message: `Valor da carteira: ${formatCurrencyBRLFromCents(portfolio.totalValue)} (${portfolio.totalProperties} imóveis)\n\n• À venda: ${formatCurrencyBRLFromCents(portfolio.forSale.value)} (${portfolio.forSale.count})\n• Para locação: ${formatCurrencyBRLFromCents(portfolio.forRent.value)} (${portfolio.forRent.count})\n• Locações ativas: ${formatCurrencyBRLFromCents(portfolio.activeRentals.value)} (${portfolio.activeRentals.count})${portfolio.unpricedProperties ? `\n• Sem valor informado: ${portfolio.unpricedProperties}` : ""}\n\nA carteira usa os imóveis e locações reais do corretor e não compõe receita ou resultado.`,
      actions,
    }
  }

  return null
}

export async function getCosLaunchFinancialFormOptions(brokerId: string): Promise<{
  clients: CosLaunchOption[]
  properties: CosLaunchOption[]
  accounts: CosLaunchOption[]
  commissionPercent: number
}> {
  const [clients, properties, accounts, config] = await Promise.all([
    prisma.lead.findMany({
      where: { brokerId },
      orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
      take: 80,
      select: { id: true, name: true, phone: true, email: true },
    }),
    prisma.property.findMany({
      where: { brokerId },
      orderBy: { title: "asc" },
      take: 80,
      select: { id: true, title: true, city: true },
    }),
    prisma.brokerFinancialAccount.findMany({
      where: { brokerId },
      orderBy: [{ bank: "asc" }, { name: "asc" }],
      select: { id: true, bank: true, name: true },
    }),
    prisma.brokerFinancialConfig.findUnique({
      where: { brokerId },
      select: { commissionPercent: true },
    }),
  ])

  return {
    clients: clients.map((client) => ({
      id: client.id,
      label: client.name || client.phone || client.email || "Cliente",
    })),
    properties: properties.map((property) => ({
      id: property.id,
      label: property.title,
      subtitle: property.city,
    })),
    accounts: accounts.map((account) => ({
      id: account.id,
      label: `${account.bank} — ${account.name}`,
    })),
    commissionPercent: Number(config?.commissionPercent ?? 6),
  }
}

async function resolveRelations(brokerId: string, payload: Record<string, unknown>) {
  const leadId = cleanText(payload.leadId, 120) || null
  const propertyId = cleanText(payload.propertyId, 120) || null
  const accountId = cleanText(payload.accountId, 120) || null
  const [lead, property, account] = await Promise.all([
    leadId ? prisma.lead.findFirst({ where: { id: leadId, brokerId }, select: { id: true } }) : null,
    propertyId ? prisma.property.findFirst({ where: { id: propertyId, brokerId }, select: { id: true } }) : null,
    accountId ? prisma.brokerFinancialAccount.findFirst({ where: { id: accountId, brokerId }, select: { id: true } }) : null,
  ])
  if (leadId && !lead) return { error: "Cliente não encontrado para este corretor." } as const
  if (propertyId && !property) return { error: "Imóvel não encontrado para este corretor." } as const
  if (accountId && !account) return { error: "Conta financeira não encontrada para este corretor." } as const
  return { leadId, propertyId, accountId } as const
}

export async function createCosLaunchFinancialRecord(input: {
  kind: FinancialFormKind
  brokerId: string
  userId: string
  payload: Record<string, unknown>
}): Promise<CosLaunchResponse> {
  const relations = await resolveRelations(input.brokerId, input.payload)
  if ("error" in relations) return { message: relations.error || "Não foi possível validar os vínculos do lançamento." }

  const dueDate = parseDate(input.payload.dueDate ?? input.payload.date)
  if (!dueDate) return { message: "Informe uma data válida para o lançamento." }
  const notes = cleanText(input.payload.notes, 2000) || null

  if (input.kind === "financial_commission") {
    const operationAmount = parseCurrencyInputToCents(input.payload.operationAmount)
    const commissionPercent = parseDecimalInput(input.payload.commissionPercent)
    const status = isOneOf(input.payload.status, FINANCIAL_INCOME_STATUSES)
      ? input.payload.status
      : "EXPECTED"
    if (!relations.leadId || !relations.propertyId) {
      return { message: "Selecione cliente e imóvel para registrar a comissão." }
    }
    if (!operationAmount || operationAmount <= 0) return { message: "Informe o valor da operação." }
    if (commissionPercent === null || commissionPercent <= 0 || commissionPercent > 100) {
      return { message: "Informe um percentual de comissão entre 0 e 100%." }
    }
    const commissionAmount = Math.round(operationAmount * (commissionPercent / 100))
    const receivedAt = status === "RECEIVED"
      ? parseDate(input.payload.occurredAt ?? input.payload.receivedAt) ?? new Date()
      : null

    await prisma.$transaction([
      prisma.brokerFinancialCommission.create({
        data: {
          brokerId: input.brokerId,
          leadId: relations.leadId,
          propertyId: relations.propertyId,
          operationAmount,
          commissionPercent,
          commissionAmount,
          dueDate,
          receivedAt,
          status,
          notes,
        },
      }),
      prisma.notification.create({
        data: {
          userId: input.userId,
          title: "Comissão registrada",
          message: `Comissão de ${commissionPercent.toLocaleString("pt-BR")}% adicionada pelo COS.`,
        },
      }),
    ])

    return {
      message: `Comissão registrada: ${formatCurrencyBRLFromCents(operationAmount)} × ${commissionPercent.toLocaleString("pt-BR")}% = ${formatCurrencyBRLFromCents(commissionAmount)}.`,
      actions: [{ id: "query:finance:commissions", label: "Ver comissões" }, openFinanceAction()],
    }
  }

  const isIncome = input.kind === "financial_income"
  const direction = isIncome ? "INCOME" : "EXPENSE"
  const description = cleanText(input.payload.description, 180)
  const category = cleanText(input.payload.category, 40).toUpperCase()
  const amount = parseCurrencyInputToCents(input.payload.amount)
  const categories = isIncome ? FINANCIAL_INCOME_CATEGORIES : FINANCIAL_EXPENSE_CATEGORIES
  const statuses = isIncome ? FINANCIAL_INCOME_STATUSES : FINANCIAL_EXPENSE_STATUSES
  const defaultStatus = isIncome ? "EXPECTED" : "PENDING"
  const status = isOneOf(input.payload.status, statuses) ? input.payload.status : defaultStatus

  if (!description) return { message: "Informe a descrição do lançamento." }
  if (!isOneOf(category, categories)) return { message: "Selecione uma categoria válida." }
  if (!amount || amount <= 0) return { message: "Informe um valor maior que zero." }

  const occurredAt = status === "RECEIVED" || status === "PAID"
    ? parseDate(input.payload.occurredAt ?? input.payload.receivedAt ?? input.payload.date) ?? new Date()
    : null

  await prisma.$transaction([
    prisma.brokerFinancialEntry.create({
      data: {
        brokerId: input.brokerId,
        leadId: relations.leadId,
        propertyId: relations.propertyId,
        accountId: relations.accountId,
        direction,
        category,
        description,
        amount,
        dueDate,
        occurredAt,
        status,
        notes,
      },
    }),
    prisma.notification.create({
      data: {
        userId: input.userId,
        title: isIncome ? "Recebimento registrado" : "Despesa registrada",
        message: `${description} foi adicionado ao Financeiro pelo COS.`,
      },
    }),
  ])

  return {
    message: `${isIncome ? "Recebimento" : "Despesa"} registrado: ${description} — ${formatCurrencyBRLFromCents(amount)}.`,
    actions: [
      { id: isIncome ? "query:finance:receipts" : "query:finance:expenses", label: isIncome ? "Ver recebimentos" : "Ver despesas" },
      openFinanceAction(),
    ],
  }
}
