import "server-only"

import { extractPropertyFromAd, type AdImportDraft } from "@/lib/property-ad-import"
import { savePropertyImageFromDataUrl } from "@/lib/property-storage"

export type CosAttachmentAnalysisInput = {
  message: string
  requestedAction?: string | null
  attachments: Array<{
    id: string
    name: string
    type: string
    size: number
    category: "image" | "document" | "video" | "files"
    dataUrl?: string
    textContent?: string
  }>
}

export type CosAttachmentAnalysis = {
  executionMessage: string
  propertyDrafts: AdImportDraft[]
  primaryPropertyDraft: AdImportDraft | null
  propertyConfirmationText: string | null
  imageUrl: string | null
}

const PROPERTY_INTENT_TOKENS = ["imovel", "anuncio", "catalogo", "publique", "publicar", "cadastre", "cadastrar", "crie", "criar", "campanha"]

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function hasPropertyIntent(message: string) {
  const normalized = normalizeText(message)
  return PROPERTY_INTENT_TOKENS.some((token) => normalized.includes(token))
}

function buildAttachmentLines(input: CosAttachmentAnalysisInput["attachments"]) {
  return input.map((attachment) => `- ${attachment.name} (${attachment.category})`)
}

function buildPrimarySourceInstruction() {
  return [
    "IMPORTANTE: os anexos sao a fonte principal de informacao.",
    "O texto do usuario descreve apenas a intencao operacional.",
    "Nao use o prompt como titulo, descricao ou conteudo do imovel/documento quando o anexo trouxer dados mais confiaveis.",
  ].join(" ")
}

function summarizePropertyDraft(draft: AdImportDraft) {
  return [
    draft.type ? `- Tipo: ${draft.type}` : "",
    draft.title ? `- Título sugerido: ${draft.title}` : "",
    draft.city ? `- Cidade: ${draft.city}` : "",
    draft.neighborhood ? `- Bairro: ${draft.neighborhood}` : "",
    draft.address ? `- Endereço: ${draft.address}` : "",
    draft.area ? `- Área: ${draft.area}` : "",
    draft.bedrooms ? `- Dormitórios: ${draft.bedrooms}` : "",
    draft.bathrooms ? `- Banheiros: ${draft.bathrooms}` : "",
    draft.parking ? `- Vagas: ${draft.parking}` : "",
    draft.price ? `- Valor: ${draft.price}` : "",
    draft.features.length > 0 ? `- Características: ${draft.features.join(", ")}` : "",
  ].filter(Boolean)
}

function buildPropertyConfirmationText(draft: AdImportDraft) {
  const summary = summarizePropertyDraft(draft)
  if (summary.length === 0) return "Encontrei informações no anexo. Deseja criar este imóvel?"

  return ["Encontrei estas informações:", "", ...summary, "", "Deseja criar este imóvel?"].join("\n")
}

function mapDraftTypeToPropertyType(type: AdImportDraft["type"]) {
  switch (type) {
    case "Casa":
      return "HOUSE"
    case "Terreno":
      return "LAND"
    case "Sala comercial":
      return "OFFICE"
    case "Loja":
      return "STORE"
    case "Cobertura":
      return "PENTHOUSE"
    case "Comercial":
      return "COMMERCIAL"
    default:
      return "APARTMENT"
  }
}

function inferPropertyPurpose(message: string) {
  const normalized = normalizeText(message)
  return normalized.includes("aluguel") || normalized.includes("locacao") ? "RENT" : "SALE"
}

export function mapAttachmentDraftToPendingPropertyData(draft: AdImportDraft, message: string, imageUrl?: string | null) {
  return {
    title: draft.title || draft.type || "Imovel em rascunho",
    description: draft.description || "",
    city: draft.city || "",
    neighborhood: draft.neighborhood || "",
    address: draft.address || "",
    area: draft.area || "",
    bedrooms: draft.bedrooms || 0,
    bathrooms: draft.bathrooms || 0,
    parkingSpots: draft.parking || 0,
    price: draft.price || "",
    type: mapDraftTypeToPropertyType(draft.type),
    purpose: inferPropertyPurpose(message),
    features: draft.features,
    sourceUrl: draft.sourceUrl || "",
    lowConfidenceFields: draft.lowConfidenceFields,
    missingFields: draft.missingFields,
    status: draft.status,
    imageUrl: imageUrl || "",
  }
}

async function analyzePropertyAttachments(input: CosAttachmentAnalysisInput) {
  const imageAttachment = input.attachments.find((attachment) => attachment.category === "image" && attachment.dataUrl)
  const textContent = input.attachments
    .map((attachment) => attachment.textContent?.trim() || "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12_000)

  const result = { propertyDrafts: [] as AdImportDraft[], imageUrl: null as string | null }

  if (!imageAttachment && !textContent) {
    return result
  }

  try {
    result.propertyDrafts = await extractPropertyFromAd({
      adText: textContent,
      sourceUrl: "",
      notes: input.message,
      imageDataUrl: imageAttachment?.dataUrl,
    })
  } catch (error) {
    console.error("[cos][attachment-analysis][property]", {
      message: error instanceof Error ? error.message : "unknown",
      attachmentCount: input.attachments.length,
      hasImage: Boolean(imageAttachment),
      hasText: Boolean(textContent),
    })
  }

  if (imageAttachment?.dataUrl) {
    try {
      result.imageUrl = await savePropertyImageFromDataUrl(imageAttachment.dataUrl)
    } catch (error) {
      console.error("[cos][attachment-analysis][image-upload]", {
        message: error instanceof Error ? error.message : "unknown",
        attachmentName: imageAttachment.name,
      })
    }
  }

  return result
}

export async function analyzeCosAttachments(input: CosAttachmentAnalysisInput): Promise<CosAttachmentAnalysis> {
  if (input.attachments.length === 0) {
    return {
      executionMessage: input.message,
      propertyDrafts: [],
      primaryPropertyDraft: null,
      propertyConfirmationText: null,
      imageUrl: null,
    }
  }

  const attachmentLines = buildAttachmentLines(input.attachments)
  const shouldAnalyzeProperty =
    input.requestedAction === "createPropertyDraft" || hasPropertyIntent(input.message)
  const { propertyDrafts, imageUrl } = shouldAnalyzeProperty
    ? await analyzePropertyAttachments(input)
    : { propertyDrafts: [] as AdImportDraft[], imageUrl: null as string | null }
  const primaryPropertyDraft = propertyDrafts[0] ?? null
  const propertySummary = primaryPropertyDraft ? summarizePropertyDraft(primaryPropertyDraft) : []

  const executionMessage = [
    input.message,
    "",
    buildPrimarySourceInstruction(),
    "",
    "Arquivos anexados:",
    ...attachmentLines,
    ...(propertySummary.length > 0 ? ["", "Dados extraidos do anexo:", ...propertySummary] : []),
  ]
    .filter(Boolean)
    .join("\n")

  return {
    executionMessage,
    propertyDrafts,
    primaryPropertyDraft,
    propertyConfirmationText: primaryPropertyDraft ? buildPropertyConfirmationText(primaryPropertyDraft) : null,
    imageUrl,
  }
}
