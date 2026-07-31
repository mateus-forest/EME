import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { saveBrokerContractFile } from "@/lib/broker-document-storage"
import {
  buildExternalContractAttachmentHtml,
  buildContractHtml,
  contractHtmlToText,
  contractTypeOptions,
  createContractContent,
  isExternalContractContent,
  normalizeContractStatus,
  normalizeContractType,
  parseContractAmount,
  parseContractContent,
  stringifyContractContent,
  type ContractAttachment,
  type ContractContent,
} from "@/lib/contract-template"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { normalizeEntityDocumentForStorage } from "@/lib/entity-document"
import { parseEntityDocuments } from "@/lib/legal-entities"
import { buildLinkedContractDocument, upsertLinkedContractDocument } from "@/lib/linked-contract-document"

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
  const amountLabel = isExternalContractContent(content)
    ? content.attachment?.fileName ?? content.financial.amountLabel ?? ""
    : content.financial.amountLabel ?? ""
  const textPreview = contractHtmlToText(content.html).slice(0, 320)

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
    amountLabel,
    textPreview,
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
  commercialPurpose?: unknown
  adjustmentTerm?: unknown
  worksScope?: unknown
  fitOutScope?: unknown
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
      commercialPurpose:
        cleanText(input.commercialPurpose, 160) || input.previous?.financial.commercialPurpose || null,
      adjustmentTerm:
        cleanText(input.adjustmentTerm, 160) || input.previous?.financial.adjustmentTerm || null,
      worksScope:
        cleanText(input.worksScope, 1200) || input.previous?.financial.worksScope || null,
      fitOutScope:
        cleanText(input.fitOutScope, 1200) || input.previous?.financial.fitOutScope || null,
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

async function loadLeadAndProperty(input: { brokerId: string; leadId: string; propertyId?: string | null }) {
  const [lead, property] = await Promise.all([
    prisma.lead.findFirst({
      where: { id: input.leadId, brokerId: input.brokerId },
      select: { id: true, name: true, phone: true, email: true },
    }),
    input.propertyId
      ? prisma.property.findFirst({
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
        })
      : Promise.resolve(null),
  ])

  if (!lead) throw new Error("Selecione um cliente valido.")
  if (input.propertyId && !property) throw new Error("Selecione um imovel valido.")

  return { lead, property }
}

async function syncLeadLinkedContractDocument(input: {
  leadId: string
  contractId: string
  title: string
  kind: string
  attachment: ContractAttachment
  updatedAt: string
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { documentsData: true },
  })

  if (!lead) return

  const documents = parseEntityDocuments(lead.documentsData)
  const linkedDocument = normalizeEntityDocumentForStorage(
    buildLinkedContractDocument({
      contractId: input.contractId,
      title: input.title,
      kind: input.kind as typeof contractTypeOptions[number],
      attachment: input.attachment,
      updatedAt: input.updatedAt,
    }),
    cleanText,
  )

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      documentsData: upsertLinkedContractDocument(documents, linkedDocument),
    },
  })
}

function createExternalContractContent(input: {
  kind: string
  title: string
  status?: string
  userName: string
  userEmail?: string | null
  lead: Awaited<ReturnType<typeof loadLeadAndProperty>>["lead"]
  property: Awaited<ReturnType<typeof loadLeadAndProperty>>["property"]
  attachment: ContractAttachment
  notes?: string
}) {
  const contractType = normalizeContractType(input.kind)
  if (!contractType) {
    throw new Error("Selecione um tipo de contrato valido.")
  }
  const status = normalizeContractStatus(input.status) ?? "draft"

  const content = createContractContent({
    kind: contractType,
    title: input.title,
    status,
    authorName: input.userName,
    authorEmail: input.userEmail,
    lead: {
      id: input.lead.id,
      name: input.lead.name,
      phone: input.lead.phone,
      email: input.lead.email,
    },
    property: input.property
      ? {
          id: input.property.id,
          publicCode: input.property.publicCode,
          title: input.property.title,
          city: input.property.city,
          neighborhood: input.property.neighborhood,
          type: input.property.type,
          purpose: input.property.purpose,
          price: input.property.price,
          bedrooms: input.property.bedrooms,
          parkingSpots: input.property.parkingSpots,
        }
      : null,
    financial: {
      additionalConditions: input.notes || null,
    },
  })

  content.source = "external"
  content.attachment = input.attachment
  content.reviewNotes = [
    `Documento externo anexado: ${input.attachment.fileName}.`,
    input.property?.title ? `Imovel vinculado: ${input.property.title}.` : "Sem imovel vinculado.",
    input.notes ? `Observacoes: ${input.notes}` : "Sem observacoes complementares.",
  ]
  content.html = buildExternalContractAttachmentHtml(content)
  return content
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
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const leadId = cleanText(formData.get("leadId"), 80)
      const propertyId = cleanText(formData.get("propertyId"), 80)
      const kind = cleanText(formData.get("kind"), 80)
      const titleInput = cleanText(formData.get("title"), 160)
      const notes = cleanText(formData.get("notes"), 2000)
      const status = cleanText(formData.get("status"), 40)
      const fileEntry = formData.get("file")

      if (!leadId) return NextResponse.json({ error: "Selecione o cliente." }, { status: 400 })
      if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
        return NextResponse.json({ error: "Selecione um arquivo PDF, DOC ou DOCX." }, { status: 400 })
      }

      const allowedTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ])
      if (!allowedTypes.has(fileEntry.type)) {
        return NextResponse.json({ error: "Envie um arquivo em PDF, DOC ou DOCX." }, { status: 400 })
      }

      const { lead, property } = await loadLeadAndProperty({
        brokerId: auth.broker!.id,
        leadId,
        propertyId: propertyId || null,
      })
      const uploaded = await saveBrokerContractFile({ brokerId: auth.broker!.id, file: fileEntry })
      const nextTitle =
        titleInput ||
        cleanText(fileEntry.name.replace(/\.[^.]+$/, ""), 160) ||
        buildContractTitle(kind, lead.name, property?.title ?? null)
      const content = createExternalContractContent({
        kind,
        title: nextTitle,
        status,
        userName: auth.name,
        userEmail: auth.email,
        lead,
        property,
        attachment: {
          ...uploaded,
          notes: notes || null,
        },
        notes,
      })

      const document = await prisma.brokerDocument.create({
        data: {
          brokerId: auth.broker!.id,
          leadId: lead.id,
          propertyId: property?.id ?? null,
          type: "contract",
          title: content.title,
          content: stringifyContractContent(content),
          status: content.status,
        },
      })

      await syncLeadLinkedContractDocument({
        leadId: lead.id,
        contractId: document.id,
        title: content.title,
        kind: content.kind,
        attachment: content.attachment!,
        updatedAt: document.updatedAt.toISOString(),
      })

      return NextResponse.json(
        {
          contract: serializeContract({
            ...document,
            leadId: lead.id,
            propertyId: property?.id ?? null,
          }),
        },
        { status: 201 },
      )
    }

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
      commercialPurpose: body?.commercialPurpose,
      adjustmentTerm: body?.adjustmentTerm,
      worksScope: body?.worksScope,
      fitOutScope: body?.fitOutScope,
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
