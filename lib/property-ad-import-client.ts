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
  image: File | null
}) {
  const formData = new FormData()
  if (input.adText) formData.append("adText", input.adText)
  if (input.sourceUrl) formData.append("sourceUrl", input.sourceUrl)
  if (input.notes) formData.append("notes", input.notes)
  if (input.image) formData.append("image", input.image)

  return parseAdImportResponse<{ drafts: AdImportDraft[] }>(
    await fetch("/api/properties/import/ad/extract", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: formData,
    }),
    "Nao foi possivel extrair os dados do anuncio.",
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
    "Nao foi possivel criar o imovel a partir do anuncio.",
  )
}

export async function getPropertyImportCapabilities() {
  return parseAdImportResponse<PropertyImportCapabilities>(
    await fetch("/api/properties/import/capabilities", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }),
    "Nao foi possivel verificar os recursos de importacao.",
  )
}
