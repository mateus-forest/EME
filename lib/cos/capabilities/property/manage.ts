import "server-only"

import { PropertyStatus } from "@/lib/prisma-enums"

import { formatCurrencyBRLFromCents } from "@/lib/currency"
import { resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { prisma } from "@/lib/prisma"

import {
  cleanText,
  extractPriceFromMessage,
  getPayloadRecord,
  requiredSelectionResponse,
} from "@/lib/cos/capabilities/shared"
import type { CosCapabilityHandler } from "@/lib/cos/types"

async function resolveProperty(input: {
  brokerId: string
  payload: Record<string, unknown>
  message?: string
}) {
  const resolution = await resolvePropertyEntity({
    brokerId: input.brokerId,
    payload: input.payload,
    message: input.message ?? "",
    take: 1,
  })

  return resolution.record
}

async function updatePropertyPublication(input: {
  brokerId: string
  payload: Record<string, unknown>
  published: boolean
  status: PropertyStatus
  responseLabel: string
}) {
  const property = await resolveProperty(input)
  if (!property) return requiredSelectionResponse("imóvel", "propertyId")

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      published: input.published,
      status: input.status,
    },
  })

  return {
    response: `${input.responseLabel}\n\n${updated.title}`,
    metadata: {
      propertyId: updated.id,
      published: updated.published,
      propertyStatus: updated.status,
      propertyTitle: updated.title,
    },
    propertyId: updated.id,
  }
}

export const publishPropertyCapability: CosCapabilityHandler = async ({ brokerId, payload }) =>
  updatePropertyPublication({
    brokerId,
    payload: getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload }),
    published: true,
    status: PropertyStatus.PUBLISHED,
    responseLabel: "Imóvel publicado com sucesso.",
  })

export const unpublishPropertyCapability: CosCapabilityHandler = async ({ brokerId, payload }) =>
  updatePropertyPublication({
    brokerId,
    payload: getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload }),
    published: false,
    status: PropertyStatus.PAUSED,
    responseLabel: "Imóvel pausado com sucesso.",
  })

export const updatePropertyMediaCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload })
  const property = await resolveProperty({ brokerId, payload: payloadRecord })
  if (!property) return requiredSelectionResponse("imóvel", "propertyId")

  const providedImages = Array.isArray(payloadRecord.imageUrls)
    ? payloadRecord.imageUrls.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []

  if (providedImages.length === 0) {
    return {
      response: `O imóvel ${property.title} tem ${Array.isArray(property.imageUrls) ? property.imageUrls.length : 0} mídia(s) cadastrada(s). Envie as novas URLs para eu atualizar esse conjunto.`,
      metadata: createPendingInputMetadata({
        field: "imageUrls",
        action: "UPDATE_PROPERTY_MEDIA",
        entity: "property",
        parsedData: { propertyId: property.id },
        extra: { propertyId: property.id },
      }),
      propertyId: property.id,
    }
  }

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      imageUrls: providedImages,
    },
  })

  return {
    response: `Mídias do imóvel atualizadas com sucesso.\n\n${updated.title}\nTotal de imagens: ${providedImages.length}`,
    metadata: {
      propertyId: updated.id,
      imageCount: providedImages.length,
    },
    propertyId: updated.id,
  }
}

export const suggestPropertyPriceCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const property = await resolveProperty({ brokerId, payload: payloadRecord, message })
  if (!property) return requiredSelectionResponse("imóvel", "propertyId")

  const comparableProperties = await prisma.property.findMany({
    where: {
      brokerId,
      id: { not: property.id },
      city: property.city,
      type: property.type,
      price: { gt: 0 },
    },
    select: {
      id: true,
      title: true,
      price: true,
      neighborhood: true,
    },
    take: 12,
  })

  const sameNeighborhood = comparableProperties.filter((item) => item.neighborhood && item.neighborhood === property.neighborhood)
  const baseList = sameNeighborhood.length >= 2 ? sameNeighborhood : comparableProperties
  const suggestedPrice = baseList.length
    ? Math.round(baseList.reduce((sum, item) => sum + item.price, 0) / baseList.length)
    : property.price
  const explicitPrice = extractPriceFromMessage(message)

  return {
    response: `Sugestão de preço para ${property.title}:\n\n- Faixa recomendada: ${formatCurrencyBRLFromCents(Math.round(suggestedPrice * 0.95))} a ${formatCurrencyBRLFromCents(Math.round(suggestedPrice * 1.05))}\n- Referência central: ${formatCurrencyBRLFromCents(suggestedPrice)}\n- Preço atual: ${formatCurrencyBRLFromCents(property.price)}${explicitPrice ? `\n- Valor citado na conversa: ${formatCurrencyBRLFromCents(explicitPrice)}` : ""}`,
    metadata: {
      propertyId: property.id,
      suggestedPrice,
      currentPrice: property.price,
      comparableCount: baseList.length,
    },
    propertyId: property.id,
  }
}

export const archivePropertyCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload })
  const property = await resolveProperty({ brokerId, payload: payloadRecord })
  if (!property) return requiredSelectionResponse("imóvel", "propertyId")

  const propertyTitle = cleanText(property.title, 160)

  await prisma.property.delete({
    where: { id: property.id },
  })

  return {
    response: `Imóvel excluído com sucesso.\n\n${propertyTitle}`,
    metadata: {
      propertyId: property.id,
      propertyTitle,
      deleted: true,
      published: false,
    },
    propertyId: property.id,
  }
}
