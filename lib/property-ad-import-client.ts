import type { AdImportDraft } from "@/lib/property-ad-import-shared"
import type { PropertyApiItem } from "@/lib/property-contract"

export type PropertyImportCapabilities = {
  aiImportEnabled: boolean
  aiImportReason: string
}

async function parseAdImportResponse<T>(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null

  if (!response.ok) {
    throw new Error(data?.error || fallback)
  }

  return data as T
}

export async function extractPropertyAd(input: {
  adText?: string
  sourceUrl?: string
  notes?: string
  workflow?: "import" | "new_property"
  image: File | null
  operationId?: string
}) {
  const formData = new FormData()
  formData.append("operationId", input.operationId ?? crypto.randomUUID())
  if (input.adText) formData.append("adText", input.adText)
  if (input.sourceUrl) formData.append("sourceUrl", input.sourceUrl)
  if (input.notes) formData.append("notes", input.notes)
  if (input.workflow) formData.append("workflow", input.workflow)
  if (input.image) formData.append("image", input.image)

  return parseAdImportResponse<{ drafts: AdImportDraft[] }>(
    await fetch("/api/properties/import/ad/extract", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: formData,
    }),
    "Não foi possível extrair os dados do anúncio.",
  )
}

export async function confirmPropertyAdImport(draft: AdImportDraft) {
  return parseAdImportResponse<{ property: PropertyApiItem }>(
    await fetch("/api/properties/import/ad/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ draft }),
    }),
    "Não foi possível criar o imóvel a partir do anúncio.",
  )
}

export async function getPropertyImportCapabilities() {
  return parseAdImportResponse<PropertyImportCapabilities>(
    await fetch("/api/properties/import/capabilities", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }),
    "Não foi possível verificar os recursos de importação.",
  )
}
