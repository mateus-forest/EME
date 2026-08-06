import "server-only"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

import { cleanText } from "@/lib/cos/capabilities/shared"
import {
  extractAgendaPersonName,
  extractPropertyReference,
  findLeadCandidates,
  formatAgendaDateLabel,
  parseAgendaDate,
  parseAgendaTime,
  parseAgendaTitle,
  parseAgendaType,
} from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function json(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject
}

export const createAgendaCapability: CosCapabilityHandler = async ({ brokerId, userId, message, pendingContext }) => {
  if (pendingContext?.action === "CREATE_AGENDA_EVENT" && pendingContext.missingField === "time") {
    const parsedData = pendingContext.parsedData ?? {}
    const time = parseAgendaTime(message)
    if (!time) {
      return {
        response: "Qual horário devo colocar?",
        metadata: json({ required: ["time"], noCharge: true, parsedData }),
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
        message: `${title} ${formatAgendaDateLabel(message, date)} às ${time}.`,
        read: false,
      },
    })

    return {
      response: `Compromisso criado.\n${formatAgendaDateLabel(message, date)} às ${time} — ${title}.`,
      metadata: json({ agendaEventId: event.id, parsedData: { ...parsedData, time }, status: "pending" }),
    }
  }

  const date = parseAgendaDate(message)
  const time = parseAgendaTime(message)
  const type = parseAgendaType(message)
  const personName = extractAgendaPersonName(message)
  const propertyReference = extractPropertyReference(message)

  const [lead, property] = await Promise.all([
    personName ? findLeadCandidates(brokerId, personName, 1).then((items) => items[0] ?? null) : null,
    propertyReference.publicCode || propertyReference.idOrCode || propertyReference.neighborhood || propertyReference.type
      ? prisma.property.findFirst({
          where: {
            brokerId,
            OR: [
              ...(propertyReference.idOrCode ? [{ id: propertyReference.idOrCode }, { title: { contains: propertyReference.idOrCode, mode: "insensitive" as const } }] : []),
              ...(propertyReference.neighborhood ? [{ neighborhood: { contains: propertyReference.neighborhood, mode: "insensitive" as const } }] : []),
              ...(propertyReference.type ? [{ type: propertyReference.type as never }] : []),
            ],
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true },
        })
      : null,
  ])

  const title = cleanText(`${parseAgendaTitle(message)}${lead?.name || personName ? ` com ${lead?.name ?? personName}` : ""}${property ? ` no ${property.title}` : ""}`, 160)
  if (!time) {
    return {
      response: "Qual horário devo colocar?",
      metadata: json({
        required: ["time"],
        noCharge: true,
        parsedData: { title, type, date: date.toISOString(), personName, propertyReference },
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
      message: `${title} ${formatAgendaDateLabel(message, date)} às ${time}.`,
      read: false,
    },
  })

  return {
    response: `Compromisso criado.\n${title} — ${formatAgendaDateLabel(message, date)}.\nHorário: ${time}.`,
    metadata: json({
      agendaEventId: event.id,
      leadId: lead?.id ?? null,
      propertyId: property?.id ?? null,
      status: "pending",
    }),
    leadId: lead?.id,
    propertyId: property?.id,
  }
}
