import type { Prisma } from "@prisma/client"

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

export const searchPropertiesCapability: CosCapabilityHandler = async ({ brokerId, message, pendingContext }) => {
  if (pendingContext?.action === "searchProperties" && pendingContext.missingField === "propertyChoice") {
    const propertyOptions = Array.isArray(pendingContext.parsedData?.propertyOptions)
      ? pendingContext.parsedData.propertyOptions as Array<{ id?: string; title?: string }>
      : []
    const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    const index =
      /^\d+$/.test(normalized) ? Number(normalized) - 1 :
      normalized.includes("primeiro") ? 0 :
      normalized.includes("segundo") ? 1 :
      normalized.includes("terceiro") ? 2 :
      -1
    const selected = index >= 0 ? propertyOptions[index] : propertyOptions.find((item) => item.title?.toLowerCase().includes(normalized))

    if (selected?.id) {
      const { results } = await searchBrokerProperties(brokerId, selected.title ?? message, 1)
      const property = results.find((item) => item.id === selected.id) ?? results[0]
      if (property) {
        return {
          response: `Imóvel ${property.publicCode ?? "-"} — ${property.title}\n${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""} — ${formatAssessorPropertyPrice(property.price)}\n\nQuer gerar proposta ou ver detalhes?`,
          metadata: json({ propertyId: property.id, publicCode: property.publicCode }),
          propertyId: property.id,
        }
      }
    }
  }

  const searchResult = await searchBrokerProperties(brokerId, message)
  const properties = searchResult.results
  const filters = searchResult.filters as Record<string, unknown>
  if (filters.priceOutOfRange === true) {
    return {
      response: "O valor informado parece alto demais. Pode confirmar a faixa de preço?",
      metadata: json({
        required: ["price"],
        noCharge: true,
        parsedData: { query: message },
      }),
    }
  }

  if (properties.length === 0) {
    return {
      response: "Não encontrei imóveis com esse filtro.",
      metadata: json({ resultCount: 0, parsedData: searchResult.filters as Record<string, unknown> }),
    }
  }

  if (properties.length === 1) {
    const property = properties[0]
    return {
      response: `Imóvel ${property.publicCode ?? "-"} — ${property.title}\n${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""} — ${formatAssessorPropertyPrice(property.price)}\n\nQuer gerar proposta ou ver detalhes?`,
      metadata: json({
        propertyId: property.id,
        publicCode: property.publicCode,
        resultCount: 1,
      }),
      propertyId: property.id,
    }
  }

  return {
    response: `Encontrei mais de um imóvel. Qual deseja abrir?\n\n${properties.map((item, index) => `${index + 1}. ${item.title} — ${item.neighborhood ?? item.city} — ${formatAssessorPropertyPrice(item.price)}`).join("\n")}`,
    metadata: json({
      required: ["propertyChoice"],
      noCharge: true,
      propertyIds: properties.map((item) => item.id),
      parsedData: {
        propertyOptions: properties.map((item) => ({ id: item.id, title: item.title })),
        options: properties.map((item) => ({
          id: item.id,
          label: item.title,
          description: `${item.neighborhood ?? item.city} - ${formatAssessorPropertyPrice(item.price)}`,
        })),
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
      ? `Base para melhoria: ${property.title}. Descrição atual: ${property.description || "sem descrição cadastrada"}.`
      : "Posso melhorar a descrição, mas preciso que você informe o imóvel ou envie a descrição atual.",
    metadata: json({ propertyId: property?.id ?? null }),
    propertyId: property?.id,
  }
}
