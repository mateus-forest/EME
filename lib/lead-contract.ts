import type { Agency, Broker, Lead, Property } from "@/lib/prisma-model-types"
import {
  LeadStatus,
  UserRole } from "@/lib/prisma-enums"

const leadStatuses = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST", "ARCHIVED"] as const

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  NEGOTIATING: "Em negociação",
  WON: "Ganho",
  LOST: "Perdido",
  ARCHIVED: "Arquivado",
}

export type LeadRecord = {
  id: string
  name: string
  email: string
  phone: string
  message: string
  source: string
  status: LeadStatus
  statusLabel: string
  propertyId: string | null
  propertyTitle: string
  brokerId: string | null
  brokerName: string
  agencyId: string | null
  agencyName: string
  createdAt: string
  updatedAt: string
}

type LeadWithRelations = Lead & {
  property: Pick<Property, "id" | "title"> | null
  broker: (Pick<Broker, "id"> & { user: { name: string } }) | null
  agency: Pick<Agency, "id" | "name"> | null
}

export function parseLeadStatus(value: unknown) {
  if (typeof value !== "string") return null
  return leadStatuses.includes(value as LeadStatus) ? (value as LeadStatus) : null
}

export function serializeLead(lead: LeadWithRelations): LeadRecord {
  return {
    id: lead.id,
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    message: lead.message ?? "",
    source: lead.source,
    status: lead.status,
    statusLabel: leadStatusLabels[lead.status],
    propertyId: lead.propertyId,
    propertyTitle: lead.property?.title ?? "",
    brokerId: lead.brokerId,
    brokerName: lead.broker?.user.name ?? "",
    agencyId: lead.agencyId,
    agencyName: lead.agency?.name ?? "",
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}

export function canAccessLead(
  user: { role: UserRole; broker: Pick<Broker, "id"> | null; ownedAgency: Pick<Agency, "id"> | null },
  lead: Pick<Lead, "brokerId" | "agencyId">,
) {
  if (user.role === "ADMIN") return true
  if (user.role === "BROKER") return Boolean(user.broker && lead.brokerId === user.broker.id)
  if (user.role === "AGENCY") return Boolean(user.ownedAgency && lead.agencyId === user.ownedAgency.id)
  return false
}

export const leadInclude = {
  property: {
    select: {
      id: true,
      title: true,
    },
  },
  broker: {
    select: {
      id: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  },
  agency: {
    select: {
      id: true,
      name: true,
    },
  },
} as const
