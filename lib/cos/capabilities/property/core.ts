import type { Prisma } from "@prisma/client"

import { createCosErrorResult, createCosSuccessResult, normalizeCosActionResult } from "@/lib/cos/action-result"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { resolveLeadEntity, resolvePropertyEntity } from "@/lib/cos/entity-resolver"
import { createPropertyDraftRecord, formatAssessorPropertyPrice, searchBrokerProperties } from "@/lib/cos/runtime-helpers"
import { prisma } from "@/lib/prisma"
import { parsePropertyLegalData } from "@/lib/legal-entities"
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

export const searchPropertiesCapability: CosCapabilityHandler = async ({ brokerId, message, payload, pendingInput, context }) => {
  let searchMessage = message
  let selectedLead: { id: string; name: string | null } | null = context?.selectedEntityIds.lead
    ? {
        id: context.selectedEntityIds.lead,
        name: context.snapshot?.activeEntities.lead?.label ?? null,
      }
    : null

  if (pendingInput?.action === "searchProperties" && pendingInput.field === "lead") {
    const leadResolution = await resolveLeadEntity({
      brokerId,
      message,
      payload: payload ?? {},
      pendingField: pendingInput.field,
      pendingData: pendingInput.parsedData,
      pendingOptions: pendingInput.options,
    })

    if (!leadResolution.record) {
      return {
        response: leadResolution.options?.length
          ? "Encontrei mais de um cliente. Qual deles está procurando o imóvel?"
          : "Não encontrei esse cliente. Pode informar o nome completo?",
        metadata: createPendingInputMetadata({
          field: "lead",
          action: "searchProperties",
          entity: "property",
          capabilityId: "property.search",
          reason: "property_search_client_missing",
          parsedData: pendingInput.parsedData,
          options: leadResolution.options ?? pendingInput.options,
        }),
      }
    }

    selectedLead = leadResolution.record
    searchMessage = typeof pendingInput.parsedData.searchQuery === "string"
      ? pendingInput.parsedData.searchQuery
      : message
  } else if (
    context?.decision?.secondaryDomains.includes("lead") &&
    !context.selectedEntityIds.lead
  ) {
    const recentLeads = await prisma.lead.findMany({
      where: { brokerId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, phone: true },
    })

    return {
      response: "Qual cliente está procurando esse imóvel?",
      metadata: createPendingInputMetadata({
        field: "lead",
        action: "searchProperties",
        entity: "property",
        capabilityId: "property.search",
        reason: "property_search_client_missing",
        parsedData: { searchQuery: message },
        options: recentLeads.map((lead) => ({
          id: lead.id,
          label: lead.name ?? "Cliente sem nome",
          description: lead.phone ?? undefined,
        })),
      }),
    }
  }

  if (!selectedLead && pendingInput?.action === "searchProperties" && typeof pendingInput.parsedData.leadId === "string") {
    selectedLead = {
      id: pendingInput.parsedData.leadId,
      name: typeof pendingInput.parsedData.leadName === "string" ? pendingInput.parsedData.leadName : null,
    }
  }

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
        metadata: json({
          propertyId: property.id,
          publicCode: property.publicCode,
          ...(selectedLead ? { leadId: selectedLead.id, leadName: selectedLead.name } : {}),
        }),
        propertyId: property.id,
        leadId: selectedLead?.id,
      }
    }
  }

  if (pendingInput?.action === "searchProperties" && (pendingInput.field === "query" || pendingInput.field === "price")) {
    const previousQuery = typeof pendingInput.parsedData.previousQuery === "string"
      ? pendingInput.parsedData.previousQuery
      : typeof pendingInput.parsedData.query === "string"
        ? pendingInput.parsedData.query
        : ""
    searchMessage = [previousQuery, message].filter(Boolean).join(" ")
  }

  const searchResult = await searchBrokerProperties(brokerId, searchMessage)
  const properties = searchResult.results
  const filters = searchResult.filters as Record<string, unknown>
  if (filters.priceOutOfRange === true) {
    return {
      response: "O valor informado parece alto demais. Pode confirmar a faixa de preço?",
      metadata: createPendingInputMetadata({
        field: "price",
        action: "searchProperties",
        entity: "property",
        parsedData: {
          query: searchMessage,
          ...(selectedLead ? { leadId: selectedLead.id, leadName: selectedLead.name } : {}),
        },
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
        parsedData: {
          previousQuery: searchMessage,
          previousFilters: searchResult.filters as Record<string, unknown>,
          ...(selectedLead ? { leadId: selectedLead.id, leadName: selectedLead.name } : {}),
        },
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
        ...(selectedLead ? { leadId: selectedLead.id, leadName: selectedLead.name } : {}),
      }),
      propertyId: property.id,
      leadId: selectedLead?.id,
    }
  }

  return {
    response: `Encontrei mais de um imóvel. Qual deseja abrir?\n\n${properties.map((item, index) => `${index + 1}. ${formatPropertyListingLine([item.title, formatPropertyLocationLabel(item.city, item.neighborhood), formatAssessorPropertyPrice(item.price)])}`).join("\n")}`,
    metadata: createPendingInputMetadata({
      field: "propertyChoice",
      action: "searchProperties",
      entity: "property",
      parsedData: {
        ...(selectedLead ? { leadId: selectedLead.id, leadName: selectedLead.name } : {}),
        propertyOptions: properties.map((item) => ({ id: item.id, title: item.title })),
        options: properties.map((item) => ({
          id: item.id,
          label: item.title,
          description: formatPropertyListingLine([formatPropertyLocationLabel(item.city, item.neighborhood), formatAssessorPropertyPrice(item.price)]),
        })),
      },
      extra: {
        propertyIds: properties.map((item) => item.id),
        ...(selectedLead ? { leadId: selectedLead.id, leadName: selectedLead.name } : {}),
      },
    }),
  }
}

export const getPropertyCapability: CosCapabilityHandler = async ({ brokerId, payload, context }) => {
  const propertyId = typeof payload?.propertyId === "string"
    ? payload.propertyId
    : context?.selectedEntityIds.property
  if (!propertyId) {
    return createCosErrorResult({
      errorCode: "COS_PROPERTY_REFERENCE_REQUIRED",
      response: "Preciso saber qual imóvel você quer consultar.",
      metadata: { noCharge: true },
    })
  }
  const property = await prisma.property.findFirst({
    where: { id: propertyId, brokerId },
  })
  if (!property) {
    return createCosErrorResult({
      errorCode: "COS_PROPERTY_NOT_FOUND",
      response: "Não encontrei esse imóvel na sua carteira.",
      metadata: { propertyId, noCharge: true },
    })
  }
  const legal = parsePropertyLegalData(property.legalData)
  const area = legal.privateArea || legal.totalArea || null

  const details = [
    area ? (/m[²2]/i.test(area) ? area : `${area} m²`) : null,
    property.bedrooms ? `${property.bedrooms} quarto${property.bedrooms === 1 ? "" : "s"}` : null,
    property.bathrooms ? `${property.bathrooms} banheiro${property.bathrooms === 1 ? "" : "s"}` : null,
    property.parkingSpots ? `${property.parkingSpots} vaga${property.parkingSpots === 1 ? "" : "s"}` : null,
  ].filter(Boolean)
  return createCosSuccessResult({
    response: `${property.title}\n${formatPropertyLocationLabel(property.city, property.neighborhood)}\n${formatAssessorPropertyPrice(property.price)}${details.length ? `\n${details.join(" • ")}` : ""}`,
    metadata: {
      propertyId: property.id,
      publicCode: property.publicCode,
      area,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parkingSpots: property.parkingSpots,
      city: property.city,
      neighborhood: property.neighborhood,
    },
    propertyId: property.id,
  })
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
