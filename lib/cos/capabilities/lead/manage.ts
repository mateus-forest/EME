import "server-only"

import { LeadStatus } from "@/lib/prisma-enums"

import { prisma } from "@/lib/prisma"

import { cleanText, getEntityIdFromPayload, getPayloadRecord, normalizeText, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
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

