import { z } from "zod"

import { getOpenAIClient } from "@/lib/openai-server"

export const propertyGenerationSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  type: z.enum(["Apartamento", "Casa", "Comercial"]),
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
    "Dados do imóvel para anúncio:",
    `Título atual: ${input.title || "Não informado"}`,
    `Tipo: ${input.type}`,
    `Cidade: ${input.city}`,
    `Bairro: ${input.neighborhood}`,
    `Preço: ${input.price}`,
    `Quartos: ${input.bedrooms}`,
    `Banheiros: ${input.bathrooms}`,
    `Vagas: ${input.parkingSpots}`,
    `Descrição manual atual: ${input.description || "Nenhuma"}`,
    "",
    "Gere:",
    "1. Uma descrição pronta para uso, clara, natural e comercial.",
    "2. Um título sugerido curto e melhorado.",
    "3. Até 3 highlights curtos.",
    "Não invente dados que não foram fornecidos.",
  ].join("\n")
}

export async function generatePropertyCopy(input: PropertyGenerationInput) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_API_KEY não configurada no servidor.")
  }

  const response = await client.responses.create({
    model: "gpt-5-mini",
    max_output_tokens: 500,
    instructions:
      "Você é um especialista em criação de anúncios imobiliários no Brasil. Gere uma descrição clara, objetiva, profissional e persuasiva com base nos dados fornecidos. Destaque os diferenciais reais do imóvel, localização e praticidade. Não invente informações que não foram fornecidas.",
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
              description: "Descrição pronta para uso, em português do Brasil, com cerca de 80 a 140 palavras.",
            },
            suggestedTitle: {
              type: "string",
              description: "Título curto e comercial, sem exageros irreais.",
            },
            highlights: {
              type: "array",
              maxItems: 3,
              items: {
                type: "string",
                description: "Highlight curto do imóvel com até 8 palavras.",
              },
            },
          },
          required: ["description", "suggestedTitle", "highlights"],
        },
      },
    },
  })

  const parsed = propertyGenerationResultSchema.parse(JSON.parse(response.output_text))

  return {
    description: parsed.description,
    suggestedTitle: parsed.suggestedTitle,
    highlights: parsed.highlights.slice(0, 3),
  } satisfies PropertyGenerationResult
}
