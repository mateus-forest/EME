import "server-only"

import { resolveAgendaEntity } from "@/lib/cos/entity-resolver"
import { createCosSuccessResult } from "@/lib/cos/action-result"
import { prisma } from "@/lib/prisma"

import { cleanText, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

async function resolveAgendaEvent(brokerId: string, payload: Record<string, unknown>) {
  const resolution = await resolveAgendaEntity({ brokerId, payload })
  return resolution.record
}

async function listAgendaWindow(brokerId: string, from: Date, to: Date, label: string) {
  const events = await prisma.agendaEvent.findMany({
    where: {
      brokerId,
      date: {
        gte: from,
        lte: to,
      },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    take: 20,
  })

  return {
    response: events.length
      ? `${label}:\n\n${events.map((event) => `- ${event.title} (${event.status})${event.time ? ` às ${event.time}` : ""}`).join("\n")}`
      : `${label}: nenhum compromisso encontrado.`,
    metadata: {
      agendaEventIds: events.map((event) => event.id),
      resultCount: events.length,
      rangeStart: from.toISOString(),
      rangeEnd: to.toISOString(),
    },
  }
}

export const updateAgendaCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const event = await resolveAgendaEvent(brokerId, payloadRecord)
  if (!event) return requiredSelectionResponse("compromisso", "agendaEventId", undefined, {
    action: "UPDATE_AGENDA_EVENT",
    entity: "agenda",
    capabilityId: "agenda.update",
  })

  const timeMatch = message.match(/\b(\d{1,2}:\d{2}|\d{1,2}h)\b/i)?.[0]?.replace("h", ":00") ?? event.time ?? null
  const updated = await prisma.agendaEvent.update({
    where: { id: event.id },
    data: {
      title: cleanText(payloadRecord.title, 160) || event.title,
      time: timeMatch,
      notes: cleanText(message, 1200) || event.notes,
    },
  })

  return createCosSuccessResult({
    response: `Compromisso atualizado.\n\n${updated.title}${updated.time ? ` às ${updated.time}` : ""}`,
    metadata: {
      agendaEventId: updated.id,
      status: updated.status,
    },
  })
}

export const cancelAgendaCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const event = await resolveAgendaEvent(brokerId, payloadRecord)
  if (!event) return requiredSelectionResponse("compromisso", "agendaEventId", undefined, {
    action: "CANCEL_AGENDA_EVENT",
    entity: "agenda",
    capabilityId: "agenda.cancel",
  })

  const updated = await prisma.agendaEvent.update({
    where: { id: event.id },
    data: { status: "cancelled" },
  })

  return createCosSuccessResult({
    response: `Compromisso cancelado.\n\n${updated.title}`,
    metadata: {
      agendaEventId: updated.id,
      status: updated.status,
    },
  })
}

export const todayAgendaCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const now = new Date()
  return listAgendaWindow(brokerId, startOfDay(now), endOfDay(now), "Agenda de hoje")
}

export const weekAgendaCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const now = new Date()
  const start = startOfDay(now)
  const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6))
  return listAgendaWindow(brokerId, start, end, "Agenda da semana")
}

export const monthAgendaCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const now = new Date()
  const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return listAgendaWindow(brokerId, start, end, "Agenda do mês")
}
