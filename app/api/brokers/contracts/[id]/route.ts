import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { deleteBrokerContractFile, saveBrokerContractFile } from "@/lib/broker-document-storage"
import {
  buildExternalContractAttachmentHtml,
  buildContractHtml,
  isExternalContractContent,
  contractHtmlToText,
  createContractContent,
  normalizeContractStatus,
  normalizeContractType,
  parseContractAmount,
  parseContractContent,
  stringifyContractContent,
} from "@/lib/contract-template"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { normalizeEntityDocumentForStorage } from "@/lib/entity-document"
import { parseEntityDocuments } from "@/lib/legal-entities"
import {
  buildLinkedContractDocument,
  removeLinkedContractDocument,
  upsertLinkedContractDocument,
} from "@/lib/linked-contract-document"

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
  const status = normalizeContractStatus(document.status) ?? "draft"
  const amountLabel = isExternalContractContent(content)
    ? content.attachment?.fileName ?? content.financial.amountLabel ?? ""
    : content.financial.amountLabel ?? ""

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

async function getContractOr404(id: string, brokerId: string) {
  const contract = await prisma.brokerDocument.findFirst({
    where: { id, brokerId, type: "contract" },
  })

  if (!contract) {
    return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 })
  }

  return contract
}

async function syncLeadLinkedContractDocument(input: {
  leadId: string
  contractId: string
  title: string
  kind: string
  attachment: NonNullable<ReturnType<typeof parseContractContent>["attachment"]>
  updatedAt: string
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { documentsData: true },
  })

  if (!lead) return

  const linkedDocument = normalizeEntityDocumentForStorage(
    buildLinkedContractDocument({
      contractId: input.contractId,
      title: input.title,
      kind: input.kind as ReturnType<typeof parseContractContent>["kind"],
      attachment: input.attachment,
      updatedAt: input.updatedAt,
    }),
    cleanText,
  )

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      documentsData: upsertLinkedContractDocument(parseEntityDocuments(lead.documentsData), linkedDocument),
    },
  })
}

async function removeLeadLinkedContractDocument(input: { leadId: string | null; contractId: string }) {
  if (!input.leadId) return

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { documentsData: true },
  })

  if (!lead) return

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      documentsData: removeLinkedContractDocument(parseEntityDocuments(lead.documentsData), input.contractId),
    },
  })
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
    const found = await getContractOr404(id, auth.broker!.id)
    if (found instanceof NextResponse) return found
    const contentType = request.headers.get("content-type") || ""
    const parsed = parseContractContent(found.content)

    if (contentType.includes("multipart/form-data")) {
      if (!isExternalContractContent(parsed)) {
        return NextResponse.json({ error: "Somente contratos anexados aceitam atualizacao por upload." }, { status: 400 })
      }

      const formData = await request.formData()
      const leadId = cleanText(formData.get("leadId"), 80)
      const propertyId = cleanText(formData.get("propertyId"), 80)
      const kind = cleanText(formData.get("kind"), 80) || parsed.kind
      const title = cleanText(formData.get("title"), 160) || found.title
      const notes = cleanText(formData.get("notes"), 2000)
      const status = normalizeContractStatus(formData.get("status")) ?? normalizeContractStatus(found.status) ?? "draft"
      const fileEntry = formData.get("file")

      if (!leadId) return NextResponse.json({ error: "Selecione o cliente." }, { status: 400 })

      const [lead, property] = await Promise.all([
        prisma.lead.findFirst({
          where: { id: leadId, brokerId: auth.broker!.id },
          select: { id: true, name: true, phone: true, email: true },
        }),
        propertyId
          ? prisma.property.findFirst({
              where: { id: propertyId, brokerId: auth.broker!.id },
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

      if (!lead) return NextResponse.json({ error: "Selecione um cliente valido." }, { status: 400 })
      if (propertyId && !property) return NextResponse.json({ error: "Selecione um imovel valido." }, { status: 400 })

      const nextAttachment = { ...(parsed.attachment ?? {}) }
      if (fileEntry instanceof File && fileEntry.size > 0) {
        const allowedTypes = new Set([
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ])
        if (!allowedTypes.has(fileEntry.type)) {
          return NextResponse.json({ error: "Envie um arquivo em PDF, DOC ou DOCX." }, { status: 400 })
        }

        const uploaded = await saveBrokerContractFile({ brokerId: auth.broker!.id, file: fileEntry })
        if (parsed.attachment?.fileUrl) {
          await deleteBrokerContractFile(parsed.attachment.fileUrl)
        }
        nextAttachment.fileName = uploaded.fileName
        nextAttachment.fileUrl = uploaded.fileUrl
        nextAttachment.mimeType = uploaded.mimeType
        nextAttachment.fileSize = uploaded.fileSize
      }

      nextAttachment.notes = notes || null

      const contractType = normalizeContractType(kind)
      if (!contractType) return NextResponse.json({ error: "Selecione um tipo de contrato valido." }, { status: 400 })

      const nextContent = createContractContent({
        kind: contractType,
        title,
        status,
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
        property: property
          ? {
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
            }
          : null,
        financial: {
          additionalConditions: notes || null,
        },
      })

      nextContent.source = "external"
      nextContent.attachment = {
        fileName: String(nextAttachment.fileName || parsed.attachment?.fileName || "documento"),
        fileUrl: String(nextAttachment.fileUrl || parsed.attachment?.fileUrl || ""),
        mimeType: String(nextAttachment.mimeType || parsed.attachment?.mimeType || "application/octet-stream"),
        fileSize:
          typeof nextAttachment.fileSize === "number"
            ? nextAttachment.fileSize
            : typeof parsed.attachment?.fileSize === "number"
              ? parsed.attachment.fileSize
              : null,
        notes: notes || null,
      }
      nextContent.reviewNotes = [
        `Documento externo anexado: ${nextContent.attachment.fileName}.`,
        property?.title ? `Imovel vinculado: ${property.title}.` : "Sem imovel vinculado.",
        notes ? `Observacoes: ${notes}` : "Sem observacoes complementares.",
      ]
      nextContent.html = buildExternalContractAttachmentHtml(nextContent)

      const updated = await prisma.brokerDocument.update({
        where: { id: found.id },
        data: {
          leadId: lead.id,
          propertyId: property?.id ?? null,
          title: nextContent.title,
          status,
          content: stringifyContractContent(nextContent),
        },
      })

      await removeLeadLinkedContractDocument({ leadId: found.leadId, contractId: found.id })
      await syncLeadLinkedContractDocument({
        leadId: lead.id,
        contractId: updated.id,
        title: nextContent.title,
        kind: nextContent.kind,
        attachment: nextContent.attachment!,
        updatedAt: updated.updatedAt.toISOString(),
      })

      return NextResponse.json({ contract: serializeContract(updated) })
    }

    const body = await request.json().catch(() => null)

    if (body?.action === "duplicate") {
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
            status: "draft",
            version: 1,
            title: cleanText(`${parsed.title} - copia`, 160),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        },
      })

      return NextResponse.json({ contract: serializeContract(duplicate) })
    }

    const nextStatus = normalizeContractStatus(body?.status) ?? normalizeContractStatus(found.status) ?? "draft"
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
      status: nextStatus,
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
        paymentMethod: cleanText(body?.paymentMethod, 120) || parsed.financial.paymentMethod || null,
        guaranteeType: cleanText(body?.guaranteeType, 120) || parsed.financial.guaranteeType || null,
        inspectionReport: cleanText(body?.inspectionReport, 400) || parsed.financial.inspectionReport || null,
        commercialPurpose: cleanText(body?.commercialPurpose, 160) || parsed.financial.commercialPurpose || null,
        adjustmentTerm: cleanText(body?.adjustmentTerm, 160) || parsed.financial.adjustmentTerm || null,
        worksScope: cleanText(body?.worksScope, 1200) || parsed.financial.worksScope || null,
        fitOutScope: cleanText(body?.fitOutScope, 1200) || parsed.financial.fitOutScope || null,
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
        status: nextStatus,
        content: stringifyContractContent(nextContent),
      },
    })

    if (isExternalContractContent(nextContent) && nextContent.attachment) {
      await removeLeadLinkedContractDocument({ leadId: found.leadId, contractId: found.id })
      await syncLeadLinkedContractDocument({
        leadId: lead.id,
        contractId: updated.id,
        title: nextContent.title,
        kind: nextContent.kind,
        attachment: nextContent.attachment,
        updatedAt: updated.updatedAt.toISOString(),
      })
    }

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
    const parsed = parseContractContent(found.content)

    await removeLeadLinkedContractDocument({ leadId: found.leadId, contractId: found.id })
    await prisma.brokerDocument.delete({ where: { id: found.id } })
    if (parsed.attachment?.fileUrl) {
      await deleteBrokerContractFile(parsed.attachment.fileUrl)
    }
    return NextResponse.json({ success: true })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de contratos indisponivel no momento." }, { status: 503 })
    }
    return NextResponse.json({ error: "Nao foi possivel excluir o contrato." }, { status: 500 })
  }
}
