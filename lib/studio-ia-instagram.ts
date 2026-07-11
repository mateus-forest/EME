import "server-only"

import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"

export const studioInstagramGoals = [
  "Venda",
  "Captacao",
  "Lancamento",
  "Alto padrao",
  "Investimento",
  "Aluguel",
] as const

export const studioInstagramIdentities = [
  "Moderna",
  "Luxo",
  "Minimalista",
  "Comercial",
] as const

export const studioInstagramRequestSchema = z.object({
  propertyId: z.string().trim().min(1).max(191),
  goal: z.enum(studioInstagramGoals),
  identity: z.enum(studioInstagramIdentities),
  version: z.number().int().min(1).max(20).default(1),
})

export const studioInstagramResultSchema = z.object({
  postFeed: z.object({
    title: z.string().trim().min(1).max(120),
    highlight: z.string().trim().min(1).max(180),
    support: z.string().trim().min(1).max(220),
  }),
  story: z.object({
    kicker: z.string().trim().min(1).max(80),
    line1: z.string().trim().min(1).max(120),
    line2: z.string().trim().min(1).max(160),
  }),
  carousel: z.array(z.string().trim().min(1).max(220)).min(3).max(3),
  caption: z.string().trim().min(1).max(1400),
  cta: z.string().trim().min(1).max(120),
  hashtags: z.array(z.string().trim().min(2).max(40)).min(4).max(8),
})

export type StudioInstagramRequest = z.infer<typeof studioInstagramRequestSchema>
export type StudioInstagramResult = z.infer<typeof studioInstagramResultSchema>

export type StudioInstagramPropertyContext = {
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
}

function buildInstagramPrompt(input: StudioInstagramRequest, property: StudioInstagramPropertyContext) {
  return [
    "Crie uma campanha imobiliaria pronta para Instagram em portugues do Brasil.",
    `Objetivo da campanha: ${input.goal}.`,
    `Identidade visual da campanha: ${input.identity}.`,
    `Versao solicitada: ${input.version}. Gere uma abordagem nova e diferente das versoes anteriores, mantendo coerencia comercial.`,
    "",
    "Contexto do imovel:",
    `Titulo: ${property.title}`,
    `Tipo: ${property.type}`,
    `Finalidade: ${property.purpose}`,
    `Localizacao: ${property.location || [property.neighborhood, property.city].filter(Boolean).join(", ")}`,
    `Cidade: ${property.city}`,
    `Bairro: ${property.neighborhood}`,
    `Preco: ${property.price}`,
    `Quartos: ${property.bedrooms}`,
    `Banheiros: ${property.bathrooms}`,
    `Vagas: ${property.parkingSpots}`,
    `Status: ${property.status}`,
    `Descricao atual: ${property.description || "Nao informada"}`,
    "",
    "Orientacoes:",
    "Nao invente informacoes factuais que nao estejam no contexto do imovel.",
    "Escreva com tom comercial, sofisticado e objetivo, apropriado para um corretor de imoveis no Brasil.",
    "Faça o texto parecer pronto para publicacao, sem mencionar IA, prompt, algoritmo ou bastidores.",
    "Quando faltar algum detalhe, seja elegante e generico sem afirmar caracteristicas nao fornecidas.",
    "As hashtags devem comecar com # e ser relevantes ao imovel, objetivo, cidade ou mercado imobiliario.",
  ].join("\n")
}

export async function generateInstagramCampaign(
  input: StudioInstagramRequest,
  property: StudioInstagramPropertyContext,
) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 1400,
    instructions:
      "Voce e o Studio IA do EME, especialista em marketing imobiliario para corretores. Entregue campanhas claras, comerciais e prontas para revisao final pelo corretor, sempre em portugues do Brasil.",
    input: buildInstagramPrompt(input, property),
    text: {
      format: {
        type: "json_schema",
        name: "studio_ia_instagram_campaign",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            postFeed: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                highlight: { type: "string" },
                support: { type: "string" },
              },
              required: ["title", "highlight", "support"],
            },
            story: {
              type: "object",
              additionalProperties: false,
              properties: {
                kicker: { type: "string" },
                line1: { type: "string" },
                line2: { type: "string" },
              },
              required: ["kicker", "line1", "line2"],
            },
            carousel: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "string" },
            },
            caption: { type: "string" },
            cta: { type: "string" },
            hashtags: {
              type: "array",
              minItems: 4,
              maxItems: 8,
              items: { type: "string" },
            },
          },
          required: ["postFeed", "story", "carousel", "caption", "cta", "hashtags"],
        },
      },
    },
  })

  const parsed = studioInstagramResultSchema.parse(JSON.parse(response.output_text))
  return {
    ...parsed,
    hashtags: parsed.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`)),
  } satisfies StudioInstagramResult
}
