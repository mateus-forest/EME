import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"

export const AD_IMPORT_MAX_TEXT_LENGTH = 12000
export const AD_IMPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const adImportDraftSchema = z.object({
  title: z.string().trim().max(160).default(""),
  description: z.string().trim().max(4000).default(""),
  price: z.string().trim().max(80).default(""),
  type: z.enum(["Apartamento", "Casa", "Comercial"]).default("Apartamento"),
  city: z.string().trim().max(120).default(""),
  neighborhood: z.string().trim().max(120).default(""),
  address: z.string().trim().max(180).default(""),
  bedrooms: z.number().int().min(0).max(50).default(0),
  bathrooms: z.number().int().min(0).max(50).default(0),
  parking: z.number().int().min(0).max(50).default(0),
  area: z.string().trim().max(80).default(""),
  features: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  images: z.array(z.string().url()).max(8).default([]),
  sourceUrl: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(1000).default(""),
  lowConfidenceFields: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  missingFields: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: z.enum(["ready", "needs_review", "invalid"]).default("needs_review"),
})

export type AdImportDraft = z.infer<typeof adImportDraftSchema>

export type AdImportInput = {
  adText: string
  sourceUrl: string
  notes: string
}

function sanitizeInput(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function buildPrompt(input: AdImportInput) {
  return [
    "Extraia dados imobiliarios do material fornecido.",
    "Nao invente dados ausentes. Quando houver duvida, deixe o campo vazio e inclua o nome do campo em lowConfidenceFields ou missingFields.",
    "Nunca marque como pronto se faltar titulo, cidade, bairro ou preco.",
    "",
    `Texto do anuncio: ${input.adText || "Nao informado"}`,
    `Link de referencia: ${input.sourceUrl || "Nao informado"}`,
    `Observacoes do usuario: ${input.notes || "Nenhuma"}`,
  ].join("\n")
}

function normalizeDraft(draft: AdImportDraft) {
  const missingFields = new Set(draft.missingFields)
  if (!draft.title) missingFields.add("titulo")
  if (!draft.city) missingFields.add("cidade")
  if (!draft.neighborhood) missingFields.add("bairro")
  if (!draft.price) missingFields.add("preco")

  const status = missingFields.size === 0 ? draft.status : missingFields.size <= 2 ? "needs_review" : "invalid"

  return {
    ...draft,
    missingFields: Array.from(missingFields),
    status,
  } satisfies AdImportDraft
}

export async function extractPropertyFromAd(input: AdImportInput) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const sanitizedInput = {
    adText: sanitizeInput(input.adText, AD_IMPORT_MAX_TEXT_LENGTH),
    sourceUrl: sanitizeInput(input.sourceUrl, 500),
    notes: sanitizeInput(input.notes, 1000),
  }

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 900,
    instructions:
      "Voce e um especialista em cadastro de imoveis no Brasil. Extraia dados de anuncios imobiliarios com cautela, em portugues do Brasil, sem inventar informacoes. Retorne apenas JSON valido conforme o schema.",
    input: buildPrompt(sanitizedInput),
    text: {
      format: {
        type: "json_schema",
        name: "property_ad_import",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            price: { type: "string" },
            type: { type: "string", enum: ["Apartamento", "Casa", "Comercial"] },
            city: { type: "string" },
            neighborhood: { type: "string" },
            address: { type: "string" },
            bedrooms: { type: "number" },
            bathrooms: { type: "number" },
            parking: { type: "number" },
            area: { type: "string" },
            features: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
            images: { type: "array", items: { type: "string" } },
            sourceUrl: { type: "string" },
            notes: { type: "string" },
            lowConfidenceFields: { type: "array", items: { type: "string" } },
            missingFields: { type: "array", items: { type: "string" } },
            status: { type: "string", enum: ["ready", "needs_review", "invalid"] },
          },
          required: [
            "title",
            "description",
            "price",
            "type",
            "city",
            "neighborhood",
            "address",
            "bedrooms",
            "bathrooms",
            "parking",
            "area",
            "features",
            "tags",
            "images",
            "sourceUrl",
            "notes",
            "lowConfidenceFields",
            "missingFields",
            "status",
          ],
        },
      },
    },
  })

  const parsed = adImportDraftSchema.parse(JSON.parse(response.output_text))

  return normalizeDraft({
    ...parsed,
    sourceUrl: parsed.sourceUrl || sanitizedInput.sourceUrl,
    notes: [parsed.notes, sanitizedInput.notes].filter(Boolean).join(" | "),
  })
}
