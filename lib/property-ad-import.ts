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
  imageDataUrl?: string
}

type SourceUrlContext = {
  finalUrl: string
  title: string
  description: string
  text: string
  images: string[]
}

function sanitizeInput(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
}

function extractMetaContent(html: string, property: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  )
  return decodeHtmlEntities(pattern.exec(html)?.[1] ?? "").trim()
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return decodeHtmlEntities(titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim()
}

function extractImageUrls(html: string, baseUrl: string) {
  const urls = new Set<string>()
  const addUrl = (candidate: string) => {
    try {
      const resolved = new URL(candidate, baseUrl)
      if (/^https?:$/i.test(resolved.protocol)) {
        urls.add(resolved.toString())
      }
    } catch {
      return
    }
  }

  const ogImage = extractMetaContent(html, "og:image")
  if (ogImage) addUrl(ogImage)

  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = imgPattern.exec(html))) {
    if (match[1]) addUrl(match[1])
    if (urls.size >= 8) break
  }

  return Array.from(urls).slice(0, 8)
}

async function fetchSourceUrlContext(sourceUrl: string): Promise<SourceUrlContext | null> {
  if (!sourceUrl) return null

  let parsedUrl: URL
  try {
    parsedUrl = new URL(sourceUrl)
  } catch {
    throw new Error("SOURCE_URL_INVALID")
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    throw new Error("SOURCE_URL_INVALID")
  }

  const response = await fetch(parsedUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EME Catalog Import/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  }).catch((error) => {
    console.error("[property-ad-import][source-url][network-failed]", {
      sourceUrl,
      message: error instanceof Error ? error.message : "unknown",
    })
    return null
  })

  if (!response) {
    throw new Error("SOURCE_URL_UNREACHABLE")
  }

  if ([401, 403, 429].includes(response.status)) {
    throw new Error("SOURCE_URL_BLOCKED")
  }

  if (!response.ok) {
    throw new Error("SOURCE_URL_FETCH_FAILED")
  }

  const html = await response.text()
  const text = stripHtml(html).slice(0, 8000)
  return {
    finalUrl: response.url || sourceUrl,
    title: extractTitle(html).slice(0, 200),
    description: extractMetaContent(html, "description").slice(0, 400),
    text,
    images: extractImageUrls(html, response.url || sourceUrl),
  }
}

function buildPrompt(input: AdImportInput, sourceContext: SourceUrlContext | null) {
  return [
    "Extraia dados imobiliarios do material fornecido.",
    "Nao invente dados ausentes. Quando houver duvida, deixe o campo vazio e inclua o nome do campo em lowConfidenceFields ou missingFields.",
    "Nunca marque como pronto se faltar titulo, cidade, bairro ou preco.",
    "Use imagens apenas para confirmar o que estiver visivel e real.",
    "",
    `Texto do anuncio: ${input.adText || "Nao informado"}`,
    `Link informado: ${input.sourceUrl || "Nao informado"}`,
    `Observacoes do usuario: ${input.notes || "Nenhuma"}`,
    "",
    `Titulo da pagina: ${sourceContext?.title || "Nao informado"}`,
    `Descricao da pagina: ${sourceContext?.description || "Nao informado"}`,
    `URL final analisada: ${sourceContext?.finalUrl || "Nao informado"}`,
    `Texto extraido da pagina: ${sourceContext?.text || "Nao informado"}`,
    `Imagens encontradas na pagina: ${(sourceContext?.images ?? []).join(", ") || "Nenhuma"}`,
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
    imageDataUrl: input.imageDataUrl?.trim() || "",
  }

  const sourceContext = await fetchSourceUrlContext(sanitizedInput.sourceUrl)
  const hasAnyContent = Boolean(
    sanitizedInput.adText ||
      sanitizedInput.notes ||
      sanitizedInput.imageDataUrl ||
      sourceContext?.text ||
      sourceContext?.images.length,
  )

  if (!hasAnyContent) {
    throw new Error("AD_IMPORT_EMPTY_INPUT")
  }

  const { model } = getOpenAIEnv()
  const inputParts: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "high" }
  > = [{ type: "input_text", text: buildPrompt(sanitizedInput, sourceContext) }]

  if (sanitizedInput.imageDataUrl) {
    inputParts.push({
      type: "input_image",
      image_url: sanitizedInput.imageDataUrl,
      detail: "high",
    })
  }

  const response = await client.responses.create({
    model,
    max_output_tokens: 900,
    instructions:
      "Voce e um especialista em cadastro de imoveis no Brasil. Extraia dados de anuncios imobiliarios com cautela, em portugues do Brasil, sem inventar informacoes. Retorne apenas JSON valido conforme o schema.",
    input: [
      {
        role: "user",
        content: inputParts,
      },
    ],
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

  const parsed = adImportDraftSchema.parse(parseGeneratedJson(response.output_text))
  const mergedImages = Array.from(
    new Set([...(parsed.images ?? []), ...(sourceContext?.images ?? [])].filter(Boolean)),
  ).slice(0, 8)

  return normalizeDraft({
    ...parsed,
    images: mergedImages,
    sourceUrl: parsed.sourceUrl || sourceContext?.finalUrl || sanitizedInput.sourceUrl,
    notes: [parsed.notes, sanitizedInput.notes].filter(Boolean).join(" | "),
  })
}
