import type { EntityDocumentRecord } from "@/lib/legal-entities"

const DATA_URL_PREFIX = "data:"
const DEFAULT_EXTERNAL_URL_MAX_LENGTH = 5_000

export function isDataUrl(value: string) {
  return value.startsWith(DATA_URL_PREFIX)
}

export function normalizeEntityDocumentForStorage(
  document: EntityDocumentRecord,
  cleanText: (value: unknown, maxLength: number) => string,
) {
  const url = document.url.trim()

  return {
    ...document,
    label: cleanText(document.label, 64),
    name: cleanText(document.name, 160),
    url: isDataUrl(url) ? url : cleanText(url, DEFAULT_EXTERNAL_URL_MAX_LENGTH),
    mimeType: cleanText(document.mimeType, 120),
    uploadedAt: cleanText(document.uploadedAt, 64) || new Date().toISOString(),
  }
}

export function parseDocumentPayload(document: Pick<EntityDocumentRecord, "url" | "mimeType" | "name">) {
  if (!isDataUrl(document.url)) {
    return {
      kind: "external" as const,
      url: document.url,
      mimeType: document.mimeType || guessMimeTypeFromName(document.name),
      fileName: document.name || "documento",
    }
  }

  const separatorIndex = document.url.indexOf(",")
  if (separatorIndex === -1) {
    throw new Error("INVALID_DATA_URL")
  }

  const metadata = document.url.slice(0, separatorIndex)
  const rawPayload = document.url.slice(separatorIndex + 1)
  const match = metadata.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?$/)
  if (!match) {
    throw new Error("INVALID_DATA_URL")
  }

  const [, detectedMimeType, isBase64Flag] = match
  const mimeType = document.mimeType || detectedMimeType || guessMimeTypeFromName(document.name)
  const fileName = document.name || "documento"

  try {
    const buffer = isBase64Flag
      ? Buffer.from(rawPayload, "base64")
      : Buffer.from(decodeURIComponent(rawPayload), "utf8")

    if (!buffer.byteLength) {
      throw new Error("EMPTY_DOCUMENT_PAYLOAD")
    }

    return {
      kind: "inline-data" as const,
      buffer,
      mimeType,
      fileName,
    }
  } catch {
    throw new Error("INVALID_DOCUMENT_PAYLOAD")
  }
}

export function buildDocumentDisposition(mimeType: string, fileName: string) {
  const disposition = isInlinePreviewMimeType(mimeType) ? "inline" : "attachment"
  const encodedFileName = encodeURIComponent(fileName)

  return `${disposition}; filename="${sanitizeFileName(fileName)}"; filename*=UTF-8''${encodedFileName}`
}

function isInlinePreviewMimeType(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/")
}

function guessMimeTypeFromName(fileName: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".doc")) return "application/msword"
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  return "application/octet-stream"
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/["\r\n]/g, "_")
}
