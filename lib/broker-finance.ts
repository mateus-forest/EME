import "server-only"

import { PropertyStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const FINANCIAL_INCOME_CATEGORIES = ["COMMISSION", "FEES", "RENT", "DEPOSIT", "OTHER"] as const
export const FINANCIAL_EXPENSE_CATEGORIES = ["ADS", "PHOTOGRAPHY", "TRAVEL", "DOCUMENTATION", "TOOLS", "OTHER"] as const
export const FINANCIAL_INCOME_STATUSES = ["EXPECTED", "RECEIVED", "OVERDUE"] as const
export const FINANCIAL_EXPENSE_STATUSES = ["PENDING", "PAID"] as const

export type FinancialIncomeStatus = (typeof FINANCIAL_INCOME_STATUSES)[number]
export type FinancialExpenseStatus = (typeof FINANCIAL_EXPENSE_STATUSES)[number]

type FinancialReceiptItem = {
  id: string
  source: "ENTRY" | "COMMISSION" | "RENTAL_PAYMENT"
  description: string
  category: string
  client: { id: string; name: string } | null
  property: { id: string; title: string } | null
  amount: number
  dueDate: string
  occurredAt: string | null
  status: FinancialIncomeStatus
  notes: string | null
  editable: boolean
}

function saoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) }
}

export function getFinancialDateRange(now = new Date()) {
  const { year, month, day } = saoPauloDateParts(now)
  const today = new Date(Date.UTC(year, month - 1, day))
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 1))
  const inSevenDays = new Date(today)
  inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 8)
  const inThirtyDays = new Date(today)
  inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 31)
  return { today, monthStart, monthEnd, inSevenDays, inThirtyDays }
}

function normalizeIncomeStatus(status: string, dueDate: Date, occurredAt: Date | null, today: Date): FinancialIncomeStatus {
  if (occurredAt || status === "RECEIVED" || status === "PAID") return "RECEIVED"
  if (status === "OVERDUE" || dueDate < today) return "OVERDUE"
  return "EXPECTED"
}

function normalizeExpenseStatus(status: string, occurredAt: Date | null): FinancialExpenseStatus {
  return occurredAt || status === "PAID" ? "PAID" : "PENDING"
}

function isInside(date: Date | null, start: Date, end: Date) {
  return Boolean(date && date >= start && date < end)
}

function leadName(lead: { name: string | null; phone: string | null; email: string | null } | null) {
  return lead?.name || lead?.phone || lead?.email || "Cliente"
}

export async function getBrokerFinancialSnapshot(brokerId: string, now = new Date()) {
  const { today, monthStart, monthEnd, inSevenDays, inThirtyDays } = getFinancialDateRange(now)
  const [config, entries, commissions, properties, rentals, clients, documents] = await Promise.all([
    prisma.brokerFinancialConfig.findUnique({
      where: { brokerId },
      select: { commissionPercent: true, calculationType: true, statusFilter: true, typeFilter: true, viewMode: true },
    }),
    prisma.brokerFinancialEntry.findMany({
      where: { brokerId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        property: { select: { id: true, title: true } },
      },
    }),
    prisma.brokerFinancialCommission.findMany({
      where: { brokerId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        property: { select: { id: true, title: true } },
      },
    }),
    prisma.property.findMany({
      where: { brokerId },
      orderBy: { title: "asc" },
      select: { id: true, title: true, price: true, purpose: true, published: true, status: true, rentalAvailable: true },
    }),
    prisma.propertyRental.findMany({
      where: { brokerId },
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { id: true, title: true } },
        tenant: { select: { id: true, name: true, phone: true, email: true } },
        owner: { select: { id: true, name: true, phone: true, email: true } },
        contractDocument: { select: { id: true, title: true, type: true } },
        payments: { orderBy: { dueDate: "asc" } },
      },
    }),
    prisma.lead.findMany({
      where: { brokerId },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      select: { id: true, name: true, phone: true, email: true },
    }),
    prisma.brokerDocument.findMany({
      where: { brokerId, type: { in: ["proposal", "contract"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, type: true, leadId: true, propertyId: true },
    }),
  ])

  const activeRentals = rentals.filter((rental) => rental.status === "ACTIVE")
  const activeRentalPropertyIds = new Set(activeRentals.map((rental) => rental.propertyId))
  const publishedProperties = properties.filter((property) => property.published || property.status === PropertyStatus.PUBLISHED)
  const forSale = publishedProperties.filter((property) => property.purpose !== "RENT")
  const forRent = publishedProperties.filter(
    (property) => property.purpose === "RENT" && property.rentalAvailable && !activeRentalPropertyIds.has(property.id),
  )
  const saleValue = forSale.reduce((total, property) => total + Math.max(0, property.price), 0)
  const rentalListingValue = forRent.reduce((total, property) => total + Math.max(0, property.price), 0)
  const activeRentalValue = activeRentals.reduce((total, rental) => total + Math.max(0, rental.monthlyRent), 0)
  const activePropertyIds = new Set([...publishedProperties.map((property) => property.id), ...activeRentalPropertyIds])

  const directReceipts: FinancialReceiptItem[] = entries
    .filter((entry) => entry.direction === "INCOME")
    .map((entry) => ({
      id: entry.id,
      source: "ENTRY",
      description: entry.description,
      category: entry.category,
      client: entry.lead ? { id: entry.lead.id, name: leadName(entry.lead) } : null,
      property: entry.property,
      amount: entry.amount,
      dueDate: entry.dueDate.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
      status: normalizeIncomeStatus(entry.status, entry.dueDate, entry.occurredAt, today),
      notes: entry.notes,
      editable: true,
    }))

  const commissionReceipts: FinancialReceiptItem[] = commissions.map((commission) => ({
    id: commission.id,
    source: "COMMISSION",
    description: `Comissão${commission.property ? ` - ${commission.property.title}` : ""}`,
    category: "COMMISSION",
    client: commission.lead ? { id: commission.lead.id, name: leadName(commission.lead) } : null,
    property: commission.property,
    amount: commission.commissionAmount,
    dueDate: commission.dueDate.toISOString(),
    occurredAt: commission.receivedAt?.toISOString() ?? null,
    status: normalizeIncomeStatus(commission.status, commission.dueDate, commission.receivedAt, today),
    notes: commission.notes,
    editable: true,
  }))

  const rentalReceipts: FinancialReceiptItem[] = rentals.flatMap((rental) =>
    rental.payments.map((payment) => ({
      id: payment.id,
      source: "RENTAL_PAYMENT" as const,
      description: `Locação ${payment.competence}`,
      category: "RENT",
      client: { id: rental.tenant.id, name: leadName(rental.tenant) },
      property: rental.property,
      amount: payment.amount,
      dueDate: payment.dueDate.toISOString(),
      occurredAt: payment.paidAt?.toISOString() ?? null,
      status: normalizeIncomeStatus(payment.status, payment.dueDate, payment.paidAt, today),
      notes: payment.notes,
      editable: false,
    })),
  )

  const receipts = [...directReceipts, ...commissionReceipts, ...rentalReceipts].sort(
    (left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
  )
  const expenses = entries
    .filter((entry) => entry.direction === "EXPENSE")
    .map((entry) => ({
      id: entry.id,
      description: entry.description,
      category: entry.category,
      client: entry.lead ? { id: entry.lead.id, name: leadName(entry.lead) } : null,
      property: entry.property,
      amount: entry.amount,
      date: entry.dueDate.toISOString(),
      occurredAt: entry.occurredAt?.toISOString() ?? null,
      status: normalizeExpenseStatus(entry.status, entry.occurredAt),
      notes: entry.notes,
    }))

  const serializedCommissions = commissions.map((commission) => ({
    id: commission.id,
    client: commission.lead ? { id: commission.lead.id, name: leadName(commission.lead) } : null,
    property: commission.property,
    operationAmount: commission.operationAmount,
    commissionPercent: Number(commission.commissionPercent),
    commissionAmount: commission.commissionAmount,
    dueDate: commission.dueDate.toISOString(),
    receivedAt: commission.receivedAt?.toISOString() ?? null,
    status: normalizeIncomeStatus(commission.status, commission.dueDate, commission.receivedAt, today),
    notes: commission.notes,
  }))

  const receivedThisMonth = receipts
    .filter((item) => item.status === "RECEIVED" && isInside(item.occurredAt ? new Date(item.occurredAt) : null, monthStart, monthEnd))
    .reduce((total, item) => total + item.amount, 0)
  const expensesThisMonth = expenses
    .filter((item) => item.status === "PAID" && isInside(new Date(item.occurredAt ?? item.date), monthStart, monthEnd))
    .reduce((total, item) => total + item.amount, 0)
  const expectedReceipts = receipts.filter((item) => item.status === "EXPECTED")
  const overdueReceipts = receipts.filter((item) => item.status === "OVERDUE")
  const pendingReceipts = receipts.filter((item) => item.status !== "RECEIVED")
  const nextSevenDays = pendingReceipts.filter((item) => {
    const date = new Date(item.dueDate)
    return date >= today && date < inSevenDays
  })
  const nextThirtyDays = pendingReceipts.filter((item) => {
    const date = new Date(item.dueDate)
    return date >= today && date < inThirtyDays
  })

  return {
    config: config ?? {
      commissionPercent: 6,
      calculationType: "Todos os imóveis",
      statusFilter: "Todos",
      typeFilter: "Todos",
      viewMode: "Geral",
    },
    summary: {
      portfolioValue: saleValue + rentalListingValue + activeRentalValue,
      receivedThisMonth,
      expensesThisMonth,
      monthResult: receivedThisMonth - expensesThisMonth,
      receivable: expectedReceipts.reduce((total, item) => total + item.amount, 0),
      overdue: overdueReceipts.reduce((total, item) => total + item.amount, 0),
    },
    portfolio: {
      totalValue: saleValue + rentalListingValue + activeRentalValue,
      totalProperties: properties.length,
      activeProperties: activePropertyIds.size,
      forSale: { count: forSale.length, value: saleValue },
      forRent: { count: forRent.length, value: rentalListingValue },
      activeRentals: { count: activeRentals.length, value: activeRentalValue },
    },
    receipts,
    expenses,
    commissions: serializedCommissions,
    upcoming: {
      next7Days: nextSevenDays,
      next30Days: nextThirtyDays,
      overdue: overdueReceipts,
    },
    references: {
      clients: clients.map((lead) => ({ id: lead.id, name: leadName(lead) })),
      properties: properties.map((property) => ({ id: property.id, title: property.title, purpose: property.purpose, price: property.price })),
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        type: document.type,
        leadId: document.leadId,
        propertyId: document.propertyId,
      })),
      rentals: rentals.map((rental) => ({
        id: rental.id,
        label: `${rental.property.title} · ${leadName(rental.tenant)}`,
        propertyId: rental.propertyId,
        leadId: rental.tenantLeadId,
        status: rental.status,
      })),
    },
  }
}

export type BrokerFinancialSnapshot = Awaited<ReturnType<typeof getBrokerFinancialSnapshot>>
