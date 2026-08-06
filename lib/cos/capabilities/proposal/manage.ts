import "server-only"

import { buildProposalHtml } from "@/lib/proposal-template"
import { prisma } from "@/lib/prisma"

import { cleanText, getEntityIdFromPayload, getPayloadRecord } from "@/lib/cos/capabilities/shared"
import { extractPersonName, extractPropertyReference, findLeadCandidates, findProposalPropertyCandidates, firstImageUrl, formatAssessorPropertyPrice, resolvePropertyChoice } from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

export const createProposalCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const pendingData = pendingContext?.action === "CREATE_PROPOSAL" ? pendingContext.parsedData ?? {} : {}
  const personName = cleanText((pendingData.personName as string | undefined) ?? extractPersonName(message), 120)
  const selectedLeadId =
    pendingContext?.missingField === "lead" && Array.isArray(pendingData.leadIds)
      ? cleanText((pendingData.leadIds as string[])[Math.max(0, Number.parseInt(message.replace(/\D/g, ""), 10) - 1)], 80)
      : getEntityIdFromPayload(payloadRecord, "lead")
  const propertyReference = extractPropertyReference(message)

  const [broker, matchingLeads] = await Promise.all([
    prisma.broker.findUnique({ where: { id: brokerId }, include: { user: { select: { name: true, email: true, photoUrl: true } } } }),
    selectedLeadId
      ? prisma.lead.findMany({ where: { brokerId, id: selectedLeadId }, take: 1, select: { id: true, name: true, phone: true, email: true } })
      : personName
        ? findLeadCandidates(brokerId, personName, 4)
        : [],
  ])

  if (!selectedLeadId && matchingLeads.length > 1) {
    return {
      response: `Encontrei mais de um ${personName}. Qual deles devo usar?\n\n${matchingLeads.map((leadItem, index) => `${index + 1}. ${leadItem.name || "Sem nome"}${leadItem.phone ? ` - ${leadItem.phone}` : ""}`).join("\n")}`,
      metadata: {
        required: ["lead"],
        noCharge: true,
        parsedData: {
          personName,
          leadIds: matchingLeads.map((leadItem) => leadItem.id),
          options: matchingLeads.map((leadItem) => ({
            id: leadItem.id,
            label: leadItem.name || "Sem nome",
            description: leadItem.phone || undefined,
          })),
        },
      },
    }
  }

  const lead = matchingLeads[0] ?? null
  if (!lead && !personName) {
    return {
      response: "Para qual cliente devo gerar a proposta?",
      metadata: { required: ["lead"], noCharge: true, parsedData: { personName } },
    }
  }

  const pendingOptions = Array.isArray(pendingData.propertyOptions) ? pendingData.propertyOptions as Array<{ id?: string; title?: string }> : []
  const selectedOption = pendingContext?.missingField === "propertyChoice" ? resolvePropertyChoice(message, pendingOptions) : null
  const selectedProperty = selectedOption?.id
    ? await prisma.property.findFirst({
        where: { brokerId, id: selectedOption.id },
        select: { id: true, publicCode: true, title: true, city: true, neighborhood: true, description: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true, imageUrls: true },
      })
    : null
  const propertyCandidates = selectedProperty ? [] : await findProposalPropertyCandidates(brokerId, message, propertyReference, 4)

  if (!selectedProperty && propertyCandidates.length > 1) {
    return {
      response: `Encontrei mais de um imóvel. Qual devo usar?\n\n${propertyCandidates.map((item, index) => `${index + 1}. ${item.publicCode ? `Imóvel ${item.publicCode} — ` : ""}${item.title} — ${item.neighborhood ?? "Sem bairro"} — ${item.city} — ${formatAssessorPropertyPrice(item.price)}`).join("\n")}`,
      metadata: {
        required: ["propertyChoice"],
        noCharge: true,
        parsedData: {
          personName,
          propertyOptions: propertyCandidates.map((item) => ({ id: item.id, title: item.title })),
          options: propertyCandidates.map((item) => ({
            id: item.id,
            label: item.title,
            description: `${item.neighborhood ?? item.city} - ${formatAssessorPropertyPrice(item.price)}`,
          })),
        },
      },
    }
  }

  const resolvedProperty = selectedProperty ?? propertyCandidates[0] ?? null
  if (!resolvedProperty) {
    return {
      response: "Qual imóvel devo usar na proposta?",
      metadata: {
        required: ["property"],
        noCharge: true,
        parsedData: { personName, leadId: lead?.id ?? null },
      },
      leadId: lead?.id,
    }
  }

  const proposalLead = lead ?? {
    id: null,
    name: personName || "Cliente não informado",
    phone: null,
    email: null,
  }
  const title = `Proposta ${proposalLead.name ?? resolvedProperty.title ?? "EME"}`
  const proposalProperty = { ...resolvedProperty, imageUrl: firstImageUrl(resolvedProperty.imageUrls) }
  const document = await prisma.brokerDocument.create({
    data: {
      brokerId,
      leadId: lead?.id ?? null,
      propertyId: resolvedProperty.id,
      type: "proposal",
      title,
      content: buildProposalHtml({
        lead: proposalLead,
        property: proposalProperty,
        broker: {
          name: broker?.user.name ?? "",
          phone: broker?.phone,
          email: broker?.user.email,
          city: resolvedProperty.city,
          creci: broker?.creci,
          photoUrl: broker?.user.photoUrl,
        },
      }),
      status: "draft",
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      title: "Proposta gerada",
      message: `Proposta para ${proposalLead.name || "cliente"} foi salva em Documentos.`,
      read: false,
    },
  })

  return {
    response: `Proposta criada em rascunho.\nCliente: ${proposalLead.name || "Cliente"}\nImóvel: ${resolvedProperty.publicCode ?? resolvedProperty.id}\nRevise e preencha os dados restantes antes de enviar.`,
    metadata: {
      documentId: document.id,
      leadId: lead?.id ?? null,
      propertyId: resolvedProperty.id,
      status: "draft",
    },
    leadId: lead?.id ?? undefined,
    propertyId: resolvedProperty.id,
  }
}
