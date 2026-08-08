import { createWhatsAppUrl } from "@/lib/whatsapp"

export const EME_SUPPORT_WHATSAPP_NUMBER = "(11) 98888-0000"

export const SUPPORT_CATEGORIES = [
  "Dúvida",
  "Problema técnico",
  "Financeiro",
  "Sugestão",
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]

function normalizePlanLabel(planName: string | null | undefined) {
  if (!planName) return "Free"

  const normalized = planName.replace(/^Plano EME\s+/i, "").replace(/^Plano\s+/i, "").trim()
  if (!normalized) return "Free"
  if (/scale|business/i.test(normalized)) return "Scale"
  if (/pro/i.test(normalized)) return "Pro"
  if (/free/i.test(normalized)) return "Free"

  return normalized
}

export function getBrokerSupportPlanLabel(planName: string | null | undefined) {
  return normalizePlanLabel(planName)
}

export function buildSupportWhatsAppMessage(input: {
  category?: SupportCategory | ""
  description: string
  brokerName: string
  planName: string | null | undefined
  pagePath: string
  date: Date
}) {
  const brokerName = input.brokerName.trim() || "Corretor"
  const category = input.category || "Não informada"
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(input.date)

  return [
    "Olá!",
    "",
    "Preciso de suporte no EME.",
    "",
    `Categoria: ${category}`,
    "",
    "Descrição:",
    input.description.trim(),
    "",
    "---",
    `Nome: ${brokerName}`,
    `Plano: ${getBrokerSupportPlanLabel(input.planName)}`,
    `Página: ${input.pagePath || "/"}`,
    `Data: ${formattedDate}`,
  ].join("\n")
}

export function createBrokerSupportWhatsAppUrl(input: {
  category?: SupportCategory | ""
  description: string
  brokerName: string
  planName: string | null | undefined
  pagePath: string
  date?: Date
}) {
  const message = buildSupportWhatsAppMessage({
    ...input,
    date: input.date ?? new Date(),
  })

  return createWhatsAppUrl(EME_SUPPORT_WHATSAPP_NUMBER, message)
}
