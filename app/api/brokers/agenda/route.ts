import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

const agendaTypes = ["visit", "reminder", "event", "task"] as const
const agendaStatuses = ["pending", "done", "cancelled"] as const

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeDate(value: unknown) {
  const text = cleanText(value, 20)
  const date = text ? new Date(`${text}T00:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) return new Date()
  return date
}

function serializeAgendaEvent(event: {
  id: string
  title: string
  type: string
  date: Date
  time: string | null
  notes: string | null
  status: string
  leadId: string | null
  propertyId: string | null
  createdAt: Date
  updatedAt: Date
  lead?: { name: string | null; phone: string | null } | null
  property?: { title: string } | null
}) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    date: event.date.toISOString().slice(0, 10),
    time: event.time ?? "",
    notes: event.notes ?? "",
    status: event.status,
    leadId: event.leadId,
    propertyId: event.propertyId,
    leadName: event.lead?.name ?? event.lead?.phone ?? "",
    propertyTitle: event.property?.title ?? "",
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const filter = request.nextUrl.searchParams.get("filter") ?? "week"
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    if (filter === "today") end.setDate(start.getDate() + 1)
    else if (filter === "tomorrow") {
      start.setDate(start.getDate() + 1)
      end.setDate(start.getDate() + 1)
    } else end.setDate(start.getDate() + 7)

    const events = await prisma.agendaEvent.findMany({
      where: {
        brokerId: user.broker.id,
        date: { gte: start, lt: end },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "desc" }],
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { title: true } },
      },
    })

    return NextResponse.json({ events: events.map(serializeAgendaEvent) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de agenda indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível carregar a agenda." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const body = await request.json().catch(() => null)
    const title = cleanText(body?.title, 160) || "Compromisso"
    const type = agendaTypes.includes(body?.type) ? body.type : "task"
    const status = agendaStatuses.includes(body?.status) ? body.status : "pending"
    const event = await prisma.agendaEvent.create({
      data: {
        brokerId: user.broker.id,
        title,
        type,
        date: normalizeDate(body?.date),
        time: cleanText(body?.time, 20) || null,
        notes: cleanText(body?.notes, 600) || null,
        status,
        leadId: cleanText(body?.leadId, 80) || null,
        propertyId: cleanText(body?.propertyId, 80) || null,
      },
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { title: true } },
      },
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "Compromisso criado",
        message: title,
        read: false,
      },
    })

    return NextResponse.json({ event: serializeAgendaEvent(event) }, { status: 201 })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de agenda indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível salvar o compromisso." }, { status: 500 })
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
    const id = cleanText(body?.id, 80)
    const status = agendaStatuses.includes(body?.status) ? body.status : "done"
    if (!id) return NextResponse.json({ error: "Informe o compromisso." }, { status: 400 })

    await prisma.agendaEvent.updateMany({
      where: { id, brokerId: user.broker.id },
      data: { status },
    })
    const event = await prisma.agendaEvent.findFirst({
      where: { id, brokerId: user.broker.id },
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { title: true } },
      },
    })
    if (!event) return NextResponse.json({ error: "Compromisso não encontrado." }, { status: 404 })

    return NextResponse.json({ event: serializeAgendaEvent(event) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de agenda indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível atualizar o compromisso." }, { status: 500 })
  }
}
