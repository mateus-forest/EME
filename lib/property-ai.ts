import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"

export const propertyGenerationSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  type: z.enum(["Apartamento", "Casa", "Comercial", "Terreno", "Sala comercial", "Loja", "Cobertura"]),
  city: z.string().trim().min(1).max(80),
  neighborhood: z.string().trim().min(1).max(80),
  price: z.string().trim().min(1).max(40),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  parkingSpots: z.number().int().min(0).max(20),
  description: z.string().trim().max(3000).optional().default(""),
})

export const propertyGenerationResultSchema = z.object({
  description: z.string().trim().min(1).max(1400),
  suggestedTitle: z.string().trim().min(1).max(120),
  highlights: z.array(z.string().trim().min(1).max(60)).max(4),
})

export type PropertyGenerationInput = z.infer<typeof propertyGenerationSchema>
export type PropertyGenerationResult = z.infer<typeof propertyGenerationResultSchema>

function buildPrompt(input: PropertyGenerationInput) {
  return [
    "Dados do imovel para anuncio:",
    `Titulo atual: ${input.title || "Nao informado"}`,
    `Tipo: ${input.type}`,
    `Cidade: ${input.city}`,
    `Bairro: ${input.neighborhood}`,
    `Preco: ${input.price}`,
    `Quartos: ${input.bedrooms}`,
    `Banheiros: ${input.bathrooms}`,
    `Vagas: ${input.parkingSpots}`,
    `Descricao manual atual: ${input.description || "Nenhuma"}`,
    "",
    "Gere:",
    "1. Uma descricao pronta para uso, clara, natural e comercial.",
    "2. Um titulo sugerido curto e melhorado.",
    "3. Ate 3 highlights curtos.",
    "Nao invente dados que nao foram fornecidos.",
  ].join("\n")
}

function parseGeneratedJson(outputText: string) {
  const normalized = outputText.trim()

  if (!normalized) {
    throw new Error("OPENAI_EMPTY_RESPONSE")
  }

  try {
    return JSON.parse(normalized)
  } catch {
    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)

    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim())
    }

    throw new Error("OPENAI_INVALID_JSON")
  }
}

export async function generatePropertyCopy(input: PropertyGenerationInput) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 500,
    instructions:
      "Voce e um especialista em criacao de anuncios imobiliarios no Brasil. Gere uma descricao clara, objetiva, profissional e persuasiva com base nos dados fornecidos. Destaque os diferenciais reais do imovel, localizacao e praticidade. Nao invente informacoes que nao foram fornecidas.",
    input: buildPrompt(input),
    text: {
      format: {
        type: "json_schema",
        name: "property_ad_generation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: {
              type: "string",
              description: "Descricao pronta para uso, em portugues do Brasil, com cerca de 80 a 140 palavras.",
            },
            suggestedTitle: {
              type: "string",
              description: "Titulo curto e comercial, sem exageros irreais.",
            },
            highlights: {
              type: "array",
              maxItems: 3,
              items: {
                type: "string",
                description: "Highlight curto do imovel com ate 8 palavras.",
              },
            },
          },
          required: ["description", "suggestedTitle", "highlights"],
        },
      },
    },
  })

  const parsed = propertyGenerationResultSchema.parse(parseGeneratedJson(response.output_text))

  return {
    description: parsed.description,
    suggestedTitle: parsed.suggestedTitle,
    highlights: parsed.highlights.slice(0, 3),
  } satisfies PropertyGenerationResult
}
