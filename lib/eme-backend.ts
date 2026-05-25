import { LeadStatus, PropertyStatus, PropertyType } from "@/lib/prisma-enums"

import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { prisma } from "@/lib/prisma"
import { buildProposalHtml, proposalHtmlToText } from "@/lib/proposal-template"

export const assessorActions = [
  "general",
  "createLead",
  "searchProperties",
  "createPropertyDraft",
  "improvePropertyDescription",
  "summarizeLead",
  "analyzeCatalog",
  "createInternalNotification",
  "getFinancialSummary",
  "getAnalyticsSummary",
  "getCatalogSummary",
  "getLeadsSummary",
  "CREATE_AGENDA_EVENT",
  "LIST_AGENDA_EVENTS",
  "MARK_AGENDA_DONE",
  "CREATE_PROPOSAL",
  "LIST_DOCUMENTS",
  "GET_DOCUMENT",
] as const

export type AssessorAction = (typeof assessorActions)[number]

const assessorActionRegistry: Record<AssessorAction, { visualAction: string; futureReady?: boolean }> = {
  general: { visualAction: "Atendimento do Assessor" },
  createLead: { visualAction: "Lead cadastrado" },
  searchProperties: { visualAction: "Busca de imóveis" },
  createPropertyDraft: { visualAction: "Rascunho de imóvel" },
  improvePropertyDescription: { visualAction: "Descrição melhorada" },
  summarizeLead: { visualAction: "Resumo de atendimentos" },
  analyzeCatalog: { visualAction: "Catálogo analisado" },
  createInternalNotification: { visualAction: "Notificação interna" },
  getFinancialSummary: { visualAction: "Consulta financeira" },
  getAnalyticsSummary: { visualAction: "Consulta de analytics" },
  getCatalogSummary: { visualAction: "Resumo do catálogo" },
  getLeadsSummary: { visualAction: "Resumo de leads" },
  CREATE_AGENDA_EVENT: { visualAction: "Compromisso criado", futureReady: true },
  LIST_AGENDA_EVENTS: { visualAction: "Consulta de agenda", futureReady: true },
  MARK_AGENDA_DONE: { visualAction: "Compromisso concluído", futureReady: true },
  CREATE_PROPOSAL: { visualAction: "Proposta gerada", futureReady: true },
  LIST_DOCUMENTS: { visualAction: "Consulta de documentos", futureReady: true },
  GET_DOCUMENT: { visualAction: "Documento consultado", futureReady: true },
}

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

export function normalizePhone(value: unknown) {
  return cleanText(value, 40).replace(/[^\d+]/g, "")
}

export function getAssessorVisualAction(action: AssessorAction) {
  return assessorActionRegistry[action]?.visualAction ?? "Ação do Assessor"
}

function normalizeForIntent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

const ASSESSOR_MENU_RESPONSE =
  "Olá! Sou o Assessor EME 😊\n\nPosso te ajudar com:\n• cadastrar leads\n• cadastrar imóveis em rascunho\n• buscar imóveis\n• agendar visitas e lembretes\n• consultar agenda\n• gerar propostas\n• consultar documentos\n• ver informações de leads, catálogo, analytics e financeiro\n\nExemplos:\nCadastrar lead: João Silva 54999999999\nCadastrar imóvel: apartamento 3 quartos no Centro, R$ 650 mil, venda\nBuscar imóvel: casa até 600 mil em Vacaria\nAgendar visita amanhã às 15h com João\nMinha agenda de hoje\nGerar proposta para João no imóvel 142\nResumo dos leads\nComo está meu catálogo?"

const ASSESSOR_FALLBACK_RESPONSE =
  "Não consegui identificar o pedido.\n\nVocê pode mandar assim:\n• Cadastrar lead: João Silva 54999999999\n• Buscar imóvel: casa até 600 mil\n• Agendar visita amanhã às 15h\n• Gerar proposta para João no imóvel 142"

function isAssessorGreeting(message: string) {
  const normalized = normalizeForIntent(message).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|ajuda|menu|help)$/.test(normalized)
}

function isLikelyUnknownAssessorMessage(message: string, action: AssessorAction) {
  if (action !== "general") return false
  const normalized = normalizeForIntent(message).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return false
  if (isAssessorGreeting(message)) return false
  if (/\b(lead|contato|cliente|imovel|imoveis|casa|apartamento|apto|terreno|sala|loja|cobertura|descricao|anuncio|catalogo|financeiro|analytics|resumo|atendimento)\b/.test(normalized)) return false
  return normalized.length <= 24
}

function extractLeadData(message: string) {
  const withoutCommands = message
    .replace(/\b(?:cadastrar|cadastre|criar|crie|novo|nova|lead|contato|cliente|esse|essa|este|esta)\b/gi, " ")
    .replace(/[:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const phoneMatch = withoutCommands.replace(/\D/g, "").match(/(\d{10,13})/)
  const phone = phoneMatch?.[1] ?? ""
  const phoneStart = phone ? withoutCommands.search(new RegExp(phone.split("").join("\\D*"))) : -1
  const rawName = phoneStart >= 0 ? withoutCommands.slice(0, phoneStart) : withoutCommands
  const name = cleanText(
    rawName
      .replace(/[,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    120,
  )

  return { name, phone }
}

function parseFlexiblePriceToCents(message: string) {
  const normalized = normalizeForIntent(message)
  const priceMatch = normalized.match(/(?:ate|até|maximo|max|abaixo de|menos de|valor|preco|preço)?\s*(?:r\$)?\s*(\d+(?:[.,]\d+)?)(?:\s*(mil|k|mi|milhao|milhoes|milhão|milhões))\b/)
  if (!priceMatch) {
    const currencyMatch = message.match(/r\$\s*([\d.]+(?:,\d{2})?)/i)
    if (!currencyMatch) return null
    return parseCurrencyInputToCents(currencyMatch[1])
  }

  const rawPrice = Number(priceMatch[1].replace(",", "."))
  if (!Number.isFinite(rawPrice) || rawPrice < 0) return null

  const unit = priceMatch[2]
  const multiplier = unit?.startsWith("mi") || unit?.startsWith("milh") ? 1_000_000 : 1000
  return Math.round(rawPrice * multiplier * 100)
}

function inferPropertyTypeFromText(message: string): PropertyType | null {
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

function parsePropertySearchFilters(message: string) {
  const normalized = normalizeForIntent(message)
  const cityMatch = normalized.match(/\b(?:em|na cidade de|cidade)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:ate|até|com|no bairro|bairro|e|$)|$)/)
  const neighborhoodMatch =
    normalized.match(/\b(?:bairro|no bairro|na regiao|regiao)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:ate|até|com|e|$)|$)/) ??
    normalized.match(/\b(?:no|na)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:ate|até|com|e|$)|$)/)
  const bedroomsMatch = normalized.match(/(\d+)\s*(?:quartos|dormitorios|dormitórios)/)
  const purpose = normalized.includes("aluguel") || normalized.includes("alugar") || normalized.includes("locacao") || normalized.includes("locação")
    ? "RENT"
    : normalized.includes("venda") || normalized.includes("comprar")
      ? "SALE"
      : null

  return {
    maxPrice: parseFlexiblePriceToCents(message),
    city: cleanText(cityMatch?.[1], 80),
    neighborhood: cleanText(neighborhoodMatch?.[1], 80),
    bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : null,
    type: inferPropertyTypeFromText(message),
    purpose,
  }
}

function parsePropertyDraftData(message: string, payload?: Record<string, unknown>) {
  const normalized = normalizeForIntent(message)
  const type = inferPropertyTypeFromText(message) ?? "APARTMENT"
  const cityMatch = normalized.match(/\b(?:em|cidade)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:bairro|no|na|com|r\$|ate|até|venda|aluguel|locacao|locação|$)|$)/)
  const neighborhoodMatch =
    normalized.match(/\b(?:bairro|no bairro|no|na)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:com|r\$|ate|até|venda|aluguel|locacao|locação|$)|$)/) ??
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

  const city = cleanText(payload?.city, 100) || cleanText(cityMatch?.[1], 100) || "Não informada"
  const neighborhood = cleanText(payload?.neighborhood, 100) || cleanText(neighborhoodMatch?.[1], 100) || null
  const bedrooms = Number(payload?.bedrooms) || (bedroomsMatch ? Number(bedroomsMatch[1]) : 0)
  const bathrooms = Number(payload?.bathrooms) || (bathroomsMatch ? Number(bathroomsMatch[1]) : 0)
  const parkingSpots = Number(payload?.parkingSpots ?? payload?.parking) || (parkingMatch ? Number(parkingMatch[1]) : 0)
  const area = cleanText(payload?.area, 40) || cleanText(areaMatch?.[0], 40)
  const price = parseCurrencyInputToCents(payload?.price) ?? parseFlexiblePriceToCents(message) ?? 0
  const title = cleanText(payload?.title, 160) || [typeLabel, bedrooms ? `${bedrooms} dormitórios` : "", neighborhood ? `no ${neighborhood}` : ""].filter(Boolean).join(" ")
  const descriptionParts = [
    cleanText(payload?.description, 2000),
    area ? `Área informada: ${area}.` : "",
    features.length ? `Características: ${features.join(", ")}.` : "",
    `Dados capturados pelo Assessor EME a partir da mensagem: "${message.slice(0, 240)}"`,
  ].filter(Boolean)

  return {
    title: title || `${typeLabel} em rascunho`,
    city,
    neighborhood,
    price,
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

function parseAgendaDate(message: string) {
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

function parseAgendaTime(message: string) {
  const normalized = normalizeForIntent(message)
  const match =
    normalized.match(/\bas\s*(\d{1,2})(?:[:h]\s*(\d{2}))?\b/) ??
    normalized.match(/\b(\d{1,2})(?:[:h]\s*(\d{2})?| horas?)\b/)
  if (!match) return ""
  const hours = Math.min(23, Number(match[1])).toString().padStart(2, "0")
  const minutes = (match[2] ? Math.min(59, Number(match[2])) : 0).toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

function parseAgendaType(message: string) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("visita")) return "visit"
  if (normalized.includes("lemb")) return "reminder"
  if (normalized.includes("evento")) return "event"
  return "task"
}

function parseAgendaTitle(message: string) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("visita")) return "Visita"
  if (normalized.includes("ligar")) return "Ligar para cliente"
  if (normalized.includes("lemb")) return "Lembrete"
  return cleanText(message.replace(/\b(agendar|agenda|lembrar|criar|novo|nova|tarefa|evento)\b/gi, " "), 160) || "Compromisso"
}

function parseAgendaListRange(message: string) {
  const normalized = normalizeForIntent(message)
  const start = normalized.includes("amanha") ? addDays(getDateOnly(new Date()), 1) : getDateOnly(new Date())
  const end = new Date(start)
  end.setDate(start.getDate() + (normalized.includes("semana") ? 7 : 1))
  const pendingOnly = /\b(pendente|pendentes|abertos|em aberto)\b/.test(normalized)
  return { start, end, label: pendingOnly ? "pendente" : normalized.includes("amanha") ? "de amanhã" : normalized.includes("semana") ? "da semana" : "de hoje", pendingOnly }
}

function extractPersonName(message: string) {
  const cleaned = message
    .replace(/\b(gerar|gere|criar|crie|proposta|documento|contrato|para|do|da|no|na|imovel|imóvel)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleanText(cleaned.split(/\s+(?:apartamento|casa|terreno|centro)\b/i)[0], 120)
}

function extractAgendaPersonName(message: string) {
  const match = message.match(/\b(?:com|para)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i)
  return cleanText(match?.[1]?.replace(/\b(?:no|na|imóvel|imovel|apartamento|casa|terreno)\b.*$/i, ""), 120)
}

function extractPropertyReference(message: string) {
  const normalized = normalizeForIntent(message)
  const idMatch = normalized.match(/\b(?:imovel|codigo|id)\s+([a-z0-9-]{2,80})\b/)
  const neighborhoodMatch = normalized.match(/\b(?:apartamento|casa|terreno|imovel)?\s*(?:do|da|no|na)\s+([a-z\s-]{3,60})\b/)
  return {
    idOrCode: cleanText(idMatch?.[1], 80),
    neighborhood: cleanText(neighborhoodMatch?.[1], 80),
    type: inferPropertyTypeFromText(message),
  }
}

function firstImageUrl(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
}

function formatAgendaDateLabel(message: string, date: Date) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("amanha")) return "amanhã"
  if (normalized.includes("hoje")) return "hoje"
  return date.toLocaleDateString("pt-BR")
}

export function inferAssessorAction(message: string, requestedAction?: string): AssessorAction {
  if (requestedAction === "create_ad") return "createPropertyDraft"
  if (requestedAction === "improve_description") return "improvePropertyDescription"
  if (requestedAction === "reply_client") return "summarizeLead"
  if (requestedAction === "match_properties") return "searchProperties"
  if (requestedAction === "analyze_catalog") return "analyzeCatalog"
  if (requestedAction === "lead_ideas") return "getAnalyticsSummary"
  if (assessorActions.includes(requestedAction as AssessorAction)) return requestedAction as AssessorAction

  const normalized = normalizeForIntent(message)
  if (isAssessorGreeting(message)) return "general"
  if (/\b(resumo|como esta|como estao|quantas|quantos|quais|mostrar|mostre|ver)\b/.test(normalized) && /\b(leads|lead|clientes|contatos)\b/.test(normalized)) return "getLeadsSummary"
  if (/\b(resumo|como esta|como estao|quantas|quantos|quais|acessos|visitas|visualizacoes|visualiz)\b/.test(normalized) && /\b(analytics|acessos|visitas|visualizacoes|visualiz|vistos)\b/.test(normalized)) return "getAnalyticsSummary"
  if (/\b(resumo|como esta|como estao|quantos|buscas|publicados|catalogo)\b/.test(normalized) && /\b(catalogo|imoveis publicados|buscas)\b/.test(normalized)) return "getCatalogSummary"
  if (/\b(resumo|valor|carteira|ticket|ativos|financeiro|comissao)\b/.test(normalized) && /\b(financeiro|carteira|ticket|ativos|comissao)\b/.test(normalized)) return "getFinancialSummary"
  if (/\b(marcar|marque|concluir|feito|finalizar)\b/.test(normalized) && /\b(agenda|visita|lembrete|tarefa|compromisso)\b/.test(normalized)) return "MARK_AGENDA_DONE"
  if (/\b(quais|mostrar|mostre|listar|lista|ver)\b/.test(normalized) && /\b(agenda|visitas|lembretes|compromissos|tarefas)\b/.test(normalized)) return "LIST_AGENDA_EVENTS"
  if (/\b(agendar|agenda|lembrar|lembrete|visita|evento|tarefa)\b/.test(normalized)) return "CREATE_AGENDA_EVENT"
  if (/\b(mostrar|mostre|listar|lista|documentos)\b/.test(normalized) && /\b(documento|documentos|proposta|propostas|contrato)\b/.test(normalized)) return "LIST_DOCUMENTS"
  if (/\b(enviar|envie|abrir|me envie|ver)\b/.test(normalized) && /\b(documento|proposta|contrato)\b/.test(normalized)) return "GET_DOCUMENT"
  if (/\b(gerar|gere|criar|crie)\b/.test(normalized) && /\b(proposta|documento|contrato)\b/.test(normalized)) return "CREATE_PROPOSAL"
  if (/\b(cadastrar|cadastre|criar|crie|salvar|salva|adicionar|adicione)\b/.test(normalized) && /\b(imovel|imoveis|casa|apartamento|apto|terreno|sala|loja|cobertura)\b/.test(normalized)) return "createPropertyDraft"
  if (/\b(cadastrar|cadastre|criar|crie|salvar|salva|adicionar|adicione|incluir|inclua)\b/.test(normalized) && /\d{10,13}/.test(normalized)) return "createLead"
  if (/\b(cadastrar|cadastre|criar|crie|salvar|salva|adicionar|adicione|incluir|inclua)\b.*\b(lead|contato|cliente)\b/.test(normalized)) return "createLead"
  if (/\b(lead|contato|cliente)\b/.test(normalized) && /\d{8,}/.test(normalized)) return "createLead"
  if (/\b(buscar|busca|procurar|procura|listar|quero|preciso|acha|encontra|opcoes|opções)\b/.test(normalized) && /\b(imovel|imoveis|casa|apartamento|apto|terreno|sala|loja|cobertura)\b/.test(normalized)) return "searchProperties"
  if (/\b(casa|apartamento|apto|terreno|sala|loja|cobertura|imovel|imoveis)\b/.test(normalized) && (/\b(ate|até|mil|k|milhao|milhoes|milhão|milhões|quartos|dormitorios|centro)\b/.test(normalized) || /\d/.test(normalized))) return "searchProperties"
  if (/\b(casa|apartamento|apto|terreno|sala|loja|cobertura|imovel|imoveis)\b/.test(normalized) && !/\b(cadastrar|cadastre|criar|crie)\b/.test(normalized)) return "searchProperties"
  if (normalized.includes("cadastrar imovel") || normalized.includes("criar imovel")) return "createPropertyDraft"
  if (normalized.includes("melhorar descricao") || normalized.includes("descrição")) return "improvePropertyDescription"
  if (normalized.includes("resumir lead") || normalized.includes("resumo")) return "summarizeLead"
  if (normalized.includes("catalogo")) return "analyzeCatalog"
  if (normalized.includes("financeiro") || normalized.includes("comissao")) return "getFinancialSummary"
  if (normalized.includes("analytics") || normalized.includes("visualiz")) return "getAnalyticsSummary"
  if (normalized.includes("notificacao")) return "createInternalNotification"
  return "general"
}

export function inferCustomerIntent(message: string) {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (normalized.includes("alugar") || normalized.includes("aluguel")) return "alugar"
  if (normalized.includes("vender") || normalized.includes("venda meu") || normalized.includes("avaliar")) return "vender"
  if (normalized.includes("comprar") || normalized.includes("procuro") || normalized.includes("quero um")) return "comprar"
  return "atendimento"
}

export async function searchBrokerProperties(brokerId: string, query: string, limit = 5) {
  const filters = parsePropertySearchFilters(query)
  const terms = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2 && !["buscar", "busca", "quero", "imovel", "imoveis", "ate", "com", "para", "opcoes", "opções"].includes(term))
  const hasSpecificFilters = Boolean(filters.maxPrice || filters.city || filters.neighborhood || filters.type || filters.bedrooms)
  const activeWhere = {
    brokerId,
    OR: [{ published: true }, { status: PropertyStatus.PUBLISHED }],
  }
  const baseFilterWhere = {
    ...activeWhere,
    ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" as const } } : {}),
    ...(filters.neighborhood ? { neighborhood: { contains: filters.neighborhood, mode: "insensitive" as const } } : {}),
    ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}),
    ...(filters.type ? { type: filters.type as PropertyType } : {}),
    ...(filters.purpose ? { purpose: filters.purpose } : {}),
  }

  const filteredProperties = await prisma.property.findMany({
    where: baseFilterWhere,
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  let usedRelaxedSearch = false
  let usedBroadSearch = false
  let properties = filteredProperties
  if (properties.length === 0 && (filters.neighborhood || filters.bedrooms || filters.city)) {
    usedRelaxedSearch = true
    properties = await prisma.property.findMany({
      where: {
        ...activeWhere,
        ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
        ...(filters.type ? { type: filters.type as PropertyType } : {}),
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
      ...(filters.type ? { type: filters.type as PropertyType } : {}),
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
  }).catch((caughtError) => {
    console.error("[eme-backend][search-properties][tracking-failed]", {
      brokerId,
      query,
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
  })

  return { results, filters: { ...filters, usedRelaxedSearch, usedBroadSearch } }
}

export async function buildBrokerContext(brokerId: string) {
  const [properties, leads, events] = await Promise.all([
    prisma.property.findMany({
      where: { brokerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { leads: true } } },
    }),
    prisma.lead.findMany({
      where: { brokerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { property: { select: { title: true } } },
    }),
    prisma.catalogEvent.groupBy({
      by: ["eventType"],
      where: { brokerId },
      _count: { _all: true },
    }),
  ])

  return { properties, leads, events }
}

export async function runAssessorAction({
  brokerId,
  userId,
  message,
  action,
  payload,
}: {
  brokerId: string
  userId: string
  message: string
  action: AssessorAction
  confirm?: boolean
  payload?: Record<string, unknown>
}) {
  if (action === "CREATE_AGENDA_EVENT") {
    const date = parseAgendaDate(message)
    const time = parseAgendaTime(message)
    const type = parseAgendaType(message)
    const personName = extractAgendaPersonName(message)
    const propertyReference = extractPropertyReference(message)
    const [lead, property] = await Promise.all([
      personName
        ? prisma.lead.findFirst({ where: { brokerId, name: { contains: personName, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } })
        : null,
      propertyReference.idOrCode || propertyReference.neighborhood || propertyReference.type
        ? prisma.property.findFirst({
            where: {
              brokerId,
              OR: [
                ...(propertyReference.idOrCode ? [{ id: propertyReference.idOrCode }, { title: { contains: propertyReference.idOrCode, mode: "insensitive" as const } }] : []),
                ...(propertyReference.neighborhood ? [{ neighborhood: { contains: propertyReference.neighborhood, mode: "insensitive" as const } }] : []),
                ...(propertyReference.type ? [{ type: propertyReference.type }] : []),
              ],
            },
            orderBy: { updatedAt: "desc" },
            select: { id: true, title: true },
          })
        : null,
    ])
    const baseTitle = parseAgendaTitle(message)
    const title = cleanText(`${baseTitle}${lead?.name || personName ? ` com ${lead?.name ?? personName}` : ""}${property ? ` no ${property.title}` : ""}`, 160)
    if (!time) {
      return {
        response: "Qual horário devo colocar?",
        metadata: {
          required: ["time"],
          noCharge: true,
          parsedData: { title, type, date: date.toISOString(), personName, propertyReference },
        },
      }
    }
    const event = await prisma.agendaEvent.create({
      data: {
        brokerId,
        title,
        type,
        date,
        time,
        leadId: lead?.id ?? null,
        propertyId: property?.id ?? null,
        notes: message,
        status: "pending",
      },
    })
    return {
      response: `Compromisso agendado ✅\n${title} ${formatAgendaDateLabel(message, date)} às ${time}.`,
      metadata: {
        agendaEventId: event.id,
        leadId: lead?.id ?? null,
        propertyId: property?.id ?? null,
        parsedData: { title, type, date: date.toISOString(), time, personName, propertyReference },
        status: "pending",
      },
      leadId: lead?.id,
      propertyId: property?.id,
    }
  }

  if (action === "LIST_AGENDA_EVENTS") {
    const range = parseAgendaListRange(message)
    const events = await prisma.agendaEvent.findMany({
      where: {
        brokerId,
        ...(range.pendingOnly ? { status: "pending" } : { date: { gte: range.start, lt: range.end }, status: { not: "cancelled" } }),
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: 8,
    })
    return {
      response: events.length
        ? `Sua agenda ${range.label}:\n\n${events.map((event) => `• ${event.time || "Sem horário"} — ${event.title}`).join("\n")}`
        : "Você não tem compromissos nessa data.",
      metadata: { resultsCount: events.length, agendaEventIds: events.map((event) => event.id), parsedData: { range } },
    }
  }

  if (action === "MARK_AGENDA_DONE") {
    const event = await prisma.agendaEvent.findFirst({
      where: { brokerId, status: "pending" },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    })
    if (!event) {
      return { response: "Não encontrei compromisso pendente para marcar como feito.", metadata: { resultsCount: 0 } }
    }
    await prisma.agendaEvent.update({ where: { id: event.id }, data: { status: "done" } })
    return {
      response: "Compromisso marcado como feito ✅",
      metadata: { agendaEventId: event.id, parsedData: { title: event.title }, status: "done" },
    }
  }

  if (action === "CREATE_PROPOSAL") {
    const personName = extractPersonName(message)
    const propertyReference = extractPropertyReference(message)
    const [broker, matchingLeads, property] = await Promise.all([
      prisma.broker.findUnique({ where: { id: brokerId }, include: { user: { select: { name: true, email: true, photoUrl: true } } } }),
      personName
        ? prisma.lead.findMany({ where: { brokerId, name: { contains: personName, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, take: 3, select: { id: true, name: true, phone: true, email: true } })
        : [],
      propertyReference.idOrCode || propertyReference.neighborhood || propertyReference.type
        ? prisma.property.findFirst({
            where: {
              brokerId,
              OR: [
                ...(propertyReference.idOrCode ? [{ id: propertyReference.idOrCode }, { title: { contains: propertyReference.idOrCode, mode: "insensitive" as const } }] : []),
                ...(propertyReference.neighborhood ? [{ neighborhood: { contains: propertyReference.neighborhood, mode: "insensitive" as const } }] : []),
                ...(propertyReference.type ? [{ type: propertyReference.type }] : []),
              ],
            },
            orderBy: { updatedAt: "desc" },
            select: { id: true, title: true, city: true, neighborhood: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true, imageUrls: true },
          })
        : null,
    ])
    if (matchingLeads.length > 1) {
      return {
        response: `Encontrei mais de um ${personName}. Qual deles devo usar?\n\n${matchingLeads.map((leadItem, index) => `${index + 1}. ${leadItem.name || "Sem nome"} ${leadItem.phone ? `- ${leadItem.phone}` : ""}`).join("\n")}`,
        metadata: { required: ["lead"], noCharge: true, parsedData: { personName, leadIds: matchingLeads.map((leadItem) => leadItem.id), propertyReference } },
      }
    }
    const lead = matchingLeads[0] ?? null
    if (!lead) {
      return {
        response: "Para quem é a proposta?",
        metadata: { required: ["lead"], noCharge: true, parsedData: { personName, propertyReference } },
      }
    }
    if (!property) {
      return {
        response: "Qual imóvel devo usar?",
        metadata: { required: ["property"], noCharge: true, leadId: lead.id, parsedData: { personName, propertyReference } },
        leadId: lead.id,
      }
    }
    const title = `Proposta ${lead?.name ?? (personName || property?.title || "EME")}`
    const proposalProperty = { ...property, imageUrl: firstImageUrl(property.imageUrls) }
    const document = await prisma.brokerDocument.create({
      data: {
        brokerId,
        leadId: lead.id,
        propertyId: property.id,
        type: "proposal",
        title,
        content: buildProposalHtml({
          lead,
          property: proposalProperty,
          broker: { name: broker?.user.name ?? "", phone: broker?.phone, email: broker?.user.email, city: property.city, creci: broker?.creci, photoUrl: broker?.user.photoUrl },
        }),
        status: "generated",
      },
    })
    return {
      response: "Proposta gerada ✅\nSalvei em Documentos e deixei pronta para baixar em PDF.",
      metadata: { documentId: document.id, leadId: lead.id, propertyId: property.id, parsedData: { personName, title, propertyReference }, status: "generated" },
      leadId: lead.id,
      propertyId: property.id,
    }
  }

  if (action === "LIST_DOCUMENTS" || action === "GET_DOCUMENT") {
    const personName = extractPersonName(message)
    const propertyReference = extractPropertyReference(message)
    const lead = personName
      ? await prisma.lead.findFirst({ where: { brokerId, name: { contains: personName, mode: "insensitive" } }, select: { id: true } })
      : null
    const property = propertyReference.idOrCode || propertyReference.neighborhood || propertyReference.type
      ? await prisma.property.findFirst({
          where: {
            brokerId,
            OR: [
              ...(propertyReference.idOrCode ? [{ id: propertyReference.idOrCode }, { title: { contains: propertyReference.idOrCode, mode: "insensitive" as const } }] : []),
              ...(propertyReference.neighborhood ? [{ neighborhood: { contains: propertyReference.neighborhood, mode: "insensitive" as const } }] : []),
              ...(propertyReference.type ? [{ type: propertyReference.type }] : []),
            ],
          },
          select: { id: true },
          orderBy: { updatedAt: "desc" },
        })
      : null
    const documents = await prisma.brokerDocument.findMany({
      where: { brokerId, ...(lead?.id ? { leadId: lead.id } : {}), ...(property?.id ? { propertyId: property.id } : {}) },
      orderBy: { createdAt: "desc" },
      take: action === "GET_DOCUMENT" ? 1 : 5,
      include: { property: { select: { title: true } }, lead: { select: { name: true } } },
    })
    if (action === "GET_DOCUMENT") {
      const document = documents[0]
      return {
        response: document ? `${document.title}\n\n${proposalHtmlToText(document.content).slice(0, 1200)}` : "Não encontrei documentos com esse filtro.",
        metadata: { documentId: document?.id ?? null, resultsCount: documents.length, parsedData: { personName, propertyReference } },
      }
    }
    return {
      response: documents.length
        ? `Encontrei ${documents.length} documento${documents.length === 1 ? "" : "s"}:\n\n${documents.map((document) => `• ${document.title}${document.property?.title ? ` — ${document.property.title}` : ""}`).join("\n")}`
        : "Não encontrei documentos com esse filtro.",
      metadata: { documentIds: documents.map((document) => document.id), resultsCount: documents.length, parsedData: { personName, propertyReference } },
    }
  }

  if (action === "searchProperties") {
    const searchResult = await searchBrokerProperties(brokerId, message)
    const properties = searchResult.results
    const filters = searchResult.filters
    return {
      response: properties.length
        ? `Encontrei ${properties.length} imóvel${properties.length === 1 ? "" : "is"}:\n\n${properties
            .map((property, index) => `${index + 1}. ${property.title} — ${formatCurrencyBRLFromCents(property.price)}${property.neighborhood || property.city ? ` — ${property.neighborhood ?? property.city}` : ""}`)
            .join("\n")}\n\nQuer que eu te mande mais detalhes de algum?`
        : "Não encontrei imóveis com esses filtros. Posso tentar uma busca mais ampla?",
      metadata: {
        propertyIds: properties.map((property) => property.id),
        propertySearchFilters: filters,
        resultCount: properties.length,
        originalMessage: message,
      },
    }
  }
  if (action === "getFinancialSummary") {
    const properties = await prisma.property.findMany({ where: { brokerId } })
    const total = properties.reduce((sum, property) => sum + Math.max(0, property.price), 0)
    const active = properties.filter((property) => property.published || property.status === PropertyStatus.PUBLISHED).length
    const average = properties.length ? Math.round(total / properties.length) : 0
    return {
      response: `Sua carteira está em ${formatCurrencyBRLFromCents(total)}, com ticket médio de ${formatCurrencyBRLFromCents(average)} e ${active} imóvel${active === 1 ? "" : "is"} ativo${active === 1 ? "" : "s"}.`,
      metadata: { totalProperties: properties.length, activeProperties: active, averageTicket: average, totalPortfolioValue: total },
    }
  }

  if (action === "getAnalyticsSummary" || action === "analyzeCatalog" || action === "getCatalogSummary") {
    const context = await buildBrokerContext(brokerId)
    const views = context.events.reduce((sum, item) => sum + (item.eventType.includes("view") ? item._count._all : 0), 0)
    const whatsappClicks = context.events.reduce((sum, item) => sum + (item.eventType === "whatsapp_click" ? item._count._all : 0), 0)
    const published = context.properties.filter((property) => property.published || property.status === PropertyStatus.PUBLISHED).length
    const searches = await prisma.searchEvent.count({ where: { brokerId } })
    return {
      response:
        action === "getAnalyticsSummary"
          ? `Seu catálogo teve ${views} visualizações, ${whatsappClicks} cliques no WhatsApp e ${context.leads.length} leads recebidos.`
          : `Seu catálogo tem ${published} imóveis publicados, ${views} visualizações e ${searches} buscas recentes.`,
      metadata: { properties: context.properties.length, published, leads: context.leads.length, views, whatsappClicks, searches },
    }
  }

  if (action === "createInternalNotification") {
    await prisma.notification.create({
      data: {
        userId,
        title: "Assessor EME",
        message: message.slice(0, 240),
        read: false,
      },
    })
    return { response: "Notificação interna criada para acompanhamento.", metadata: {} }
  }

  if (action === "improvePropertyDescription") {
    const searchResult = await searchBrokerProperties(brokerId, message, 1)
    const property = searchResult.results[0]
    return {
      response: property
        ? `Base para melhoria: ${property.title}. Descrição atual: ${property.description || "sem descrição cadastrada"}.`
        : "Posso melhorar a descrição, mas preciso que você informe o imóvel ou envie a descrição atual.",
      metadata: { propertyId: property?.id ?? null },
      propertyId: property?.id,
    }
  }

  if (action === "summarizeLead") {
    const leads = await prisma.lead.findMany({
      where: { brokerId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { property: { select: { title: true } } },
    })
    return {
      response: leads.length
        ? `Últimos leads: ${leads.map((lead) => `${lead.name || lead.phone || "Lead"} (${lead.status})${lead.property?.title ? ` - ${lead.property.title}` : ""}`).join("; ")}.`
        : "Ainda não há leads cadastrados para resumir.",
      metadata: { leadIds: leads.map((lead) => lead.id) },
      leadId: leads[0]?.id,
    }
  }

  if (action === "createLead") {
    const extracted = extractLeadData(message)
    const name = cleanText(payload?.name, 120) || extracted.name
    const phone = normalizePhone(payload?.phone) || extracted.phone
    if (!name) {
      return {
        response: "Qual o nome do lead?",
        metadata: { required: ["name"], readyForConfirmation: false },
      }
    }
    if (!phone) {
      return {
        response: "Qual o telefone dele?",
        metadata: { required: ["phone"], readyForConfirmation: false, extractedName: name },
      }
    }

    const existingLead = await prisma.lead.findFirst({
      where: { brokerId, phone },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    })
    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: { name, phone, source: "assessor_eme", status: LeadStatus.CONTACTED, message },
        })
      : await prisma.lead.create({
          data: {
            name,
            phone,
            source: "assessor_eme",
            status: LeadStatus.NEW,
            brokerId,
            message,
          },
        })
    await prisma.notification.create({
      data: {
        userId,
        title: existingLead ? "Lead atualizado pelo Assessor EME" : "Lead criado pelo Assessor EME",
        message: `${name} foi ${existingLead ? "atualizado" : "cadastrado"} no CRM.`,
        read: false,
      },
    })
    return {
      response: existingLead ? "Esse lead já existia. Atualizei as informações 👌" : `Lead ${name} cadastrado com sucesso 👌`,
      metadata: { leadId: lead.id, phone, name, updatedExisting: Boolean(existingLead) },
      leadId: lead.id,
    }
  }

  if (action === "createPropertyDraft") {
    const draft = parsePropertyDraftData(message, payload)
    if (!draft.price) {
      return {
        response: "Qual o valor do imóvel?",
        metadata: { required: ["price"], noCharge: true, parsedData: draft },
      }
    }

    const property = await prisma.property.create({
      data: {
        title: draft.title,
        city: draft.city,
        neighborhood: draft.neighborhood,
        price: draft.price,
        description: draft.description,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        parkingSpots: draft.parkingSpots,
        type: draft.type,
        purpose: draft.purpose,
        status: PropertyStatus.DRAFT,
        published: false,
        brokerId,
      },
    })
    await prisma.notification.create({ data: { userId, title: "Rascunho criado pelo Assessor EME", message: `${draft.title} foi criado como rascunho.`, read: false } })
    return {
      response: "Imóvel criado em rascunho ✅\nRevise os dados no painel antes de publicar.",
      metadata: {
        propertyId: property.id,
        parsedData: draft,
        futureActions: ["agenda_eme", "follow_up", "documents", "proposals", "ad_publication"],
        mediaHandling: {
          prepared: true,
          status: "waiting_storage_binding",
        },
      },
      propertyId: property.id,
    }
  }

  if (action === "getLeadsSummary") {
    const [total, newLeads, pending, recent] = await Promise.all([
      prisma.lead.count({ where: { brokerId } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.NEW } }),
      prisma.lead.count({ where: { brokerId, status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.NEGOTIATING] } } }),
      prisma.lead.findMany({ where: { brokerId }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, phone: true, status: true } }),
    ])
    return {
      response: `Você tem ${total} leads recebidos, ${newLeads} novo${newLeads === 1 ? "" : "s"} e ${pending} aguardando resposta.`,
      metadata: { total, newLeads, pending, leadIds: recent.map((lead) => lead.id), parsedData: { recent } },
      leadId: recent[0]?.id,
    }
  }

  return { response: "", metadata: {} }
}

export async function generateAssessorText(message: string, action: AssessorAction, actionResponse: string) {
  if (isAssessorGreeting(message)) return ASSESSOR_MENU_RESPONSE
  if (isLikelyUnknownAssessorMessage(message, action)) return ASSESSOR_FALLBACK_RESPONSE

  const client = getOpenAIClient()
  if (!client) return actionResponse || ASSESSOR_FALLBACK_RESPONSE

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 120,
    instructions:
      "Você é o Assessor EME no WhatsApp: concierge comercial e SDR imobiliário para corretores. Responda em 1 a 4 linhas, natural e direto. Uma ação por vez. Sem onboarding, manual, listas grandes, linguagem técnica ou textão. Se a ação já foi executada, apenas confirme e sugira o próximo passo. Nunca diga que não tem acesso ao CRM. Não execute ações destrutivas nem altere créditos ou imóveis sem confirmação explícita.",
    input: [`Ação detectada: ${action}`, `Pedido do corretor: ${message}`, actionResponse ? `Resultado interno: ${actionResponse}` : "Resultado interno: Oi 👋 Sou o Assessor EME.\n\nPosso ajudar com:\n• imóveis\n• leads\n• anúncios\n• atendimentos\n\nO que você precisa?"].join("\n"),
  })
  return response.output_text.trim()
}

export async function generateCorretorEmeReply(input: {
  message: string
  customerName?: string
  intent: string
  suggestions: Array<{ title: string; price: number; city: string; neighborhood: string | null }>
}) {
  const client = getOpenAIClient()
  const fallback =
    input.intent === "comprar" || input.intent === "alugar"
      ? `Obrigado pelo contato${input.customerName ? `, ${input.customerName}` : ""}. Vou te ajudar a encontrar o imóvel ideal. Pode me informar cidade, tipo de imóvel, faixa de preço e quantidade de quartos?`
      : "Obrigado pelo contato. Vou registrar suas informações e encaminhar para o corretor continuar o atendimento."

  if (!client) return fallback

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 420,
    instructions:
      "Você é o Corretor EME, IA de pré-atendimento no WhatsApp do próprio corretor. Qualifique leads com educação, colete intenção, cidade, tipo de imóvel, faixa de preço e telefone. Não prometa fechamento, não marque convertido/perdido sem confirmação humana e encaminhe para humano quando necessário.",
    input: [
      `Mensagem do cliente: ${input.message}`,
      `Intenção detectada: ${input.intent}`,
      `Imóveis sugeridos: ${input.suggestions.map((property) => `${property.title} em ${property.neighborhood ?? property.city} por ${formatCurrencyBRLFromCents(property.price)}`).join("; ") || "nenhum"}`,
    ].join("\n"),
  })
  return response.output_text.trim()
}
