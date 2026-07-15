import { z } from "zod"

export const studioVideoFormats = [
  "Reel vertical 9:16",
  "Story vertical 9:16",
  "Paisagem 16:9",
  "Quadrado 1:1",
] as const

export const studioVideoDurations = ["15 segundos", "30 segundos", "45 segundos", "60 segundos"] as const

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

export const studioVideoEstimatedCredits = 90
export const studioVideoActionType = "studio_ia_video_generation"

export const studioVideoUploadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(25 * 1024 * 1024),
})

export const studioVideoRequestSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(191).optional(),
    referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]),
    uploadedImages: z.array(studioVideoUploadSchema).max(12).default([]),
    format: z.enum(studioVideoFormats),
    duration: z.enum(studioVideoDurations),
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
  videoUrl: z.string().trim().url().optional(),
  fileSaved: z.boolean().default(false),
  progress: z.number().min(0).max(100).default(0),
  errorMessage: z.string().trim().max(400).optional(),
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
  duration: z.enum(studioVideoDurations),
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
})

export type StudioVideoRequest = z.infer<typeof studioVideoRequestSchema>
export type StudioVideoResult = z.infer<typeof studioVideoResultSchema>
export type StudioVideoJobContent = z.infer<typeof studioVideoJobContentSchema>
