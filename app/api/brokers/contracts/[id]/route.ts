import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  buildContractHtml,
  createContractContent,
  normalizeContractType,
  parseContractAmount,
  parseContractContent,
  stringifyContractContent,
} from "@/lib/contract-template"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function splitLines(value: unknown) {
  return cleanText(value, 6000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function serializeContract(document: {
  id: string
  title: string
  status: string
  createdAt: Date
  updatedAt: Date
  content: string
  leadId: string | null
  propertyId: string | null
}) {
  const content = parseContractContent(document.content)

  return {
    id: document.id,
    type: "contract",
    title: document.title,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    leadId: document.leadId,
    propertyId: document.propertyId,
    kind: content.kind,
    version: content.version,
    authorName: content.authorName,
    leadName: content.lead?.name ?? "",
    propertyTitle: content.property?.title ?? "",
    amountLabel: content.financial.amountLabel ?? "",
    content,
  }
}

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor nao encontrado." }, { status: 404 })
  return user
}

async function getContractOr404(id: string, brokerId: string) {
  const contract = await prisma.brokerDocument.findFirst({
    where: { id, brokerId, type: "contract" },
  })

  if (!contract) {
    return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 })
  }

  return contract
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await context.params
    const found = await getContractOr404(id, auth.broker!.id)
    if (found instanceof NextResponse) return found
    return NextResponse.json({ contract: serializeContract(found) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel carregar o contrato." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const found = await getContractOr404(id, auth.broker!.id)
    if (found instanceof NextResponse) return found

    if (body?.action === "duplicate") {
      const parsed = parseContractContent(found.content)
      const duplicate = await prisma.brokerDocument.create({
        data: {
          brokerId: auth.broker!.id,
          leadId: found.leadId,
          propertyId: found.propertyId,
          type: "contract",
          title: cleanText(`${found.title} - copia`, 160),
          status: "draft",
          content: stringifyContractContent({
            ...parsed,
            version: 1,
            title: cleanText(`${parsed.title} - copia`, 160),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
      })

      return NextResponse.json({ contract: serializeContract(duplicate) })
    }

    const parsed = parseContractContent(found.content)
    const nextLeadId = cleanText(body?.leadId, 80) || found.leadId || ""
    const nextPropertyId = cleanText(body?.propertyId, 80) || found.propertyId || ""
    const nextKind = cleanText(body?.kind, 80) || parsed.kind

    const [lead, property] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: nextLeadId, brokerId: auth.broker!.id },
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.property.findFirst({
        where: { id: nextPropertyId, brokerId: auth.broker!.id },
        select: {
          id: true,
          publicCode: true,
          title: true,
          city: true,
          neighborhood: true,
          type: true,
          purpose: true,
          price: true,
          bedrooms: true,
          parkingSpots: true,
        },
      }),
    ])

    if (!lead) return NextResponse.json({ error: "Selecione um cliente valido." }, { status: 400 })
    if (!property) return NextResponse.json({ error: "Selecione um imovel valido." }, { status: 400 })

    const contractType = normalizeContractType(nextKind)
    if (!contractType) return NextResponse.json({ error: "Selecione um tipo de contrato valido." }, { status: 400 })

    const nextContent = createContractContent({
      kind: contractType,
      title: cleanText(body?.title, 160) || parsed.title,
      status: "draft",
      version: parsed.version + 1,
      authorName: auth.name,
      authorEmail: auth.email,
      createdAt: parsed.createdAt,
      updatedAt: new Date().toISOString(),
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
      },
      property: {
        id: property.id,
        publicCode: property.publicCode,
        title: property.title,
        city: property.city,
        neighborhood: property.neighborhood,
        type: property.type,
        purpose: property.purpose,
        price: property.price,
        bedrooms: property.bedrooms,
        parkingSpots: property.parkingSpots,
      },
      financial: {
        amountCents: parseContractAmount(body?.amount) ?? parsed.financial.amountCents ?? property.price ?? null,
        commissionPercent: cleanText(body?.commissionPercent, 20) || parsed.financial.commissionPercent || null,
        startDate: cleanText(body?.startDate, 40) || parsed.financial.startDate || null,
        endDate: cleanText(body?.endDate, 40) || parsed.financial.endDate || null,
        dueDate: cleanText(body?.dueDate, 40) || parsed.financial.dueDate || null,
        validity: cleanText(body?.validity, 80) || parsed.financial.validity || null,
        additionalConditions:
          cleanText(body?.additionalConditions, 2000) || parsed.financial.additionalConditions || null,
      },
    })

    const clauses = splitLines(body?.clausesText)
    const reviewNotes = splitLines(body?.reviewNotesText)
    if (clauses.length > 0) nextContent.clauses = clauses
    if (reviewNotes.length > 0) nextContent.reviewNotes = reviewNotes
    nextContent.html = buildContractHtml(nextContent)

    const updated = await prisma.brokerDocument.update({
      where: { id: found.id },
      data: {
        leadId: lead.id,
        propertyId: property.id,
        title: nextContent.title,
        status: cleanText(body?.status, 40) || "draft",
        content: stringifyContractContent(nextContent),
      },
    })

    return NextResponse.json({ contract: serializeContract(updated) })
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : ""
    if (message) return NextResponse.json({ error: message }, { status: 400 })
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel atualizar o contrato." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await context.params
    const found = await getContractOr404(id, auth.broker!.id)
    if (found instanceof NextResponse) return found

    await prisma.brokerDocument.delete({ where: { id: found.id } })
    return NextResponse.json({ success: true })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel excluir o contrato." }, { status: 500 })
  }
}
