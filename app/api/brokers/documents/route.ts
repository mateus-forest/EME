import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { buildProposalHtml } from "@/lib/proposal-template"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

const documentStatuses = ["draft", "generated", "signed", "archived"] as const

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function serializeDocument(document: {
  id: string
  type: string
  title: string
  content: string
  status: string
  leadId: string | null
  propertyId: string | null
  createdAt: Date
  updatedAt: Date
  lead?: { name: string | null; phone: string | null } | null
  property?: { id: string; title: string; city: string; neighborhood: string | null; price: number; purpose: string | null; type: string; bedrooms: number; parkingSpots: number } | null
}) {
  return {
    id: document.id,
    type: document.type,
    title: document.title,
    content: document.content,
    status: document.status,
    leadId: document.leadId,
    propertyId: document.propertyId,
    leadName: document.lead?.name ?? document.lead?.phone ?? "",
    propertyTitle: document.property?.title ?? "",
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const status = request.nextUrl.searchParams.get("status")
    const documents = await prisma.brokerDocument.findMany({
      where: {
        brokerId: user.broker.id,
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { id: true, title: true, city: true, neighborhood: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true } },
      },
    })

    return NextResponse.json({ documents: documents.map(serializeDocument) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de documentos indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível carregar documentos." }, { status: 500 })
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
    const leadId = cleanText(body?.leadId, 80)
    const propertyId = cleanText(body?.propertyId, 80)
    const [lead, property] = await Promise.all([
      leadId ? prisma.lead.findFirst({ where: { id: leadId, brokerId: user.broker.id }, select: { id: true, name: true, phone: true } }) : null,
      propertyId ? prisma.property.findFirst({ where: { id: propertyId, brokerId: user.broker.id }, select: { id: true, title: true, city: true, neighborhood: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true } }) : null,
    ])
    const title = cleanText(body?.title, 160) || `Proposta ${lead?.name ?? property?.title ?? "EME"}`
    const content = buildProposalHtml({
      lead,
      property,
      broker: { name: user.name, phone: user.broker.phone, creci: user.broker.creci },
      conditions: cleanText(body?.conditions, 500),
    })

    const document = await prisma.brokerDocument.create({
      data: {
        brokerId: user.broker.id,
        leadId: lead?.id ?? null,
        propertyId: property?.id ?? null,
        type: "proposal",
        title,
        content,
        status: "generated",
      },
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { id: true, title: true, city: true, neighborhood: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true } },
      },
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: "Proposta gerada",
        message: title,
        read: false,
      },
    })

    return NextResponse.json({ document: serializeDocument(document) }, { status: 201 })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de documentos indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível gerar a proposta." }, { status: 500 })
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
    const status = documentStatuses.includes(body?.status) ? body.status : "signed"
    if (!id) return NextResponse.json({ error: "Informe o documento." }, { status: 400 })

    await prisma.brokerDocument.updateMany({
      where: { id, brokerId: user.broker.id },
      data: { status },
    })
    const document = await prisma.brokerDocument.findFirst({
      where: { id, brokerId: user.broker.id },
      include: {
        lead: { select: { name: true, phone: true } },
        property: { select: { id: true, title: true, city: true, neighborhood: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true } },
      },
    })
    if (!document) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })

    return NextResponse.json({ document: serializeDocument(document) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de documentos indisponível no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível atualizar o documento." }, { status: 500 })
  }
}
