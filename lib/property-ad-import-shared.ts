import { z } from "zod"

export const AD_IMPORT_MAX_TEXT_LENGTH = 12000
export const AD_IMPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const propertyImportTypeOptions = [
  "Apartamento",
  "Casa",
  "Comercial",
  "Terreno",
  "Sala comercial",
  "Loja",
  "Cobertura",
] as const

export type PropertyImportType = (typeof propertyImportTypeOptions)[number]

export const adImportDraftSchema = z.object({
  title: z.string().trim().max(160).default(""),
  description: z.string().trim().max(4000).default(""),
  price: z.string().trim().max(80).default(""),
  type: z.enum(propertyImportTypeOptions).default("Apartamento"),
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

type PersistedPropertyType = "APARTMENT" | "HOUSE" | "COMMERCIAL" | "LAND" | "OFFICE" | "STORE" | "PENTHOUSE"

export function buildImportedDraftPersistence(
  draft: AdImportDraft,
  parsed: { price: number | null; propertyType: PersistedPropertyType | null },
) {
  return {
    title: draft.title || "Imóvel importado em revisão",
    price: parsed.price ?? 0,
    city: draft.city,
    neighborhood: draft.neighborhood || null,
    type: parsed.propertyType ?? ("APARTMENT" as const),
    status: "DRAFT" as const,
    published: false,
  }
}

export type PropertyImportBatchFailure = { title: string; message: string }

export function formatPropertyImportBatchFeedback(createdCount: number, failures: PropertyImportBatchFailure[]) {
  const createdLabel = `${createdCount} ${createdCount === 1 ? "rascunho criado" : "rascunhos criados"}`
  if (failures.length === 0) return `${createdLabel}.`
  const failureLabel = `${failures.length} ${failures.length === 1 ? "falhou" : "falharam"}`
  return `${createdLabel}. ${failureLabel}: ${failures.map((failure) => `${failure.title} — ${failure.message}`).join("; ")}`
}

export function buildAdImportCreditKeys(brokerId: string, operationId: string) {
  return {
    usage: `ad_import_usage:${brokerId}:${operationId}`,
    refund: `ad_import_refund:${brokerId}:${operationId}`,
  }
}
