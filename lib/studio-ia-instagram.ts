import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"
import type { StudioProviderResult } from "@/lib/studio-providers/types"
import { createXaiStructuredOutput, XAI_MODELS } from "@/lib/studio-providers/xai"

const OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED = "OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED"

export const studioInstagramGoals = [
  "Venda",
  "Captacao",
  "Lancamento",
  "Alto padrao",
  "Investimento",
  "Aluguel",
] as const

export const studioInstagramRequestSchema = z.object({
  propertyId: z.string().trim().min(1).max(191),
  goal: z.enum(studioInstagramGoals),
  provider: z.enum(["openai", "xai"]).default("openai"),
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

export function buildInstagramPrompt(input: StudioInstagramRequest, property: StudioInstagramPropertyContext) {
  return [
    "Crie uma campanha imobiliaria pronta para Instagram em portugues do Brasil.",
    `Objetivo da campanha: ${input.goal}.`,
    `Versao solicitada: ${input.version}. Gere uma abordagem nova e coerente com o contexto do imovel.`,
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
    "Escreva com tom comercial, sofisticado, objetivo e conciso, apropriado para um corretor de imoveis no Brasil.",
    "Gere apenas o conteudo editorial da campanha. O template oficial do Studio IA sera responsavel por toda a composicao visual.",
    "Nao descreva layout, grid, tipografia, badge, logo, sombras, overlays ou posicionamento.",
    "Priorize frases curtas, titulos fortes e leitura rapida.",
    "Evite palavras longas demais quando houver alternativa mais curta equivalente.",
    "Para o post feed, entregue titulo, subtitulo e apoio com estrutura enxuta, adequada para destaque sobre a imagem do imovel.",
    "Para o story, entregue leitura ainda mais rapida, com titulo forte e poucos elementos textuais.",
    "Entregue somente o conteudo final da campanha, pronto para ser aplicado no template oficial.",
    "Quando faltar algum detalhe, seja elegante e generico sem afirmar caracteristicas nao fornecidas.",
    "As hashtags devem comecar com # e ser relevantes ao imovel, objetivo, cidade ou mercado imobiliario.",
  ].join("\n")
}

function normalizeCampaignResult(result: StudioInstagramResult) {
  return {
    ...result,
    hashtags: result.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`)),
  } satisfies StudioInstagramResult
}

async function generateInstagramCampaignWithOpenAI(
  input: StudioInstagramRequest,
  property: StudioInstagramPropertyContext,
): Promise<StudioProviderResult<StudioInstagramResult>> {
  const startedAt = Date.now()
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await createOpenAIResponse({
    client,
    operationKey: "studio.instagram",
    metadata: {
      propertyId: property.id,
      goal: input.goal,
      version: input.version,
    },
    request: {
      model,
      max_output_tokens: 2200,
      reasoning: {
        effort: "minimal",
      },
      instructions:
        "Voce e o Studio IA do EME, especialista em marketing imobiliario para corretores. Responda apenas com o JSON do schema solicitado, sem texto adicional, sempre em portugues do Brasil.",
      input: buildInstagramPrompt(input, property),
      text: {
        verbosity: "low",
        format: zodTextFormat(studioInstagramResultSchema, "studio_ia_instagram_campaign"),
      },
    },
  })

  if (response.status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens") {
    console.error("[studio-ia][instagram][openai-response-truncated]", {
      message: OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED,
      status: response.status,
      incompleteDetails: response.incomplete_details,
      rawResponseText: typeof response.output_text === "string" ? response.output_text.slice(0, 6000) : "",
      responseOutput: JSON.stringify(response.output ?? []).slice(0, 6000),
    })
    throw new Error(OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED)
  }

  const parsed = studioInstagramResultSchema.parse(JSON.parse(response.output_text))
  return {
    provider: "openai",
    model,
    capability: "campaign.structured_content",
    status: "completed",
    data: normalizeCampaignResult(parsed),
    durationMs: Date.now() - startedAt,
    externalRequestId: response.id,
    costUsd: null,
    costSource: "estimated",
  }
}

async function generateInstagramCampaignWithXAI(
  input: StudioInstagramRequest,
  property: StudioInstagramPropertyContext,
): Promise<StudioProviderResult<StudioInstagramResult>> {
  const generated = await createXaiStructuredOutput({
    schema: studioInstagramResultSchema,
    schemaName: "studio_ia_instagram_campaign",
    operationKey: "studio.instagram.xai",
    maxOutputTokens: 2200,
    instructions:
      "Voce e o Studio IA do EME, especialista em marketing imobiliario para corretores. Responda apenas com o JSON do schema solicitado, sem texto adicional, sempre em portugues do Brasil.",
    prompt: buildInstagramPrompt(input, property),
    metadata: {
      propertyId: property.id,
      goal: input.goal,
      version: input.version,
    },
  })

  return {
    ...generated,
    model: XAI_MODELS.structuredText,
    data: normalizeCampaignResult(generated.data),
  }
}

export function generateInstagramCampaign(
  input: StudioInstagramRequest,
  property: StudioInstagramPropertyContext,
) {
  return input.provider === "xai"
    ? generateInstagramCampaignWithXAI(input, property)
    : generateInstagramCampaignWithOpenAI(input, property)
}
