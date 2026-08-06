import "server-only"

import { resolveLeadEntity, resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { prisma } from "@/lib/prisma"

import { cleanText } from "@/lib/cos/capabilities/shared"
import {
  extractAgendaPersonName,
  extractPropertyReference,
  formatAgendaDateLabel,
  parseAgendaDate,
  parseAgendaTime,
  parseAgendaTitle,
  parseAgendaType,
} from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

export const createAgendaCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  if (pendingInput?.action === "CREATE_AGENDA_EVENT" && pendingInput.field === "time") {
    const parsedData = pendingInput.parsedData ?? {}
    const time = parseAgendaTime(message)
    if (!time) {
      return {
        response: "Qual horario devo colocar?",
        metadata: createPendingInputMetadata({
          field: "time",
          action: "CREATE_AGENDA_EVENT",
          entity: "agenda",
          parsedData,
        }),
      }
    }

    const title = cleanText(parsedData.title, 160) || "Compromisso"
    const type = cleanText(parsedData.type, 40) || "task"
    const date = typeof parsedData.date === "string" ? new Date(parsedData.date) : new Date()
    const event = await prisma.agendaEvent.create({
      data: { brokerId, title, type, date, time, notes: message, status: "pending" },
    })

    await prisma.notification.create({
      data: {
        userId,
        title: "Compromisso agendado",
        message: `${title} ${formatAgendaDateLabel(message, date)} as ${time}.`,
        read: false,
      },
    })

    return {
      response: `Compromisso criado.\n${formatAgendaDateLabel(message, date)} as ${time} - ${title}.`,
      metadata: { agendaEventId: event.id, parsedData: { ...parsedData, time }, status: "pending" },
    }
  }

  const date = parseAgendaDate(message)
  const time = parseAgendaTime(message)
  const type = parseAgendaType(message)
  const personName = extractAgendaPersonName(message)
  const propertyReference = extractPropertyReference(message)
  const payloadRecord = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>

  const [leadResolution, propertyResolution] = await Promise.all([
    personName
      ? resolveLeadEntity({
          brokerId,
          message,
          payload: payloadRecord,
          pendingData: { personName },
          take: 1,
        })
      : Promise.resolve(null),
    propertyReference.publicCode || propertyReference.idOrCode || propertyReference.neighborhood || propertyReference.type
      ? resolvePropertyEntity({
          brokerId,
          payload: payloadRecord,
          message,
          pendingData: { propertyReference },
          take: 1,
        })
      : Promise.resolve(null),
  ])

  const lead = leadResolution?.record ?? null
  const property = propertyResolution?.record ?? null
  const title = cleanText(`${parseAgendaTitle(message)}${lead?.name || personName ? ` com ${lead?.name ?? personName}` : ""}${property ? ` no ${property.title}` : ""}`, 160)

  if (!time) {
    return {
      response: "Qual horario devo colocar?",
      metadata: createPendingInputMetadata({
        field: "time",
        action: "CREATE_AGENDA_EVENT",
        entity: "agenda",
        parsedData: { title, type, date: date.toISOString(), personName, propertyReference },
        extra: {
          leadId: lead?.id ?? null,
          propertyId: property?.id ?? null,
        },
      }),
      leadId: lead?.id,
      propertyId: property?.id,
    }
  }

  const event = await prisma.agendaEvent.create({
    data: {
      brokerId,
      title,
      type,
      date,
      time,
      leadId: lead?.id ?? null,
      propertyId: property?.id ?? null,
      notes: message,
      status: "pending",
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      title: "Compromisso agendado",
      message: `${title} ${formatAgendaDateLabel(message, date)} as ${time}.`,
      read: false,
    },
  })

  return {
    response: `Compromisso criado.\n${title} - ${formatAgendaDateLabel(message, date)}.\nHorario: ${time}.`,
    metadata: {
      agendaEventId: event.id,
      leadId: lead?.id ?? null,
      propertyId: property?.id ?? null,
      status: "pending",
    },
    leadId: lead?.id,
    propertyId: property?.id,
  }
}
