import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"
import { isDescriptionTooSimilarToSource } from "@/lib/property-new-ai"

export const propertyGenerationSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  type: z.enum(["Apartamento", "Casa", "Comercial", "Terreno", "Sala comercial", "Loja", "Cobertura"]),
  purpose: z.enum(["Venda", "Locação"]).optional().default("Venda"),
  city: z.string().trim().max(80).optional().default(""),
  neighborhood: z.string().trim().max(80).optional().default(""),
  price: z.string().trim().max(40).optional().default(""),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  parkingSpots: z.number().int().min(0).max(20),
  description: z.string().trim().max(3000).optional().default(""),
  address: z.string().trim().max(240).optional().default(""),
  state: z.string().trim().max(32).optional().default(""),
  privateArea: z.string().trim().max(64).optional().default(""),
  totalArea: z.string().trim().max(64).optional().default(""),
  condominiumName: z.string().trim().max(160).optional().default(""),
})

export const propertyGenerationResultSchema = z.object({
  description: z.string().trim().min(40).max(1400),
  suggestedTitle: z.string().trim().min(1).max(120),
  highlights: z.array(z.string().trim().min(1).max(60)).max(4),
})

export type PropertyGenerationInput = z.infer<typeof propertyGenerationSchema>
export type PropertyGenerationResult = z.infer<typeof propertyGenerationResultSchema>

function buildPrompt(input: PropertyGenerationInput) {
  const facts = [
    input.title ? `Título atual: ${input.title}` : "",
    `Tipo: ${input.type}`,
    `Finalidade: ${input.purpose}`,
    input.city ? `Cidade: ${input.city}` : "",
    input.neighborhood ? `Bairro: ${input.neighborhood}` : "",
    input.state ? `Estado/UF: ${input.state}` : "",
    input.address ? `Endereço: ${input.address}` : "",
    input.price ? `Preço: ${input.price}` : "",
    `Quartos: ${input.bedrooms}`,
    `Banheiros: ${input.bathrooms}`,
    `Vagas: ${input.parkingSpots}`,
    input.privateArea ? `Área privativa: ${input.privateArea}` : "",
    input.totalArea ? `Área total: ${input.totalArea}` : "",
    input.condominiumName ? `Condomínio: ${input.condominiumName}` : "",
    input.description ? `Descrição manual atual: ${input.description}` : "",
  ].filter(Boolean)

  return [
    "Dados do imovel para anuncio:",
    ...facts,
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
  if (!normalized) return null

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() || normalized
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function extractGeneratedPayload(response: unknown) {
  const candidate = response as {
    output_parsed?: unknown
    parsed?: unknown
    output_text?: string
    output?: Array<{ content?: Array<{ parsed?: unknown; text?: string }> }>
  }
  if (candidate.output_parsed && typeof candidate.output_parsed === "object") return candidate.output_parsed
  if (candidate.parsed && typeof candidate.parsed === "object") return candidate.parsed

  const parsedText = parseGeneratedJson(candidate.output_text ?? "")
  if (parsedText) return parsedText

  for (const item of candidate.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.parsed && typeof content.parsed === "object") return content.parsed
      const parsedContent = parseGeneratedJson(content.text ?? "")
      if (parsedContent) return parsedContent
    }
  }
  return null
}

export async function generatePropertyCopy(input: PropertyGenerationInput) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  let terminalError = "OPENAI_EMPTY_RESPONSE"

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await createOpenAIResponse({
      client,
      operationKey: "property.generate_copy",
      metadata: {
        propertyType: input.type,
        city: input.city || null,
        neighborhood: input.neighborhood || null,
        retry: attempt > 0,
      },
      request: {
        model,
        max_output_tokens: 700,
        reasoning: { effort: "minimal" },
        instructions: [
          "Voce e um especialista em anuncios imobiliarios no Brasil.",
          "Use estritamente os dados atuais fornecidos e omita o que estiver ausente.",
          "Nunca invente caracteristicas, localizacao, acabamento, lazer, proximidades ou estado de conservacao.",
          "Produza uma descricao comercial natural e util, nao uma lista de campos.",
          input.description
            ? "A descricao precisa ser uma redacao comercial nova, sem copiar ou apenas reorganizar o texto atual."
            : "",
          attempt > 0
            ? `A tentativa anterior foi ${terminalError === "PROPERTY_DESCRIPTION_TOO_SIMILAR" ? "semelhante demais ao texto atual" : "vazia ou invalida"}. Regenere com outra estrutura, preservando os mesmos fatos.`
            : "",
        ].filter(Boolean).join(" "),
        input: buildPrompt(input),
        text: {
          verbosity: "low",
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
                  description: "Descricao comercial em portugues do Brasil baseada somente nos fatos fornecidos.",
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
                    description: "Highlight curto e factual do imovel com ate 8 palavras.",
                  },
                },
              },
              required: ["description", "suggestedTitle", "highlights"],
            },
          },
        },
      },
    })

    const payload = extractGeneratedPayload(response)
    if (!payload) {
      terminalError = "OPENAI_EMPTY_RESPONSE"
      continue
    }

    const parsed = propertyGenerationResultSchema.safeParse(payload)
    if (!parsed.success) {
      terminalError = "OPENAI_INVALID_JSON"
      continue
    }

    if (input.description && isDescriptionTooSimilarToSource(input.description, parsed.data.description)) {
      terminalError = "PROPERTY_DESCRIPTION_TOO_SIMILAR"
      continue
    }

    return {
      description: parsed.data.description,
      suggestedTitle: parsed.data.suggestedTitle,
      highlights: parsed.data.highlights.slice(0, 3),
    } satisfies PropertyGenerationResult
  }

  throw new Error(terminalError)
}
