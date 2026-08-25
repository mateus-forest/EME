import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
  return user
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function parseDate(value: unknown) {
  const text = cleanText(value, 40)
  if (!text) return null
  const date = new Date(`${text}T12:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100)
  if (typeof value !== "string") return null
  const amount = Number(value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."))
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const action = cleanText(body?.action, 40)
    const rental = await prisma.propertyRental.findFirst({ where: { id, brokerId: auth.broker!.id }, include: { property: { select: { id: true, title: true } } } })
    if (!rental) return NextResponse.json({ error: "Locação não encontrada." }, { status: 404 })

    if (action === "payment") {
      const competence = cleanText(body?.competence, 7)
      const amount = parseMoney(body?.amount)
      const dueDate = parseDate(body?.dueDate)
      const status = cleanText(body?.status, 20).toUpperCase()
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence) || !amount || amount <= 0 || !dueDate || !["PAID", "PENDING", "OVERDUE"].includes(status)) return NextResponse.json({ error: "Preencha competência, valor, vencimento e status corretamente." }, { status: 400 })
      await prisma.rentalPayment.upsert({
        where: { rentalId_competence: { rentalId: rental.id, competence } },
        create: { rentalId: rental.id, competence, amount, dueDate, status, paidAt: status === "PAID" ? new Date() : null, receiptData: body?.receiptData ?? undefined, notes: cleanText(body?.notes, 800) || null },
        update: { amount, dueDate, status, paidAt: status === "PAID" ? new Date() : null, receiptData: body?.receiptData ?? undefined, notes: cleanText(body?.notes, 800) || null },
      })
    } else if (action === "adjustment") {
      if (rental.status !== "ACTIVE") return NextResponse.json({ error: "Apenas locações ativas podem ser reajustadas." }, { status: 400 })
      const newAmount = parseMoney(body?.newAmount)
      const effectiveDate = parseDate(body?.effectiveDate)
      const percentage = body?.percentage === "" || body?.percentage == null ? null : Number(String(body.percentage).replace(",", "."))
      if (!newAmount || newAmount <= 0 || !effectiveDate || (percentage !== null && !Number.isFinite(percentage))) return NextResponse.json({ error: "Informe o novo valor e a data de vigência." }, { status: 400 })
      const nextAdjustmentDate = new Date(effectiveDate)
      nextAdjustmentDate.setUTCFullYear(nextAdjustmentDate.getUTCFullYear() + 1)
      await prisma.$transaction([
        prisma.rentalAdjustment.create({ data: { rentalId: rental.id, previousAmount: rental.monthlyRent, percentage, indexLabel: cleanText(body?.indexLabel, 80) || rental.adjustmentIndex, newAmount, effectiveDate } }),
        prisma.propertyRental.update({ where: { id: rental.id }, data: { monthlyRent: newAmount, nextAdjustmentDate } }),
        prisma.agendaEvent.create({ data: { brokerId: auth.broker!.id, propertyId: rental.propertyId, leadId: rental.tenantLeadId, title: `Reajuste da locação - ${rental.property.title}`, type: "rental_adjustment", date: nextAdjustmentDate } }),
      ])
    } else if (action === "issue") {
      const type = cleanText(body?.type, 50).toUpperCase()
      const title = cleanText(body?.title, 160)
      const priority = cleanText(body?.priority, 20).toUpperCase()
      const eventDate = parseDate(body?.eventDate)
      if (!title || !eventDate || !["MAINTENANCE", "INSPECTION", "DOCUMENTATION", "TENANT_REQUEST", "OTHER"].includes(type) || !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) return NextResponse.json({ error: "Preencha tipo, título, prioridade e data da pendência." }, { status: 400 })
      await prisma.$transaction([
        prisma.rentalIssue.create({ data: { rentalId: rental.id, type, title, description: cleanText(body?.description, 2000) || null, priority, eventDate, attachmentsData: body?.attachmentsData ?? undefined } }),
        prisma.agendaEvent.create({ data: { brokerId: auth.broker!.id, propertyId: rental.propertyId, leadId: rental.tenantLeadId, title, type: "rental_issue", date: eventDate, notes: cleanText(body?.description, 2000) || null } }),
      ])
    } else if (action === "end") {
      if (rental.status !== "ACTIVE") return NextResponse.json({ error: "Esta locação já foi encerrada." }, { status: 400 })
      const endedAt = parseDate(body?.endedAt) ?? new Date()
      const makeAvailable = body?.makeAvailable !== false
      await prisma.$transaction([
        prisma.propertyRental.update({ where: { id: rental.id }, data: { status: "ENDED", endedAt, endDate: rental.endDate ?? endedAt } }),
        prisma.property.update({ where: { id: rental.propertyId }, data: { rentalAvailable: makeAvailable } }),
      ])
    } else {
      return NextResponse.json({ error: "Ação de locação inválida." }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[api][properties][rentals][id] update failed", { message: error instanceof Error ? error.message : "unknown" })
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Já existe um pagamento para esta competência." }, { status: 409 })
    return NextResponse.json({ error: "Não foi possível atualizar a locação." }, { status: isPrismaUnavailable(error) ? 503 : 500 })
  }
}
