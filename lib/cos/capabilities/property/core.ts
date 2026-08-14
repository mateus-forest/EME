import type { Prisma } from "@prisma/client"

import { createCosErrorResult, normalizeCosActionResult } from "@/lib/cos/action-result"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPropertyDraftRecord, formatAssessorPropertyPrice, searchBrokerProperties } from "@/lib/cos/runtime-helpers"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function json(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject
}

// Junta titulo/localizacao/preco com " — ", omitindo qualquer parte vazia (e o separador junto)
// em vez de deixar um traço solto quando o imovel nao tem cidade/bairro cadastrado.
function formatPropertyListingLine(parts: Array<string | null | undefined>) {
  return parts.filter((part) => Boolean(part && part.trim())).join(" — ")
}

function formatPropertyLocationLabel(city?: string | null, neighborhood?: string | null) {
  return [city, neighborhood].filter((part) => Boolean(part && part.trim())).join(", ")
}

export const createPropertyDraftCapability: CosCapabilityHandler = async ({ brokerId, userId, message, payload }) => {
  const legacyResult = await createPropertyDraftRecord({
    brokerId,
    userId,
    message,
    payload: payload ?? undefined,
  })
  const result = normalizeCosActionResult({
    result: legacyResult,
    action: "createPropertyDraft",
    entity: "property",
  })
  if (result.status === "success" && typeof result.metadata.propertyLimit === "number") {
    return createCosErrorResult({
      errorCode: "COS_PROPERTY_LIMIT_REACHED",
      response: result.response,
      metadata: result.metadata,
    })
  }
  return result
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
        response: `Imóvel ${property.publicCode ?? "-"} — ${property.title}\n${formatPropertyListingLine([
          formatPropertyLocationLabel(property.city, property.neighborhood),
          formatAssessorPropertyPrice(property.price),
        ])}\n\nQuer gerar proposta ou ver detalhes?`,
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
      response: "O valor informado parece alto demais. Pode confirmar a faixa de preço?",
      metadata: createPendingInputMetadata({
        field: "price",
        action: "searchProperties",
        entity: "property",
        parsedData: { query: message },
      }),
    }
  }

  if (properties.length === 0) {
    // Antes terminava aqui sem pedir nada a mais — beco sem saida para o usuario. Pede os
    // detalhes que ainda faltam (cidade/preco/tipo, o que a extracao ja nao conseguiu achar no
    // texto) para dar uma proxima busca com chance real de encontrar algo.
    const missingDetails = [
      filters.city ? "" : "cidade",
      filters.maxPrice ? "" : "faixa de preço",
      filters.type ? "" : "tipo de imóvel (apartamento, casa, terreno...)",
    ].filter(Boolean)

    return {
      response: `Não encontrei imóveis com esse filtro.\n\nPode me dar mais detalhes? Por exemplo: ${missingDetails.join(", ")}.`,
      metadata: createPendingInputMetadata({
        field: "query",
        action: "searchProperties",
        entity: "property",
        parsedData: { previousQuery: message, previousFilters: searchResult.filters as Record<string, unknown> },
      }),
    }
  }

  if (properties.length === 1) {
    const property = properties[0]
    return {
      response: `Imóvel ${property.publicCode ?? "-"} — ${property.title}\n${formatPropertyListingLine([
        formatPropertyLocationLabel(property.city, property.neighborhood),
        formatAssessorPropertyPrice(property.price),
      ])}\n\nQuer gerar proposta ou ver detalhes?`,
      metadata: json({
        propertyId: property.id,
        publicCode: property.publicCode,
        resultCount: 1,
      }),
      propertyId: property.id,
    }
  }

  return {
    response: `Encontrei mais de um imóvel. Qual deseja abrir?\n\n${properties.map((item, index) => `${index + 1}. ${formatPropertyListingLine([item.title, formatPropertyLocationLabel(item.city, item.neighborhood), formatAssessorPropertyPrice(item.price)])}`).join("\n")}`,
    metadata: createPendingInputMetadata({
      field: "propertyChoice",
      action: "searchProperties",
      entity: "property",
      parsedData: {
        propertyOptions: properties.map((item) => ({ id: item.id, title: item.title })),
        options: properties.map((item) => ({
          id: item.id,
          label: item.title,
          description: formatPropertyListingLine([formatPropertyLocationLabel(item.city, item.neighborhood), formatAssessorPropertyPrice(item.price)]),
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
      ? `Base para melhoria: ${property.title}. Descrição atual: ${property.description || "sem descrição cadastrada"}.`
      : "Posso melhorar a descrição, mas preciso que você informe o imóvel ou envie a descrição atual.",
    metadata: json({ propertyId: property?.id ?? null }),
    propertyId: property?.id,
  }
}
