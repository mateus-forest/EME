import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { parseCurrencyInputToCents } from "@/lib/currency"
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
  property?: { id: string; title: string; city: string; neighborhood: string | null; price: number; purpose: string | null; type: string; bedrooms: number; parkingSpots: number; area?: string | null } | null
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
    const manualLead = {
      name: cleanText(body?.clientName, 120),
      phone: cleanText(body?.clientPhone, 40),
      email: cleanText(body?.clientEmail, 120),
    }
    const manualProperty = {
      id: cleanText(body?.propertyCode, 80),
      title: cleanText(body?.propertyTitle, 160),
      neighborhood: cleanText(body?.propertyNeighborhood, 100),
      city: cleanText(body?.propertyCity, 100),
      type: cleanText(body?.propertyType, 80),
      purpose: cleanText(body?.propertyPurpose, 20).toLowerCase() === "locação" || cleanText(body?.propertyPurpose, 20).toLowerCase() === "locacao" ? "RENT" : "SALE",
      price: parseCurrencyInputToCents(body?.propertyPrice) ?? 0,
      area: cleanText(body?.propertyArea, 40),
      bedrooms: 0,
      parkingSpots: 0,
    }
    const [lead, property] = await Promise.all([
      leadId ? prisma.lead.findFirst({ where: { id: leadId, brokerId: user.broker.id }, select: { id: true, name: true, phone: true } }) : null,
      propertyId ? prisma.property.findFirst({ where: { id: propertyId, brokerId: user.broker.id }, select: { id: true, title: true, city: true, neighborhood: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true } }) : null,
    ])
    const proposalLead = lead ?? (manualLead.name || manualLead.phone || manualLead.email ? manualLead : null)
    const proposalProperty = property ?? (manualProperty.title || manualProperty.neighborhood || manualProperty.city || manualProperty.price ? manualProperty : null)
    const title = cleanText(body?.title, 160) || `Proposta ${proposalLead?.name ?? proposalProperty?.title ?? "EME"}`
    const content = buildProposalHtml({
      lead: proposalLead,
      property: proposalProperty,
      broker: { name: user.name, phone: user.broker.phone, creci: user.broker.creci },
      conditions: {
        entry: cleanText(body?.entry, 120),
        installments: cleanText(body?.installments, 200),
        notes: cleanText(body?.conditions ?? body?.notes, 700),
        validity: cleanText(body?.validity, 80),
      },
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
