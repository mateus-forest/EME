import { z } from "zod"

import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import {
  AD_IMPORT_MAX_IMAGE_BYTES,
  AD_IMPORT_MAX_TEXT_LENGTH,
  adImportDraftSchema,
  propertyImportTypeOptions,
  type AdImportDraft,
  type PropertyImportType,
} from "@/lib/property-ad-import-shared"
import type { ParsedXmlProperty } from "@/lib/property-xml-import"
export {
  AD_IMPORT_MAX_IMAGE_BYTES,
  AD_IMPORT_MAX_TEXT_LENGTH,
  adImportDraftSchema,
  propertyImportTypeOptions,
}
export type { AdImportDraft, PropertyImportType }

export type AdImportInput = {
  adText: string
  sourceUrl: string
  notes: string
  imageDataUrl?: string
}

const OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED = "OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED"

type SourceUrlContext = {
  finalUrl: string
  title: string
  description: string
  text: string
  images: string[]
}

type SourceLookupResult = {
  context: SourceUrlContext | null
  warningCode: string
}

const adImportModelResponseSchema = z
  .object({
    title: z.unknown().optional(),
    description: z.unknown().optional(),
    price: z.unknown().optional(),
    type: z.unknown().optional(),
    city: z.unknown().optional(),
    neighborhood: z.unknown().optional(),
    address: z.unknown().optional(),
    bedrooms: z.unknown().optional(),
    bathrooms: z.unknown().optional(),
    parking: z.unknown().optional(),
    area: z.unknown().optional(),
    features: z.unknown().optional(),
    tags: z.unknown().optional(),
    images: z.unknown().optional(),
    sourceUrl: z.unknown().optional(),
    notes: z.unknown().optional(),
    lowConfidenceFields: z.unknown().optional(),
    missingFields: z.unknown().optional(),
    status: z.unknown().optional(),
  })
  .passthrough()

const adImportModelResponseListSchema = z
  .object({
    drafts: z.array(adImportModelResponseSchema).default([]),
  })
  .passthrough()

function sanitizeInput(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

function normalizeTextValue(value: unknown, maxLength: number) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value).slice(0, maxLength)
  if (typeof value !== "string") return ""

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function normalizeMultilineTextValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return normalizeTextValue(value, maxLength)

  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength)
}

function splitListLikeText(value: string) {
  return value
    .split(/[\n,;|•]+/g)
    .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? splitListLikeText(value)
      : []

  return Array.from(
    new Set(
      items
        .map((item) => normalizeTextValue(item, maxLength))
        .filter(Boolean),
    ),
  ).slice(0, maxItems)
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

function normalizeImageUrls(value: unknown, maxItems = 8) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? splitListLikeText(value)
      : []

  return Array.from(
    new Set(
      items.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item.trim())).map((item) => item.trim()),
    ),
  ).slice(0, maxItems)
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

async function fetchSourceUrlContext(sourceUrl: string): Promise<SourceUrlContext> {
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

async function resolveSourceUrlContext(sourceUrl: string, canFallbackWithoutLink: boolean): Promise<SourceLookupResult> {
  if (!sourceUrl) {
    return { context: null, warningCode: "" }
  }

  try {
    return {
      context: await fetchSourceUrlContext(sourceUrl),
      warningCode: "",
    }
  } catch (error) {
    const warningCode = error instanceof Error ? error.message : "SOURCE_URL_FETCH_FAILED"
    if (!canFallbackWithoutLink) {
      throw error
    }

    console.warn("[property-ad-import][source-url][fallback-to-local-content]", {
      sourceUrl,
      warningCode,
    })

    return {
      context: null,
      warningCode,
    }
  }
}

function buildPrompt(input: AdImportInput, sourceContext: SourceUrlContext | null, sourceWarningCode: string) {
  const sourceWarning =
    sourceWarningCode === "SOURCE_URL_BLOCKED"
      ? "A leitura automatica do link foi bloqueada. Use o texto, as observacoes e a imagem enviada como base principal."
      : sourceWarningCode === "SOURCE_URL_UNREACHABLE" || sourceWarningCode === "SOURCE_URL_FETCH_FAILED"
        ? "O link nao pode ser lido neste momento. Priorize o texto, as observacoes e a imagem enviada."
        : sourceWarningCode === "SOURCE_URL_INVALID"
          ? "O link informado parece invalido. Ignore o link e use apenas os outros materiais."
          : "Nao informado"

  return [
    "Extraia imoveis do material fornecido.",
    "Cada item de drafts deve representar um unico imovel identificado.",
    "Se houver varios imoveis visiveis, retorne um item por imovel.",
    "Nao invente dados ausentes. Quando houver duvida, deixe o campo vazio.",
    "Use lowConfidenceFields e missingFields para sinalizar incerteza ou ausencia.",
    "Se houver pouco contexto, ainda assim retorne drafts parciais com status needs_review.",
    "",
    `Texto do anuncio: ${input.adText || "Nao informado"}`,
    `Link informado: ${input.sourceUrl || "Nao informado"}`,
    `Observacoes do usuario: ${input.notes || "Nenhuma"}`,
    `Status do link: ${sourceWarning}`,
    "",
    `Titulo da pagina: ${sourceContext?.title || "Nao informado"}`,
    `Descricao da pagina: ${sourceContext?.description || "Nao informado"}`,
    `URL final analisada: ${sourceContext?.finalUrl || "Nao informado"}`,
    `Texto extraido da pagina: ${sourceContext?.text || "Nao informado"}`,
    `Imagens encontradas na pagina: ${(sourceContext?.images ?? []).join(", ") || "Nenhuma"}`,
  ].join("\n")
}

function stripCodeFences(value: string) {
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return fencedMatch?.[1]?.trim() || value.trim()
}

function extractLikelyJsonObject(value: string) {
  const startIndex = value.indexOf("{")
  if (startIndex === -1) return value.trim()

  let depth = 0
  let inString = false
  let isEscaping = false

  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index]

    if (isEscaping) {
      isEscaping = false
      continue
    }

    if (character === "\\" && inString) {
      isEscaping = true
      continue
    }

    if (character === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (character === "{") depth += 1
    if (character === "}") {
      depth -= 1
      if (depth === 0) {
        return value.slice(startIndex, index + 1).trim()
      }
    }
  }

  return value.slice(startIndex).trim()
}

function appendMissingClosers(value: string, opener: string, closer: string) {
  let balance = 0
  let inString = false
  let isEscaping = false

  for (const character of value) {
    if (isEscaping) {
      isEscaping = false
      continue
    }

    if (character === "\\" && inString) {
      isEscaping = true
      continue
    }

    if (character === '"') {
      inString = !inString
      continue
    }

    if (inString) continue
    if (character === opener) balance += 1
    if (character === closer && balance > 0) balance -= 1
  }

  return balance > 0 ? `${value}${closer.repeat(balance)}` : value
}

function repairJsonCandidate(value: string) {
  const normalized = stripCodeFences(value)
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()

  const extracted = extractLikelyJsonObject(normalized)
  const withoutTrailingCommas = extracted.replace(/,\s*([}\]])/g, "$1")
  const withBalancedObjects = appendMissingClosers(withoutTrailingCommas, "{", "}")
  return appendMissingClosers(withBalancedObjects, "[", "]")
}

export function parseGeneratedJson(outputText: string) {
  const normalized = outputText.trim()

  if (!normalized) {
    throw new Error("OPENAI_EMPTY_RESPONSE")
  }

  const candidates = Array.from(
    new Set([
      normalized,
      stripCodeFences(normalized),
      extractLikelyJsonObject(normalized),
      repairJsonCandidate(normalized),
      repairJsonCandidate(stripCodeFences(normalized)),
    ].filter(Boolean)),
  )

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      continue
    }
  }

  throw new Error("OPENAI_INVALID_JSON")
}

function collectResponseStrings(value: unknown, bucket: string[]) {
  if (!value) return

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed) bucket.push(trimmed)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectResponseStrings(item, bucket))
    return
  }

  if (typeof value !== "object") return

  const candidate = value as Record<string, unknown>
  ;["text", "value", "output_text", "content", "message"].forEach((key) => {
    if (key in candidate) {
      collectResponseStrings(candidate[key], bucket)
    }
  })
}

function extractStructuredResponsePayload(response: {
  output_text?: string
  output_parsed?: unknown
  parsed?: unknown
  content?: unknown
  output?: Array<{
    type?: string
    parsed?: unknown
    output_parsed?: unknown
    content?: Array<{
      type?: string
      text?: string
      value?: string
      parsed?: unknown
      output_parsed?: unknown
    }>
  }>
}) {
  if (response.output_parsed && typeof response.output_parsed === "object") {
    return response.output_parsed
  }

  if (response.parsed && typeof response.parsed === "object") {
    return response.parsed
  }

  for (const item of response.output ?? []) {
    if (item.output_parsed && typeof item.output_parsed === "object") {
      return item.output_parsed
    }

    if (item.parsed && typeof item.parsed === "object") {
      return item.parsed
    }

    for (const content of item.content ?? []) {
      if (content.output_parsed && typeof content.output_parsed === "object") {
        return content.output_parsed
      }

      if (content.parsed && typeof content.parsed === "object") {
        return content.parsed
      }
    }
  }

  const textCandidates: string[] = []
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    textCandidates.push(response.output_text.trim())
  }

  collectResponseStrings(response.content, textCandidates)
  collectResponseStrings(response.output, textCandidates)

  const extractedText = Array.from(new Set(textCandidates.filter(Boolean))).join("\n").trim()
  return extractedText ? parseGeneratedJson(extractedText) : null
}

function isTruncatedStructuredOutputResponse(response: {
  status?: string
  incomplete_details?: { reason?: string | null } | null
  output_text?: string
  output_parsed?: unknown
  parsed?: unknown
  output?: unknown
}) {
  return (
    response.status === "incomplete" &&
    response.incomplete_details?.reason === "max_output_tokens" &&
    !response.output_text &&
    !response.output_parsed &&
    !response.parsed
  )
}

function normalizePriceValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return formatCurrencyBRLFromCents(Math.round(value * 100), { showCents: false })
  }

  const normalized = normalizeTextValue(value, 80)
  if (!normalized) return ""

  const compactMatch = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)?)\s*(mi|milhao|milhoes|mil)\b/)

  if (compactMatch) {
    const amount = Number(compactMatch[1].replace(",", "."))
    if (Number.isFinite(amount) && amount > 0) {
      const multiplier = compactMatch[2] === "mil" ? 1_000 : 1_000_000
      return formatCurrencyBRLFromCents(Math.round(amount * multiplier * 100), { showCents: false })
    }
  }

  const cents = parseCurrencyInputToCents(normalized)
  return cents && cents > 0 ? formatCurrencyBRLFromCents(cents, { showCents: false }) : ""
}

function normalizeCountValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(50, Math.trunc(value)))
  }

  const normalized = normalizeTextValue(value, 40)
  if (!normalized) return 0

  const match = normalized.match(/-?\d+(?:[.,]\d+)?/)
  if (!match) return 0

  const parsed = Number(match[0].replace(",", "."))
  return Number.isFinite(parsed) ? Math.max(0, Math.min(50, Math.trunc(parsed))) : 0
}

function normalizeAreaValue(value: unknown) {
  const normalized = normalizeTextValue(value, 80)
  if (!normalized) return ""

  const compact = normalized
    .replace(/\s+/g, " ")
    .replace(/m2/gi, "m²")
    .replace(/metros?\s+quadrados?/gi, "m²")
    .trim()

  if (/\bm²\b/i.test(compact)) return compact

  const match = compact.match(/\d+(?:[.,]\d+)?/)
  if (!match) return compact

  return `${match[0].replace(".", ",")} m²`
}

function normalizeTypeValue(...values: unknown[]): PropertyImportType {
  const normalized = normalizeKey(
    values
      .map((value) => normalizeTextValue(value, 120))
      .filter(Boolean)
      .join(" "),
  )

  if (!normalized) return "Apartamento"
  if (normalized.includes("casa") || normalized.includes("house") || normalized.includes("sobrado")) return "Casa"
  if (normalized.includes("terreno") || normalized.includes("lote") || normalized.includes("land")) return "Terreno"
  if (normalized.includes("cobertura") || normalized.includes("penthouse")) return "Cobertura"
  if (normalized.includes("loja") || normalized.includes("store")) return "Loja"
  if (normalized.includes("salacomercial") || normalized.includes("office") || normalized.includes("escritorio")) return "Sala comercial"
  if (normalized.includes("comercial")) return "Comercial"

  return "Apartamento"
}

function normalizeFieldName(value: string) {
  const normalized = normalizeKey(value)

  if (!normalized) return ""
  if (["titulo", "title", "nome", "headline"].includes(normalized)) return "titulo"
  if (["descricao", "description", "detalhes"].includes(normalized)) return "descricao"
  if (["preco", "price", "valor"].includes(normalized)) return "preco"
  if (["tipo", "type", "tipoimovel"].includes(normalized)) return "tipo"
  if (["cidade", "city"].includes(normalized)) return "cidade"
  if (["bairro", "neighborhood", "district"].includes(normalized)) return "bairro"
  if (["endereco", "address", "logradouro"].includes(normalized)) return "endereco"
  if (["quartos", "bedrooms", "dormitorios", "suites"].includes(normalized)) return "quartos"
  if (["banheiros", "bathrooms", "wc"].includes(normalized)) return "banheiros"
  if (["vagas", "parking", "garagens", "garage"].includes(normalized)) return "vagas"
  if (["area", "areautil", "areatotal"].includes(normalized)) return "area"
  if (["caracteristicas", "features", "diferenciais"].includes(normalized)) return "caracteristicas"
  if (["tags", "etiquetas"].includes(normalized)) return "tags"
  if (["imagens", "images", "fotos", "foto"].includes(normalized)) return "imagens"
  if (["link", "sourceurl", "url"].includes(normalized)) return "link"
  if (["observacoes", "notes", "nota"].includes(normalized)) return "observacoes"

  return normalizeTextValue(value, 40)
}

function normalizeFieldList(value: unknown, maxItems: number) {
  const list = normalizeStringList(value, maxItems, 40).map(normalizeFieldName).filter(Boolean)
  return Array.from(new Set(list))
}

function hasMeaningfulPreviewData(draft: AdImportDraft) {
  return Boolean(
    draft.title ||
      draft.description ||
      draft.price ||
      draft.city ||
      draft.neighborhood ||
      draft.address ||
      draft.area ||
      draft.images.length > 0 ||
      draft.features.length > 0 ||
      draft.tags.length > 0 ||
      draft.bedrooms > 0 ||
      draft.bathrooms > 0 ||
      draft.parking > 0,
  )
}

function finalizeDraft(draft: AdImportDraft) {
  const missingFields = new Set(draft.missingFields)
  if (!draft.title) missingFields.add("titulo")
  if (!draft.city) missingFields.add("cidade")
  if (!draft.neighborhood) missingFields.add("bairro")
  if (!draft.price) missingFields.add("preco")

  const normalizedMissingFields = Array.from(missingFields)
  const normalizedLowConfidenceFields = Array.from(new Set(draft.lowConfidenceFields)).filter(
    (field) => !normalizedMissingFields.includes(field),
  )

  const status = !hasMeaningfulPreviewData(draft)
    ? "invalid"
    : normalizedMissingFields.length === 0
      ? "ready"
      : "needs_review"

  return adImportDraftSchema.parse({
    ...draft,
    lowConfidenceFields: normalizedLowConfidenceFields,
    missingFields: normalizedMissingFields,
    status,
  })
}

export function normalizeAdImportDraft(
  value: unknown,
  options?: {
    sourceUrl?: string
    notes?: string
    sourceImages?: string[]
    sourceWarningCode?: string
  },
) {
  const candidate = adImportModelResponseSchema.parse(value)
  const sourceWarningField =
    options?.sourceWarningCode === "SOURCE_URL_BLOCKED"
      ? ["link"]
      : options?.sourceWarningCode === "SOURCE_URL_UNREACHABLE" ||
          options?.sourceWarningCode === "SOURCE_URL_FETCH_FAILED" ||
          options?.sourceWarningCode === "SOURCE_URL_INVALID"
        ? ["link"]
        : []

  const draft = {
    title: normalizeTextValue(candidate.title, 160),
    description: normalizeMultilineTextValue(candidate.description, 4000),
    price: normalizePriceValue(candidate.price),
    type: normalizeTypeValue(candidate.type, candidate.title, candidate.description),
    city: normalizeTextValue(candidate.city, 120),
    neighborhood: normalizeTextValue(candidate.neighborhood, 120),
    address: normalizeTextValue(candidate.address, 180),
    bedrooms: normalizeCountValue(candidate.bedrooms),
    bathrooms: normalizeCountValue(candidate.bathrooms),
    parking: normalizeCountValue(candidate.parking),
    area: normalizeAreaValue(candidate.area),
    features: normalizeStringList(candidate.features, 12, 80),
    tags: normalizeStringList(candidate.tags, 12, 40),
    images: Array.from(
      new Set([
        ...normalizeImageUrls(candidate.images, 8),
        ...normalizeImageUrls(options?.sourceImages ?? [], 8),
      ]),
    ).slice(0, 8),
    sourceUrl: normalizeTextValue(candidate.sourceUrl, 500) || normalizeTextValue(options?.sourceUrl, 500),
    notes: [normalizeMultilineTextValue(candidate.notes, 1000), normalizeMultilineTextValue(options?.notes, 1000)]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1000),
    lowConfidenceFields: Array.from(
      new Set([...normalizeFieldList(candidate.lowConfidenceFields, 20), ...sourceWarningField]),
    ),
    missingFields: normalizeFieldList(candidate.missingFields, 20),
    status: "needs_review" as const,
  }

  return finalizeDraft(draft)
}

export function mapXmlPropertyToAdImportDraft(property: ParsedXmlProperty) {
  return finalizeDraft({
    title: normalizeTextValue(property.title, 160),
    description: normalizeMultilineTextValue(property.description, 4000),
    price: normalizePriceValue(property.price),
    type: normalizeTypeValue(property.type, property.title, property.description),
    city: normalizeTextValue(property.city, 120),
    neighborhood: normalizeTextValue(property.neighborhood, 120),
    address: normalizeTextValue(property.address, 180),
    bedrooms: normalizeCountValue(property.bedrooms),
    bathrooms: normalizeCountValue(property.bathrooms),
    parking: normalizeCountValue(property.parking),
    area: normalizeAreaValue(property.area),
    features: [],
    tags: property.externalRef ? ["xml"] : [],
    images: normalizeImageUrls(property.images, 8),
    sourceUrl: "",
    notes: property.externalRef ? `Referencia externa: ${property.externalRef}` : "",
    lowConfidenceFields: [],
    missingFields: property.issues.map(normalizeFieldName).filter(Boolean),
    status: property.status === "ready" ? "ready" : "needs_review",
  })
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

  const canFallbackWithoutLink = Boolean(sanitizedInput.adText || sanitizedInput.notes || sanitizedInput.imageDataUrl)
  const sourceLookup = await resolveSourceUrlContext(sanitizedInput.sourceUrl, canFallbackWithoutLink)
  const sourceContext = sourceLookup.context
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
  > = [
    {
      type: "input_text",
      text: buildPrompt(sanitizedInput, sourceContext, sourceLookup.warningCode),
    },
  ]

  if (sanitizedInput.imageDataUrl) {
    inputParts.push({
      type: "input_image",
      image_url: sanitizedInput.imageDataUrl,
      detail: "high",
    })
  }

  const response = await client.responses.create({
    model,
    max_output_tokens: 2200,
    reasoning: {
      effort: "minimal",
    },
    instructions:
      "Extraia dados de anuncios imobiliarios no Brasil e responda apenas com o JSON do schema solicitado, sem texto adicional.",
    input: [
      {
        role: "user",
        content: inputParts,
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "property_ad_import",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            drafts: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  price: { type: "string" },
                  type: { type: "string", enum: propertyImportTypeOptions },
                  city: { type: "string" },
                  neighborhood: { type: "string" },
                  address: { type: "string" },
                  bedrooms: { type: "string" },
                  bathrooms: { type: "string" },
                  parking: { type: "string" },
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
          required: ["drafts"],
        },
      },
    },
  })

  try {
    if (isTruncatedStructuredOutputResponse(response)) {
      console.error("[property-ad-import][openai-response-truncated]", {
        message: OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED,
        sourceUrl: sanitizedInput.sourceUrl,
        sourceWarningCode: sourceLookup.warningCode,
        status: response.status,
        incompleteDetails: response.incomplete_details,
        outputParsed: (response as { output_parsed?: unknown }).output_parsed,
        parsed: (response as { parsed?: unknown }).parsed,
        rawResponseText: typeof response.output_text === "string" ? response.output_text.slice(0, 6000) : "",
        responseOutput: JSON.stringify(response.output ?? []).slice(0, 6000),
      })
      throw new Error(OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED)
    }

    const parsedJson = extractStructuredResponsePayload(response)
    if (!parsedJson) {
      throw new Error("OPENAI_EMPTY_RESPONSE")
    }
    const parsedList = adImportModelResponseListSchema.parse(parsedJson)
    const normalizedDrafts = parsedList.drafts
      .map((draft) =>
        normalizeAdImportDraft(draft, {
          sourceUrl: sourceContext?.finalUrl || sanitizedInput.sourceUrl,
          notes: sanitizedInput.notes,
          sourceImages: sourceContext?.images ?? [],
          sourceWarningCode: sourceLookup.warningCode,
        }),
      )
      .filter((draft) => draft.status !== "invalid")

    if (normalizedDrafts.length === 0) {
      throw new Error("AD_IMPORT_PREVIEW_EMPTY")
    }

    return normalizedDrafts
  } catch (error) {
    console.error("[property-ad-import][parse-failed]", {
      message: error instanceof Error ? error.message : "unknown",
      sourceUrl: sanitizedInput.sourceUrl,
      sourceWarningCode: sourceLookup.warningCode,
      rawResponseText: typeof response.output_text === "string" ? response.output_text.slice(0, 6000) : "",
      outputParsed: (response as { output_parsed?: unknown }).output_parsed,
      parsed: (response as { parsed?: unknown }).parsed,
      content: (response as { content?: unknown }).content,
      responseOutput: JSON.stringify(response.output ?? []).slice(0, 6000),
    })
    throw error
  }
}
