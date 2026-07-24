import type { ParsedXmlProperty } from "@/lib/property-xml-import"
import type { PropertyApiItem } from "@/lib/property-contract"

export type XmlImportSummary = {
  total: number
  ready: number
  needsReview: number
  invalid: number
}

export type XmlImportReport = {
  imported: number
  duplicates: number
  errors: number
  pendingFields: number
  importedProperties: PropertyApiItem[]
  failed: Array<{ title: string; reason: string }>
}

type PreviewXmlInput =
  | {
      file: File
      sourceUrl?: never
    }
  | {
      file?: never
      sourceUrl: string
    }

async function parseImportResponse<T>(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null

  if (!response.ok) {
    throw new Error(data?.error || fallback)
  }

  return data as T
}

export async function previewPropertyXml(input: PreviewXmlInput) {
  const formData = new FormData()
  if (input.file) formData.append("file", input.file)
  if (input.sourceUrl) formData.append("sourceUrl", input.sourceUrl)

  return parseImportResponse<{ properties: ParsedXmlProperty[]; summary: XmlImportSummary }>(
    await fetch("/api/properties/import/xml/preview", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: formData,
    }),
    "Nao foi possivel analisar o XML.",
  )
}

export async function confirmPropertyXmlImport(properties: ParsedXmlProperty[]) {
  return parseImportResponse<{ report: XmlImportReport }>(
    await fetch("/api/properties/import/xml/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ properties }),
    }),
    "Nao foi possivel importar os imoveis.",
  )
}
