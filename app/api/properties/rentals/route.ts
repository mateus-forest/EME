import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const rentalInclude = {
  property: { select: { id: true, title: true, purpose: true, rentalAvailable: true } },
  tenant: { select: { id: true, name: true, phone: true, email: true } },
  owner: { select: { id: true, name: true, phone: true, email: true } },
  contractDocument: { select: { id: true, title: true, status: true } },
  payments: { orderBy: { dueDate: "desc" as const } },
  adjustments: { orderBy: { effectiveDate: "desc" as const } },
  issues: { orderBy: { eventDate: "desc" as const } },
} as const

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
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

function serializeRental(rental: Awaited<ReturnType<typeof prisma.propertyRental.findFirstOrThrow>> & Record<string, unknown>) {
  const source = rental as typeof rental & {
    property: { id: string; title: string; purpose: string; rentalAvailable: boolean }
    tenant: { id: string; name: string | null; phone: string | null; email: string | null }
    owner: { id: string; name: string | null; phone: string | null; email: string | null } | null
    contractDocument: { id: string; title: string; status: string } | null
    payments: Array<{ id: string; competence: string; amount: number; dueDate: Date; paidAt: Date | null; status: string; receiptData: unknown; notes: string | null }>
    adjustments: Array<{ id: string; previousAmount: number; percentage: unknown; indexLabel: string | null; newAmount: number; effectiveDate: Date; createdAt: Date }>
    issues: Array<{ id: string; type: string; title: string; description: string | null; priority: string; status: string; eventDate: Date; attachmentsData: unknown }>
  }
  return {
    id: source.id,
    propertyId: source.propertyId,
    property: source.property,
    tenant: source.tenant,
    owner: source.owner,
    ownerName: source.ownerName,
    contract: source.contractDocument,
    monthlyRent: source.monthlyRent,
    dueDay: source.dueDay,
    startDate: source.startDate.toISOString(),
    endDate: source.endDate?.toISOString() ?? null,
    adjustmentIndex: source.adjustmentIndex,
    adjustmentOther: source.adjustmentOther,
    guaranteeType: source.guaranteeType,
    guaranteeOther: source.guaranteeOther,
    notes: source.notes,
    status: source.status,
    nextAdjustmentDate: source.nextAdjustmentDate?.toISOString() ?? null,
    endedAt: source.endedAt?.toISOString() ?? null,
    createdAt: source.createdAt.toISOString(),
    payments: source.payments.map((payment) => ({ ...payment, dueDate: payment.dueDate.toISOString(), paidAt: payment.paidAt?.toISOString() ?? null })),
    adjustments: source.adjustments.map((adjustment) => ({ ...adjustment, percentage: adjustment.percentage === null ? null : Number(adjustment.percentage), effectiveDate: adjustment.effectiveDate.toISOString(), createdAt: adjustment.createdAt.toISOString() })),
    issues: source.issues.map((issue) => ({ ...issue, eventDate: issue.eventDate.toISOString() })),
  }
}

export async function GET() {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth
  try {
    const [rentals, rentalProperties] = await Promise.all([
      prisma.propertyRental.findMany({ where: { brokerId: auth.broker!.id }, include: rentalInclude, orderBy: { createdAt: "desc" } }),
      prisma.property.findMany({ where: { brokerId: auth.broker!.id, purpose: "RENT" }, select: { id: true, rentalAvailable: true } }),
    ])
    return NextResponse.json({ rentals: rentals.map((rental) => serializeRental(rental as never)), propertyAvailability: rentalProperties })
  } catch (error) {
    console.error("[api][properties][rentals] list failed", { message: error instanceof Error ? error.message : "unknown" })
    const status = isPrismaUnavailable(error) ? 503 : 500
    return NextResponse.json({ error: status === 503 ? "O serviço de locações está indisponível no momento." : "Não foi possível carregar as locações." }, { status })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await request.json().catch(() => null)
    const propertyId = cleanText(body?.propertyId, 120)
    const tenantLeadId = cleanText(body?.tenantLeadId, 120)
    const ownerLeadId = cleanText(body?.ownerLeadId, 120) || null
    const ownerName = cleanText(body?.ownerName, 160)
    const contractDocumentId = cleanText(body?.contractDocumentId, 120)
    const monthlyRent = parseMoney(body?.monthlyRent)
    const dueDay = Number(body?.dueDay)
    const startDate = parseDate(body?.startDate)
    const endDate = parseDate(body?.endDate)
    const adjustmentIndex = cleanText(body?.adjustmentIndex, 40).toUpperCase()
    const adjustmentOther = cleanText(body?.adjustmentOther, 80)
    const guaranteeType = cleanText(body?.guaranteeType, 60).toUpperCase()
    const guaranteeOther = cleanText(body?.guaranteeOther, 120)
    const notes = cleanText(body?.notes, 2000)

    if (!propertyId || !tenantLeadId || !contractDocumentId || !monthlyRent || monthlyRent <= 0 || !startDate) {
      return NextResponse.json({ error: "Preencha imóvel, locatário, contrato, valor mensal e data de início." }, { status: 400 })
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return NextResponse.json({ error: "Informe um dia de vencimento entre 1 e 31." }, { status: 400 })
    if (!ownerName && !ownerLeadId) return NextResponse.json({ error: "Informe ou selecione o proprietário." }, { status: 400 })
    if (!['IPCA', 'IGP-M', 'OUTRO'].includes(adjustmentIndex)) return NextResponse.json({ error: "Selecione um índice de reajuste válido." }, { status: 400 })
    if (!['CAUÇÃO', 'FIADOR', 'SEGURO-FIANÇA', 'SEM GARANTIA', 'OUTRO'].includes(guaranteeType)) return NextResponse.json({ error: "Selecione uma garantia válida." }, { status: 400 })
    if (endDate && endDate < startDate) return NextResponse.json({ error: "A data de término não pode ser anterior ao início." }, { status: 400 })

    const [property, tenant, owner, contract, activeRental] = await Promise.all([
      prisma.property.findFirst({ where: { id: propertyId, brokerId: auth.broker!.id }, select: { id: true, purpose: true, rentalAvailable: true, ownerName: true, title: true } }),
      prisma.lead.findFirst({ where: { id: tenantLeadId, brokerId: auth.broker!.id }, select: { id: true } }),
      ownerLeadId ? prisma.lead.findFirst({ where: { id: ownerLeadId, brokerId: auth.broker!.id }, select: { id: true, name: true } }) : null,
      prisma.brokerDocument.findFirst({ where: { id: contractDocumentId, brokerId: auth.broker!.id, type: "contract" }, select: { id: true } }),
      prisma.propertyRental.findFirst({ where: { propertyId, status: "ACTIVE" }, select: { id: true } }),
    ])
    if (!property || property.purpose !== "RENT") return NextResponse.json({ error: "Este imóvel não está disponível para aluguel." }, { status: 400 })
    if (!property.rentalAvailable || activeRental) return NextResponse.json({ error: "Este imóvel já possui uma locação ativa ou não está disponível." }, { status: 409 })
    if (!tenant) return NextResponse.json({ error: "Locatário não encontrado." }, { status: 404 })
    if (ownerLeadId && !owner) return NextResponse.json({ error: "Proprietário não encontrado." }, { status: 404 })
    if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })

    const nextAdjustmentDate = new Date(startDate)
    nextAdjustmentDate.setUTCFullYear(nextAdjustmentDate.getUTCFullYear() + 1)
    const resolvedOwnerName = owner?.name || ownerName || property.ownerName || null

    const rentalId = await prisma.$transaction(async (tx) => {
      const rental = await tx.propertyRental.create({
        data: { brokerId: auth.broker!.id, propertyId, tenantLeadId, ownerLeadId, ownerName: resolvedOwnerName, contractDocumentId, monthlyRent, dueDay, startDate, endDate, adjustmentIndex, adjustmentOther: adjustmentIndex === "OUTRO" ? adjustmentOther || null : null, guaranteeType, guaranteeOther: guaranteeType === "OUTRO" ? guaranteeOther || null : null, notes: notes || null, nextAdjustmentDate },
      })
      await tx.property.update({ where: { id: propertyId }, data: { rentalAvailable: false, ...(resolvedOwnerName ? { ownerName: resolvedOwnerName } : {}) } })
      await tx.agendaEvent.create({ data: { brokerId: auth.broker!.id, propertyId, leadId: tenantLeadId, title: `Reajuste da locação - ${property.title}`, type: "rental_adjustment", date: nextAdjustmentDate, notes: `Revisar reajuste pelo índice ${adjustmentIndex}.` } })
      if (endDate) await tx.agendaEvent.create({ data: { brokerId: auth.broker!.id, propertyId, leadId: tenantLeadId, title: `Término da locação - ${property.title}`, type: "rental_end", date: endDate } })
      return rental.id
    })
    const rental = await prisma.propertyRental.findUniqueOrThrow({ where: { id: rentalId }, include: rentalInclude })
    return NextResponse.json({ rental: serializeRental(rental as never) }, { status: 201 })
  } catch (error) {
    console.error("[api][properties][rentals] create failed", { message: error instanceof Error ? error.message : "unknown" })
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Este imóvel já possui uma locação ativa." }, { status: 409 })
    return NextResponse.json({ error: "Não foi possível iniciar a locação." }, { status: isPrismaUnavailable(error) ? 503 : 500 })
  }
}
