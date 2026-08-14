import { LeadStatus, PropertyStatus, PropertyType } from "@/lib/prisma-enums"
import type { Prisma } from "@prisma/client"

import { formatCurrencyBRLFromCents } from "@/lib/currency"
import { canCreateBrokerProperties } from "@/lib/eme-plan-service"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"
import { prisma } from "@/lib/prisma"
import { extractPropertyPublicCode, findPropertyByBrokerPublicCode, getNextPropertyPublicCode } from "@/lib/property-public-code"
import { contractHtmlToText, createContractContent, parseContractContent, stringifyContractContent } from "@/lib/contract-template"
import { buildProposalHtml, proposalHtmlToText } from "@/lib/proposal-template"
import { detectNamedClientReference, extractClientIdentity } from "@/lib/cos/entity-extraction"

export const assessorActions = [
  "general",
  "createLead",
  "searchProperties",
  "GET_PROPERTY",
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
  "CREATE_CONTRACT",
  "CONTRACT_PREVIEW",
  "UPDATE_CONTRACT",
  "SEND_CONTRACT",
  "SIGN_CONTRACT",
  "CANCEL_CONTRACT",
  "DOWNLOAD_CONTRACT",
  "CONTRACT_HISTORY",
  "LIST_PROPOSALS",
  "LIST_DOCUMENTS",
  "GET_DOCUMENT",
  "LIST_CONTRACTS",
  "GET_CONTRACT",
  "PUBLISH_CATALOG",
  "UNPUBLISH_CATALOG",
  "SHARE_CATALOG",
  "CATALOG_STATS",
  "PUBLISH_PROPERTY",
  "UNPUBLISH_PROPERTY",
  "UPDATE_PROPERTY_MEDIA",
  "SUGGEST_PROPERTY_PRICE",
  "ARCHIVE_PROPERTY",
  "UPDATE_LEAD",
  "DELETE_LEAD",
  "FIND_LEAD",
  "LEAD_TIMELINE",
  "CONVERT_LEAD",
  "ATTACH_LEAD_DOCUMENT",
  "UPDATE_AGENDA_EVENT",
  "CANCEL_AGENDA_EVENT",
  "LIST_AGENDA_TODAY",
  "LIST_AGENDA_WEEK",
  "LIST_AGENDA_MONTH",
  "GET_FINANCE_RECEIVABLE",
  "GET_FINANCE_PAYABLE",
  "GET_FINANCE_FORECAST",
  "GET_FINANCE_COMMISSION",
  "GET_FINANCE_CASHFLOW",
  "GET_ANALYTICS_PERFORMANCE",
  "GET_ANALYTICS_SALES",
  "GET_ANALYTICS_PROPERTIES",
  "GET_ANALYTICS_LEADS",
  "STUDIO_GENERATE_DESCRIPTION",
  "STUDIO_GENERATE_CAMPAIGN",
  "STUDIO_GENERATE_INSTAGRAM",
  "STUDIO_GENERATE_FACEBOOK",
  "STUDIO_GENERATE_VIDEO",
  "STUDIO_GENERATE_STORY",
  "STUDIO_IMPROVE_TEXT",
  "STUDIO_REGENERATE",
  "help_first_steps",
  "help_use_cos",
  "help_register_properties",
  "help_manage_clients",
  "help_contracts_proposals",
  "help_marketing_studio",
  "help_general_question",
] as const

export type AssessorAction = (typeof assessorActions)[number]

const assessorActionRegistry: Record<AssessorAction, { visualAction: string; futureReady?: boolean }> = {
  general: { visualAction: "Atendimento do Assessor" },
  createLead: { visualAction: "Lead cadastrado" },
  searchProperties: { visualAction: "Busca de imóveis" },
  GET_PROPERTY: { visualAction: "Imóvel consultado", futureReady: true },
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
  CREATE_CONTRACT: { visualAction: "Contrato gerado", futureReady: true },
  CONTRACT_PREVIEW: { visualAction: "Preview de contrato", futureReady: true },
  UPDATE_CONTRACT: { visualAction: "Contrato atualizado", futureReady: true },
  SEND_CONTRACT: { visualAction: "Contrato enviado", futureReady: true },
  SIGN_CONTRACT: { visualAction: "Contrato assinado", futureReady: true },
  CANCEL_CONTRACT: { visualAction: "Contrato cancelado", futureReady: true },
  DOWNLOAD_CONTRACT: { visualAction: "Download de contrato", futureReady: true },
  CONTRACT_HISTORY: { visualAction: "Historico de contratos", futureReady: true },
  LIST_PROPOSALS: { visualAction: "Consulta de propostas", futureReady: true },
  LIST_DOCUMENTS: { visualAction: "Consulta de documentos", futureReady: true },
  GET_DOCUMENT: { visualAction: "Documento consultado", futureReady: true },
  LIST_CONTRACTS: { visualAction: "Consulta de contratos", futureReady: true },
  GET_CONTRACT: { visualAction: "Contrato consultado", futureReady: true },
  PUBLISH_CATALOG: { visualAction: "Catalogo publicado", futureReady: true },
  UNPUBLISH_CATALOG: { visualAction: "Catalogo despublicado", futureReady: true },
  SHARE_CATALOG: { visualAction: "Link do catalogo", futureReady: true },
  CATALOG_STATS: { visualAction: "Estatisticas do catalogo", futureReady: true },
  PUBLISH_PROPERTY: { visualAction: "Imovel publicado", futureReady: true },
  UNPUBLISH_PROPERTY: { visualAction: "Imovel despublicado", futureReady: true },
  UPDATE_PROPERTY_MEDIA: { visualAction: "Midias do imovel atualizadas", futureReady: true },
  SUGGEST_PROPERTY_PRICE: { visualAction: "Sugestao de preco", futureReady: true },
  ARCHIVE_PROPERTY: { visualAction: "Imovel arquivado", futureReady: true },
  UPDATE_LEAD: { visualAction: "Cliente atualizado", futureReady: true },
  DELETE_LEAD: { visualAction: "Cliente removido", futureReady: true },
  FIND_LEAD: { visualAction: "Cliente encontrado", futureReady: true },
  LEAD_TIMELINE: { visualAction: "Timeline do cliente", futureReady: true },
  CONVERT_LEAD: { visualAction: "Cliente convertido", futureReady: true },
  ATTACH_LEAD_DOCUMENT: { visualAction: "Documento anexado ao cliente", futureReady: true },
  UPDATE_AGENDA_EVENT: { visualAction: "Compromisso atualizado", futureReady: true },
  CANCEL_AGENDA_EVENT: { visualAction: "Compromisso cancelado", futureReady: true },
  LIST_AGENDA_TODAY: { visualAction: "Agenda de hoje", futureReady: true },
  LIST_AGENDA_WEEK: { visualAction: "Agenda da semana", futureReady: true },
  LIST_AGENDA_MONTH: { visualAction: "Agenda do mes", futureReady: true },
  GET_FINANCE_RECEIVABLE: { visualAction: "Recebiveis previstos", futureReady: true },
  GET_FINANCE_PAYABLE: { visualAction: "Contas a pagar", futureReady: true },
  GET_FINANCE_FORECAST: { visualAction: "Previsao financeira", futureReady: true },
  GET_FINANCE_COMMISSION: { visualAction: "Comissao prevista", futureReady: true },
  GET_FINANCE_CASHFLOW: { visualAction: "Fluxo de caixa", futureReady: true },
  GET_ANALYTICS_PERFORMANCE: { visualAction: "Performance comercial", futureReady: true },
  GET_ANALYTICS_SALES: { visualAction: "Analise de vendas", futureReady: true },
  GET_ANALYTICS_PROPERTIES: { visualAction: "Analise de imoveis", futureReady: true },
  GET_ANALYTICS_LEADS: { visualAction: "Analise de leads", futureReady: true },
  STUDIO_GENERATE_DESCRIPTION: { visualAction: "Descricao gerada", futureReady: true },
  STUDIO_GENERATE_CAMPAIGN: { visualAction: "Campanha gerada", futureReady: true },
  STUDIO_GENERATE_INSTAGRAM: { visualAction: "Campanha Instagram gerada", futureReady: true },
  STUDIO_GENERATE_FACEBOOK: { visualAction: "Campanha Facebook gerada", futureReady: true },
  STUDIO_GENERATE_VIDEO: { visualAction: "Video gerado", futureReady: true },
  STUDIO_GENERATE_STORY: { visualAction: "Story gerado", futureReady: true },
  STUDIO_IMPROVE_TEXT: { visualAction: "Texto refinado", futureReady: true },
  STUDIO_REGENERATE: { visualAction: "Campanha regenerada", futureReady: true },
  help_first_steps: { visualAction: "Ajuda: primeiros passos" },
  help_use_cos: { visualAction: "Ajuda: como usar o COS" },
  help_register_properties: { visualAction: "Ajuda: cadastrar imóveis" },
  help_manage_clients: { visualAction: "Ajuda: gerenciar clientes" },
  help_contracts_proposals: { visualAction: "Ajuda: contratos e propostas" },
  help_marketing_studio: { visualAction: "Ajuda: marketing e Studio IA" },
  help_general_question: { visualAction: "Ajuda: dúvida geral" },
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

export function isAssessorAction(value: unknown): value is AssessorAction {
  return typeof value === "string" && assessorActions.includes(value as AssessorAction)
}

function normalizeForIntent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

const ASSESSOR_MENU_RESPONSE =
  "Olá! Sou o Assessor EME 😊\n\nPosso te ajudar com:\n• cadastrar leads\n• buscar imóveis do seu catálogo\n• cadastrar imóveis em rascunho\n• agendar visitas e lembretes\n• consultar sua agenda\n• gerar propostas\n• consultar documentos\n• trazer resumos de leads, catálogo, financeiro e analytics\n\nExemplos:\nCadastrar lead: João Silva 54999999999\nBuscar imóvel: apartamento até 900 mil\nCadastrar imóvel: apartamento 3 quartos no Centro, R$ 850 mil, venda\nAgendar visita amanhã às 15h com João\nGerar proposta para Mateus no apartamento do Centro"

const ASSESSOR_FALLBACK_RESPONSE =
  "Não consegui identificar o pedido.\n\nVocê pode mandar assim:\n• Cadastrar lead: João Silva 54999999999\n• Buscar imóvel: casa até 600 mil\n• Agendar visita amanhã às 15h\n• Gerar proposta para João no imóvel 142"

function isAssessorGreeting(message: string) {
  const normalized = normalizeForIntent(message).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|ajuda|menu|help)$/.test(normalized)
}

const FIXED_ASSESSOR_MENU_RESPONSE =
  "Ol\u00e1! Sou o Assessor EME \ud83d\ude0a\n\nPara eu executar tudo corretamente, envie seus pedidos nesse formato:\n\n\u2022 Cadastrar im\u00f3vel: apartamento 3 quartos, Centro, Vacaria, R$ 790 mil, venda\n\u2022 Buscar im\u00f3vel: apartamento at\u00e9 790 mil em Vacaria\n\u2022 Criar proposta: Jo\u00e3o im\u00f3vel 2\n\u2022 Cadastrar lead: Mateus, (54) 99990-2688, novo\n\u2022 Agendar compromisso: visita amanh\u00e3 com Jo\u00e3o \u00e0s 15h\n\u2022 Minha agenda de amanh\u00e3\n\u2022 Analisar leads\n\u2022 Relat\u00f3rio analytics\n\u2022 Analisar financeiro\n\u2022 Minhas notifica\u00e7\u00f5es\n\nSe faltar alguma informa\u00e7\u00e3o, eu aviso e continuo o rascunho sempre que poss\u00edvel."

const FIXED_ASSESSOR_FALLBACK_RESPONSE =
  "N\u00e3o identifiquei a a\u00e7\u00e3o.\nVoc\u00ea pode enviar assim:\n\n\u2022 Cadastrar lead: Mateus, 54999999999, novo\n\u2022 Cadastrar im\u00f3vel: apartamento 3 quartos, Centro, Vacaria, R$ 790 mil, venda\n\u2022 Buscar im\u00f3vel: apartamento at\u00e9 790 mil\n\u2022 Criar proposta: Jo\u00e3o im\u00f3vel 2\n\u2022 Agendar compromisso: visita amanh\u00e3 com Jo\u00e3o \u00e0s 15h"

function isFixedAssessorGreeting(message: string) {
  const normalized = normalizeForIntent(message).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|ajuda|menu|help|o que voce faz|o que você faz)$/.test(normalized)
}

export function getAssessorActionErrorResponse(action: AssessorAction) {
  if (action === "searchProperties") return "Não consegui buscar esse imóvel agora.\nEnvie assim: Buscar imóvel: apartamento até 790 mil em Vacaria."
  if (action === "CREATE_PROPOSAL") return "Não consegui criar a proposta agora.\nEnvie assim: Criar proposta: João imóvel 2."
  if (action === "createPropertyDraft") return "Não consegui cadastrar o imóvel agora.\nEnvie assim: Cadastrar imóvel: apartamento 3 quartos, Centro, Vacaria, R$ 790 mil, venda."
  if (action === "createLead") return "Não consegui cadastrar o lead agora.\nEnvie assim: Cadastrar lead: Mateus, 54999999999, novo."
  if (action === "CREATE_AGENDA_EVENT" || action === "LIST_AGENDA_EVENTS") return "Não consegui acessar a agenda agora.\nEnvie assim: Agendar compromisso: visita amanhã com João às 15h."
  return "Não consegui concluir essa ação agora.\nEnvie menu para ver os formatos aceitos."
}

export function buildSaturdayAssessorMessage(date = new Date()) {
  if (date.getDay() !== 6) return null
  const key = date.toISOString().slice(0, 10)
  return {
    key,
    message: "Final de semana é dia de descanso, mas eu sigo aqui na operação, junto com meu aliado catálogo 🚀",
    pendingCron: true,
  }
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
  const extracted = extractClientIdentity(message)
  return { name: cleanText(extracted.name, 120), phone: extracted.phone }
}

function parseLeadStatusFromText(message: string): LeadStatus {
  const normalized = normalizeForIntent(message)
  if (/\b(convertido|ganho|fechado)\b/.test(normalized)) return LeadStatus.WON
  if (/\b(perdido|perdeu)\b/.test(normalized)) return LeadStatus.LOST
  if (/\b(em atendimento|atendimento|negociacao|negociação)\b/.test(normalized)) return LeadStatus.CONTACTED
  return LeadStatus.NEW
}

const MAX_PROPERTY_INTEGER_VALUE = 2_147_483_647

type ParsedBrazilianMoney = {
  raw: string
  value: number
  outOfRange: boolean
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
// app (ver lib/currency.ts). Antes retornava reais direto, gravado sem conversao na coluna de
// centavos (preco 100x menor que o real); formatAssessorPropertyPrice, no sentido inverso, lia a
// coluna em centavos como se fosse reais (preco 100x maior que o real). As duas pontas sao
// corrigidas juntas.
function parseBrazilianMoney(input: unknown): ParsedBrazilianMoney | null {
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
  if (!hasCurrency && !hasUnit && !/[.,]/.test(numberPart) && numeric < 1000) return null

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

// value chega em centavos (mesma unidade de Property.price em todo o app).
export function formatAssessorPropertyPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value || 0) / 100)
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

function parseFixedPropertyDraftCommand(message: string) {
  const afterCommand = message.replace(/^.*?cadastrar\s+im[oó]vel\s*:?\s*/i, "").trim()
  const parts = afterCommand
    .split(",")
    .map((part) => cleanText(part, 120))
    .filter(Boolean)
  const normalizedParts = parts.map((part) => normalizeForIntent(part))
  const pricePart = parts.find((part) => parseBrazilianMoney(part))
  const purposePart = normalizedParts.find((part) => /\b(venda|aluguel|locacao|locação|alugar)\b/.test(part)) ?? ""
  const purpose = purposePart.includes("aluguel") || purposePart.includes("locacao") || purposePart.includes("locação") || purposePart.includes("alugar")
    ? "RENT"
    : purposePart.includes("venda")
      ? "SALE"
      : null
  const detailPart = parts[0] ?? afterCommand
  const localityParts = parts.filter((part) => {
    const normalized = normalizeForIntent(part)
    return part !== pricePart &&
      !/\b(venda|aluguel|locacao|locação|alugar)\b/.test(normalized) &&
      !/\b(apartamento|apto|casa|cobertura|terreno|sala|loja|quartos|dormitorios|dormitórios|dorms?)\b/.test(normalized)
  })
  const firstLocality = localityParts[0] ?? ""
  const secondLocality = localityParts[1] ?? ""
  const firstLooksLikeNeighborhood = /\b(centro|bairro|menino deus|petropolis|petrópolis)\b/.test(normalizeForIntent(firstLocality))
  const city = secondLocality ? (firstLooksLikeNeighborhood ? secondLocality : firstLocality) : ""
  const neighborhood = secondLocality ? (firstLooksLikeNeighborhood ? firstLocality : secondLocality) : firstLocality

  return {
    detailPart,
    city: cleanText(city, 100),
    neighborhood: cleanText(neighborhood, 100),
    purpose,
  }
}

export function parsePropertyDraftData(message: string, payload?: Record<string, unknown>) {
  const normalized = normalizeForIntent(message)
  const fixedCommand = parseFixedPropertyDraftCommand(message)
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
  const resolvedCity = fixedCommand.city || city
  const resolvedNeighborhood = fixedCommand.neighborhood || neighborhood
  const resolvedPurpose = fixedCommand.purpose ?? purpose
  const bedrooms = Number(payload?.bedrooms) || (bedroomsMatch ? Number(bedroomsMatch[1]) : 0)
  const bathrooms = Number(payload?.bathrooms) || (bathroomsMatch ? Number(bathroomsMatch[1]) : 0)
  const parkingSpots = Number(payload?.parkingSpots ?? payload?.parking) || (parkingMatch ? Number(parkingMatch[1]) : 0)
  const area = cleanText(payload?.area, 40) || cleanText(areaMatch?.[0], 40)
  const parsedPrice = parseBrazilianMoney(payload?.price) ?? parseBrazilianMoney(message)
  const price = parsedPrice && !parsedPrice.outOfRange ? parsedPrice.value : 0
  const title = cleanText(payload?.title, 160) || [typeLabel, bedrooms ? `${bedrooms} dormitórios` : "", neighborhood ? `no ${neighborhood}` : ""].filter(Boolean).join(" ")
  const descriptionParts = [
    cleanText(payload?.description, 2000),
    area ? `Área informada: ${area}.` : "",
    features.length ? `Características: ${features.join(", ")}.` : "",
  ].filter(Boolean)

  return {
    title: title || `${typeLabel} em rascunho`,
    city: resolvedCity,
    neighborhood: resolvedNeighborhood,
    price,
    parsedPriceRaw: parsedPrice?.raw ?? "",
    parsedPriceFinal: price || null,
    priceOutOfRange: parsedPrice?.outOfRange ?? false,
    bedrooms,
    bathrooms,
    parkingSpots,
    type,
    purpose: resolvedPurpose,
    area,
    features,
    description: descriptionParts.join("\n"),
  }
}

export function getDateOnly(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(date: Date, days: number) {
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

export function parseFixedAgendaListRange(message: string) {
  const normalized = normalizeForIntent(message)
  const start = normalized.includes("amanha") ? addDays(getDateOnly(new Date()), 1) : parseAgendaDate(message)
  const end = new Date(start)
  end.setDate(start.getDate() + (normalized.includes("mes") || normalized.includes("mês") ? 31 : normalized.includes("semana") ? 7 : 1))
  const pendingOnly = /\b(pendente|pendentes|abertos|em aberto)\b/.test(normalized)
  const label = pendingOnly
    ? "pendente"
    : normalized.includes("amanha")
      ? "de amanhã"
      : normalized.includes("semana")
        ? "da próxima semana"
        : normalized.includes("mes") || normalized.includes("mês")
          ? "do próximo mês"
          : normalized.includes("hoje")
            ? "de hoje"
            : `de ${formatAgendaDateLabel(message, start)}`
  return { start, end, label, pendingOnly }
}

function parseFixedProposalCommand(message: string) {
  const match = message.match(/(?:criar|gerar|cadastrar)\s+proposta\s*:?\s*([^,\n]+?)\s+im[oó]vel\s+(\d{1,6})/i)
  if (!match) return { personName: "", publicCode: null as number | null }
  const publicCode = Number(match[2])
  return {
    personName: cleanText(match[1], 120),
    publicCode: Number.isInteger(publicCode) && publicCode > 0 ? publicCode : null,
  }
}

function extractPersonName(message: string) {
  const directMatch = message.match(/\bpara\s+([\p{L}]+(?:\s+[\p{L}]+)?)/iu)
  if (directMatch?.[1]) {
    return cleanText(directMatch[1].replace(/\b(?:no|na|do|da|imóvel|imovel|apartamento|casa|terreno)\b.*$/i, ""), 120)
  }
  const cleaned = message
    .replace(/\b(gerar|gere|criar|crie|proposta|documento|contrato|para|do|da|no|na|imovel|imóvel)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleanText(cleaned.split(/\s+(?:apartamento|casa|terreno|centro)\b/i)[0], 120)
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

async function findLeadCandidates(brokerId: string, personName: string, take = 4) {
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

function extractAgendaPersonName(message: string) {
  const match = message.match(/\b(?:com|para)\s+([\p{L}]+(?:\s+[\p{L}]+)?)/iu)
  return cleanText(match?.[1]?.replace(/\b(?:no|na|imóvel|imovel|apartamento|casa|terreno)\b.*$/i, ""), 120)
}

function extractPropertyReference(message: string) {
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

function firstImageUrl(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
}

export type PendingAssessorContext = {
  action: AssessorAction
  missingField: string
  parsedData: Record<string, unknown>
  createdAt: Date
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function workspaceEntityFromPayload(payload?: Record<string, unknown>) {
  const workspace = metadataRecord(payload?.workspace)
  const selection = Array.isArray(workspace.selection)
    ? workspace.selection.find((item) => item && typeof item === "object")
    : null
  const selectionRecord = metadataRecord(selection)

  return {
    workspace,
    entity: cleanText(workspace.entity, 40) || cleanText(selectionRecord.entity, 40),
    entityId: cleanText(workspace.entityId, 120) || cleanText(selectionRecord.entityId, 120),
  }
}

async function resolveWorkspaceScope(brokerId: string, payload?: Record<string, unknown>) {
  const workspacePayload = workspaceEntityFromPayload(payload)
  const { entity, entityId, workspace } = workspacePayload
  if (!entity || !entityId) {
    return {
      workspace,
      entity,
      entityId,
      lead: null,
      property: null,
      document: null,
    }
  }

  if (entity === "lead") {
    const lead = await prisma.lead.findFirst({
      where: { brokerId, id: entityId },
      select: { id: true, name: true, phone: true, email: true },
    })
    return { workspace, entity, entityId, lead, property: null, document: null }
  }

  if (entity === "property") {
    const property = await prisma.property.findFirst({
      where: { brokerId, id: entityId },
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
    return { workspace, entity, entityId, lead: null, property, document: null }
  }

  if (entity === "contract" || entity === "proposal" || entity === "document") {
    const document = await prisma.brokerDocument.findFirst({
      where: { brokerId, id: entityId },
      select: { id: true, type: true, title: true, leadId: true, propertyId: true },
    })

    const [lead, property] = await Promise.all([
      document?.leadId
        ? prisma.lead.findFirst({
            where: { brokerId, id: document.leadId },
            select: { id: true, name: true, phone: true, email: true },
          })
        : null,
      document?.propertyId
        ? prisma.property.findFirst({
            where: { brokerId, id: document.propertyId },
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
        : null,
    ])

    return { workspace, entity, entityId, lead, property, document }
  }

  return {
    workspace,
    entity,
    entityId,
    lead: null,
    property: null,
    document: null,
  }
}

export async function getPendingAssessorContext(brokerId: string, conversationId?: string | null): Promise<PendingAssessorContext | null> {
  const recent = await prisma.emeMessage.findFirst({
    where: {
      brokerId,
      channel: "assessor_eme",
      actionStatus: { in: ["processing", "needs_input"] },
      ...(conversationId ? { metadata: { path: ["conversationId"], equals: conversationId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { actionType: true, metadata: true, createdAt: true },
  })
  if (!recent || !isAssessorAction(recent.actionType)) return null
  if (Date.now() - recent.createdAt.getTime() > 30 * 60 * 1000) return null

  const metadata = metadataRecord(recent.metadata)
  const required = Array.isArray(metadata.required) ? metadata.required : []
  const missingField = typeof required[0] === "string" ? required[0] : ""
  if (!missingField) return null

  return {
    action: recent.actionType,
    missingField,
    parsedData: metadataRecord(metadata.parsedData),
    createdAt: recent.createdAt,
  }
}

export function resolveAssessorInputWithContext(input: {
  message: string
  requestedAction?: string
  pendingContext?: PendingAssessorContext | null
}) {
  const inferred = inferAssessorAction(input.message, input.requestedAction)
  if (!input.pendingContext) return { action: inferred, payload: {} }

  const normalized = normalizeForIntent(input.message).trim()
  const shouldContinue =
    inferred === "general" ||
    /^\d+$/.test(normalized) ||
    /^(sim|s|primeiro|segunda|segundo|terceiro|terceira|ok|pode|gerar)$/.test(normalized) ||
    input.message.trim().split(/\s+/).length <= 4

  return {
    action: shouldContinue ? input.pendingContext.action : inferred,
    payload: shouldContinue ? { pendingContext: input.pendingContext } : {},
  }
}

function formatAgendaDateLabel(message: string, date: Date) {
  const normalized = normalizeForIntent(message)
  if (normalized.includes("amanha")) return "amanhã"
  if (normalized.includes("hoje")) return "hoje"
  return date.toLocaleDateString("pt-BR")
}

function resolvePropertyChoice(message: string, options: Array<{ id?: string; title?: string }>) {
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

async function findProposalPropertyCandidates(
  brokerId: string,
  message: string,
  propertyReference: { publicCode?: number | null; idOrCode?: string; neighborhood?: string; type?: PropertyType | null; price?: number | null; parsedPriceRaw?: string },
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
  const OR = [
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
    ...(propertyReference.type ? [{ type: propertyReference.type }] : []),
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
    AND.push({ type: propertyReference.type })
  }
  if (OR.length) {
    AND.push({ OR })
  }

  return prisma.property.findMany({
    where: { brokerId, ...(AND.length ? { AND } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: { id: true, publicCode: true, title: true, city: true, neighborhood: true, description: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true, imageUrls: true },
  })
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
  if (isFixedAssessorGreeting(message) || isAssessorGreeting(message)) return "general"
  if (/\b(minhas notificacoes|minhas notificações|o que preciso revisar|resumo da operacao|resumo da operação|pendencias de hoje|pendências de hoje)\b/.test(normalized)) return "createInternalNotification"
  if (/^\s*cadastrar\s+im[oó]vel\s*:/i.test(message)) return "createPropertyDraft"
  if (/^\s*buscar\s+im[oó]vel\s*:/i.test(message)) return "searchProperties"
  if (/^\s*(criar|gerar|cadastrar)\s+proposta\s*:/i.test(message)) return "CREATE_PROPOSAL"
  if (/^\s*cadastrar\s+lead\s*:/i.test(message)) return "createLead"
  if (/^\s*agendar\s+compromisso\s*:/i.test(message)) return "CREATE_AGENDA_EVENT"
  if (/\b(minha agenda|agenda de|agenda da proxima|agenda do proximo|agenda da próxima|agenda do próximo)\b/.test(normalized)) return "LIST_AGENDA_EVENTS"
  if (/\b(analisar leads|resumo dos leads|como estao meus leads|como estão meus leads)\b/.test(normalized)) return "getLeadsSummary"
  if (/\b(relatorio analytics|relatório analytics|analisar analytics|como esta meu catalogo|como está meu catálogo)\b/.test(normalized)) return "getAnalyticsSummary"
  if (/\b(analisar financeiro|resumo financeiro|como esta meu financeiro|como está meu financeiro)\b/.test(normalized)) return "getFinancialSummary"
  if (/\b(resumo|como esta|como estao|quantas|quantos|quais|mostrar|mostre|ver)\b/.test(normalized) && /\b(leads|lead|clientes|contatos)\b/.test(normalized)) return "getLeadsSummary"
  if (/\b(resumo|como esta|como estao|quantas|quantos|quais|acessos|visitas|visualizacoes|visualiz)\b/.test(normalized) && /\b(analytics|acessos|visitas|visualizacoes|visualiz|vistos)\b/.test(normalized)) return "getAnalyticsSummary"
  if (/\b(resumo|como esta|como estao|quantos|buscas|publicados|catalogo)\b/.test(normalized) && /\b(catalogo|imoveis publicados|buscas)\b/.test(normalized)) return "getCatalogSummary"
  if (/\b(resumo|valor|carteira|ticket|ativos|financeiro|comissao)\b/.test(normalized) && /\b(financeiro|carteira|ticket|ativos|comissao)\b/.test(normalized)) return "getFinancialSummary"
  if (/\b(marcar|marque|concluir|feito|finalizar)\b/.test(normalized) && /\b(agenda|visita|lembrete|tarefa|compromisso)\b/.test(normalized)) return "MARK_AGENDA_DONE"
  if (/\b(quais|mostrar|mostre|listar|lista|ver)\b/.test(normalized) && /\b(agenda|visitas|lembretes|compromissos|tarefas)\b/.test(normalized)) return "LIST_AGENDA_EVENTS"
  if (/\b(agendar|agenda|lembrar|lembrete|visita|evento|tarefa)\b/.test(normalized)) return "CREATE_AGENDA_EVENT"
  if (/\b(mostrar|mostre|listar|lista|documentos)\b/.test(normalized) && /\b(documento|documentos|proposta|propostas)\b/.test(normalized)) return "LIST_DOCUMENTS"
  if (/\b(enviar|envie|abrir|me envie|ver)\b/.test(normalized) && /\b(documento|proposta)\b/.test(normalized)) return "GET_DOCUMENT"
  if (/\b(mostrar|mostre|listar|lista|ver)\b/.test(normalized) && /\b(contrato|contratos)\b/.test(normalized)) return "LIST_CONTRACTS"
  if (/\b(enviar|envie|abrir|me envie|ver)\b/.test(normalized) && /\b(contrato|contratos)\b/.test(normalized)) return "GET_CONTRACT"
  if (/\b(gerar|gere|criar|crie|fazer|faca|cadastrar|cadastre)\b/.test(normalized) && /\b(contrato|contratos)\b/.test(normalized)) return "CREATE_CONTRACT"
  if (/\b(gerar|gere|criar|crie|fazer|faca|cadastrar|cadastre)\b/.test(normalized) && /\b(proposta|documento)\b/.test(normalized)) return "CREATE_PROPOSAL"
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
  if ((normalized.includes("contrato") || normalized.includes("contratos")) && (normalized.includes("criar") || normalized.includes("gerar") || normalized.includes("cadastar") || normalized.includes("cadastrar"))) return "CREATE_CONTRACT"
  if ((normalized.includes("contrato") || normalized.includes("contratos")) && (normalized.includes("listar") || normalized.includes("lista") || normalized.includes("mostrar") || normalized.includes("mostre"))) return "LIST_CONTRACTS"
  if ((normalized.includes("contrato") || normalized.includes("contratos")) && (normalized.includes("abrir") || normalized.includes("ver") || normalized.includes("enviar") || normalized.includes("envie"))) return "GET_CONTRACT"
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
  if (!brokerId) {
    throw new Error("SEARCH_PROPERTIES sem brokerId.")
  }

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
    const filters = { publicCode, codeSearch: true }
    return { results: property ? [property] : [], filters }
  }

  const filters = parsePropertySearchFilters(query)
  if (filters.priceOutOfRange) {
    return {
      results: [],
      filters: {
        ...filters,
        blockedByPriceLimit: true,
      },
    }
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

export async function runLegacyAssessorAction({
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
  const pendingContext = metadataRecord(payload?.pendingContext) as Partial<PendingAssessorContext>
  const workspaceScope = await resolveWorkspaceScope(brokerId, payload)
  if (!brokerId) {
    return {
      response: "Não encontrei seu cadastro de corretor vinculado a este WhatsApp.",
      metadata: { noCharge: true, errorReason: "missing_broker_id" },
    }
  }

  const brokerExists = await prisma.broker.findUnique({
    where: { id: brokerId },
    select: { id: true },
  })
  if (!brokerExists) {
    return {
      response: "Não encontrei seu cadastro de corretor vinculado a este WhatsApp.",
      metadata: { noCharge: true, errorReason: "broker_not_found" },
    }
  }

  const namedClientReference = detectNamedClientReference(message)
  if (namedClientReference) {
    const matches = await prisma.lead.findMany({
      where: { brokerId, name: { contains: namedClientReference, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })
    if (matches.length === 1) {
      const lead = matches[0]
      return {
        response: `Encontrei o cliente ${lead.name ?? namedClientReference}. Ainda não consigo executar essa ação automaticamente, mas já localizei o cadastro certo — em breve isso será liberado por aqui.`,
        metadata: { leadId: lead.id, matchedByName: true, resolvedExisting: true },
        leadId: lead.id,
      }
    }
    if (matches.length > 1) {
      return {
        response: `Encontrei ${matches.length} clientes chamados "${namedClientReference}": ${matches.map((item) => item.name ?? "Sem nome").join(", ")}. Me diga qual deles para eu continuar.`,
        metadata: { leadIds: matches.map((item) => item.id), matchedByName: true, ambiguous: true },
      }
    }
    return {
      response: `Não encontrei nenhum cliente chamado "${namedClientReference}".`,
      metadata: { matchedByName: true, resolvedExisting: false },
    }
  }

  if (action === "CREATE_AGENDA_EVENT") {
    if (pendingContext.action === "CREATE_AGENDA_EVENT" && pendingContext.missingField === "time") {
      const parsedData = metadataRecord(pendingContext.parsedData)
      const time = parseAgendaTime(message)
      if (!time) {
        return {
          response: "Qual horário devo colocar?",
          metadata: { required: ["time"], noCharge: true, parsedData },
        }
      }
      const title = cleanText(parsedData.title, 160) || "Compromisso"
      const type = cleanText(parsedData.type, 40) || "task"
      const date = typeof parsedData.date === "string" ? new Date(parsedData.date) : new Date()
      const event = await prisma.agendaEvent.create({
        data: { brokerId, title, type, date, time, notes: message, status: "pending" },
      })
      await prisma.notification.create({ data: { userId, title: "Compromisso agendado", message: `${title} ${formatAgendaDateLabel(message, date)} às ${time}.`, read: false } })
      return {
        response: `Compromisso criado ✅\n${formatAgendaDateLabel(message, date)} às ${time} — ${title}.`,
        metadata: { agendaEventId: event.id, parsedData: { ...parsedData, time }, status: "pending" },
      }
    }

    const date = parseAgendaDate(message)
    const time = parseAgendaTime(message) || "não informado"
    const type = parseAgendaType(message)
    const personName = extractAgendaPersonName(message)
    const propertyReference = extractPropertyReference(message)
    const [lead, property] = await Promise.all([
      personName
        ? prisma.lead.findFirst({ where: { brokerId, name: { contains: personName, mode: "insensitive" } }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } })
        : workspaceScope.lead
          ? Promise.resolve({ id: workspaceScope.lead.id, name: workspaceScope.lead.name })
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
        : workspaceScope.property
          ? Promise.resolve({ id: workspaceScope.property.id, title: workspaceScope.property.title })
          : null,
    ])
    const baseTitle = parseAgendaTitle(message)
    const title = cleanText(`${baseTitle}${lead?.name || personName ? ` com ${lead?.name ?? personName}` : ""}${property ? ` no ${property.title}` : ""}`, 160)
    if (!time && Boolean(payload?.requireTime)) {
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
        time: time || null,
        leadId: lead?.id ?? null,
        propertyId: property?.id ?? null,
        notes: message,
        status: "pending",
      },
    })
    await prisma.notification.create({ data: { userId, title: "Compromisso agendado", message: `${title} ${formatAgendaDateLabel(message, date)} às ${time}.`, read: false } })
    return {
      response: `Compromisso criado ✅\n${title} — ${formatAgendaDateLabel(message, date)}.\nHorário: ${time || "não informado"}.`,
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
    const range = parseFixedAgendaListRange(message)
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
    const fixedProposal = parseFixedProposalCommand(message)
    const pendingParsedData = pendingContext.action === "CREATE_PROPOSAL" ? metadataRecord(pendingContext.parsedData) : {}
    const pendingPropertyReference = metadataRecord(pendingParsedData.propertyReference)
    const pendingLeadIds = Array.isArray(pendingParsedData.leadIds) ? pendingParsedData.leadIds.map((id) => cleanText(id, 80)).filter(Boolean) : []
    const isManualProposalConfirmation =
      pendingContext.missingField === "lead" &&
      pendingParsedData.awaitingManualConfirmation === true &&
      /^(sim|s|pode|gerar manual|isso|ok|claro)$/i.test(normalizeForIntent(message).trim())
    const personName = fixedProposal.personName || (pendingContext.missingField === "lead"
      ? cleanText(pendingParsedData.personName, 120) || cleanText(message, 120)
      : cleanText(pendingParsedData.personName, 120) || extractPersonName(message) || cleanText(workspaceScope.lead?.name, 120))
    const selectedLeadId = pendingContext.missingField === "lead" && pendingLeadIds.length
      ? pendingLeadIds[Math.max(0, Number.parseInt(message.replace(/\D/g, ""), 10) - 1)] ?? null
      : workspaceScope.lead?.id ?? null
    const propertyReference = {
      ...extractPropertyReference(message),
      publicCode: fixedProposal.publicCode ?? extractPropertyReference(message).publicCode ?? workspaceScope.property?.publicCode ?? null,
      idOrCode:
        cleanText(pendingPropertyReference.idOrCode, 80) ||
        cleanText(pendingParsedData.propertyId, 80) ||
        extractPropertyReference(message).idOrCode ||
        workspaceScope.property?.id ||
        "",
      neighborhood: cleanText(pendingPropertyReference.neighborhood, 80) || cleanText(pendingParsedData.propertyNeighborhood, 80) || cleanText(pendingParsedData.propertyTerm, 120) || extractPropertyReference(message).neighborhood,
      type: (cleanText(pendingPropertyReference.type, 40) as PropertyType | "") || extractPropertyReference(message).type,
      price: Number(pendingPropertyReference.price ?? pendingParsedData.propertyPrice) || extractPropertyReference(message).price,
      parsedPriceRaw: cleanText(pendingPropertyReference.parsedPriceRaw, 80) || cleanText(pendingParsedData.parsedPriceRaw, 80) || extractPropertyReference(message).parsedPriceRaw,
    }
    const propertyOptions = Array.isArray(pendingParsedData.propertyOptions) ? pendingParsedData.propertyOptions as Array<{ id?: string; title?: string }> : []
    const selectedOption =
      pendingContext.missingField === "propertyChoice"
        ? resolvePropertyChoice(message, propertyOptions)
        : null
    const [broker, matchingLeads, selectedProperty] = await Promise.all([
      prisma.broker.findUnique({ where: { id: brokerId }, include: { user: { select: { name: true, email: true, photoUrl: true } } } }),
      selectedLeadId
        ? prisma.lead.findMany({ where: { brokerId, id: selectedLeadId }, take: 1, select: { id: true, name: true, phone: true, email: true } })
        : personName
        ? findLeadCandidates(brokerId, personName, 4)
        : workspaceScope.lead
          ? Promise.resolve([workspaceScope.lead])
          : [],
      workspaceScope.property
        ? Promise.resolve(workspaceScope.property)
        : selectedOption?.id
        ? prisma.property.findFirst({
            where: { brokerId, id: selectedOption.id },
            select: { id: true, publicCode: true, title: true, city: true, neighborhood: true, description: true, price: true, purpose: true, type: true, bedrooms: true, parkingSpots: true, imageUrls: true },
          })
        : null,
    ])
    if (!selectedLeadId && matchingLeads.length > 1) {
      return {
        response: `Encontrei mais de um ${personName}. Qual deles devo usar?\n\n${matchingLeads.map((leadItem, index) => `${index + 1}. ${leadItem.name || "Sem nome"} ${leadItem.phone ? `- ${leadItem.phone}` : ""}`).join("\n")}`,
        metadata: {
          required: ["lead"],
          noCharge: true,
          parsedData: {
            personName,
            leadIds: matchingLeads.map((leadItem) => leadItem.id),
            propertyReference,
            propertyTerm: message,
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
    if (!lead && !personName && !isManualProposalConfirmation) {
      return {
        response: personName ? "Não encontrei esse lead cadastrado.\nQuer gerar manualmente?" : "Para qual cliente devo gerar a proposta?",
        metadata: { required: ["lead"], noCharge: true, parsedData: { personName, propertyReference, propertyTerm: cleanText(pendingParsedData.propertyTerm, 160) || message, awaitingManualConfirmation: Boolean(personName) } },
      }
    }
    const propertyCandidates = selectedProperty
      ? []
      : await findProposalPropertyCandidates(brokerId, cleanText(pendingParsedData.propertyTerm, 160) || message, propertyReference, 4)
    if (propertyCandidates.length > 1) {
      return {
        response: `Encontrei mais de um imóvel. Qual devo usar?\n\n${propertyCandidates.map((item, index) => `${index + 1}. ${item.publicCode ? `Imóvel ${item.publicCode} — ` : ""}${item.title} — ${item.neighborhood ?? "Sem bairro"} — ${item.city} — ${formatAssessorPropertyPrice(item.price)}`).join("\n")}`,
        metadata: {
          required: ["propertyChoice"],
          noCharge: true,
          parsedData: {
            personName,
            propertyReference,
            propertyTerm: cleanText(pendingParsedData.propertyTerm, 160) || message,
            propertyPrice: propertyReference.price,
            parsedPriceRaw: propertyReference.parsedPriceRaw,
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
        response: "Não encontrei esse imóvel no seu catálogo.\nPode me mandar o título ou bairro?",
        metadata: { required: ["property"], noCharge: true, leadId: lead?.id ?? null, parsedData: { personName, propertyReference, awaitingManualConfirmation: isManualProposalConfirmation } },
        leadId: lead?.id,
      }
    }
    const proposalLead = lead ?? {
      id: null,
      name: personName || "Cliente não informado",
      phone: null,
      email: null,
    }
    const title = `Proposta ${proposalLead.name ?? (personName || resolvedProperty?.title || "EME")}`
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
          broker: { name: broker?.user.name ?? "", phone: broker?.phone, email: broker?.user.email, city: resolvedProperty.city, creci: broker?.creci, photoUrl: broker?.user.photoUrl },
        }),
        status: "draft",
      },
    })
    await prisma.notification.create({ data: { userId, title: "Proposta gerada", message: `Proposta para ${proposalLead.name || personName || "cliente"} foi salva em Documentos.`, read: false } })
    return {
      response: `Proposta criada em rascunho ✅
Cliente: ${proposalLead.name || personName || "Cliente"}
Imóvel: ${resolvedProperty.publicCode ?? resolvedProperty.id}
Revise e preencha os dados restantes antes de enviar.`,
      metadata: { documentId: document.id, leadId: lead?.id ?? null, propertyId: resolvedProperty.id, parsedData: { personName, title, propertyReference, manualLead: !lead }, status: "draft" },
      leadId: lead?.id,
      propertyId: resolvedProperty.id,
    }
  }

  if (action === "CREATE_CONTRACT") {
    const normalized = normalizeForIntent(message)
    const personName = extractPersonName(message) || cleanText(workspaceScope.lead?.name, 120)
    const propertyReference = extractPropertyReference(message)
    const contractKind =
      normalized.includes("locacao comercial") || normalized.includes("aluguel comercial")
        ? "Locacao comercial"
        : normalized.includes("locacao") || normalized.includes("aluguel")
          ? "Locacao residencial"
          : normalized.includes("autorizacao")
            ? "Autorizacao de venda"
            : normalized.includes("exclusividade")
              ? "Exclusividade"
              : normalized.includes("visita")
                ? "Termo de visita"
                : normalized.includes("reserva")
                  ? "Reserva"
                  : normalized.includes("aditivo")
                    ? "Aditivo"
                    : normalized.includes("distrato")
                      ? "Distrato"
                      : "Compra e venda"

    const [broker, matchingLeads] = await Promise.all([
      prisma.broker.findUnique({ where: { id: brokerId }, include: { user: { select: { name: true, email: true } } } }),
      personName ? findLeadCandidates(brokerId, personName, 4) : workspaceScope.lead ? Promise.resolve([workspaceScope.lead]) : [],
    ])

    if (matchingLeads.length > 1) {
      return {
        response: `Encontrei mais de um cliente com esse nome. Qual deles devo usar?\n\n${matchingLeads.map((leadItem, index) => `${index + 1}. ${leadItem.name || "Sem nome"}${leadItem.phone ? ` - ${leadItem.phone}` : ""}`).join("\n")}`,
        metadata: {
          required: ["lead"],
          noCharge: true,
          parsedData: {
            personName,
            contractKind,
            leadIds: matchingLeads.map((leadItem) => leadItem.id),
            propertyReference,
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
        metadata: { required: ["lead"], noCharge: true, parsedData: { personName, contractKind, propertyReference } },
      }
    }

    const propertyCandidates = workspaceScope.property ? [workspaceScope.property] : await findProposalPropertyCandidates(brokerId, message, propertyReference, 4)
    if (propertyCandidates.length > 1) {
      return {
        response: `Encontrei mais de um imovel. Qual devo usar no contrato?\n\n${propertyCandidates.map((item, index) => `${index + 1}. ${item.publicCode ? `Imovel ${item.publicCode} - ` : ""}${item.title} - ${item.city}`).join("\n")}`,
        metadata: {
          required: ["propertyChoice"],
          noCharge: true,
          parsedData: {
            personName,
            contractKind,
            propertyReference,
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

    const resolvedProperty = propertyCandidates[0] ?? null
    if (!resolvedProperty) {
      return {
        response: "Qual imovel devo vincular a este contrato?",
        metadata: { required: ["property"], noCharge: true, parsedData: { personName, contractKind, leadId: lead.id, propertyReference } },
        leadId: lead.id,
      }
    }

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
      response: `Contrato criado em rascunho.\nCliente: ${lead.name || "Cliente"}\nImovel: ${resolvedProperty.publicCode ?? resolvedProperty.id}\nRevise, edite e exporte em Documentos > Contratos.`,
      metadata: {
        documentId: document.id,
        leadId: lead.id,
        propertyId: resolvedProperty.id,
        parsedData: { personName, contractKind },
        status: "draft",
      },
      leadId: lead.id,
      propertyId: resolvedProperty.id,
    }
  }

  if (action === "LIST_DOCUMENTS" || action === "GET_DOCUMENT") {
    const personName = extractPersonName(message)
    const propertyReference = extractPropertyReference(message)
    const lead = personName
      ? await prisma.lead.findFirst({ where: { brokerId, name: { contains: personName, mode: "insensitive" } }, select: { id: true } })
      : workspaceScope.lead
        ? { id: workspaceScope.lead.id }
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
      : workspaceScope.property
        ? { id: workspaceScope.property.id }
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

  if (action === "LIST_CONTRACTS" || action === "GET_CONTRACT") {
    const personName = extractPersonName(message)
    const propertyReference = extractPropertyReference(message)
    const lead = personName
      ? await prisma.lead.findFirst({ where: { brokerId, name: { contains: personName, mode: "insensitive" } }, select: { id: true } })
      : workspaceScope.lead
        ? { id: workspaceScope.lead.id }
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
      : workspaceScope.property
        ? { id: workspaceScope.property.id }
        : null
    const documents = await prisma.brokerDocument.findMany({
      where: {
        brokerId,
        type: "contract",
        ...(lead?.id ? { leadId: lead.id } : {}),
        ...(property?.id ? { propertyId: property.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: action === "GET_CONTRACT" ? 1 : 5,
      include: { property: { select: { title: true } }, lead: { select: { name: true } } },
    })
    if (action === "GET_CONTRACT") {
      const document = documents[0]
      return {
        response: document ? `${document.title}\n\n${contractHtmlToText(parseContractContent(document.content).html).slice(0, 1200)}` : "Nao encontrei contratos com esse filtro.",
        metadata: { documentId: document?.id ?? null, resultsCount: documents.length, parsedData: { personName, propertyReference } },
      }
    }
    return {
      response: documents.length
        ? `Encontrei ${documents.length} contrato${documents.length === 1 ? "" : "s"}:\n\n${documents.map((document) => `- ${document.title}${document.property?.title ? ` - ${document.property.title}` : ""}`).join("\n")}`
        : "Nao encontrei contratos com esse filtro.",
      metadata: { documentIds: documents.map((document) => document.id), resultsCount: documents.length, parsedData: { personName, propertyReference } },
    }
  }

  if (action === "searchProperties") {
    const startedAt = Date.now()
    const parsedPriceForLog = parseBrazilianMoney(message)
    try {
      if (pendingContext.action === "searchProperties" && pendingContext.missingField === "propertyChoice") {
        const pendingParsedData = metadataRecord(pendingContext.parsedData)
        const propertyOptions = Array.isArray(pendingParsedData.propertyOptions) ? pendingParsedData.propertyOptions as Array<{ id?: string; title?: string }> : []
        const selectedOption = resolvePropertyChoice(message, propertyOptions)
        if (selectedOption?.id) {
          const property = await prisma.property.findFirst({ where: { brokerId, id: selectedOption.id } })
          if (property) {
            return {
              response: `Imóvel ${property.publicCode ?? "-"} — ${property.title}\n${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""} — ${formatAssessorPropertyPrice(property.price)}\n\nQuer gerar proposta ou ver detalhes?`,
              metadata: { propertyId: property.id, publicCode: property.publicCode, actionStatus: "success", durationMs: Date.now() - startedAt },
              propertyId: property.id,
            }
          }
        }
      }
      const searchResult = await searchBrokerProperties(brokerId, message)
      const properties = searchResult.results
      const filters = searchResult.filters as typeof searchResult.filters & {
        priceOutOfRange?: boolean
        parsedPriceRaw?: string
        parsedPriceFinal?: number | null
      }
      if (filters.priceOutOfRange) {
        return {
          response: "O valor informado parece alto demais. Pode confirmar o valor do imóvel?",
          metadata: {
            required: ["price"],
            noCharge: true,
            propertySearchFilters: filters,
            originalMessage: message,
            parsedPriceRaw: filters.parsedPriceRaw,
            parsedPriceFinal: null,
            actionStatus: "needs_input",
            durationMs: Date.now() - startedAt,
          },
        }
      }
      if (properties.length === 1) {
        const property = properties[0]
        return {
          response: `Encontrei este imóvel:\n\nImóvel ${property.publicCode ?? "-"} — ${property.title}\n${property.city}${property.neighborhood ? `, ${property.neighborhood}` : ""} — ${formatAssessorPropertyPrice(property.price)}\n\nQuer gerar proposta ou ver detalhes?`,
          metadata: {
            propertyIds: [property.id],
            propertySearchFilters: filters,
            resultCount: 1,
            originalMessage: message,
            parsedPriceRaw: filters.parsedPriceRaw,
            parsedPriceFinal: filters.parsedPriceFinal,
            actionStatus: "success",
            durationMs: Date.now() - startedAt,
          },
          propertyId: property.id,
        }
      }
      if (properties.length > 1) {
        const propertyOptions = properties.map((property) => ({ id: property.id, title: property.title }))
        return {
          response: `Encontrei mais de um imóvel:\n\n${properties
            .map((property, index) => `${index + 1}. ${property.title} — ${property.neighborhood ?? property.city} — ${formatAssessorPropertyPrice(property.price)}`)
            .join("\n")}\n\nQual deles você quer?`,
          metadata: {
            required: ["propertyChoice"],
            propertyIds: properties.map((property) => property.id),
            propertySearchFilters: filters,
            resultCount: properties.length,
            originalMessage: message,
            parsedPriceRaw: filters.parsedPriceRaw,
            parsedPriceFinal: filters.parsedPriceFinal,
            actionStatus: "success",
            durationMs: Date.now() - startedAt,
            // propertyOptions precisa ficar aninhado em parsedData: updateWorkflowFromExecutionResult
            // so copia para pendingInput.parsedData o que estiver aqui dentro, nao no nivel raiz.
            parsedData: {
              propertyOptions,
              options: properties.map((property) => ({
                id: property.id,
                label: property.title,
                description: `${property.neighborhood ?? property.city} — ${formatAssessorPropertyPrice(property.price)}`,
              })),
            },
          },
        }
      }
      if (properties.length === 0) {
        return {
          response: "Não encontrei imóveis com esses dados.\nEnvie assim: Buscar imóvel: apartamento até 790 mil em Vacaria.",
          metadata: {
            propertyIds: [],
            propertySearchFilters: filters,
            resultCount: 0,
            originalMessage: message,
            parsedPriceRaw: filters.parsedPriceRaw,
            parsedPriceFinal: filters.parsedPriceFinal,
            actionStatus: "success",
            durationMs: Date.now() - startedAt,
          },
        }
      }
      return {
        response: properties.length
          ? `Encontrei ${properties.length} imóvel${properties.length === 1 ? "" : "is"}:\n\n${properties
              .map((property, index) => `${index + 1}. ${property.publicCode ? `Imóvel ${property.publicCode} — ` : ""}${property.title} — ${formatAssessorPropertyPrice(property.price)}${property.neighborhood || property.city ? ` — ${property.neighborhood ?? property.city}` : ""}`)
              .join("\n")}\n\nQuer que eu te mande mais detalhes de algum?`
          : "Não encontrei imóveis com esses filtros. Quer que eu tente uma busca mais ampla?",
        metadata: {
          propertyIds: properties.map((property) => property.id),
          propertySearchFilters: filters,
          resultCount: properties.length,
          originalMessage: message,
          parsedPriceRaw: filters.parsedPriceRaw,
          parsedPriceFinal: filters.parsedPriceFinal,
          actionStatus: "success",
          durationMs: Date.now() - startedAt,
        },
      }
    } catch (caughtError) {
      console.error("[eme-backend][search-properties][failed]", {
        actionName: "searchProperties",
        originalMessage: message,
        brokerId,
        userId,
        parsedPriceRaw: parsedPriceForLog?.raw ?? "",
        parsedPriceFinal: parsedPriceForLog && !parsedPriceForLog.outOfRange ? parsedPriceForLog.value : null,
        errorMessage: caughtError instanceof Error ? caughtError.message : "unknown",
        errorStack: caughtError instanceof Error ? caughtError.stack : undefined,
        durationMs: Date.now() - startedAt,
      })
      throw caughtError
    }
  }
  if (action === "getFinancialSummary") {
    const properties = await prisma.property.findMany({ where: { brokerId } })
    const total = properties.reduce((sum, property) => sum + Math.max(0, property.price), 0)
    const active = properties.filter((property) => property.published || property.status === PropertyStatus.PUBLISHED).length
    const inactive = properties.length - active
    const average = properties.length ? Math.round(total / properties.length) : 0
    return {
      response: `Resumo financeiro:\n\n• Imóveis cadastrados: ${properties.length}\n• Valor da carteira: ${formatAssessorPropertyPrice(total)}\n• Ticket médio: ${formatAssessorPropertyPrice(average)}\n• Ativos: ${active}\n• Inativos/rascunhos: ${inactive}`,
      metadata: { totalProperties: properties.length, activeProperties: active, inactiveProperties: inactive, averageTicket: average, totalPortfolioValue: total },
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
          ? `Relatório Analytics:\n\n• Visualizações do catálogo: ${views}\n• Cliques no WhatsApp: ${whatsappClicks}\n• Leads recebidos: ${context.leads.length}\n• Imóveis monitorados: ${context.properties.length}`
          : `Seu catálogo tem ${published} imóveis publicados, ${views} visualizações e ${searches} buscas recentes.`,
      metadata: { properties: context.properties.length, published, leads: context.leads.length, views, whatsappClicks, searches },
    }
  }

  if (action === "createInternalNotification") {
    const today = getDateOnly(new Date())
    const tomorrow = addDays(today, 1)
    const [draftProperties, upcomingEvents, pastEvents, draftDocuments, todayClicks, newLeads] = await Promise.all([
      prisma.property.count({ where: { brokerId, OR: [{ status: PropertyStatus.DRAFT }, { published: false }] } }),
      prisma.agendaEvent.count({ where: { brokerId, status: "pending", date: { gte: today, lt: addDays(today, 7) } } }),
      prisma.agendaEvent.count({ where: { brokerId, status: "pending", date: { lt: today } } }),
      prisma.brokerDocument.count({ where: { brokerId, status: "draft" } }),
      prisma.catalogEvent.count({ where: { brokerId, eventType: "whatsapp_click", createdAt: { gte: today, lt: tomorrow } } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.NEW } }),
    ])
    return {
      response: `Resumo da operação:\n\n• Imóveis em rascunho: ${draftProperties}\n• Compromissos próximos: ${upcomingEvents}\n• Compromissos atrasados: ${pastEvents}\n• Propostas em rascunho: ${draftDocuments}\n• Cliques do catálogo hoje: ${todayClicks}\n• Leads novos: ${newLeads}`,
      metadata: { draftProperties, upcomingEvents, pastEvents, draftDocuments, todayClicks, newLeads },
    }
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
    const property = workspaceScope.property ?? (await searchBrokerProperties(brokerId, message, 1)).results[0]
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
    const pendingLeadData = pendingContext.action === "createLead" ? metadataRecord(pendingContext.parsedData) : {}
    const extracted = extractLeadData(message)
    const name =
      cleanText(payload?.name, 120) ||
      cleanText(pendingLeadData.extractedName, 120) ||
      cleanText(pendingLeadData.name, 120) ||
      extracted.name
    const phone = normalizePhone(payload?.phone) || normalizePhone(pendingLeadData.phone) || extracted.phone
    if (!name) {
      return {
        response: "Qual o nome do lead?",
        metadata: { required: ["name"], readyForConfirmation: false, parsedData: pendingLeadData },
      }
    }
    if (!phone && Boolean(payload?.requirePhone)) {
      return {
        response: "Qual o telefone dele?",
        metadata: { required: ["phone"], readyForConfirmation: false, extractedName: name, parsedData: { ...pendingLeadData, extractedName: name } },
      }
    }

    const requestedStatus = parseLeadStatusFromText(message)
    const existingLead = phone ? await prisma.lead.findFirst({
      where: { brokerId, phone },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    }) : null
    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: { name, phone: phone || null, source: "assessor_eme", status: requestedStatus, message },
        })
      : await prisma.lead.create({
          data: {
            name,
            phone: phone || null,
            source: "assessor_eme",
            status: requestedStatus,
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
    if (!phone) {
      return {
        response: "Lead cadastrado ✅\nFaltou telefone.",
        metadata: { leadId: lead.id, phone, name, status: requestedStatus, updatedExisting: Boolean(existingLead) },
        leadId: lead.id,
      }
    }
    return {
      response: existingLead ? "Esse lead já existia. Atualizei as informações 👌" : `Lead ${name} cadastrado com sucesso 👌`,
      metadata: { leadId: lead.id, phone, name, status: requestedStatus, updatedExisting: Boolean(existingLead) },
      leadId: lead.id,
    }
  }

  if (action === "createPropertyDraft") {
    const startedAt = Date.now()
    const messagePriceForLog = parseBrazilianMoney(message)
    const payloadPriceForLog = parseBrazilianMoney(payload?.price)
    try {
      const pendingDraft = pendingContext.action === "createPropertyDraft" ? metadataRecord(pendingContext.parsedData) : {}
      const parsedDraft = parsePropertyDraftData(message, payload)
      const messagePrice = messagePriceForLog
      const payloadPrice = payloadPriceForLog
      const pendingPrice = parseBrazilianMoney(pendingDraft.price)?.value ?? (Number(pendingDraft.price ?? 0) || null)
      const priceOutOfRange = Boolean(messagePrice?.outOfRange || payloadPrice?.outOfRange || pendingDraft.priceOutOfRange)
      const resolvedPrice = priceOutOfRange
        ? 0
        : messagePrice?.value ?? payloadPrice?.value ?? pendingPrice ?? parsedDraft.price ?? 0
      const draft = {
        ...parsedDraft,
        ...pendingDraft,
        title: cleanText(pendingDraft.title, 160) || parsedDraft.title,
        city: cleanText(pendingDraft.city, 100) || parsedDraft.city || "Não informada",
        neighborhood: cleanText(pendingDraft.neighborhood, 100) || parsedDraft.neighborhood || null,
        description: cleanText(pendingDraft.description, 2000) || parsedDraft.description,
        bedrooms: Number(pendingDraft.bedrooms ?? parsedDraft.bedrooms) || 0,
        bathrooms: Number(pendingDraft.bathrooms ?? parsedDraft.bathrooms) || 0,
        parkingSpots: Number(pendingDraft.parkingSpots ?? parsedDraft.parkingSpots) || 0,
        type: (cleanText(pendingDraft.type, 40) as PropertyType) || parsedDraft.type || "APARTMENT",
        purpose: cleanText(pendingDraft.purpose, 20) || parsedDraft.purpose || "SALE",
        price: resolvedPrice,
        parsedPriceRaw: messagePrice?.raw ?? payloadPrice?.raw ?? (cleanText(pendingDraft.parsedPriceRaw, 80) || parsedDraft.parsedPriceRaw),
        parsedPriceFinal: resolvedPrice || null,
        priceOutOfRange,
        imageUrl: cleanText(pendingDraft.imageUrl, 2000),
      } as ReturnType<typeof parsePropertyDraftData> & { imageUrl: string }
      if (draft.priceOutOfRange) {
        return {
          response: "O valor informado parece alto demais. Pode confirmar o valor do imóvel?",
          metadata: {
            required: ["price"],
            noCharge: true,
            parsedData: draft,
            parsedPriceRaw: draft.parsedPriceRaw,
            parsedPriceFinal: null,
          },
        }
      }
      if (!draft.price && Boolean(payload?.requirePrice)) {
        return {
          response: "Qual o valor do imóvel?",
          metadata: { required: ["price"], noCharge: true, parsedData: draft, parsedPriceRaw: draft.parsedPriceRaw, parsedPriceFinal: null },
        }
      }

      const missingFields = [
        draft.price ? "" : "valor",
        draft.city && draft.city !== "Não informada" && draft.city !== "Não informada" ? "" : "cidade",
        draft.neighborhood ? "" : "bairro",
        draft.area ? "" : "metragem",
        draft.parkingSpots ? "" : "vagas",
      ].filter(Boolean)
      const propertyLimit = await canCreateBrokerProperties(brokerId)
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

      const publicCode = await getNextPropertyPublicCode(prisma, brokerId)
      const property = await prisma.property.create({
        data: {
          publicCode,
          title: draft.title || "Imóvel em rascunho",
          city: draft.city || "Não informada",
          neighborhood: draft.neighborhood || null,
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
          imageUrls: draft.imageUrl ? [draft.imageUrl] : undefined,
        },
      })
      await prisma.notification.create({ data: { userId, title: "Imóvel criado em rascunho", message: "Revise antes de publicar.", read: false } })
      return {
        response: `Imóvel criado em rascunho ✅
Código: ${property.publicCode ?? publicCode}
${missingFields.length ? `Faltou preencher: ${missingFields.join(" e ")}.
` : ""}Revise antes de publicar.`,
        metadata: {
          propertyId: property.id,
          publicCode: property.publicCode,
          parsedData: draft,
          parsedPriceRaw: draft.parsedPriceRaw,
          parsedPriceFinal: draft.parsedPriceFinal,
          missingFields,
          actionStatus: "success",
          durationMs: Date.now() - startedAt,
          mediaHandling: {
            prepared: true,
            status: draft.imageUrl ? "saved" : "no_image_provided",
          },
        },
        propertyId: property.id,
      }
    } catch (caughtError) {
      console.error("[eme-backend][create-property-draft][failed]", {
        actionName: "createPropertyDraft",
        originalMessage: message,
        brokerId,
        userId,
        payload,
        parsedPriceRaw: messagePriceForLog?.raw ?? payloadPriceForLog?.raw ?? "",
        parsedPriceFinal: messagePriceForLog && !messagePriceForLog.outOfRange
          ? messagePriceForLog.value
          : payloadPriceForLog && !payloadPriceForLog.outOfRange
            ? payloadPriceForLog.value
            : null,
        errorMessage: caughtError instanceof Error ? caughtError.message : "unknown",
        errorStack: caughtError instanceof Error ? caughtError.stack : undefined,
        durationMs: Date.now() - startedAt,
      })
      throw caughtError
    }
  }

  if (action === "getLeadsSummary") {
    const [leadTotal, leadNew, contacted, negotiating, won, lost] = await Promise.all([
      prisma.lead.count({ where: { brokerId } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.NEW } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.CONTACTED } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.NEGOTIATING } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.WON } }),
      prisma.lead.count({ where: { brokerId, status: LeadStatus.LOST } }),
    ])
    const inProgress = contacted + negotiating
    return {
      response: `Seus leads:\n\n• Total: ${leadTotal}\n• Novos: ${leadNew}\n• Em atendimento: ${inProgress}\n• Convertidos: ${won}\n• Perdidos: ${lost}`,
      metadata: { total: leadTotal, newLeads: leadNew, inProgress, won, lost },
    }
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

export async function runAssessorAction(input: {
  brokerId: string
  userId: string
  message: string
  action: AssessorAction
  confirm?: boolean
  payload?: Record<string, unknown>
}) {
  return runLegacyAssessorAction(input)
}

export async function generateAssessorText(message: string, action: AssessorAction, actionResponse: string) {
  if (isFixedAssessorGreeting(message) || isAssessorGreeting(message)) return FIXED_ASSESSOR_MENU_RESPONSE
  if (isLikelyUnknownAssessorMessage(message, action)) return FIXED_ASSESSOR_FALLBACK_RESPONSE

  const client = getOpenAIClient()
  if (!client) return actionResponse || ASSESSOR_FALLBACK_RESPONSE

  const { model } = getOpenAIEnv()
  const response = await createOpenAIResponse({
    client,
    operationKey: "assessor.whatsapp.reply",
    metadata: {
      action,
    },
    request: {
    model,
    max_output_tokens: 120,
    instructions:
      "Você é o Assessor EME no WhatsApp: concierge comercial e SDR imobiliário para corretores. Responda em 1 a 4 linhas, natural e direto. Uma ação por vez. Sem onboarding, manual, listas grandes, linguagem técnica ou textão. Se a ação já foi executada, apenas confirme e sugira o próximo passo. Nunca diga que não tem acesso ao CRM. Não execute ações destrutivas nem altere créditos ou imóveis sem confirmação explícita.",
    input: [`Ação detectada: ${action}`, `Pedido do corretor: ${message}`, actionResponse ? `Resultado interno: ${actionResponse}` : "Resultado interno: Oi 👋 Sou o Assessor EME.\n\nPosso ajudar com:\n• imóveis\n• leads\n• anúncios\n• atendimentos\n\nO que você precisa?"].join("\n"),
    },
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
  const response = await createOpenAIResponse({
    client,
    operationKey: "corretor_eme.reply",
    metadata: {
      intent: input.intent,
      suggestionCount: input.suggestions.length,
    },
    request: {
    model,
    max_output_tokens: 420,
    instructions:
      "Você é o Corretor EME, IA de pré-atendimento no WhatsApp do próprio corretor. Qualifique leads com educação, colete intenção, cidade, tipo de imóvel, faixa de preço e telefone. Não prometa fechamento, não marque convertido/perdido sem confirmação humana e encaminhe para humano quando necessário.",
    input: [
      `Mensagem do cliente: ${input.message}`,
      `Intenção detectada: ${input.intent}`,
      `Imóveis sugeridos: ${input.suggestions.map((property) => `${property.title} em ${property.neighborhood ?? property.city} por ${formatCurrencyBRLFromCents(property.price)}`).join("; ") || "nenhum"}`,
    ].join("\n"),
    },
  })
  return response.output_text.trim()
}
