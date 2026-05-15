import type { AdImportDraft } from "@/lib/property-ad-import"
import type { PropertyApiItem } from "@/lib/property-contract"

async function parseAdImportResponse<T>(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null

  if (!response.ok) {
    throw new Error(data?.error || fallback)
  }

  return data as T
}

export async function extractPropertyAd(input: {
  adText: string
  sourceUrl: string
  notes: string
  image: File | null
}) {
  const formData = new FormData()
  formData.append("adText", input.adText)
  formData.append("sourceUrl", input.sourceUrl)
  formData.append("notes", input.notes)
  if (input.image) formData.append("image", input.image)

  return parseAdImportResponse<{ draft: AdImportDraft }>(
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
