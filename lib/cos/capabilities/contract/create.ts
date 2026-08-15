import "server-only"

import { contractHtmlToText, createContractContent, parseContractContent, stringifyContractContent } from "@/lib/contract-template"
import { prisma } from "@/lib/prisma"

import { cleanText, getEntityIdFromPayload, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import { resolveContractEntity, resolveLeadEntity, resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
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

export const createContractCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload, pendingInput }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId, message, action: "general", payload })
  const pendingData = pendingInput?.action === "CREATE_CONTRACT" ? pendingInput.parsedData ?? {} : {}
  const pendingOptions = pendingInput?.action === "CREATE_CONTRACT" ? pendingInput.options ?? null : null
  const contractKind = inferContractKind(message)

  const leadResolution = await resolveLeadEntity({
    brokerId,
    message,
    payload: payloadRecord,
    pendingField: pendingInput?.field ?? null,
    pendingData: { ...pendingData, contractKind },
    pendingOptions,
    take: 4,
  })

  if ((leadResolution.recordIds?.length ?? 0) > 1 && leadResolution.options) {
    return {
      response: `Encontrei mais de um cliente com esse nome. Qual deles devo usar?\n\n${leadResolution.options.map((option, index) => `${index + 1}. ${option.label}${option.description ? ` - ${option.description}` : ""}`).join("\n")}`,
      metadata: createPendingInputMetadata({
        field: "lead",
        action: "CREATE_CONTRACT",
        entity: "contract",
        parsedData: {
          ...leadResolution.parsedData,
          contractKind,
          leadIds: leadResolution.recordIds ?? [],
        },
        options: leadResolution.options,
      }),
    }
  }

  const lead = leadResolution.record
  if (!lead) {
    return {
      response: "Para qual cliente devo criar o contrato?",
      metadata: createPendingInputMetadata({
        field: "lead",
        action: "CREATE_CONTRACT",
        entity: "contract",
        parsedData: {
          ...leadResolution.parsedData,
          contractKind,
        },
      }),
    }
  }

  const propertyResolution = await resolvePropertyEntity({
    brokerId,
    message,
    payload: payloadRecord,
    pendingField: pendingInput?.field ?? null,
    pendingData: {
      ...pendingData,
      contractKind,
      leadId: lead.id,
      personName: cleanText(leadResolution.parsedData?.personName, 120),
    },
    take: 4,
  })

  if ((propertyResolution.recordIds?.length ?? 0) > 1 && propertyResolution.options) {
    return {
      response: `Encontrei mais de um imóvel. Qual devo usar no contrato?\n\n${propertyResolution.options.map((option, index) => `${index + 1}. ${option.label}${option.description ? ` - ${option.description}` : ""}`).join("\n")}`,
      metadata: createPendingInputMetadata({
        field: "propertyChoice",
        action: "CREATE_CONTRACT",
        entity: "contract",
        parsedData: propertyResolution.parsedData,
        options: propertyResolution.options,
      }),
    }
  }

  const resolvedProperty = propertyResolution.record
  if (!resolvedProperty) {
    return {
      response: "Qual imóvel devo vincular a este contrato?",
      metadata: createPendingInputMetadata({
        field: "property",
        action: "CREATE_CONTRACT",
        entity: "contract",
        parsedData: propertyResolution.parsedData,
      }),
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
      : "Não encontrei contratos com esse filtro.",
    metadata: { documentIds: documents.map((document) => document.id), resultsCount: documents.length },
  }
}

export const getContractCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const resolution = await resolveContractEntity({ brokerId, payload: payloadRecord, message })
  const contract = resolution.record

  if (!contract) return requiredSelectionResponse("contrato", "contractId")

  return {
    response: `${contract.title}\n\n${contractHtmlToText(parseContractContent(contract.content).html).slice(0, 1200)}`,
    metadata: { documentId: contract.id, resultsCount: 1 },
  }
}
