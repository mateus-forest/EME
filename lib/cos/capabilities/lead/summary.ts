import type { Prisma } from "@prisma/client"

import { LeadStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

import { cleanText } from "@/lib/cos/capabilities/shared"
import { extractClientIdentity } from "@/lib/cos/entity-extraction"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function json(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject
}

function parseLeadStatusFromText(message: string): LeadStatus {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (/\b(convertido|ganho|fechado)\b/.test(normalized)) return LeadStatus.WON
  if (/\b(perdido|perdeu)\b/.test(normalized)) return LeadStatus.LOST
  if (/\b(em atendimento|atendimento|negociacao|negociação)\b/.test(normalized)) return LeadStatus.CONTACTED
  return LeadStatus.NEW
}

export const createLeadCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const pendingLeadData = pendingInput?.action === "createLead" ? pendingInput.parsedData ?? {} : {}
  const extracted = extractClientIdentity(message)
  const name =
    cleanText(payload?.name, 120) ||
    cleanText(pendingLeadData.extractedName, 120) ||
    cleanText(pendingLeadData.name, 120) ||
    cleanText(extracted.name, 120)
  const phone =
    cleanText(payload?.phone, 40) ||
    cleanText(pendingLeadData.phone, 40) ||
    cleanText(extracted.phone, 40)

  if (!name) {
    return {
      response: "Qual o nome do lead?",
      metadata: createPendingInputMetadata({
        field: "name",
        action: "createLead",
        entity: "lead",
        parsedData: pendingLeadData,
        extra: { readyForConfirmation: false },
      }),
    }
  }

  if (!phone) {
    return {
      response: "Qual o telefone dele?",
      metadata: createPendingInputMetadata({
        field: "phone",
        action: "createLead",
        entity: "lead",
        parsedData: { ...pendingLeadData, extractedName: name },
        extra: {
          readyForConfirmation: false,
          extractedName: name,
        },
      }),
    }
  }

  const requestedStatus = parseLeadStatusFromText(message)
  const existingLead = await prisma.lead.findFirst({
    where: { brokerId, OR: [{ phone }, { whatsapp: phone }] },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  })

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: { name, phone, whatsapp: phone, source: "assessor_eme", status: requestedStatus, message },
      })
    : await prisma.lead.create({
        data: {
          name,
          phone,
          whatsapp: phone,
          source: "assessor_eme",
          status: requestedStatus,
          brokerId,
          message,
        },
      })

  await prisma.notification.create({
    data: {
      userId,
      title: existingLead ? "Lead atualizado pelo COS" : "Lead criado pelo COS",
      message: `${name} foi ${existingLead ? "atualizado" : "cadastrado"} no CRM.`,
      read: false,
    },
  })

  return {
    response: existingLead ? "Esse lead já existia. Atualizei as informações." : `Lead ${name} cadastrado com sucesso.`,
    metadata: json({ leadId: lead.id, phone, name, status: requestedStatus, updatedExisting: Boolean(existingLead) }),
    leadId: lead.id,
  }
}

export const leadSummaryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const [leadTotal, leadNew, contacted, negotiating, won, lost] = await Promise.all([
    prisma.lead.count({ where: { brokerId } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.NEW } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.CONTACTED } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.NEGOTIATING } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { brokerId, status: LeadStatus.LOST } }),
  ])
  const inProgress = contacted + negotiating

  return {
    response: `Seus leads:\n\n• Total: ${leadTotal}\n• Novos: ${leadNew}\n• Em atendimento: ${inProgress}\n• Convertidos: ${won}\n• Perdidos: ${lost}`,
    metadata: json({ total: leadTotal, newLeads: leadNew, inProgress, won, lost }),
  }
}

export const leadSummarizeCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const leads = await prisma.lead.findMany({
    where: { brokerId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { property: { select: { title: true } } },
  })

  return {
    response: leads.length
      ? `Últimos leads: ${leads.map((lead) => `${lead.name || lead.phone || "Lead"} (${lead.status})${lead.property?.title ? ` - ${lead.property.title}` : ""}`).join("; ")}.`
      : "Ainda não há leads cadastrados para resumir.",
    metadata: json({ leadIds: leads.map((lead) => lead.id) }),
    leadId: leads[0]?.id,
  }
}
