import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getEmeCreditCost } from "@/lib/eme-plans"
import { getOpenAIClient } from "@/lib/openai-server"

export const brokerAssistantActionTypes = [
  "general",
  "create_ad",
  "improve_description",
  "reply_client",
  "match_properties",
  "analyze_catalog",
  "lead_ideas",
] as const

export const brokerAssistantSchema = z.object({
  prompt: z.string().trim().min(3).max(3000),
  actionType: z.enum(brokerAssistantActionTypes).default("general"),
})

export type BrokerAssistantActionType = z.infer<typeof brokerAssistantSchema>["actionType"]

const defaultActionCosts: Record<BrokerAssistantActionType, number> = {
  general: 1,
  create_ad: 2,
  improve_description: 1,
  reply_client: 1,
  match_properties: 2,
  analyze_catalog: 3,
  lead_ideas: 1,
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function getBrokerAssistantCreditCost(actionType: BrokerAssistantActionType) {
  const specificKey = `BROKER_M_CREDIT_COST_${actionType.toUpperCase()}`
  const centralCost = actionType === "create_ad" ? getEmeCreditCost("create_ad") : defaultActionCosts[actionType]
  return readPositiveInt(specificKey, readPositiveInt("BROKER_M_CREDIT_COST_DEFAULT", centralCost))
}

function buildAssistantPrompt(prompt: string, actionType: BrokerAssistantActionType) {
  return [
    `Tipo de acao: ${actionType}`,
    `Pedido do corretor: ${prompt}`,
    "",
    "Responda em portugues do Brasil, com tom direto, comercial e util para um corretor de imoveis.",
    "Nao prometa integracao com WhatsApp, nao invente dados privados e nao solicite chaves ou informacoes sensiveis.",
    "Quando a tarefa envolver cliente ou imovel, entregue uma resposta pronta para revisar antes de enviar.",
  ].join("\n")
}

export async function generateBrokerAssistantResponse(prompt: string, actionType: BrokerAssistantActionType) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 650,
    instructions:
      "Voce e o Assessor EME, canal oficial de IA dentro de um SaaS imobiliario para corretores individuais. Ajude o corretor a cadastrar leads, buscar imoveis no catalogo, cadastrar imoveis, criar anuncios, resumir atendimentos e executar tarefas operacionais. Seja objetivo, pratico e seguro.",
    input: buildAssistantPrompt(prompt, actionType),
  })

  return response.output_text.trim()
}
