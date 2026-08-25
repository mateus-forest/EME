import "server-only"

import type { Prisma } from "@prisma/client"

import { canCreateBrokerProperties } from "@/lib/eme-plan-service"
import { looksLikeRawCommandSentence } from "@/lib/cos/entity-extraction"
import { createPendingInputMetadata } from "@/lib/cos/pending-input"
import { PropertyStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { extractPropertyPublicCode, findPropertyByBrokerPublicCode, getNextPropertyPublicCode } from "@/lib/property-public-code"

import { cleanText, getAttachmentsFromPayload } from "@/lib/cos/capabilities/shared"

const MAX_PROPERTY_INTEGER_VALUE = 2_147_483_647

type ParsedBrazilianMoney = {
  raw: string
  value: number
  outOfRange: boolean
}

export function normalizeForIntent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

// Quando ha anexo na conversa, lib/cos/attachment-analysis.ts concatena um bloco de instrucao
// interna ("IMPORTANTE: os anexos sao a fonte principal...") e a lista de arquivos ("Arquivos
// anexados:") ao final da mensagem antes dela chegar aqui. Extratores deterministicos (regex) nao
// devem ver esse bloco: o texto da instrucao contamina a extracao de localizacao (a captura
// gulosa cruza a quebra de linha e o match inteiro falha), e nomes de arquivo com sequencias
// numericas (ex: "WhatsApp Image 2026-08-04 at 20.26.13.jpeg") sao capturados como se fossem um
// preco. Cortar a mensagem no primeiro marcador desse bloco garante que so o texto real do
// usuario seja analisado.
const ATTACHMENT_BOILERPLATE_MARKER = /\n\s*(?:IMPORTANTE:|Arquivos anexados:)/i

export function stripAttachmentBoilerplate(message: string) {
  const markerIndex = message.search(ATTACHMENT_BOILERPLATE_MARKER)
  return markerIndex >= 0 ? message.slice(0, markerIndex).trim() : message
}

function parseNumericMoneyToken(raw: string, hasUnit: boolean) {
  const token = raw.trim()
  if (!token) return null
  if (token.includes(",")) return Number(token.replace(/\./g, "").replace(",", "."))
  if (token.includes(".") && hasUnit) return Number(token)
  if (token.includes(".")) return Number(token.replace(/\./g, ""))
  return Number(token)
}

// Retorna o valor em CENTAVOS — mesma unidade da coluna Property.price (Int) em todo o resto do
// app (ver lib/currency.ts formatCurrencyBRLFromCents/parseCurrencyInputToCents). Antes retornava
// reais direto, que era gravado sem conversao na coluna de centavos (preco 100x menor que o real,
// ex: "850 mil" virava R$ 8.500,00) e, no sentido inverso, formatAssessorPropertyPrice lia a coluna
// em centavos como se fosse reais (preco 100x maior que o real, ex: R$ 1.780.000 exibido como
// R$ 178.000.000). As duas pontas estao corrigidas juntas: aqui a conversao para centavos, e em
// formatAssessorPropertyPrice a divisao por 100 na leitura.
export function parseBrazilianMoney(input: unknown): ParsedBrazilianMoney | null {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    const value = Math.round(input * 100)
    return { raw: String(input), value, outOfRange: value > MAX_PROPERTY_INTEGER_VALUE }
  }
  if (typeof input !== "string") return null

  const normalized = normalizeForIntent(input)
  const match = normalized.match(/(?:r\$\s*)?(\d[\d.,]*)(?:\s*(milhao|milhoes|milhão|milhões|mil|k|mi))?\b/)
  if (!match) return null

  const raw = match[0].trim()
  const unit = match[2] ?? ""
  const numberPart = match[1]
  const hasUnit = Boolean(unit)
  const hasCurrency = /r\$/.test(raw)
  const numeric = parseNumericMoneyToken(numberPart, hasUnit)
  if (numeric === null || !Number.isFinite(numeric) || numeric < 0) return null
  // Sem "R$", unidade (mil/mi) ou separador decimal/milhar, um numero solto e uma aposta fraca de
  // que seja preco (pode ser um trecho de nome de arquivo, data, CEP etc.) — nenhum imovel real
  // custa menos de R$ 10 mil, entao esse e o piso minimo para aceitar um numero sem nenhum sinal de
  // que realmente representa dinheiro.
  if (!hasCurrency && !hasUnit && !/[.,]/.test(numberPart) && numeric < 10_000) return null

  const multiplier =
    unit === "mil" || unit === "k"
      ? 1000
      : unit === "mi" || unit.startsWith("milh")
        ? 1_000_000
        : 1

  const value = Math.round(numeric * multiplier * 100)
  return { raw, value, outOfRange: value > MAX_PROPERTY_INTEGER_VALUE }
}

export function parseBrazilianMoneyToInt(input: unknown) {
  const parsed = parseBrazilianMoney(input)
  return parsed && !parsed.outOfRange ? parsed.value : null
}

// value chega em centavos (mesma unidade de Property.price em todo o app) — antes formatava sem
// dividir por 100, exibindo o preco 100x maior que o real em qualquer resposta do COS que listasse
// imoveis (busca, selecao, resumo financeiro etc.).
export function formatAssessorPropertyPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value || 0) / 100)
}

function inferPropertyTypeFromText(message: string): string | null {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("casa")) return "HOUSE"
  if (normalized.includes("apartamento") || normalized.includes("apto")) return "APARTMENT"
  if (normalized.includes("terreno")) return "LAND"
  if (normalized.includes("sala")) return "OFFICE"
  if (normalized.includes("loja")) return "STORE"
  if (normalized.includes("cobertura")) return "PENTHOUSE"
  if (normalized.includes("comercial")) return "COMMERCIAL"
  return null
}

export function parsePropertyDraftData(rawMessage: string, payload?: Record<string, unknown>) {
  const message = stripAttachmentBoilerplate(rawMessage)
  const normalized = normalizeForIntent(message)
  const type = inferPropertyTypeFromText(message) ?? "APARTMENT"
  const cityMatch = normalized.match(/\b(?:em|cidade)\s+([\p{L}\s-]{3,60})(?:\s+(?:bairro|no|na|com|r\$|ate|até|venda|aluguel|locacao|locação|$)|$)/u)
  const centerCityMatch = normalized.match(/\b(?:no|na)\s+centro\s+de\s+([\p{L}\s-]{3,60})(?:\s+(?:com|r\$|ate|até|venda|aluguel|locacao|locação|$)|$)/u)
  const neighborhoodMatch =
    normalized.match(/\b(?:bairro|no bairro|no|na)\s+([\p{L}\s-]{3,60})(?:\s+(?:com|r\$|ate|até|venda|aluguel|locacao|locação|$)|$)/u) ??
    normalized.match(/\b(centro)\b/)
  const bedroomsMatch = normalized.match(/(\d+)\s*(?:quartos|dormitorios|dormitórios|dorms?)/)
  const bathroomsMatch = normalized.match(/(\d+)\s*(?:banheiros|banheiro|bwc)/)
  const parkingMatch = normalized.match(/(\d+)\s*(?:vagas|vaga|garagens|garagem)/)
  const areaMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|metros)/)
  const purpose = normalized.includes("aluguel") || normalized.includes("alugar") || normalized.includes("locacao") || normalized.includes("locação") ? "RENT" : "SALE"
  const features = ["piscina", "mobiliado", "patio", "pátio", "churrasqueira", "sacada", "suite", "suíte"]
    .filter((feature) => normalized.includes(normalizeForIntent(feature)))
  const typeLabel =
    type === "HOUSE" ? "Casa" :
    type === "LAND" ? "Terreno" :
    type === "OFFICE" ? "Sala comercial" :
    type === "STORE" ? "Loja" :
    type === "PENTHOUSE" ? "Cobertura" :
    type === "COMMERCIAL" ? "Comercial" :
    "Apartamento"

  const city = cleanText(payload?.city, 100) || cleanText(centerCityMatch?.[1], 100) || cleanText(cityMatch?.[1], 100) || "Não informada"
  const neighborhood = cleanText(payload?.neighborhood, 100) || (centerCityMatch ? "Centro" : cleanText(neighborhoodMatch?.[1], 100)) || null
  const bedrooms = Number(payload?.bedrooms) || (bedroomsMatch ? Number(bedroomsMatch[1]) : 0)
  const bathrooms = Number(payload?.bathrooms) || (bathroomsMatch ? Number(bathroomsMatch[1]) : 0)
  const parkingSpots = Number(payload?.parkingSpots ?? payload?.parking) || (parkingMatch ? Number(parkingMatch[1]) : 0)
  const area = cleanText(payload?.area, 40) || cleanText(areaMatch?.[0], 40)
  const parsedPrice = parseBrazilianMoney(payload?.price) ?? parseBrazilianMoney(message)
  const price = parsedPrice && !parsedPrice.outOfRange ? parsedPrice.value : 0
  const title = cleanText(payload?.title, 160) || [typeLabel, bedrooms ? `${bedrooms} dormitorios` : "", neighborhood ? `no ${neighborhood}` : ""].filter(Boolean).join(" ")
  const descriptionParts = [
    cleanText(payload?.description, 2000),
    area ? `Area informada: ${area}.` : "",
    features.length ? `Caracteristicas: ${features.join(", ")}.` : "",
  ].filter(Boolean)

  return {
    title: title || `${typeLabel} em rascunho`,
    city,
    neighborhood,
    price,
    parsedPriceRaw: parsedPrice?.raw ?? "",
    parsedPriceFinal: price || null,
    priceOutOfRange: parsedPrice?.outOfRange ?? false,
    bedrooms,
    bathrooms,
    parkingSpots,
    type,
    purpose,
    area,
    features,
    description: descriptionParts.join("\n"),
  }
}

export async function createPropertyDraftRecord(input: {
  brokerId: string
  userId: string
  message: string
  payload?: Record<string, unknown>
}) {
  const parsedDraft = parsePropertyDraftData(input.message, input.payload)
  const parsedPrice = parseBrazilianMoney(input.payload?.price) ?? parseBrazilianMoney(stripAttachmentBoilerplate(input.message))
  const draft = {
    ...parsedDraft,
    priceOutOfRange: parsedPrice?.outOfRange ?? false,
    parsedPriceRaw: parsedPrice?.raw ?? parsedDraft.parsedPriceRaw,
  }

  if (draft.priceOutOfRange) {
    return {
      response: "O valor informado parece alto demais. Pode confirmar o valor do imóvel?",
      metadata: createPendingInputMetadata({
        field: "price",
        action: "createPropertyDraft",
        entity: "property",
        parsedData: draft,
      }),
    }
  }

  const allowIncompleteDraft = input.payload?.allowIncompleteDraft === true
  if (!draft.price && !allowIncompleteDraft) {
    return {
      response: "Qual o valor do imóvel?",
      metadata: createPendingInputMetadata({
        field: "price",
        action: "createPropertyDraft",
        entity: "property",
        parsedData: draft,
      }),
    }
  }

  const propertyLimit = await canCreateBrokerProperties(input.brokerId)
  if (!propertyLimit.allowed) {
    return {
      response: propertyLimit.message,
      metadata: {
        noCharge: true,
        propertyLimit: propertyLimit.propertyLimit,
        propertyCount: propertyLimit.propertyCount,
        requested: propertyLimit.requested,
      },
    }
  }

  const missingFields = [
    draft.price ? "" : "preço",
    draft.city && draft.city !== "Não informada" ? "" : "cidade",
    draft.neighborhood ? "" : "bairro",
    draft.area ? "" : "metragem",
    draft.parkingSpots ? "" : "vagas",
  ].filter(Boolean)

  // O anexo de imagem chega em payload.attachments como dataUrl base64 — o pipeline do COS ainda
  // nao faz upload para um storage durável, entao nao existe outra fonte de URL disponivel aqui.
  // Sem isso o imovel sempre era criado com "Sem imagem cadastrada" mesmo com uma imagem de fato
  // anexada na conversa — o dado ja chegava ate aqui via payload, so nunca era lido.
  const imageUrls = getAttachmentsFromPayload(input.payload ?? {})
    .filter((attachment) => attachment.category === "image" && attachment.dataUrl)
    .map((attachment) => attachment.dataUrl as string)

  const publicCode = await getNextPropertyPublicCode(prisma, input.brokerId)
  const property = await prisma.property.create({
    data: {
      publicCode,
      title: draft.title || "Imovel em rascunho",
      city: draft.city || "Não informada",
      neighborhood: draft.neighborhood || null,
      price: draft.price,
      description: draft.description,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      parkingSpots: draft.parkingSpots,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      type: draft.type as never,
      purpose: draft.purpose,
      status: PropertyStatus.DRAFT,
      published: false,
      brokerId: input.brokerId,
    },
  })

  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: "Imovel criado em rascunho",
      message: "Revise antes de publicar.",
      read: false,
    },
  })

  return {
    response: `Imóvel criado em rascunho.\n${missingFields.length ? `\nPendências:\n- ${missingFields.join("\n- ")}\n` : "\n"}Revise antes de publicar.`,
    metadata: {
      propertyId: property.id,
      publicCode: property.publicCode,
      parsedData: draft,
      missingFields,
    },
    propertyId: property.id,
  }
}

function parsePropertySearchFilters(message: string) {
  const normalized = normalizeForIntent(message)
  const parsedPrice = parseBrazilianMoney(message)
  const cityMatch = normalized.match(/\b(?:em|na cidade de|cidade)\s+([\p{L}\s-]{3,60})(?:\s+(?:ate|até|com|no bairro|bairro|e|$)|$)/u)
  const neighborhoodMatch =
    normalized.match(/\b(?:bairro|no bairro|na regiao|regiao)\s+([\p{L}\s-]{3,60})(?:\s+(?:ate|até|com|e|$)|$)/u) ??
    normalized.match(/\b(?:no|na)\s+([\p{L}\s-]{3,60})(?:\s+(?:ate|até|com|e|$)|$)/u)
  const bedroomsMatch = normalized.match(/(\d+)\s*(?:quartos|dormitorios|dormitórios)/)
  const purpose = normalized.includes("aluguel") || normalized.includes("alugar") || normalized.includes("locacao") || normalized.includes("locação")
    ? "RENT"
    : normalized.includes("venda") || normalized.includes("comprar")
      ? "SALE"
      : null

  return {
    maxPrice: parsedPrice && !parsedPrice.outOfRange ? parsedPrice.value : null,
    parsedPriceRaw: parsedPrice?.raw ?? "",
    parsedPriceFinal: parsedPrice && !parsedPrice.outOfRange ? parsedPrice.value : null,
    priceOutOfRange: parsedPrice?.outOfRange ?? false,
    city: cleanText(cityMatch?.[1], 80),
    neighborhood: cleanText(neighborhoodMatch?.[1], 80),
    bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : null,
    type: inferPropertyTypeFromText(message),
    purpose,
  }
}

export async function searchBrokerProperties(brokerId: string, query: string, limit = 5) {
  const publicCode = extractPropertyPublicCode(query)
  if (publicCode) {
    const property = await prisma.property.findFirst({
      where: {
        brokerId,
        publicCode,
        OR: [{ published: true }, { status: PropertyStatus.PUBLISHED }],
      },
      orderBy: { updatedAt: "desc" },
    })
    return { results: property ? [property] : [], filters: { publicCode, codeSearch: true } }
  }

  const filters = parsePropertySearchFilters(query)
  if (filters.priceOutOfRange) {
    return { results: [], filters: { ...filters, blockedByPriceLimit: true } }
  }

  const terms = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2 && !["buscar", "busca", "quero", "imovel", "imoveis", "ate", "com", "para", "opcoes", "opções"].includes(term))

  const hasSpecificFilters = Boolean(filters.maxPrice || filters.city || filters.neighborhood || filters.type || filters.bedrooms)
  const activeWhere: Prisma.PropertyWhereInput = {
    brokerId,
    OR: [{ published: true }, { status: PropertyStatus.PUBLISHED }],
  }
  const baseFilterWhere: Prisma.PropertyWhereInput = {
    ...activeWhere,
    ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" as const } } : {}),
    ...(filters.neighborhood ? { neighborhood: { contains: filters.neighborhood, mode: "insensitive" as const } } : {}),
    ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}),
    ...(filters.type ? { type: filters.type as never } : {}),
    ...(filters.purpose ? { purpose: filters.purpose } : {}),
  }

  let usedRelaxedSearch = false
  let usedBroadSearch = false
  let properties = await prisma.property.findMany({
    where: baseFilterWhere,
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  if (properties.length === 0 && (filters.neighborhood || filters.bedrooms || filters.city)) {
    usedRelaxedSearch = true
    properties = await prisma.property.findMany({
      where: {
        ...activeWhere,
        ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
        ...(filters.type ? { type: filters.type as never } : {}),
        ...(filters.purpose ? { purpose: filters.purpose } : {}),
      },
      orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }],
      take: 30,
    })
  }

  if (properties.length === 0) {
    usedBroadSearch = true
    properties = await prisma.property.findMany({
      where: {
        ...activeWhere,
        ...(filters.type ? { type: filters.type as never } : {}),
      },
      orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }],
      take: 30,
    })
  }

  const results = properties
    .map((property) => {
      const haystack = [
        property.title,
        property.description ?? "",
        property.city,
        property.neighborhood ?? "",
        property.type,
        String(property.bedrooms),
        String(property.price),
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0)
      return { property, score }
    })
    .filter((item) => usedBroadSearch || terms.length === 0 || hasSpecificFilters || item.score > 0)
    .sort((first, second) => second.score - first.score || second.property.viewsCount - first.property.viewsCount)
    .slice(0, limit)
    .map(({ property }) => property)

  await prisma.searchEvent.create({
    data: {
      brokerId,
      query,
      filters: { ...filters, usedRelaxedSearch, usedBroadSearch },
      resultCount: results.length,
      source: "assessor_eme",
    },
  }).catch(() => {})

  return { results, filters: { ...filters, usedRelaxedSearch, usedBroadSearch } }
}

function normalizeComparableText(value: unknown) {
  return cleanText(value, 300)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function findLeadCandidates(brokerId: string, personName: string, take = 4) {
  const normalizedName = normalizeComparableText(personName)
  if (!normalizedName) return []
  const firstName = normalizedName.split(" ")[0] ?? normalizedName
  const candidates = await prisma.lead.findMany({
    where: {
      brokerId,
      OR: [
        { name: { contains: personName, mode: "insensitive" as const } },
        ...(firstName ? [{ name: { contains: firstName, mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, name: true, phone: true, email: true },
  })

  const filtered = candidates.filter((lead) => {
    const leadName = normalizeComparableText(lead.name)
    return leadName.includes(normalizedName) || leadName.split(" ")[0] === firstName
  })

  return (filtered.length ? filtered : candidates).slice(0, take)
}

// Nunca deve retornar texto de comando/instrucao como nome — mesma garantia de
// extractClientIdentity (lib/cos/entity-extraction.ts). Sem isso, uma mensagem sem "para X"
// reconhecivel (ex: cliente nao informado, ou a mensagem enriquecida com o bloco de instrucao de
// anexo) caia no fallback abaixo e devolvia a propria instrucao interna como "nome do cliente" da
// proposta gerada.
export function extractPersonName(rawMessage: string) {
  const message = stripAttachmentBoilerplate(rawMessage)
  const directMatch = message.match(/\bpara\s+([\p{L}]+(?:\s+[\p{L}]+)?)/iu)
  if (directMatch?.[1]) {
    const candidate = cleanText(directMatch[1].replace(/\b(?:no|na|do|da|imóvel|imovel|apartamento|casa|terreno)\b.*$/i, ""), 120)
    return looksLikeRawCommandSentence(candidate) ? "" : candidate
  }
  const cleaned = message
    .replace(/\b(gerar|gere|criar|crie|proposta|documento|contrato|para|do|da|no|na|imovel|imóvel)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  const fallback = cleanText(cleaned.split(/\s+(?:apartamento|casa|terreno|centro)\b/i)[0], 120)
  return looksLikeRawCommandSentence(fallback) ? "" : fallback
}

export function extractAgendaPersonName(message: string) {
  const match = message.match(/\b(?:com|para)\s+([\p{L}]+(?:\s+[\p{L}]+)?)/iu)
  return cleanText(match?.[1]?.replace(/\b(?:no|na|imóvel|imovel|apartamento|casa|terreno)\b.*$/i, ""), 120)
}

export function extractPropertyReference(message: string) {
  const normalized = normalizeForIntent(message)
  const parsedPrice = parseBrazilianMoney(message)
  const publicCode = extractPropertyPublicCode(message)
  const idMatch = normalized.match(/\b(?:imovel|codigo|id)\s+([a-z0-9-]{2,80})\b/)
  const neighborhoodMatch = normalized.match(/\b(?:apartamento|casa|terreno|imovel)?\s*(?:do|da|no|na)\s+([a-z\s-]{3,60})\b/)
  return {
    publicCode,
    idOrCode: cleanText(idMatch?.[1], 80),
    neighborhood: cleanText(neighborhoodMatch?.[1], 80),
    type: inferPropertyTypeFromText(message),
    price: parsedPrice && !parsedPrice.outOfRange ? parsedPrice.value : null,
    parsedPriceRaw: parsedPrice?.raw ?? "",
  }
}

export function firstImageUrl(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
}

function getDateOnly(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function parseAgendaDate(message: string) {
  const normalized = normalizeForIntent(message)
  const today = getDateOnly(new Date())
  if (normalized.includes("amanha")) return addDays(today, 1)
  if (normalized.includes("hoje")) return today

  const weekDays = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"]
  const targetWeekday = weekDays.findIndex((day) => normalized.includes(day))
  if (targetWeekday >= 0) {
    const current = today.getDay()
    const diff = (targetWeekday - current + 7) % 7 || 7
    return addDays(today, diff)
  }

  return today
}

export function parseAgendaTime(message: string) {
  const normalized = normalizeForIntent(message)
  const match =
    normalized.match(/\bas\s*(\d{1,2})(?:[:h]\s*(\d{2}))?\b/) ??
    normalized.match(/\b(\d{1,2})(?:[:h]\s*(\d{2})?| horas?)\b/)
  if (!match) return ""
  const hours = Math.min(23, Number(match[1])).toString().padStart(2, "0")
  const minutes = (match[2] ? Math.min(59, Number(match[2])) : 0).toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

export function parseAgendaType(message: string) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("visita")) return "visit"
  if (normalized.includes("lemb")) return "reminder"
  if (normalized.includes("evento")) return "event"
  return "task"
}

export function parseAgendaTitle(message: string) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("visita")) return "Visita"
  if (normalized.includes("ligar")) return "Ligar para cliente"
  if (normalized.includes("lemb")) return "Lembrete"
  return cleanText(message.replace(/\b(agendar|agenda|lembrar|criar|novo|nova|tarefa|evento)\b/gi, " "), 160) || "Compromisso"
}

export function formatAgendaDateLabel(message: string, date: Date) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("amanha")) return "amanha"
  if (normalized.includes("hoje")) return "hoje"
  return date.toLocaleDateString("pt-BR")
}

export function parseFixedAgendaListRange(message: string) {
  const normalized = normalizeForIntent(message)
  const start = normalized.includes("amanha") ? addDays(getDateOnly(new Date()), 1) : parseAgendaDate(message)
  const end = new Date(start)
  end.setDate(start.getDate() + (normalized.includes("mes") || normalized.includes("mês") ? 31 : normalized.includes("semana") ? 7 : 1))
  const pendingOnly = /\b(pendente|pendentes|abertos|em aberto)\b/.test(normalized)
  const label = pendingOnly
    ? "pendente"
    : normalized.includes("amanha")
      ? "de amanha"
      : normalized.includes("semana")
        ? "da proxima semana"
        : normalized.includes("mes") || normalized.includes("mês")
          ? "do proximo mes"
          : normalized.includes("hoje")
            ? "de hoje"
            : `de ${formatAgendaDateLabel(message, start)}`
  return { start, end, label, pendingOnly }
}

export function resolvePropertyChoice(message: string, options: Array<{ id?: string; title?: string }>) {
  const normalized = normalizeForIntent(message)
  const index =
    /^\d+$/.test(normalized) ? Number(normalized) - 1 :
    normalized.includes("primeiro") ? 0 :
    normalized.includes("segundo") ? 1 :
    normalized.includes("terceiro") ? 2 :
    -1
  if (index >= 0 && options[index]) return options[index]
  return options.find((option) => option.title && normalizeForIntent(option.title).includes(normalized)) ?? null
}

export async function findProposalPropertyCandidates(
  brokerId: string,
  message: string,
  propertyReference: { publicCode?: number | null; idOrCode?: string; neighborhood?: string; type?: string | null; price?: number | null },
  take = 4,
) {
  if (propertyReference.publicCode) {
    const property = await findPropertyByBrokerPublicCode(prisma, brokerId, propertyReference.publicCode)
    return property ? [property] : []
  }

  const normalized = normalizeForIntent(message)
  const price = propertyReference.price ?? parseBrazilianMoneyToInt(message)
  const words = normalized
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["gerar", "criar", "fazer", "proposta", "para", "imovel", "imoveis", "apartamento", "casa"].includes(word))

  const OR: Prisma.PropertyWhereInput[] = [
    ...(propertyReference.idOrCode ? [{ id: propertyReference.idOrCode }, { title: { contains: propertyReference.idOrCode, mode: "insensitive" as const } }] : []),
    ...(propertyReference.neighborhood ? [
      { neighborhood: { contains: propertyReference.neighborhood, mode: "insensitive" as const } },
      { title: { contains: propertyReference.neighborhood, mode: "insensitive" as const } },
      { description: { contains: propertyReference.neighborhood, mode: "insensitive" as const } },
    ] : []),
    ...words.slice(0, 4).flatMap((word) => [
      { title: { contains: word, mode: "insensitive" as const } },
      { neighborhood: { contains: word, mode: "insensitive" as const } },
      { city: { contains: word, mode: "insensitive" as const } },
      { description: { contains: word, mode: "insensitive" as const } },
    ]),
    ...(propertyReference.type ? [{ type: propertyReference.type as never }] : []),
  ]

  const AND: Prisma.PropertyWhereInput[] = []
  if (price) {
    AND.push({
      price: {
        gte: Math.round(price * 0.9),
        lte: Math.round(price * 1.1),
      },
    })
  }
  if (propertyReference.type) {
    AND.push({ type: propertyReference.type as never })
  }
  if (OR.length) AND.push({ OR })

  return prisma.property.findMany({
    where: { brokerId, ...(AND.length ? { AND } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take,
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
}
