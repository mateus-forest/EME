import type { Prisma } from "@prisma/client"

import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPropertyDraftRecord, formatAssessorPropertyPrice, searchBrokerProperties } from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function json(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject
}

export const createPropertyDraftCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload }) => {
  return createPropertyDraftRecord({
    brokerId,
    userId,
    message,
    payload: payload ?? undefined,
  })
}

export const searchPropertiesCapability: CosCapabilityHandler = async ({ brokerId, message, pendingInput }) => {
  if (pendingInput?.action === "searchProperties" && pendingInput.field === "propertyChoice") {
    const resolution = await resolvePropertyEntity({
      brokerId,
      message,
      payload: {},
      pendingField: "propertyChoice",
      pendingData: pendingInput.parsedData ?? {},
      take: 1,
    })

    if (resolution.record) {
      const property = resolution.record
      return {
        response: `ImÃ³vel ${property.publicCode ?? "-"} â€” ${property.title}\n${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""} â€” ${formatAssessorPropertyPrice(property.price)}\n\nQuer gerar proposta ou ver detalhes?`,
        metadata: json({ propertyId: property.id, publicCode: property.publicCode }),
        propertyId: property.id,
      }
    }
  }

  const searchResult = await searchBrokerProperties(brokerId, message)
  const properties = searchResult.results
  const filters = searchResult.filters as Record<string, unknown>
  if (filters.priceOutOfRange === true) {
    return {
      response: "O valor informado parece alto demais. Pode confirmar a faixa de preÃ§o?",
      metadata: createPendingInputMetadata({
        field: "price",
        action: "searchProperties",
        entity: "property",
        parsedData: { query: message },
      }),
    }
  }

  if (properties.length === 0) {
    return {
      response: "NÃ£o encontrei imÃ³veis com esse filtro.",
      metadata: json({ resultCount: 0, parsedData: searchResult.filters as Record<string, unknown> }),
    }
  }

  if (properties.length === 1) {
    const property = properties[0]
    return {
      response: `ImÃ³vel ${property.publicCode ?? "-"} â€” ${property.title}\n${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""} â€” ${formatAssessorPropertyPrice(property.price)}\n\nQuer gerar proposta ou ver detalhes?`,
      metadata: json({
        propertyId: property.id,
        publicCode: property.publicCode,
        resultCount: 1,
      }),
      propertyId: property.id,
    }
  }

  return {
    response: `Encontrei mais de um imÃ³vel. Qual deseja abrir?\n\n${properties.map((item, index) => `${index + 1}. ${item.title} â€” ${item.neighborhood ?? item.city} â€” ${formatAssessorPropertyPrice(item.price)}`).join("\n")}`,
    metadata: createPendingInputMetadata({
      field: "propertyChoice",
      action: "searchProperties",
      entity: "property",
      parsedData: {
        propertyOptions: properties.map((item) => ({ id: item.id, title: item.title })),
        options: properties.map((item) => ({
          id: item.id,
          label: item.title,
          description: `${item.neighborhood ?? item.city} - ${formatAssessorPropertyPrice(item.price)}`,
        })),
      },
      extra: {
        propertyIds: properties.map((item) => item.id),
      },
    }),
  }
}

export const improvePropertyDescriptionCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const propertyId = typeof payload?.propertyId === "string" ? payload.propertyId : ""
  const property = propertyId
    ? (await searchBrokerProperties(brokerId, propertyId, 1)).results[0]
    : (await searchBrokerProperties(brokerId, message, 1)).results[0]

  return {
    response: property
      ? `Base para melhoria: ${property.title}. DescriÃ§Ã£o atual: ${property.description || "sem descriÃ§Ã£o cadastrada"}.`
      : "Posso melhorar a descriÃ§Ã£o, mas preciso que vocÃª informe o imÃ³vel ou envie a descriÃ§Ã£o atual.",
    metadata: json({ propertyId: property?.id ?? null }),
    propertyId: property?.id,
  }
}
