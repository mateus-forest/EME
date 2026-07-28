import type { Agency, Broker, Lead, Property } from "@/lib/prisma-model-types"
import {
  LeadStatus,
  UserRole } from "@/lib/prisma-enums"
import {
  computeLeadCompletion,
  defaultLeadAddress,
  defaultLeadIdentification,
  defaultLeadLegalData,
  parseEntityDocuments,
  parseLeadAddress,
  parseLeadIdentification,
  parseLeadLegalData,
  type CompletionSummary,
  type EntityDocumentRecord,
  type LeadAddress,
  type LeadIdentification,
  type LeadLegalData,
} from "@/lib/legal-entities"

const leadStatuses = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST", "ARCHIVED"] as const

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: "Novo",
  CONTACTED: "Em atendimento",
  NEGOTIATING: "Em atendimento",
  WON: "Convertido",
  LOST: "Perdido",
  ARCHIVED: "Arquivado",
}

export type LeadRecord = {
  id: string
  name: string
  email: string
  phone: string
  whatsApp: string
  message: string
  catalogSlug: string
  searchTerm: string
  intent: string
  source: string
  status: LeadStatus
  statusLabel: string
  propertyId: string | null
  propertyTitle: string
  brokerId: string | null
  brokerName: string
  agencyId: string | null
  agencyName: string
  identification: LeadIdentification
  address: LeadAddress
  legal: LeadLegalData
  documents: EntityDocumentRecord[]
  completion: CompletionSummary
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

export function leadSourceLabel(source: string) {
  const normalized = source.trim().toLowerCase()
  if (normalized === "catalog" || normalized === "catalogo" || normalized === "catálogo") return "Catálogo"
  if (normalized === "corretor_eme") return "Corretor EME"
  if (normalized === "assessor_eme") return "Assessor EME"
  if (normalized === "manual") return "Manual"
  if (normalized === "whatsapp") return "WhatsApp"
  if (normalized === "landing") return "Landing page"
  return source || "Não informado"
}

export function serializeLead(lead: LeadWithRelations): LeadRecord {
  const identification = parseLeadIdentification(lead.legalData)
  const address = parseLeadAddress(lead.addressData)
  const legal = parseLeadLegalData(lead.legalData)
  const documents = parseEntityDocuments(lead.documentsData)
  const completion = computeLeadCompletion({
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.whatsapp ?? lead.phone ?? "",
    identification,
    address,
  })

  return {
    id: lead.id,
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    whatsApp: lead.whatsapp ?? lead.phone ?? "",
    message: lead.message ?? "",
    catalogSlug: lead.catalogSlug ?? "",
    searchTerm: lead.searchTerm ?? "",
    intent: lead.intent ?? "",
    source: leadSourceLabel(lead.source),
    status: lead.status,
    statusLabel: leadStatusLabels[lead.status],
    propertyId: lead.propertyId,
    propertyTitle: lead.property?.title ?? "",
    brokerId: lead.brokerId,
    brokerName: lead.broker?.user.name ?? "",
    agencyId: lead.agencyId,
    agencyName: lead.agency?.name ?? "",
    identification: identification ?? defaultLeadIdentification,
    address: address ?? defaultLeadAddress,
    legal: legal ?? defaultLeadLegalData,
    documents,
    completion,
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
