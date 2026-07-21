import { z } from "zod"

export const studioVideoFormats = [
  "Reel vertical 9:16",
  "Story vertical 9:16",
  "Paisagem 16:9",
  "Quadrado 1:1",
] as const

export const studioVideoLegacyDurations = ["15 segundos", "30 segundos", "45 segundos", "60 segundos"] as const

export const studioVideoSelectableDurationOptions = [
  {
    value: "9s",
    label: "9 segundos",
    estimatedCredits: 90,
  },
] as const

export const studioVideoSelectableDurations = studioVideoSelectableDurationOptions.map((item) => item.value) as ["9s"]
export const studioVideoDefaultDuration = "9s" as const
export const studioVideoDurationAdjustedMessage =
  "A duração foi ajustada para 9 segundos, compatível com o modelo atual."
export const studioVideoInvalidDurationMessage =
  "A duração escolhida não é compatível com o gerador atual. Selecione uma opção disponível."

const studioVideoProviderAcceptedDurationsByModel = {
  "ray-2": ["5s", "9s"],
  "ray-flash-2": ["9s"],
} as const

export const studioVideoObjectives = [
  "Atrair interessados",
  "Gerar visitas",
  "Apresentar o imovel",
  "Fortalecer a marca do corretor",
] as const

export const studioVideoStyles = [
  "Cinematografico",
  "Minimalista",
  "Alto padrao",
  "Dinamico comercial",
] as const

export const studioVideoActionType = "studio_ia_video_generation"

export const studioVideoUploadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(25 * 1024 * 1024),
})

const studioVideoRequestDurationSchema = z.enum(studioVideoSelectableDurations)
const studioVideoJobDurationSchema = z.enum(studioVideoSelectableDurations)

export const studioVideoRequestSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(191).optional(),
    referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]),
    uploadedImages: z.array(studioVideoUploadSchema).max(12).default([]),
    format: z.enum(studioVideoFormats),
    duration: studioVideoRequestDurationSchema,
    objective: z.enum(studioVideoObjectives),
    style: z.enum(studioVideoStyles),
    additionalInstructions: z.string().trim().max(600).default(""),
    version: z.number().int().min(1).max(20).default(1),
  })
  .superRefine((payload, ctx) => {
    const hasPropertySelection = Boolean(payload.propertyId && payload.referenceImageUrls.length > 0)
    const hasUploadSelection = payload.uploadedImages.length > 0

    if (!hasPropertySelection && !hasUploadSelection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos uma imagem do imovel ou envie imagens de referencia.",
        path: ["referenceImageUrls"],
      })
    }
  })

export const studioVideoResultSchema = z.object({
  requestId: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  estimatedCredits: z.number().int().min(1),
  generationStatus: z.enum(["queued", "processing", "completed", "failed"]),
  storyboard: z.array(z.string().trim().min(1).max(220)).min(3).max(6),
  script: z.string().trim().min(1).max(2200),
  shotPlan: z.array(z.string().trim().min(1).max(180)).min(3).max(8),
  duration: studioVideoRequestDurationSchema,
  videoUrl: z.string().trim().url().optional(),
  fileSaved: z.boolean().default(false),
  progress: z.number().min(0).max(100).default(0),
  errorMessage: z.string().trim().max(400).optional(),
  noticeMessage: z.string().trim().max(200).optional(),
})

export const studioVideoJobContentSchema = z.object({
  provider: z.string().trim().min(1),
  providerVideoId: z.string().trim().min(1),
  estimatedCredits: z.number().int().min(1),
  propertyId: z.string().trim().min(1).optional(),
  propertyTitle: z.string().trim().min(1).optional(),
  propertyLocation: z.string().trim().min(1).optional(),
  referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]),
  uploadedImages: z.array(studioVideoUploadSchema).max(12).default([]),
  format: z.enum(studioVideoFormats),
  duration: studioVideoJobDurationSchema,
  objective: z.enum(studioVideoObjectives),
  style: z.enum(studioVideoStyles),
  additionalInstructions: z.string().trim().max(600).default(""),
  prompt: z.string().trim().min(1),
  storyboard: z.array(z.string().trim().min(1).max(220)).min(3).max(6),
  script: z.string().trim().min(1).max(2200),
  shotPlan: z.array(z.string().trim().min(1).max(180)).min(3).max(8),
  generationStatus: z.enum(["queued", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100).default(0),
  videoUrl: z.string().trim().url().optional(),
  savedDocumentId: z.string().trim().min(1).optional(),
  creditsCharged: z.boolean().default(false),
  creditsRefunded: z.boolean().default(false),
  errorMessage: z.string().trim().max(400).optional(),
  noticeMessage: z.string().trim().max(200).optional(),
})

export type StudioVideoDuration = (typeof studioVideoSelectableDurations)[number]
export type StudioVideoRequest = z.infer<typeof studioVideoRequestSchema>
export type StudioVideoResult = z.infer<typeof studioVideoResultSchema>
export type StudioVideoJobContent = z.infer<typeof studioVideoJobContentSchema>

export function getStudioVideoDurationLabel(duration: StudioVideoDuration) {
  return studioVideoSelectableDurationOptions.find((item) => item.value === duration)?.label ?? "9 segundos"
}

export function getStudioVideoEstimatedCredits(duration: StudioVideoDuration) {
  return studioVideoSelectableDurationOptions.find((item) => item.value === duration)?.estimatedCredits ?? 90
}

export function getStudioVideoProviderAcceptedDurations(model: string) {
  if (model in studioVideoProviderAcceptedDurationsByModel) {
    return studioVideoProviderAcceptedDurationsByModel[model as keyof typeof studioVideoProviderAcceptedDurationsByModel]
  }

  return studioVideoSelectableDurations
}

export function isStudioVideoSelectableDuration(value: string): value is StudioVideoDuration {
  return studioVideoSelectableDurations.includes(value as StudioVideoDuration)
}

export function normalizeStudioVideoDuration(value: unknown) {
  if (typeof value !== "string") {
    return { duration: studioVideoDefaultDuration, adjusted: false }
  }

  const normalized = value.trim()
  if (isStudioVideoSelectableDuration(normalized)) {
    return { duration: normalized, adjusted: false }
  }

  if (studioVideoLegacyDurations.includes(normalized as (typeof studioVideoLegacyDurations)[number])) {
    return { duration: studioVideoDefaultDuration, adjusted: true }
  }

  return { duration: studioVideoDefaultDuration, adjusted: false }
}
