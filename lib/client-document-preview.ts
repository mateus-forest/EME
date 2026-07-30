import type { EntityDocumentRecord } from "@/lib/legal-entities"

export async function openClientDocumentPreview(document: EntityDocumentRecord, leadId?: string) {
  if (typeof window === "undefined") return

  if (leadId) {
    window.open(`/api/leads/${encodeURIComponent(leadId)}/documents/${encodeURIComponent(document.id)}`, "_blank", "noopener,noreferrer")
    return
  }

  if (document.url.startsWith("data:")) {
    const response = await fetch(document.url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    window.open(objectUrl, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return
  }

  window.open(document.url, "_blank", "noopener,noreferrer")
}
