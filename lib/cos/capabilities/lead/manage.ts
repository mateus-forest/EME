import "server-only"

import { LeadStatus } from "@/lib/prisma-enums"

import { prisma } from "@/lib/prisma"
import { detectNamedClientReference, detectNamedClientReferenceForDeletion } from "@/lib/cos/entity-extraction"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
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

async function finalizeLeadDeletion(brokerId: string, leadId: string, fallbackName: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, brokerId } })
  if (!lead) {
    return {
      response: "Não encontrei mais esse cliente — ele já deve ter sido excluído.",
      metadata: { noCharge: true },
    }
  }

  const name = lead.name ?? fallbackName

  try {
    await prisma.lead.delete({ where: { id: lead.id } })

    return {
      response: `Cliente excluído permanentemente.\n\n${name}`,
      metadata: { leadId: lead.id, leadDeleted: true },
      leadId: lead.id,
    }
  } catch (error) {
    console.error("[cos][lead][delete] failed", {
      message: error instanceof Error ? error.message : "unknown",
      leadId: lead.id,
    })
    return {
      response: "Não consegui excluir o cliente agora. Tente novamente em instantes.",
      metadata: { noCharge: true },
    }
  }
}

// Permanent delete, not archive: EmeMessage/AgendaEvent/BrokerDocument all reference Lead with
// onDelete: SetNull in prisma/schema.prisma (they lose the link, not the row), and
// AiAssistantInteraction.leadId isn't even a real FK — so a direct delete can't strand a
// constraint or orphan a row. Same three-phase confirm pattern as attachLeadDocumentCapability:
// resolve by name (0/1/>1), confirm with the exact resolved name, only mutate on the "sim".
export const deleteLeadCapability: CosCapabilityHandler = async ({ brokerId, message, payload, pendingInput }) => {
  // Terceiro turno: usuario confirmou a exclusao. leadId/leadName ja foram resolvidos em
  // turnos anteriores e voltam intactos via pendingInput.parsedData — exclui de verdade agora.
  if (pendingInput?.action === "DELETE_LEAD" && pendingInput.field === "confirmation" && pendingInput.parsedData) {
    const pendingLeadId = typeof pendingInput.parsedData.leadId === "string" ? pendingInput.parsedData.leadId : ""
    const pendingLeadName = typeof pendingInput.parsedData.leadName === "string" ? pendingInput.parsedData.leadName : "Cliente sem nome"
    if (pendingLeadId) {
      return finalizeLeadDeletion(brokerId, pendingLeadId, pendingLeadName)
    }
  }

  // Segundo turno (so quando havia ambiguidade): usuario respondeu qual cliente quis dizer.
  // Reaproveita a mesma resolucao de candidato por ordinal/substring ja usada no anexo de
  // documento — nao grava nada ainda, so avanca para a confirmacao final.
  if (pendingInput?.action === "DELETE_LEAD" && pendingInput.field === "lead" && pendingInput.parsedData) {
    const pendingCandidates = pendingInput.parsedData.candidates
    if (isLeadDocumentCandidateArray(pendingCandidates)) {
      const chosen = resolveLeadDocumentCandidateChoice(message, pendingCandidates)
      if (!chosen) {
        return {
          response: `Ainda não entendi qual cliente você quer excluir. Os candidatos eram: ${pendingCandidates.map((candidate) => candidate.name).join(", ")}. Tente novamente com o nome completo.`,
          metadata: { noCharge: true },
        }
      }

      return {
        response: `Encontrei o cliente ${chosen.name}.\n\n⚠️ Esta ação é permanente e não pode ser desfeita.`,
        metadata: createPendingInputMetadata({
          field: "confirmation",
          action: "DELETE_LEAD",
          entity: "lead",
          parsedData: { leadId: chosen.id, leadName: chosen.name },
          extra: { matchedByName: true },
        }),
      }
    }
  }

  // Primeiro turno: resolve o cliente do zero, por id direto (workspace da tela atual) ou por nome.
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const directLeadId = getEntityIdFromPayload(payloadRecord, "lead")

  let matches: LeadDocumentCandidate[]

  if (directLeadId) {
    const lead = await prisma.lead.findFirst({ where: { id: directLeadId, brokerId } })
    matches = lead ? [{ id: lead.id, name: lead.name ?? "Sem nome" }] : []
  } else {
    const namedClientReference = detectNamedClientReferenceForDeletion(message)
    if (!namedClientReference) {
      return {
        response: 'Não entendi qual cliente devo excluir. Tente assim: "Exclua o cliente <nome>".',
        metadata: { noCharge: true },
      }
    }

    const found = await prisma.lead.findMany({
      where: { brokerId, name: { contains: namedClientReference, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })
    matches = found.map((item) => ({ id: item.id, name: item.name ?? "Sem nome" }))
  }

  if (matches.length === 0) {
    return {
      response: "Não encontrei nenhum cliente correspondente. Confirme o nome e tente novamente.",
      metadata: { noCharge: true, matchedByName: true },
    }
  }

  if (matches.length > 1) {
    return {
      response: `Encontrei ${matches.length} clientes com esse nome: ${matches.map((candidate) => candidate.name).join(", ")}. Qual deles devo excluir?`,
      metadata: createPendingInputMetadata({
        field: "lead",
        action: "DELETE_LEAD",
        entity: "lead",
        parsedData: {
          candidates: matches,
          options: matches.map((candidate) => ({ id: candidate.id, label: candidate.name })),
        },
        extra: {
          matchedByName: true,
          ambiguous: true,
        },
      }),
    }
  }

  const target = matches[0]

  return {
    response: `Encontrei o cliente ${target.name}.\n\n⚠️ Esta ação é permanente e não pode ser desfeita.`,
    metadata: createPendingInputMetadata({
      field: "confirmation",
      action: "DELETE_LEAD",
      entity: "lead",
      parsedData: { leadId: target.id, leadName: target.name },
      extra: { matchedByName: true },
    }),
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

type LeadDocumentCandidate = { id: string; name: string }

export function isLeadDocumentCandidateArray(value: unknown): value is LeadDocumentCandidate[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false
      const candidate = item as Record<string, unknown>
      return typeof candidate.id === "string" && typeof candidate.name === "string"
    })
  )
}

const ORDINAL_WORDS = ["primeiro", "segundo", "terceiro", "quarto", "quinto"]

// Mesmo padrao de lib/eme-backend.ts's resolvePropertyChoice: indice numerico/ordinal,
// ou substring mutua entre a resposta do usuario e o nome do candidato.
export function resolveLeadDocumentCandidateChoice(message: string, candidates: LeadDocumentCandidate[]): LeadDocumentCandidate | null {
  const normalized = normalizeText(message)
  const ordinalIndex = ORDINAL_WORDS.findIndex((word) => normalized.includes(word))
  const index = /^\d+$/.test(normalized) ? Number(normalized) - 1 : ordinalIndex
  if (index >= 0 && candidates[index]) return candidates[index]

  return (
    candidates.find((candidate) => {
      const normalizedName = normalizeText(candidate.name)
      return Boolean(normalizedName) && (normalizedName.includes(normalized) || normalized.includes(normalizedName))
    }) ?? null
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

export const attachLeadDocumentCapability: CosCapabilityHandler = async ({ brokerId, message, payload, pendingInput }) => {
  // Terceiro turno: usuario confirmou. leadId e record ja foram resolvidos e validados
  // em turnos anteriores e voltam intactos via pendingInput.parsedData — nao re-resolve nada.
  if (pendingInput?.action === "ATTACH_LEAD_DOCUMENT" && pendingInput.field === "confirmation" && pendingInput.parsedData) {
    const pendingLeadId = typeof pendingInput.parsedData.leadId === "string" ? pendingInput.parsedData.leadId : ""
    const pendingRecord = pendingInput.parsedData.record
    if (pendingLeadId && isEntityDocumentRecordLike(pendingRecord)) {
      return finalizeLeadDocumentAttachment(brokerId, pendingLeadId, pendingRecord)
    }
  }

  // Segundo turno (so quando havia ambiguidade): usuario respondeu qual cliente quis dizer.
  // Resolve a escolha entre os candidatos salvos e pede confirmacao final — ainda nao grava.
  if (pendingInput?.action === "ATTACH_LEAD_DOCUMENT" && pendingInput.field === "lead" && pendingInput.parsedData) {
    const pendingCandidates = pendingInput.parsedData.candidates
    const pendingRecord = pendingInput.parsedData.record
    if (isLeadDocumentCandidateArray(pendingCandidates) && isEntityDocumentRecordLike(pendingRecord)) {
      const chosen = resolveLeadDocumentCandidateChoice(message, pendingCandidates)
      if (!chosen) {
        return {
          response: `Ainda não entendi qual cliente você quer usar. Os candidatos eram: ${pendingCandidates.map((candidate) => candidate.name).join(", ")}. Tente novamente com o nome completo.`,
          metadata: { noCharge: true },
        }
      }

      return {
        response: `Encontrei o cliente ${chosen.name}. Posso anexar o documento "${pendingRecord.name}" a ele? Deseja confirmar?`,
        metadata: createPendingInputMetadata({
          field: "confirmation",
          action: "ATTACH_LEAD_DOCUMENT",
          entity: "lead",
          parsedData: { leadId: chosen.id, record: pendingRecord },
          extra: { matchedByName: true },
        }),
      }
    }
  }

  // Primeiro turno: resolve cliente + anexo do zero.
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

  const record = buildEntityDocumentRecord({
    name: documentAttachment.name,
    type: documentAttachment.type,
    dataUrl: documentAttachment.dataUrl,
  })

  if (matches.length > 1) {
    const candidates: LeadDocumentCandidate[] = matches.map((item) => ({ id: item.id, name: item.name ?? "Sem nome" }))
    return {
      response: `Encontrei ${matches.length} clientes chamados "${namedClientReference}": ${candidates.map((candidate) => candidate.name).join(", ")}. Qual deles devo usar?`,
      metadata: createPendingInputMetadata({
        field: "lead",
        action: "ATTACH_LEAD_DOCUMENT",
        entity: "lead",
        parsedData: {
          candidates,
          record,
          options: candidates.map((candidate) => ({ id: candidate.id, label: candidate.name })),
        },
        extra: {
          matchedByName: true,
          ambiguous: true,
        },
      }),
    }
  }

  const lead = matches[0]

  return {
    response: `Encontrei o cliente ${lead.name ?? namedClientReference}. Posso anexar o documento "${record.name}" a ele? Deseja confirmar?`,
    metadata: createPendingInputMetadata({
      field: "confirmation",
      action: "ATTACH_LEAD_DOCUMENT",
      entity: "lead",
      parsedData: { leadId: lead.id, record },
      extra: { matchedByName: true },
    }),
  }
}

