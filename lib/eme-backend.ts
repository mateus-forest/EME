import { LeadStatus, PropertyStatus } from "@/lib/prisma-enums"

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

export function inferAssessorAction(message: string, requestedAction?: string): AssessorAction {
  if (requestedAction === "create_ad") return "createPropertyDraft"
  if (requestedAction === "improve_description") return "improvePropertyDescription"
  if (requestedAction === "reply_client") return "summarizeLead"
  if (requestedAction === "match_properties") return "searchProperties"
  if (requestedAction === "analyze_catalog") return "analyzeCatalog"
  if (requestedAction === "lead_ideas") return "getAnalyticsSummary"
  if (assessorActions.includes(requestedAction as AssessorAction)) return requestedAction as AssessorAction

  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  if (normalized.includes("cadastrar lead") || normalized.includes("criar lead")) return "createLead"
  if (normalized.includes("buscar imovel") || normalized.includes("procurar imovel") || normalized.includes("listar imoveis")) return "searchProperties"
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
  const terms = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2)

  const properties = await prisma.property.findMany({
    where: { brokerId },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  return properties
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
    .filter((item) => terms.length === 0 || item.score > 0)
    .sort((first, second) => second.score - first.score || second.property.viewsCount - first.property.viewsCount)
    .slice(0, limit)
    .map(({ property }) => property)
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
    return {
      response: properties.length
        ? `Encontrei ${properties.length} imóvel(is): ${properties.map((property) => `${property.title} (${formatCurrencyBRLFromCents(property.price)})`).join("; ")}.`
        : "Não encontrei imóveis do seu catálogo com esses critérios.",
      metadata: { propertyIds: properties.map((property) => property.id) },
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
    const name = cleanText(payload?.name, 120)
    const phone = normalizePhone(payload?.phone)
    if (!confirm || !name || !phone) {
      return {
        response: "Posso cadastrar o lead, mas preciso de confirmação e dos campos mínimos: nome e telefone.",
        metadata: { required: ["name", "phone"], readyForConfirmation: Boolean(name && phone) },
      }
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        source: "assessor_eme",
        status: LeadStatus.NEW,
        brokerId,
        message,
      },
    })
    await prisma.notification.create({ data: { userId, title: "Lead criado pelo Assessor EME", message: `${name} foi cadastrado no CRM.`, read: false } })
    return { response: `Lead ${name} cadastrado com sucesso.`, metadata: { leadId: lead.id }, leadId: lead.id }
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
  if (!client) return actionResponse || "Modo avaliação: IA não está ativa neste ambiente. A estrutura do Assessor EME está pronta para operar quando OPENAI_ENABLED estiver ativo."

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 700,
    instructions:
      "Você é o Assessor EME, assistente operacional oficial do EME para corretores individuais. Ajude com tarefas internas: cadastrar lead, buscar imóveis, criar rascunho de imóvel, melhorar descrição, resumir lead, analisar catálogo, financeiro e analytics. Não execute ações perigosas sem confirmação. Seja claro, comercial e objetivo.",
    input: [`Ação detectada: ${action}`, `Pedido do corretor: ${message}`, actionResponse ? `Resultado interno: ${actionResponse}` : ""].join("\n"),
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
