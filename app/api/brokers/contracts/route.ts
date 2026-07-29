import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  buildContractHtml,
  contractHtmlToText,
  contractTypeOptions,
  createContractContent,
  normalizeContractStatus,
  normalizeContractType,
  parseContractAmount,
  parseContractContent,
  stringifyContractContent,
  type ContractContent,
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

function toIsoDate(value: unknown) {
  const text = cleanText(value, 40)
  if (!text) return null
  return text
}

function buildContractTitle(kind: string, leadName?: string | null, propertyTitle?: string | null) {
  return cleanText(
    `Contrato ${kind}${leadName ? ` - ${leadName}` : propertyTitle ? ` - ${propertyTitle}` : ""}`,
    160,
  )
}

function getStatusWhere(status: string) {
  const normalized = normalizeContractStatus(status)
  if (!normalized) return null
  if (normalized === "awaiting_signature") return { in: ["awaiting_signature", "generated"] }
  if (normalized === "completed") return { in: ["completed", "archived"] }
  return normalized
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
  const status = normalizeContractStatus(document.status) ?? "draft"

  return {
    id: document.id,
    type: "contract",
    title: document.title,
    status,
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
    textPreview: contractHtmlToText(content.html).slice(0, 320),
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

async function buildPersistedContract(input: {
  brokerId: string
  userName: string
  userEmail?: string | null
  leadId: string
  propertyId: string
  kind: string
  title?: string
  amount?: unknown
  commissionPercent?: unknown
  startDate?: unknown
  endDate?: unknown
  dueDate?: unknown
  validity?: unknown
  paymentMethod?: unknown
  guaranteeType?: unknown
  inspectionReport?: unknown
  additionalConditions?: unknown
  clausesText?: unknown
  reviewNotesText?: unknown
  status?: unknown
  previous?: ContractContent | null
}) {
  const contractType = normalizeContractType(input.kind)
  if (!contractType) {
    throw new Error("Selecione um tipo de contrato valido.")
  }

  const [lead, property] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: input.leadId, brokerId: input.brokerId },
      select: { id: true, name: true, phone: true, email: true },
    }),
    prisma.property.findFirst({
      where: { id: input.propertyId, brokerId: input.brokerId },
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

  if (!lead) throw new Error("Selecione um cliente valido.")
  if (!property) throw new Error("Selecione um imovel valido.")

  const amountCents = parseContractAmount(input.amount)
  const nextStatus = normalizeContractStatus(input.status) ?? "draft"
  const nextContent = createContractContent({
    kind: contractType,
    title:
      cleanText(input.title, 160) ||
      input.previous?.title ||
      buildContractTitle(contractType, lead.name, property.title),
    status: nextStatus,
    version: input.previous ? input.previous.version + 1 : 1,
    authorName: input.userName,
    authorEmail: input.userEmail,
    createdAt: input.previous?.createdAt,
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
      amountCents: amountCents ?? input.previous?.financial.amountCents ?? property.price ?? null,
      commissionPercent:
        cleanText(input.commissionPercent, 20) || input.previous?.financial.commissionPercent || null,
      startDate: toIsoDate(input.startDate) ?? input.previous?.financial.startDate ?? null,
      endDate: toIsoDate(input.endDate) ?? input.previous?.financial.endDate ?? null,
      dueDate: toIsoDate(input.dueDate) ?? input.previous?.financial.dueDate ?? null,
      validity: cleanText(input.validity, 80) || input.previous?.financial.validity || null,
      paymentMethod:
        cleanText(input.paymentMethod, 120) || input.previous?.financial.paymentMethod || null,
      guaranteeType:
        cleanText(input.guaranteeType, 120) || input.previous?.financial.guaranteeType || null,
      inspectionReport:
        cleanText(input.inspectionReport, 400) || input.previous?.financial.inspectionReport || null,
      additionalConditions:
        cleanText(input.additionalConditions, 2000) ||
        input.previous?.financial.additionalConditions ||
        null,
    },
  })

  const clauses = splitLines(input.clausesText)
  const reviewNotes = splitLines(input.reviewNotesText)
  if (clauses.length > 0) nextContent.clauses = clauses
  if (reviewNotes.length > 0) nextContent.reviewNotes = reviewNotes
  nextContent.html = buildContractHtml(nextContent)

  return {
    lead,
    property,
    content: nextContent,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const q = cleanText(request.nextUrl.searchParams.get("q"), 120)
    const kind = cleanText(request.nextUrl.searchParams.get("kind"), 80)
    const status = cleanText(request.nextUrl.searchParams.get("status"), 40)
    const statusWhere = status && status !== "all" ? getStatusWhere(status) : null

    const documents = await prisma.brokerDocument.findMany({
      where: {
        brokerId: auth.broker!.id,
        type: "contract",
        ...(statusWhere ? { status: statusWhere } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    })

    const contracts = documents
      .map(serializeContract)
      .filter((item) => (kind && kind !== "all" ? item.kind === kind : true))

    return NextResponse.json({
      contracts,
      contractTypes: contractTypeOptions,
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel carregar contratos." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json().catch(() => null)
    const leadId = cleanText(body?.leadId, 80)
    const propertyId = cleanText(body?.propertyId, 80)
    const kind = cleanText(body?.kind, 80)

    if (!leadId) return NextResponse.json({ error: "Selecione o cliente." }, { status: 400 })
    if (!propertyId) return NextResponse.json({ error: "Selecione o imovel." }, { status: 400 })

    const draft = await buildPersistedContract({
      brokerId: auth.broker!.id,
      userName: auth.name,
      userEmail: auth.email,
      leadId,
      propertyId,
      kind,
      title: body?.title,
      amount: body?.amount,
      commissionPercent: body?.commissionPercent,
      startDate: body?.startDate,
      endDate: body?.endDate,
      dueDate: body?.dueDate,
      validity: body?.validity,
      paymentMethod: body?.paymentMethod,
      guaranteeType: body?.guaranteeType,
      inspectionReport: body?.inspectionReport,
      additionalConditions: body?.additionalConditions,
      clausesText: body?.clausesText,
      reviewNotesText: body?.reviewNotesText,
      status: body?.status,
      previous: null,
    })

    const document = await prisma.brokerDocument.create({
      data: {
        brokerId: auth.broker!.id,
        leadId: draft.lead.id,
        propertyId: draft.property.id,
        type: "contract",
        title: draft.content.title,
        content: stringifyContractContent(draft.content),
        status: draft.content.status,
      },
    })

    return NextResponse.json({ contract: serializeContract({ ...document, leadId: draft.lead.id, propertyId: draft.property.id }) }, { status: 201 })
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : ""
    if (message) return NextResponse.json({ error: message }, { status: 400 })
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel criar o contrato." }, { status: 500 })
  }
}
