import "server-only"

import { LeadStatus } from "@/lib/prisma-enums"

import { prisma } from "@/lib/prisma"
import { detectNamedClientReference } from "@/lib/cos/entity-extraction"
import { normalizeEntityDocumentForStorage } from "@/lib/entity-document"
import { parseEntityDocuments, type EntityDocumentRecord } from "@/lib/legal-entities"

import { cleanText, getAttachmentsFromPayload, getEntityIdFromPayload, getPayloadRecord, normalizeText, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import type { CosCapabilityHandler } from "@/lib/cos/types"

async function resolveLead(brokerId: string, payload: Record<string, unknown>, message?: string) {
  const leadId = getEntityIdFromPayload(payload, "lead")
  if (leadId) {
    return prisma.lead.findFirst({ where: { id: leadId, brokerId } })
  }

  const query = normalizeText(message ?? "").replace(/\b(cliente|lead|leads|atualizar|editar|timeline|historico|converter)\b/g, "").trim()
  if (query) {
    return prisma.lead.findFirst({
      where: {
        brokerId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { whatsapp: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    })
  }

  return prisma.lead.findFirst({ where: { brokerId }, orderBy: { updatedAt: "desc" } })
}

export const updateLeadCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const lead = await resolveLead(brokerId, payloadRecord, message)
  if (!lead) return requiredSelectionResponse("cliente", "leadId")

  const normalizedMessage = normalizeText(message)
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ""
  const phoneMatch = message.replace(/[^\d+]/g, "").match(/\d{10,13}/)?.[0] ?? ""
  const status =
    normalizedMessage.includes("ganho") || normalizedMessage.includes("convert")
      ? LeadStatus.WON
      : normalizedMessage.includes("perd")
        ? LeadStatus.LOST
        : normalizedMessage.includes("negoci")
          ? LeadStatus.NEGOTIATING
          : undefined

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      email: emailMatch || undefined,
      phone: phoneMatch || undefined,
      whatsapp: phoneMatch || undefined,
      status,
    },
  })

  return {
    response: `Cliente atualizado com sucesso.\n\n${updated.name ?? "Cliente sem nome"}${emailMatch ? `\nEmail: ${emailMatch}` : ""}${phoneMatch ? `\nTelefone: ${phoneMatch}` : ""}`,
    metadata: {
      leadId: updated.id,
      leadStatus: updated.status,
      email: updated.email,
      phone: updated.phone,
    },
    leadId: updated.id,
  }
}

export const deleteLeadCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const lead = await resolveLead(brokerId, payloadRecord, message)
  if (!lead) return requiredSelectionResponse("cliente", "leadId")

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.ARCHIVED },
  })

  return {
    response: `Cliente arquivado com sucesso.\n\n${updated.name ?? "Cliente sem nome"}`,
    metadata: {
      leadId: updated.id,
      leadStatus: updated.status,
    },
    leadId: updated.id,
  }
}

export const findLeadCapability: CosCapabilityHandler = async ({ brokerId, message }) => {
  const query = normalizeText(message).replace(/\b(buscar|encontrar|localizar|cliente|lead)\b/g, "").trim()
  const leads = await prisma.lead.findMany({
    where: query
      ? {
          brokerId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { whatsapp: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        }
      : { brokerId },
    orderBy: { updatedAt: "desc" },
    take: 5,
  })

  return {
    response: leads.length
      ? `Encontrei ${leads.length} cliente${leads.length === 1 ? "" : "s"}:\n\n${leads.map((lead) => `- ${lead.name ?? "Sem nome"} (${lead.status})`).join("\n")}`
      : "Não encontrei clientes com esse filtro.",
    metadata: {
      leadIds: leads.map((lead) => lead.id),
      resultCount: leads.length,
    },
    leadId: leads[0]?.id,
  }
}

export const leadTimelineCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const lead = await resolveLead(brokerId, payloadRecord, message)
  if (!lead) return requiredSelectionResponse("cliente", "leadId")

  const [messages, events, documents] = await Promise.all([
    prisma.emeMessage.findMany({
      where: { brokerId, leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true, message: true, direction: true },
    }),
    prisma.agendaEvent.findMany({
      where: { brokerId, leadId: lead.id },
      orderBy: { date: "desc" },
      take: 5,
      select: { title: true, date: true, status: true },
    }),
    prisma.brokerDocument.findMany({
      where: { brokerId, leadId: lead.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { title: true, type: true, status: true },
    }),
  ])

  return {
    response: [
      `Timeline de ${lead.name ?? "cliente"}:`,
      "",
      `Mensagens recentes: ${messages.length}`,
      `Compromissos: ${events.length}`,
      `Documentos: ${documents.length}`,
      "",
      ...messages.slice(0, 2).map((item) => `- ${item.direction === "outbound" ? "Saída" : "Entrada"}: ${cleanText(item.message, 80)}`),
    ].join("\n"),
    metadata: {
      leadId: lead.id,
      messagesCount: messages.length,
      agendaCount: events.length,
      documentsCount: documents.length,
    },
    leadId: lead.id,
  }
}

export const convertLeadCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const lead = await resolveLead(brokerId, payloadRecord, message)
  if (!lead) return requiredSelectionResponse("cliente", "leadId")

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.WON },
  })

  return {
    response: `Cliente marcado como convertido.\n\n${updated.name ?? "Cliente sem nome"}`,
    metadata: {
      leadId: updated.id,
      leadStatus: updated.status,
    },
    leadId: updated.id,
  }
}

function buildEntityDocumentRecord(attachment: { name: string; type: string; dataUrl: string }): EntityDocumentRecord {
  return {
    id: crypto.randomUUID(),
    label: "Documento anexado via Assessor",
    name: attachment.name || "documento.pdf",
    url: attachment.dataUrl,
    mimeType: attachment.type || "application/pdf",
    uploadedAt: new Date().toISOString(),
  }
}

export function isEntityDocumentRecordLike(value: unknown): value is EntityDocumentRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.name === "string" &&
    typeof record.url === "string" &&
    typeof record.mimeType === "string" &&
    typeof record.uploadedAt === "string"
  )
}

async function finalizeLeadDocumentAttachment(brokerId: string, leadId: string, record: EntityDocumentRecord) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, brokerId } })
  if (!lead) {
    return {
      response: "Não encontrei mais o cliente selecionado. Tente anexar o documento novamente.",
      metadata: { noCharge: true },
    }
  }

  try {
    const existingDocuments = parseEntityDocuments(lead.documentsData)
    const nextDocuments = [...existingDocuments, record].map((document) => normalizeEntityDocumentForStorage(document, cleanText))
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { documentsData: nextDocuments },
    })

    return {
      response: `Documento "${record.name}" anexado ao cliente ${updated.name ?? "selecionado"} ✅`,
      metadata: { leadId: updated.id, documentId: record.id, matchedByName: true },
      leadId: updated.id,
    }
  } catch (error) {
    console.error("[cos][lead][attach-document] failed", {
      message: error instanceof Error ? error.message : "unknown",
      leadId: lead.id,
    })
    return {
      response: "Não consegui salvar o documento agora. Tente novamente em instantes.",
      metadata: { noCharge: true },
    }
  }
}

export const attachLeadDocumentCapability: CosCapabilityHandler = async ({ brokerId, message, payload, pendingContext }) => {
  // Segundo turno: usuario confirmou. leadId e record ja foram resolvidos e validados
  // no primeiro turno e voltam intactos via pendingContext.parsedData — nao re-resolve nada.
  if (pendingContext?.action === "ATTACH_LEAD_DOCUMENT" && pendingContext.parsedData) {
    const pendingLeadId = typeof pendingContext.parsedData.leadId === "string" ? pendingContext.parsedData.leadId : ""
    const pendingRecord = pendingContext.parsedData.record
    if (pendingLeadId && isEntityDocumentRecordLike(pendingRecord)) {
      return finalizeLeadDocumentAttachment(brokerId, pendingLeadId, pendingRecord)
    }
  }

  // Primeiro turno: resolve cliente + anexo, mas so pede confirmacao — nao grava ainda.
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const namedClientReference = detectNamedClientReference(message)
  if (!namedClientReference) {
    return {
      response: 'Não entendi qual cliente devo usar. Tente assim: "Anexe este documento ao cliente <nome>".',
      metadata: { noCharge: true },
    }
  }

  const attachments = getAttachmentsFromPayload(payloadRecord)
  const documentAttachment = attachments.find((attachment) => Boolean(attachment.dataUrl))
  if (!documentAttachment?.dataUrl) {
    const unsupportedAttachment = attachments[0]
    return {
      response: unsupportedAttachment
        ? `O arquivo "${unsupportedAttachment.name}" ainda não pode ser anexado automaticamente — hoje só oferecemos suporte a PDF. Envie o documento em PDF e tente novamente.`
        : "Não encontrei nenhum arquivo anexado para vincular. Anexe o documento e tente novamente.",
      metadata: { noCharge: true },
    }
  }

  const matches = await prisma.lead.findMany({
    where: { brokerId, name: { contains: namedClientReference, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  })

  if (matches.length === 0) {
    return {
      response: `Não encontrei nenhum cliente chamado "${namedClientReference}". Confirme o nome e tente novamente.`,
      metadata: { noCharge: true, matchedByName: true },
    }
  }

  if (matches.length > 1) {
    return {
      response: `Encontrei ${matches.length} clientes chamados "${namedClientReference}": ${matches.map((item) => item.name ?? "Sem nome").join(", ")}. Me diga qual deles para eu continuar.`,
      metadata: { noCharge: true, matchedByName: true, ambiguous: true, leadIds: matches.map((item) => item.id) },
    }
  }

  const lead = matches[0]
  const record = buildEntityDocumentRecord({
    name: documentAttachment.name,
    type: documentAttachment.type,
    dataUrl: documentAttachment.dataUrl,
  })

  return {
    response: `Encontrei o cliente ${lead.name ?? namedClientReference}. Posso anexar o documento "${record.name}" a ele? Deseja confirmar?`,
    metadata: {
      required: ["confirmation"],
      noCharge: true,
      matchedByName: true,
      parsedData: { leadId: lead.id, record },
    },
  }
}

