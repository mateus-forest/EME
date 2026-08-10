import "server-only"

import { prisma } from "@/lib/prisma"

import { resolveLeadDocumentCandidateChoice } from "@/lib/cos/capabilities/lead/manage"
import { getEntityIdFromPayload, normalizeText } from "@/lib/cos/capabilities/shared"
import {
  extractPersonName,
  extractPropertyReference,
  findLeadCandidates,
  findProposalPropertyCandidates,
  resolvePropertyChoice,
} from "@/lib/cos/runtime-helpers"
import type { CosPendingInputOption, CosWorkspaceEntity } from "@/lib/cos/types"

type PayloadRecord = Record<string, unknown>

export type CosEntityResolution<TRecord> = {
  record: TRecord | null
  options?: CosPendingInputOption[]
  recordIds?: string[]
  parsedData?: Record<string, unknown>
}

function getDirectEntityId(payload: PayloadRecord, entity: CosWorkspaceEntity) {
  return getEntityIdFromPayload(payload, entity)
}

export async function resolveLeadEntity(input: {
  brokerId: string
  message: string
  payload: PayloadRecord
  pendingField?: string | null
  pendingData?: Record<string, unknown>
  pendingOptions?: CosPendingInputOption[] | null
  take?: number
}) {
  // A opcao clicada num card de selecao chega aqui como texto livre (o label da opcao, ex.: o
  // nome do lead), nao como indice numerico. Resolver contra a lista de opcoes que o proprio EME
  // ofereceu no turno anterior (pendingOptions, ja com id+label) evita cair de volta numa busca
  // livre por nome que pode retornar os MESMOS multiplos candidatos e reexibir o mesmo card em
  // loop, sem nunca progredir o fluxo — mesmo padrao ja usado por resolveLeadDocumentCandidateChoice.
  const directLeadId =
    input.pendingField === "lead" && input.pendingOptions && input.pendingOptions.length > 0
      ? resolveLeadDocumentCandidateChoice(
          input.message,
          input.pendingOptions.map((option) => ({ id: option.id, name: option.label })),
        )?.id ?? null
      : getDirectEntityId(input.payload, "lead")

  const personName =
    typeof input.pendingData?.personName === "string" && input.pendingData.personName
      ? input.pendingData.personName
      : extractPersonName(input.message)

  const matchingLeads = directLeadId
    ? await prisma.lead.findMany({
        where: { brokerId: input.brokerId, id: directLeadId },
        take: 1,
        select: { id: true, name: true, phone: true, email: true },
      })
    : personName
      ? await findLeadCandidates(input.brokerId, personName, input.take ?? 4)
      : []

  return {
    record: matchingLeads[0] ?? null,
    options:
      matchingLeads.length > 1
        ? matchingLeads.map((lead) => ({
            id: lead.id,
            label: lead.name || "Sem nome",
            description: lead.phone || undefined,
          }))
        : undefined,
    recordIds: matchingLeads.map((lead) => lead.id),
    parsedData: { ...input.pendingData, personName },
  } satisfies CosEntityResolution<(typeof matchingLeads)[number]>
}

export async function resolvePropertyEntity(input: {
  brokerId: string
  message: string
  payload: PayloadRecord
  pendingField?: string | null
  pendingData?: Record<string, unknown>
  take?: number
}) {
  const directPropertyId = getDirectEntityId(input.payload, "property")
  if (directPropertyId) {
    const property = await prisma.property.findFirst({
      where: { brokerId: input.brokerId, id: directPropertyId },
      select: {
        id: true,
        publicCode: true,
        title: true,
        city: true,
        neighborhood: true,
        description: true,
        price: true,
        purpose: true,
        type: true,
        bedrooms: true,
        parkingSpots: true,
        imageUrls: true,
      },
    })
    return { record: property, parsedData: input.pendingData ?? {} } satisfies CosEntityResolution<typeof property>
  }

  const pendingOptions = Array.isArray(input.pendingData?.propertyOptions)
    ? (input.pendingData.propertyOptions as Array<{ id?: string; title?: string }>)
    : []
  const selectedOption = input.pendingField === "propertyChoice" ? resolvePropertyChoice(input.message, pendingOptions) : null
  if (selectedOption?.id) {
    const selectedProperty = await prisma.property.findFirst({
      where: { brokerId: input.brokerId, id: selectedOption.id },
      select: {
        id: true,
        publicCode: true,
        title: true,
        city: true,
        neighborhood: true,
        description: true,
        price: true,
        purpose: true,
        type: true,
        bedrooms: true,
        parkingSpots: true,
        imageUrls: true,
      },
    })
    if (selectedProperty) {
      return { record: selectedProperty, parsedData: input.pendingData ?? {} } satisfies CosEntityResolution<typeof selectedProperty>
    }
  }

  const propertyReference = extractPropertyReference(input.message)
  const candidates = await findProposalPropertyCandidates(
    input.brokerId,
    input.message,
    propertyReference,
    input.take ?? 4,
  )

  return {
    record: candidates[0] ?? null,
    options:
      candidates.length > 1
        ? candidates.map((item) => ({
            id: item.id,
            label: item.title,
            description: `${item.neighborhood ?? item.city} - ${item.city}`,
          }))
        : undefined,
    recordIds: candidates.map((item) => item.id),
    parsedData: {
      ...input.pendingData,
      propertyReference,
      propertyOptions: candidates.map((item) => ({ id: item.id, title: item.title })),
    },
  } satisfies CosEntityResolution<(typeof candidates)[number]>
}

export async function resolveContractEntity(input: {
  brokerId: string
  payload: PayloadRecord
  message?: string
}) {
  const documentId = getDirectEntityId(input.payload, "contract")
  if (documentId) {
    const contract = await prisma.brokerDocument.findFirst({
      where: { id: documentId, brokerId: input.brokerId, type: "contract" },
    })
    return { record: contract, parsedData: {} } satisfies CosEntityResolution<typeof contract>
  }

  const query = normalizeText(input.message ?? "")
  const contract = await prisma.brokerDocument.findFirst({
    where: {
      brokerId: input.brokerId,
      type: "contract",
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  })
  return { record: contract, parsedData: {} } satisfies CosEntityResolution<typeof contract>
}

export async function resolveAgendaEntity(input: {
  brokerId: string
  payload: PayloadRecord
}) {
  const agendaEventId = getDirectEntityId(input.payload, "agenda")
  if (agendaEventId) {
    const event = await prisma.agendaEvent.findFirst({
      where: { id: agendaEventId, brokerId: input.brokerId },
    })
    return { record: event, parsedData: {} } satisfies CosEntityResolution<typeof event>
  }

  const event = await prisma.agendaEvent.findFirst({
    where: { brokerId: input.brokerId },
    orderBy: { date: "desc" },
  })
  return { record: event, parsedData: {} } satisfies CosEntityResolution<typeof event>
}

export async function resolveCampaignEntity(input: {
  brokerId: string
  payload: PayloadRecord
}) {
  const campaignId = typeof input.payload.campaignId === "string" ? input.payload.campaignId.trim() : ""
  if (!campaignId) {
    return { record: null, parsedData: {} } satisfies CosEntityResolution<null>
  }

  const campaign = await prisma.studioCampaign.findFirst({
    where: {
      id: campaignId,
      brokerId: input.brokerId,
    },
  })

  return { record: campaign, parsedData: {} } satisfies CosEntityResolution<typeof campaign>
}
