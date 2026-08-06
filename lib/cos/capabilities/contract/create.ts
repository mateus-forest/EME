import "server-only"

import { contractHtmlToText, createContractContent, parseContractContent, stringifyContractContent } from "@/lib/contract-template"
import { prisma } from "@/lib/prisma"

import { cleanText, getEntityIdFromPayload, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import { extractPersonName, extractPropertyReference, findLeadCandidates, findProposalPropertyCandidates, resolvePropertyChoice } from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function inferContractKind(message: string) {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (normalized.includes("locacao comercial") || normalized.includes("aluguel comercial")) return "Locacao comercial"
  if (normalized.includes("locacao") || normalized.includes("aluguel")) return "Locacao residencial"
  if (normalized.includes("autorizacao")) return "Autorizacao de venda"
  if (normalized.includes("exclusividade")) return "Exclusividade"
  if (normalized.includes("visita")) return "Termo de visita"
  if (normalized.includes("reserva")) return "Reserva"
  if (normalized.includes("aditivo")) return "Aditivo"
  if (normalized.includes("distrato")) return "Distrato"
  return "Compra e venda"
}

export const createContractCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingContext }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const personName = extractPersonName(message)
  const propertyReference = extractPropertyReference(message)
  const contractKind = inferContractKind(message)

  const selectedLeadId =
    pendingContext?.missingField === "lead" && Array.isArray(pendingContext.parsedData?.leadIds)
      ? cleanText((pendingContext.parsedData.leadIds as string[])[Math.max(0, Number.parseInt(message.replace(/\D/g, ""), 10) - 1)], 80)
      : getEntityIdFromPayload(payloadRecord, "lead")

  const matchingLeads = selectedLeadId
    ? await prisma.lead.findMany({ where: { brokerId, id: selectedLeadId }, take: 1, select: { id: true, name: true, phone: true, email: true } })
    : personName
      ? await findLeadCandidates(brokerId, personName, 4)
      : []

  if (!selectedLeadId && matchingLeads.length > 1) {
    return {
      response: `Encontrei mais de um cliente com esse nome. Qual deles devo usar?\n\n${matchingLeads.map((leadItem, index) => `${index + 1}. ${leadItem.name || "Sem nome"}${leadItem.phone ? ` - ${leadItem.phone}` : ""}`).join("\n")}`,
      metadata: {
        required: ["lead"],
        noCharge: true,
        parsedData: {
          personName,
          contractKind,
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
  if (!lead) {
    return {
      response: "Para qual cliente devo criar o contrato?",
      metadata: { required: ["lead"], noCharge: true, parsedData: { personName, contractKind } },
    }
  }

  const pendingOptions = Array.isArray(pendingContext?.parsedData?.propertyOptions) ? pendingContext?.parsedData?.propertyOptions as Array<{ id?: string; title?: string }> : []
  const selectedOption = pendingContext?.missingField === "propertyChoice" ? resolvePropertyChoice(message, pendingOptions) : null
  const selectedProperty =
    selectedOption?.id
      ? await prisma.property.findFirst({
          where: { brokerId, id: selectedOption.id },
          select: { id: true, publicCode: true, title: true, city: true, neighborhood: true, type: true, purpose: true, price: true, bedrooms: true, parkingSpots: true },
        })
      : null
  const propertyCandidates = selectedProperty ? [] : await findProposalPropertyCandidates(brokerId, message, propertyReference, 4)

  if (!selectedProperty && propertyCandidates.length > 1) {
    return {
      response: `Encontrei mais de um imóvel. Qual devo usar no contrato?\n\n${propertyCandidates.map((item, index) => `${index + 1}. ${item.publicCode ? `Imóvel ${item.publicCode} - ` : ""}${item.title} - ${item.city}`).join("\n")}`,
      metadata: {
        required: ["propertyChoice"],
        noCharge: true,
        parsedData: {
          personName,
          contractKind,
          propertyOptions: propertyCandidates.map((item) => ({ id: item.id, title: item.title })),
          options: propertyCandidates.map((item) => ({
            id: item.id,
            label: item.title,
            description: item.city,
          })),
        },
      },
    }
  }

  const resolvedProperty = selectedProperty ?? propertyCandidates[0] ?? null
  if (!resolvedProperty) {
    return {
      response: "Qual imóvel devo vincular a este contrato?",
      metadata: {
        required: ["property"],
        noCharge: true,
        parsedData: { personName, contractKind, leadId: lead.id },
      },
      leadId: lead.id,
    }
  }

  const broker = await prisma.broker.findUnique({ where: { id: brokerId }, include: { user: { select: { name: true, email: true } } } })
  const content = createContractContent({
    kind: contractKind,
    title: `Contrato ${contractKind} - ${lead.name || resolvedProperty.title}`,
    status: "draft",
    authorName: broker?.user.name ?? "",
    authorEmail: broker?.user.email ?? null,
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
    },
    property: {
      id: resolvedProperty.id,
      publicCode: resolvedProperty.publicCode,
      title: resolvedProperty.title,
      city: resolvedProperty.city,
      neighborhood: resolvedProperty.neighborhood,
      type: resolvedProperty.type,
      purpose: resolvedProperty.purpose,
      price: resolvedProperty.price,
      bedrooms: resolvedProperty.bedrooms,
      parkingSpots: resolvedProperty.parkingSpots,
    },
    financial: {
      amountCents: resolvedProperty.price,
    },
  })

  const document = await prisma.brokerDocument.create({
    data: {
      brokerId,
      leadId: lead.id,
      propertyId: resolvedProperty.id,
      type: "contract",
      title: content.title,
      content: stringifyContractContent(content),
      status: "draft",
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      title: "Contrato criado",
      message: `Contrato salvo como rascunho para ${lead.name || "cliente"} em Documentos > Contratos.`,
      read: false,
    },
  })

  return {
    response: `Contrato criado em rascunho.\nCliente: ${lead.name || "Cliente"}\nImóvel: ${resolvedProperty.publicCode ?? resolvedProperty.id}\nRevise, edite e exporte em Documentos > Contratos.`,
    metadata: {
      documentId: document.id,
      leadId: lead.id,
      propertyId: resolvedProperty.id,
      status: "draft",
    },
    leadId: lead.id,
    propertyId: resolvedProperty.id,
  }
}

export const listContractsCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const leadId = getEntityIdFromPayload(payloadRecord, "lead")
  const propertyId = getEntityIdFromPayload(payloadRecord, "property")
  const documents = await prisma.brokerDocument.findMany({
    where: {
      brokerId,
      type: "contract",
      ...(leadId ? { leadId } : {}),
      ...(propertyId ? { propertyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { property: { select: { title: true } } },
  })

  return {
    response: documents.length
      ? `Encontrei ${documents.length} contrato${documents.length === 1 ? "" : "s"}:\n\n${documents.map((document) => `- ${document.title}${document.property?.title ? ` - ${document.property.title}` : ""}`).join("\n")}`
      : "Nao encontrei contratos com esse filtro.",
    metadata: { documentIds: documents.map((document) => document.id), resultsCount: documents.length },
  }
}

export const getContractCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const contractId = getEntityIdFromPayload(payloadRecord, "contract")
  const contract = contractId
    ? await prisma.brokerDocument.findFirst({ where: { brokerId, id: contractId, type: "contract" } })
    : await prisma.brokerDocument.findFirst({ where: { brokerId, type: "contract" }, orderBy: { createdAt: "desc" } })

  if (!contract) return requiredSelectionResponse("contrato", "contractId")

  return {
    response: `${contract.title}\n\n${contractHtmlToText(parseContractContent(contract.content).html).slice(0, 1200)}`,
    metadata: { documentId: contract.id, resultsCount: 1 },
  }
}
