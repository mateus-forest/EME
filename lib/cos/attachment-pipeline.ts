import { analyzeCosAttachments, type CosAttachmentAnalysis } from "@/lib/cos/attachment-analysis"
import type { CosAttachmentCategory, CosAttachmentInput } from "@/lib/cos/types"

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeCategory(value: unknown): CosAttachmentCategory {
  const category = cleanText(value, 20).toLowerCase()
  if (category === "image" || category === "document" || category === "video") return category
  return "files"
}

export function normalizeCosAttachments(value: unknown): CosAttachmentInput[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((item) => ({
      id: cleanText(item.id, 80) || crypto.randomUUID(),
      name: cleanText(item.name, 240),
      type: cleanText(item.type, 120) || "application/octet-stream",
      size: typeof item.size === "number" ? item.size : 0,
      category: normalizeCategory(item.category),
      dataUrl: cleanText(item.dataUrl, 12_000_000) || undefined,
      textContent: cleanText(item.textContent, 120_000) || undefined,
    }))
    .filter((attachment) => attachment.name)
}

export function splitCosAttachmentsByCategory(attachments: CosAttachmentInput[]) {
  return {
    images: attachments.filter((attachment) => attachment.category === "image"),
    documents: attachments.filter((attachment) => attachment.category === "document"),
    videos: attachments.filter((attachment) => attachment.category === "video"),
    files: attachments.filter((attachment) => attachment.category === "files"),
  }
}

export function attachmentSupportsCosAction(input: {
  action: string
  normalizedMessage: string
  workflowAction?: string | null
  attachments: CosAttachmentInput[]
}) {
  const hasImageOrAudio = input.attachments.some(
    (attachment) => attachment.category === "image" || attachment.type.toLowerCase().startsWith("audio/"),
  )
  const hasDocument = input.attachments.some((attachment) => attachment.category === "document")
  const hasVideo = input.attachments.some((attachment) => attachment.category === "video")
  const continuesAction = input.workflowAction === input.action

  if (input.action === "createPropertyDraft") {
    const explicitPropertyIntent = /\b(?:cadastr\w*|cri\w*|atualiz\w*|foto\w*|imagem\w*)\b.*\bimovel\b|\bimovel\b.*\b(?:cadastr\w*|cri\w*|atualiz\w*|foto\w*|imagem\w*)\b/u.test(input.normalizedMessage)
    return hasImageOrAudio && (continuesAction || explicitPropertyIntent)
  }

  if (input.action === "ATTACH_LEAD_DOCUMENT") {
    const explicitLeadIntent = /\b(?:anex\w*|vincul\w*|document\w*)\b.*\b(?:cliente|lead)\b|\b(?:cliente|lead)\b.*\b(?:anex\w*|vincul\w*|document\w*)\b/u.test(input.normalizedMessage)
    return hasDocument && (continuesAction || explicitLeadIntent)
  }

  if (input.action === "STUDIO_GENERATE_VIDEO") {
    const explicitVideoIntent = /\b(?:cri\w*|ger\w*|produz\w*|roteir\w*)\b.*\bvideo\b|\bvideo\b.*\b(?:cri\w*|ger\w*|produz\w*|roteir\w*)\b/u.test(input.normalizedMessage)
    return hasVideo && (continuesAction || explicitVideoIntent)
  }

  return false
}

export async function runCosAttachmentPipeline(input: {
  message: string
  requestedAction?: string | null
  attachments: CosAttachmentInput[]
}): Promise<CosAttachmentAnalysis> {
  return analyzeCosAttachments({
    message: input.message,
    requestedAction: input.requestedAction,
    attachments: input.attachments,
  })
}
