import "server-only"

import { randomUUID } from "node:crypto"

import { getLumaAIEnv } from "@/lib/env.server"
import { savePropertyGeneratedVideo, saveStudioVideoReferenceImage } from "@/lib/property-storage"
import {
  studioVideoActionType,
  studioVideoCameraMovementConfig,
  studioVideoCameraMovementOptions,
  type StudioVideoCameraMovement,
  studioVideoDefaultDuration,
  studioVideoFormats,
  getStudioVideoDurationLabel,
  getStudioVideoEstimatedCredits,
  getStudioVideoProviderAcceptedDurations,
  normalizeStudioVideoDuration,
  studioVideoJobContentSchema,
  studioVideoObjectiveConfig,
  studioVideoObjectiveGroups,
  studioVideoObjectives,
  studioVideoRhythmConfig,
  studioVideoRhythmOptions,
  type StudioVideoRhythm,
  studioVideoStyles,
  studioVideoDurationAdjustedMessage,
  studioVideoInvalidDurationMessage,
  studioVideoStyleConfig,
  studioVideoTransformationConfig,
  studioVideoTransformationOptions,
  type StudioVideoTransformation,
  type StudioVideoStyle,
  type StudioVideoJobContent,
  type StudioVideoDuration,
  type StudioVideoObjective,
  type StudioVideoRequest,
  type StudioVideoResult,
  studioVideoRequestSchema,
  studioVideoResultSchema,
} from "@/lib/studio-ia-video-shared"

export {
  studioVideoActionType,
  studioVideoCameraMovementOptions,
  studioVideoDefaultDuration,
  studioVideoFormats,
  getStudioVideoDurationLabel,
  getStudioVideoEstimatedCredits,
  studioVideoObjectiveConfig,
  studioVideoObjectiveGroups,
  studioVideoDurationAdjustedMessage,
  studioVideoInvalidDurationMessage,
  studioVideoObjectives,
  studioVideoRhythmOptions,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  studioVideoStyles,
  studioVideoStyleConfig,
  studioVideoTransformationConfig,
  studioVideoTransformationOptions,
} from "@/lib/studio-ia-video-shared"

export type StudioVideoPropertyContext = {
  id: string
  title: string
  city: string
  neighborhood: string
  location: string
  type: string
  purpose: string
  price: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  description: string
}

type ReferenceInput = { kind: "url"; url: string } | { kind: "file"; file: File }

type LumaGenerationCreateRequest = {
  prompt: string
  model: string
  resolution: "540p" | "720p" | "1080p"
  duration: "5s" | "9s"
  aspect_ratio: "9:16" | "16:9" | "1:1"
  keyframes?: {
    frame0?: {
      type: "image"
      url: string
    }
  }
}

type LumaGeneration = {
  id: string
  state: string
  failure_reason: string | null
  created_at?: string
  assets?: {
    video?: string
  }
  version?: string
  request?: {
    prompt?: string
    aspect_ratio?: string
    loop?: boolean
  }
}

const LUMA_API_BASE_URL = "https://api.lumalabs.ai/dream-machine/v1"

const formatAspectRatioMap: Record<(typeof studioVideoFormats)[number], LumaGenerationCreateRequest["aspect_ratio"]> = {
  "Reel vertical 9:16": "9:16",
  "Story vertical 9:16": "9:16",
  "Paisagem 16:9": "16:9",
  "Quadrado 1:1": "1:1",
}

const formatResolutionMap: Record<(typeof studioVideoFormats)[number], LumaGenerationCreateRequest["resolution"]> = {
  "Reel vertical 9:16": "720p",
  "Story vertical 9:16": "720p",
  "Paisagem 16:9": "720p",
  "Quadrado 1:1": "540p",
}

function getObjectiveConfig(objective: StudioVideoObjective) {
  return studioVideoObjectiveConfig[objective]
}

function getStyleConfig(style: StudioVideoStyle) {
  return studioVideoStyleConfig[style]
}

function getTransformationConfig(transformation: StudioVideoTransformation) {
  return studioVideoTransformationConfig[transformation]
}

function getRhythmConfig(rhythm: StudioVideoRhythm) {
  return studioVideoRhythmConfig[rhythm]
}

function getCameraMovementConfig(cameraMovement: StudioVideoCameraMovement) {
  return studioVideoCameraMovementConfig[cameraMovement]
}

function clipText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength)
}

function sanitizeStudioVideoErrorMessage(message?: string | null) {
  if (!message) return undefined
  if (/(duration|9s|5s|seconds|segundos)/i.test(message)) {
    return studioVideoInvalidDurationMessage
  }

  return "O provedor nao conseguiu concluir o video. Os creditos foram preservados."
}

function getLumaAuthHeaders() {
  const { apiKey } = getLumaAIEnv()

  if (!apiKey) {
    throw new Error("LUMAAI_API_KEY_NOT_CONFIGURED")
  }

  return {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
  }
}

async function parseLumaJsonResponse<T>(response: Response) {
  const data = (await response.json().catch(() => null)) as T | { error?: string; detail?: string; message?: string } | null

  if (!response.ok) {
    const detail =
      data && typeof data === "object"
        ? "error" in data
          ? data.error
          : "detail" in data
            ? data.detail
            : "message" in data
              ? data.message
              : ""
        : ""

    if (response.status === 401 || response.status === 403) {
      throw new Error(detail || "LUMAAI_API_KEY_INVALID")
    }

    if (detail && /(duration|9s|5s|seconds|segundos)/i.test(detail)) {
      throw new Error("LUMA_DURATION_NOT_SUPPORTED")
    }

    throw new Error(detail || `Luma AI retornou erro ${response.status}.`)
  }

  if (!data) {
    throw new Error("Luma AI nao retornou resposta valida.")
  }

  return data as T
}

export function parseStudioVideoJobContent(content: string) {
  const parsed = JSON.parse(content) as Record<string, unknown>
  const normalizedDuration = normalizeStudioVideoDuration(parsed.duration)

  return studioVideoJobContentSchema.parse({
    ...parsed,
    duration: normalizedDuration.duration,
    transformation:
      typeof parsed.transformation === "string" && parsed.transformation in studioVideoTransformationConfig
        ? parsed.transformation
        : studioVideoTransformationOptions[0],
    rhythm:
      typeof parsed.rhythm === "string" && parsed.rhythm in studioVideoRhythmConfig
        ? parsed.rhythm
        : studioVideoRhythmOptions[1],
    cameraMovement:
      typeof parsed.cameraMovement === "string" && parsed.cameraMovement in studioVideoCameraMovementConfig
        ? parsed.cameraMovement
        : studioVideoCameraMovementOptions[3],
    noticeMessage: normalizedDuration.adjusted
      ? studioVideoDurationAdjustedMessage
      : typeof parsed.noticeMessage === "string"
        ? parsed.noticeMessage
        : undefined,
  })
}

export function stringifyStudioVideoJobContent(content: StudioVideoJobContent) {
  return JSON.stringify(content)
}

function buildStoryboard(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const area = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ") || "localizacao do imovel"
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)

  return [
    `Abertura com fachada e contexto de ${clipText(area, 70)}.`,
    `Entrada mostrando ${clipText(property?.title || "apresentacao principal do imovel", 80)} com foco em ${clipText(objective.commercialFocus, 90)}.`,
    `Ambientes internos guiados por ${clipText(objective.storyline, 120)}.`,
    `Transformacao principal: ${clipText(transformation.sceneDirection, 120)}.`,
    `Tratamento visual com ${clipText(style.visualDirection, 120)}.`,
    `Encerramento com chamada para acao alinhada a ${clipText(objective.ctaDirection, 90)}.`,
  ].slice(0, 5)
}

function buildShotPlan(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)
  const cameraMovement = getCameraMovementConfig(input.cameraMovement)

  return [
    "Plano aberto da fachada ou vista principal.",
    clipText(cameraMovement.shotDirection, 150),
    `Destaque para ${clipText(property?.type?.toLowerCase() || "ambientes principais", 80)} com foco em amplitude.`,
    `Detalhes de apoio reforcando ${clipText(style.cameraDirection, 120)}.`,
    `Momento de transformacao: ${clipText(transformation.sceneDirection, 120)}.`,
    "Fechamento com cena mais aspiracional e CTA visual.",
  ]
}

function buildScript(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)
  const rhythm = getRhythmConfig(input.rhythm)
  const cameraMovement = getCameraMovementConfig(input.cameraMovement)
  const summary = [
    property?.title,
    property?.type,
    property?.price,
    location,
    property?.bedrooms ? `${property.bedrooms} quartos` : "",
    property?.parkingSpots ? `${property.parkingSpots} vagas` : "",
  ]
    .filter(Boolean)
    .join(" | ")

  return clipText(
    [
      `Video comercial no formato ${input.format}, com narrativa ${input.style.toLowerCase()} e objetivo de ${input.objective.toLowerCase()}.`,
      summary ? `Contexto principal: ${summary}.` : "",
      `Direcao criativa: ${objective.promptBase}.`,
      `Tratamento visual: ${style.visualDirection}.`,
      `Narrativa: ${style.narrativeDirection}.`,
      `Transformacao: ${transformation.promptDirection}.`,
      `Ritmo: ${rhythm.promptDirection}.`,
      `Camera: ${cameraMovement.promptDirection}.`,
      input.additionalInstructions ? `Instrucoes extras: ${input.additionalInstructions}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    2200,
  )
}

function buildVideoPrompt(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)
  const rhythm = getRhythmConfig(input.rhythm)
  const cameraMovement = getCameraMovementConfig(input.cameraMovement)

  return [
    "Crie um video imobiliario comercial em portugues do Brasil.",
    `Formato final desejado: ${input.format}.`,
    `Duracao final obrigatoria: ${getStudioVideoDurationLabel(input.duration)} (${input.duration}).`,
    `Objetivo principal: ${input.objective}. ${objective.promptBase}`,
    `Categoria do objetivo: ${objective.group}.`,
    `Foco comercial: ${objective.commercialFocus}.`,
    `Estilo visual: ${input.style}. ${style.visualDirection}`,
    `Narrativa: ${style.narrativeDirection}`,
    `Ritmo: ${input.rhythm}. ${rhythm.promptDirection}`,
    `Movimento de camera: ${input.cameraMovement}. ${cameraMovement.promptDirection}`,
    `Transformacao desejada: ${input.transformation}. ${transformation.promptDirection}`,
    `Comportamento da cena: ${transformation.sceneDirection}`,
    property
      ? `Contexto do imovel: ${property.title}; tipo ${property.type}; finalidade ${property.purpose}; localizacao ${location}; preco ${property.price}; quartos ${property.bedrooms}; banheiros ${property.bathrooms}; vagas ${property.parkingSpots}.`
      : "Use apenas a imagem enviada como base do video.",
    property?.description ? `Descricao atual do imovel: ${clipText(property.description, 500)}.` : "",
    `Direcao de camera complementar: ${style.cameraDirection}`,
    `Ritmo narrativo complementar: ${style.rhythmDirection}`,
    `CTA final: ${objective.ctaDirection}`,
    objective.group === "Transformacao"
      ? "A transformacao deve ser visivel durante a cena, com evolucao natural do ambiente e resultado final superior ao frame inicial."
      : "Evite apenas aplicar zoom sobre imagem estatica; crie narrativa visual com progressao real e leitura espacial do ambiente.",
    input.transformation !== "Nenhuma"
      ? "Os elementos de transformacao devem aparecer de forma realista, com materiais, luz, decoracao e mobiliario coerentes com o imovel."
      : "Preserve fidelidade ao espaco original e valorize o que ja existe no ambiente.",
    "Nao inclua textos sobrepostos, legendas, logos, marcas d'agua ou interfaces.",
    "Mantenha aparencia fotografica realista, pronta para uso comercial imobiliario.",
    "Preserve a coerencia arquitetonica do imovel e nao invente caracteristicas conflitantes com a imagem de referencia.",
    "A imagem de referencia deve ser tratada como frame inicial e guia principal da cena.",
    input.additionalInstructions ? `Observacoes adicionais do corretor: ${input.additionalInstructions}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

async function createLumaGeneration(payload: LumaGenerationCreateRequest) {
  const response = await fetch(`${LUMA_API_BASE_URL}/generations`, {
    method: "POST",
    headers: {
      ...getLumaAuthHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  return parseLumaJsonResponse<LumaGeneration>(response)
}

async function getLumaGeneration(generationId: string) {
  const response = await fetch(`${LUMA_API_BASE_URL}/generations/${generationId}`, {
    method: "GET",
    headers: getLumaAuthHeaders(),
    cache: "no-store",
  })

  return parseLumaJsonResponse<LumaGeneration>(response)
}

async function resolveReferenceImageUrl(referenceInput: ReferenceInput, propertyId?: string) {
  if (referenceInput.kind === "url") {
    return referenceInput.url
  }

  const referenceId = propertyId || randomUUID()
  return saveStudioVideoReferenceImage(referenceId, referenceInput.file)
}

export function getStudioVideoProviderConfig() {
  const { apiKey, videoModel } = getLumaAIEnv()

  return {
    provider: "lumaai",
    model: videoModel,
    isConfigured: Boolean(apiKey),
    estimatedCredits: getStudioVideoEstimatedCredits({
      duration: studioVideoDefaultDuration,
      objective: studioVideoObjectives[0],
      transformation: studioVideoTransformationOptions[0],
    }),
  }
}

function mapVideoStatus(state: string): StudioVideoResult["generationStatus"] {
  if (state === "completed") return "completed"
  if (state === "failed") return "failed"
  if (state === "dreaming") return "processing"
  return "queued"
}

function mapVideoProgress(state: string) {
  if (state === "completed") return 100
  if (state === "dreaming") return 55
  if (state === "failed") return 0
  return 10
}

function createResultFromJob(requestId: string, job: StudioVideoJobContent): StudioVideoResult {
  return {
    requestId,
    provider: job.provider,
    estimatedCredits: job.estimatedCredits,
    generationStatus: job.generationStatus,
    storyboard: job.storyboard,
    script: job.script,
    shotPlan: job.shotPlan,
    duration: job.duration,
    promptPreview: job.prompt,
    videoUrl: job.videoUrl,
    fileSaved: Boolean(job.savedDocumentId),
    progress: job.progress,
    errorMessage: job.errorMessage,
    noticeMessage: job.noticeMessage,
  }
}

function validateProviderDuration(duration: StudioVideoDuration, model: string) {
  const acceptedDurations = getStudioVideoProviderAcceptedDurations(model)
  return acceptedDurations.includes(duration)
}

export async function generateStudioPropertyVideo({
  input,
  property,
  referenceInput,
}: {
  input: StudioVideoRequest
  property?: StudioVideoPropertyContext | null
  referenceInput: ReferenceInput
}) {
  const config = getStudioVideoProviderConfig()
  if (!config.isConfigured) {
    throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED")
  }

  const prompt = buildVideoPrompt(input, property)
  const storyboard = buildStoryboard(input, property)
  const shotPlan = buildShotPlan(input, property)
  const script = buildScript(input, property)

  if (!validateProviderDuration(input.duration, config.model)) {
    throw new Error("STUDIO_VIDEO_DURATION_NOT_SUPPORTED")
  }

  const requestPayload: LumaGenerationCreateRequest = {
    prompt,
    model: config.model,
    resolution: formatResolutionMap[input.format],
    duration: input.duration,
    aspect_ratio: formatAspectRatioMap[input.format],
  }

  const referenceImageUrl = await resolveReferenceImageUrl(referenceInput, property?.id)
  requestPayload.keyframes = {
    frame0: {
      type: "image",
      url: referenceImageUrl,
    },
  }

  const generation = await createLumaGeneration(requestPayload)
  if (generation.failure_reason) {
    console.error("[studio-ia][video][provider-failure]", {
      provider: config.provider,
      providerVideoId: generation.id,
      failureReason: generation.failure_reason,
    })
  }

  const jobContent: StudioVideoJobContent = {
    provider: config.provider,
    providerVideoId: generation.id,
    estimatedCredits: getStudioVideoEstimatedCredits({
      duration: input.duration,
      objective: input.objective,
      transformation: input.transformation,
    }),
    propertyId: property?.id,
    propertyTitle: property?.title,
    propertyLocation: property?.location,
    referenceImageUrls: input.referenceImageUrls.length > 0 ? input.referenceImageUrls : [referenceImageUrl],
    uploadedImages: input.uploadedImages,
    format: input.format,
    duration: input.duration,
    objective: input.objective,
    style: input.style,
    transformation: input.transformation,
    rhythm: input.rhythm,
    cameraMovement: input.cameraMovement,
    additionalInstructions: input.additionalInstructions,
    prompt,
    storyboard,
    script,
    shotPlan,
    generationStatus: mapVideoStatus(generation.state),
    progress: mapVideoProgress(generation.state),
    creditsCharged: false,
    creditsRefunded: false,
    errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
  }

  return {
    providerVideoId: generation.id,
    jobContent,
  }
}

export async function refreshStudioVideoJob(job: StudioVideoJobContent) {
  const generation = await getLumaGeneration(job.providerVideoId)
  const nextStatus = mapVideoStatus(generation.state)
  let videoUrl = job.videoUrl

  if (generation.failure_reason) {
    console.error("[studio-ia][video][provider-failure]", {
      provider: job.provider,
      providerVideoId: job.providerVideoId,
      failureReason: generation.failure_reason,
    })
  }

  if (generation.state === "completed" && generation.assets?.video && !videoUrl) {
    const response = await fetch(generation.assets.video, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("VIDEO_DOWNLOAD_FAILED")
    }

    const arrayBuffer = await response.arrayBuffer()
    videoUrl = await savePropertyGeneratedVideo(job.propertyId || job.providerVideoId, Buffer.from(arrayBuffer), "video/mp4")
  }

  return {
    ...job,
    generationStatus: nextStatus,
    progress: mapVideoProgress(generation.state),
    videoUrl,
    errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason) ?? job.errorMessage,
  } satisfies StudioVideoJobContent
}

export function getStudioVideoResult(requestId: string, job: StudioVideoJobContent) {
  return createResultFromJob(requestId, job)
}
