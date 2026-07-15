import "server-only"

import { randomUUID } from "node:crypto"

import { getLumaAIEnv } from "@/lib/env.server"
import { savePropertyGeneratedVideo, saveStudioVideoReferenceImage } from "@/lib/property-storage"
import {
  studioVideoActionType,
  studioVideoDurations,
  studioVideoEstimatedCredits,
  studioVideoFormats,
  studioVideoJobContentSchema,
  studioVideoObjectives,
  studioVideoStyles,
  type StudioVideoJobContent,
  type StudioVideoRequest,
  type StudioVideoResult,
} from "@/lib/studio-ia-video-shared"

export {
  studioVideoActionType,
  studioVideoDurations,
  studioVideoEstimatedCredits,
  studioVideoFormats,
  studioVideoObjectives,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  studioVideoStyles,
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
  duration: "5s" | "10s"
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

const durationMap: Record<(typeof studioVideoDurations)[number], LumaGenerationCreateRequest["duration"]> = {
  "15 segundos": "10s",
  "30 segundos": "10s",
  "45 segundos": "10s",
  "60 segundos": "10s",
}

const styleDirectionMap: Record<(typeof studioVideoStyles)[number], string> = {
  Cinematografico: "movimentos suaves de camera, composicao elegante, luz natural valorizada e acabamento premium",
  Minimalista: "visual limpo, ritmo sereno, enquadramentos objetivos e foco em arquitetura e amplitude",
  "Alto padrao": "apresentacao sofisticada, detalhes de luxo, atmosfera aspiracional e acabamento impecavel",
  "Dinamico comercial": "edicao mais energica, cortes objetivos, foco comercial e linguagem visual de anuncio",
}

const objectiveDirectionMap: Record<(typeof studioVideoObjectives)[number], string> = {
  "Atrair interessados": "priorize impacto inicial, melhores diferenciais e convite para contato imediato",
  "Gerar visitas": "mostre fluidez de circulacao, conforto e beneficios que incentivem agendar visita",
  "Apresentar o imovel": "organize a narrativa como tour objetivo e claro do imovel",
  "Fortalecer a marca do corretor": "combine apresentacao do imovel com sensacao de atendimento profissional e confiavel",
}

function clipText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength)
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

    throw new Error(detail || `Luma AI retornou erro ${response.status}.`)
  }

  if (!data) {
    throw new Error("Luma AI nao retornou resposta valida.")
  }

  return data as T
}

export function parseStudioVideoJobContent(content: string) {
  return studioVideoJobContentSchema.parse(JSON.parse(content))
}

export function stringifyStudioVideoJobContent(content: StudioVideoJobContent) {
  return JSON.stringify(content)
}

function buildStoryboard(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const area = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ") || "localizacao do imovel"

  return [
    `Abertura com fachada e contexto de ${clipText(area, 70)}.`,
    `Entrada mostrando ${clipText(property?.title || "apresentacao principal do imovel", 80)} com foco em impacto visual.`,
    `Ambientes internos destacando ${clipText(objectiveDirectionMap[input.objective], 110)}.`,
    `Detalhes de valor como iluminacao, acabamento e sensacao de ${clipText(input.style.toLowerCase(), 70)}.`,
    `Encerramento com chamada para acao alinhada a ${clipText(input.objective.toLowerCase(), 70)}.`,
  ].slice(0, 5)
}

function buildShotPlan(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  return [
    "Plano aberto da fachada ou vista principal.",
    "Travelling de entrada conectando exterior e interior.",
    `Destaque para ${clipText(property?.type?.toLowerCase() || "ambientes principais", 80)} com foco em amplitude.`,
    `Detalhes de apoio reforcando o estilo ${clipText(input.style.toLowerCase(), 60)}.`,
    "Fechamento com cena mais aspiracional e CTA visual.",
  ]
}

function buildScript(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")
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
      `Direcao criativa: ${objectiveDirectionMap[input.objective]}.`,
      `Tratamento visual: ${styleDirectionMap[input.style]}.`,
      input.additionalInstructions ? `Instrucoes extras: ${input.additionalInstructions}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    2200,
  )
}

function buildVideoPrompt(input: StudioVideoRequest, property?: StudioVideoPropertyContext | null) {
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")

  return [
    "Crie um video imobiliario comercial em portugues do Brasil.",
    `Formato final desejado: ${input.format}.`,
    `Duracao alvo no Studio IA: ${input.duration}. Use a duracao suportada mais proxima pela Luma mantendo o melhor resultado comercial possivel.`,
    `Objetivo comercial: ${input.objective}.`,
    `Estilo visual: ${input.style}. ${styleDirectionMap[input.style]}.`,
    `Direcao narrativa: ${objectiveDirectionMap[input.objective]}.`,
    property
      ? `Contexto do imovel: ${property.title}; tipo ${property.type}; finalidade ${property.purpose}; localizacao ${location}; preco ${property.price}; quartos ${property.bedrooms}; banheiros ${property.bathrooms}; vagas ${property.parkingSpots}.`
      : "Use apenas a imagem enviada como base do video.",
    property?.description ? `Descricao atual do imovel: ${clipText(property.description, 500)}.` : "",
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
    estimatedCredits: studioVideoEstimatedCredits,
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
    videoUrl: job.videoUrl,
    fileSaved: Boolean(job.savedDocumentId),
    progress: job.progress,
    errorMessage: job.errorMessage,
  }
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
  const requestPayload: LumaGenerationCreateRequest = {
    prompt,
    model: config.model,
    resolution: formatResolutionMap[input.format],
    duration: durationMap[input.duration],
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
  const jobContent: StudioVideoJobContent = {
    provider: config.provider,
    providerVideoId: generation.id,
    estimatedCredits: config.estimatedCredits,
    propertyId: property?.id,
    propertyTitle: property?.title,
    propertyLocation: property?.location,
    referenceImageUrls: input.referenceImageUrls.length > 0 ? input.referenceImageUrls : [referenceImageUrl],
    uploadedImages: input.uploadedImages,
    format: input.format,
    duration: input.duration,
    objective: input.objective,
    style: input.style,
    additionalInstructions: input.additionalInstructions,
    prompt,
    storyboard,
    script,
    shotPlan,
    generationStatus: mapVideoStatus(generation.state),
    progress: mapVideoProgress(generation.state),
    creditsCharged: false,
    creditsRefunded: false,
    errorMessage: generation.failure_reason ? clipText(generation.failure_reason, 400) : undefined,
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
    errorMessage: generation.failure_reason ? clipText(generation.failure_reason, 400) : job.errorMessage,
  } satisfies StudioVideoJobContent
}

export function getStudioVideoResult(requestId: string, job: StudioVideoJobContent) {
  return createResultFromJob(requestId, job)
}
