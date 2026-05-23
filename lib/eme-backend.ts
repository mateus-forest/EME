import { LeadStatus, PropertyStatus, PropertyType } from "@/lib/prisma-enums"

import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { prisma } from "@/lib/prisma"

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
] as const

export type AssessorAction = (typeof assessorActions)[number]

export function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

export function normalizePhone(value: unknown) {
  return cleanText(value, 40).replace(/[^\d+]/g, "")
}

function normalizeForIntent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
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

function parsePropertySearchFilters(message: string) {
  const normalized = normalizeForIntent(message)
  const priceMatch = normalized.match(/(?:ate|até|maximo|max|abaixo de|menos de)\s*(?:r\$)?\s*(\d+(?:[\.,]\d+)?)(?:\s*(mil|mi|milhao|milhoes))?/)
  const rawPrice = priceMatch ? Number(priceMatch[1].replace(",", ".")) : null
  const maxPrice =
    rawPrice === null || Number.isNaN(rawPrice)
      ? null
      : Math.round(rawPrice * (priceMatch?.[2]?.startsWith("mi") ? 1_000_000 : priceMatch?.[2] === "mil" || rawPrice < 10000 ? 1000 : 1) * 100)
  const cityMatch = normalized.match(/\b(?:em|na cidade de|cidade)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:ate|até|com|no bairro|bairro|e|$)|$)/)
  const neighborhoodMatch = normalized.match(/\b(?:bairro|no bairro|na regiao|regiao)\s+([a-zà-ÿ\s-]{3,60})(?:\s+(?:ate|até|com|e|$)|$)/)
  const bedroomsMatch = normalized.match(/(\d+)\s*(?:quartos|dormitorios|dormitórios)/)
  const type = normalized.includes("casa")
    ? "HOUSE"
    : normalized.includes("apartamento") || normalized.includes("apto")
      ? "APARTMENT"
      : normalized.includes("terreno")
        ? "LAND"
        : normalized.includes("sala")
          ? "OFFICE"
          : normalized.includes("loja")
            ? "STORE"
            : normalized.includes("cobertura")
              ? "PENTHOUSE"
              : null

  return {
    maxPrice,
    city: cleanText(cityMatch?.[1], 80),
    neighborhood: cleanText(neighborhoodMatch?.[1], 80),
    bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : null,
    type,
  }
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
  if (/\b(cadastrar|cadastre|criar|crie|salvar|salva|adicionar|adicione|incluir|inclua)\b.*\b(lead|contato|cliente)\b/.test(normalized)) return "createLead"
  if (/\b(lead|contato|cliente)\b/.test(normalized) && /\d{8,}/.test(normalized)) return "createLead"
  if (/\b(buscar|busca|procurar|procura|listar|quero|preciso|acha|encontra)\b/.test(normalized) && /\b(imovel|imoveis|casa|apartamento|apto|terreno|sala|loja|cobertura)\b/.test(normalized)) return "searchProperties"
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
    .filter((term) => term.length > 2)

  const properties = await prisma.property.findMany({
    where: {
      brokerId,
      ...(filters.maxPrice ? { price: { lte: filters.maxPrice } } : {}),
      ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
      ...(filters.neighborhood ? { neighborhood: { contains: filters.neighborhood, mode: "insensitive" } } : {}),
      ...(filters.bedrooms ? { bedrooms: { gte: filters.bedrooms } } : {}),
      ...(filters.type ? { type: filters.type as PropertyType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

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
    .filter((item) => terms.length === 0 || filters.maxPrice || filters.city || filters.neighborhood || filters.type || filters.bedrooms || item.score > 0)
    .sort((first, second) => second.score - first.score || second.property.viewsCount - first.property.viewsCount)
    .slice(0, limit)
    .map(({ property }) => property)

  await prisma.searchEvent.create({
    data: {
      brokerId,
      query,
      filters,
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

  return results
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
  confirm,
  payload,
}: {
  brokerId: string
  userId: string
  message: string
  action: AssessorAction
  confirm?: boolean
  payload?: Record<string, unknown>
}) {
  if (action === "searchProperties") {
    const properties = await searchBrokerProperties(brokerId, message)
    const filters = parsePropertySearchFilters(message)
    return {
      response: properties.length
        ? `Encontrei ${properties.length} opção(ões):\n${properties
            .map((property) => `• ${property.title} | ${property.neighborhood ?? property.city} | ${formatCurrencyBRLFromCents(property.price)} | ${property.bedrooms} quarto(s) | ID ${property.id.slice(-6)}`)
            .join("\n")}\nQuer refinar por bairro, quartos ou garagem?`
        : "Não encontrei opção nesse filtro. Quer ampliar valor ou cidade?",
      metadata: { propertyIds: properties.map((property) => property.id), propertySearchFilters: filters },
    }
  }

  if (action === "getFinancialSummary") {
    const properties = await prisma.property.findMany({ where: { brokerId } })
    const total = properties.reduce((sum, property) => sum + Math.max(0, property.price), 0)
    return {
      response: `Sua carteira tem ${properties.length} imóvel(is), valor total estimado de ${formatCurrencyBRLFromCents(total)} e comissão potencial de ${formatCurrencyBRLFromCents(Math.round(total * 0.06))} usando 6%.`,
      metadata: { totalProperties: properties.length, totalPortfolioValue: total },
    }
  }

  if (action === "getAnalyticsSummary" || action === "analyzeCatalog") {
    const context = await buildBrokerContext(brokerId)
    const views = context.events.reduce((sum, item) => sum + (item.eventType.includes("view") ? item._count._all : 0), 0)
    return {
      response: `Seu catálogo tem ${context.properties.length} imóvel(is), ${context.leads.length} lead(s) e ${views} visualização(ões) registradas. Imóvel mais recente: ${context.properties[0]?.title ?? "nenhum cadastrado"}.`,
      metadata: { properties: context.properties.length, leads: context.leads.length, views },
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
    const properties = await searchBrokerProperties(brokerId, message, 1)
    const property = properties[0]
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
    const title = cleanText(payload?.title, 160)
    const city = cleanText(payload?.city, 100)
    const price = parseCurrencyInputToCents(payload?.price)
    if (!confirm || !title || !city || price === null) {
      return {
        response: "Posso preparar o rascunho do imóvel, mas preciso de confirmação e dos campos mínimos: título, cidade e preço.",
        metadata: { required: ["title", "city", "price"], readyForConfirmation: Boolean(title && city && price !== null) },
      }
    }

    const property = await prisma.property.create({
      data: {
        title,
        city,
        neighborhood: cleanText(payload?.neighborhood, 100) || null,
        price,
        description: cleanText(payload?.description, 2000) || null,
        status: PropertyStatus.DRAFT,
        published: false,
        brokerId,
      },
    })
    await prisma.notification.create({ data: { userId, title: "Rascunho criado pelo Assessor EME", message: `${title} foi criado como rascunho.`, read: false } })
    return { response: `Rascunho do imóvel ${title} criado com sucesso.`, metadata: { propertyId: property.id }, propertyId: property.id }
  }

  return { response: "", metadata: {} }
}

export async function generateAssessorText(message: string, action: AssessorAction, actionResponse: string) {
  const client = getOpenAIClient()
  if (!client) return actionResponse || "Oi 👋 Sou o Assessor EME.\n\nPosso ajudar com:\n• imóveis\n• leads\n• anúncios\n• atendimentos\n\nO que você precisa?"

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 160,
    instructions:
      "Você é o Assessor EME no WhatsApp. Responda como concierge comercial humano: curto, natural e operacional. Máximo 2 a 5 linhas. Nunca faça onboarding gigante, manual, lista enorme ou texto corporativo. Faça uma pergunta por vez. Assuma defaults inteligentes. Execute primeiro e pergunte depois. Nunca diga que não tem acesso ao CRM. Se houver Resultado interno, preserve a informação e deixe mais WhatsApp/mobile.",
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
