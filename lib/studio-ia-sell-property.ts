import "server-only"

import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"

export const studioSellPropertyRequestSchema = z.object({
  propertyId: z.string().trim().min(1).max(191),
  version: z.number().int().min(1).max(20).default(1),
})

export const studioSellPropertyResultSchema = z.object({
  salesStrategy: z.string().trim().min(1).max(1000),
  recommendedAudience: z.string().trim().min(1).max(240),
  mainCampaign: z.string().trim().min(1).max(260),
  caption: z.string().trim().min(1).max(1200),
  cta: z.string().trim().min(1).max(140),
  whatsappText: z.string().trim().min(1).max(1000),
  timeline: z.array(z.string().trim().min(1).max(240)).min(3).max(4),
  nextActions: z.array(z.string().trim().min(1).max(220)).min(3).max(5),
  applicableFlows: z.array(z.string().trim().min(1).max(120)).min(3).max(4),
})

export type StudioSellPropertyRequest = z.infer<typeof studioSellPropertyRequestSchema>
export type StudioSellPropertyResult = z.infer<typeof studioSellPropertyResultSchema>

export type StudioSellPropertyContext = {
  id: string
  title: string
  city: string
  neighborhood: string
  location: string
  type: string
  purpose: string
  price: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  description: string
  status: string
  hasImages: boolean
  likelyUnderConstruction: boolean
}

function buildSellPropertyPrompt(input: StudioSellPropertyRequest, property: StudioSellPropertyContext) {
  const applicableConstruction = property.likelyUnderConstruction
    ? "Inclua explicitamente o fluxo Transformar obra em imovel pronto como parte relevante da operacao."
    : "Considere o fluxo Transformar obra em imovel pronto apenas se fizer sentido; se nao for aplicavel, priorize Instagram, Atrair compradores e Captar proprietarios."

  return [
    "Crie um plano comercial consolidado para vender um imovel no mercado imobiliario brasileiro.",
    `Versao solicitada: ${input.version}. Gere uma abordagem nova, mantendo coerencia comercial.`,
    "",
    "Contexto do imovel:",
    `Titulo: ${property.title}`,
    `Tipo: ${property.type}`,
    `Finalidade: ${property.purpose}`,
    `Localizacao: ${property.location}`,
    `Cidade: ${property.city}`,
    `Bairro: ${property.neighborhood}`,
    `Preco: ${property.price}`,
    `Quartos: ${property.bedrooms}`,
    `Banheiros: ${property.bathrooms}`,
    `Vagas: ${property.parkingSpots}`,
    `Status: ${property.status}`,
    `Tem imagens cadastradas: ${property.hasImages ? "sim" : "nao"}`,
    `Indicacao de obra/em desenvolvimento: ${property.likelyUnderConstruction ? "sim" : "nao"}`,
    `Descricao atual: ${property.description || "Nao informada"}`,
    "",
    "Fluxos que este orquestrador deve considerar:",
    "- Criar campanha para Instagram",
    "- Atrair compradores",
    "- Captar proprietarios",
    "- Transformar obra em imovel pronto, quando aplicavel",
    "",
    "Regras:",
    applicableConstruction,
    "Nao invente fatos que nao estejam no contexto do imovel.",
    "Escreva em portugues do Brasil, com tom comercial, sofisticado e objetivo.",
    "O plano deve parecer pronto para revisao final de um corretor.",
    "Nao mencione IA, prompt, algoritmo, automacao ou bastidores.",
    "Em proximas acoes, entregue orientacoes praticas e acionaveis.",
  ].join("\n")
}

export async function generateSellPropertyPlan(
  input: StudioSellPropertyRequest,
  property: StudioSellPropertyContext,
) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 1800,
    instructions:
      "Voce e o Studio IA do EME, especialista em planejamento comercial imobiliario para corretores. Monte um plano consolidado de venda com foco em clareza, persuasao e execucao pratica no mercado brasileiro.",
    input: buildSellPropertyPrompt(input, property),
    text: {
      format: {
        type: "json_schema",
        name: "studio_ia_sell_property_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            salesStrategy: { type: "string" },
            recommendedAudience: { type: "string" },
            mainCampaign: { type: "string" },
            caption: { type: "string" },
            cta: { type: "string" },
            whatsappText: { type: "string" },
            timeline: {
              type: "array",
              minItems: 3,
              maxItems: 4,
              items: { type: "string" },
            },
            nextActions: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: { type: "string" },
            },
            applicableFlows: {
              type: "array",
              minItems: 3,
              maxItems: 4,
              items: { type: "string" },
            },
          },
          required: [
            "salesStrategy",
            "recommendedAudience",
            "mainCampaign",
            "caption",
            "cta",
            "whatsappText",
            "timeline",
            "nextActions",
            "applicableFlows",
          ],
        },
      },
    },
  })

  return studioSellPropertyResultSchema.parse(JSON.parse(response.output_text))
}
