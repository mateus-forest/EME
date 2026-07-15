import "server-only"

import type OpenAI from "openai"

import { getOpenAIClient } from "@/lib/openai-server"
import { savePropertyGeneratedVideo } from "@/lib/property-storage"
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

const formatSizeMap: Record<(typeof studioVideoFormats)[number], OpenAI.Videos.VideoSize> = {
  "Reel vertical 9:16": "720x1280",
  "Story vertical 9:16": "720x1280",
  "Paisagem 16:9": "1280x720",
  "Quadrado 1:1": "1024x1792",
}

const durationSecondsMap: Record<(typeof studioVideoDurations)[number], OpenAI.Videos.VideoSeconds> = {
  "15 segundos": "12",
  "30 segundos": "12",
  "45 segundos": "12",
  "60 segundos": "12",
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
    `Duracao solicitada no Studio IA: ${input.duration}.`,
    `Objetivo comercial: ${input.objective}.`,
    `Estilo visual: ${input.style}. ${styleDirectionMap[input.style]}.`,
    `Direcao narrativa: ${objectiveDirectionMap[input.objective]}.`,
    property
      ? `Contexto do imovel: ${property.title}; tipo ${property.type}; finalidade ${property.purpose}; localizacao ${location}; preco ${property.price}; quartos ${property.bedrooms}; banheiros ${property.bathrooms}; vagas ${property.parkingSpots}.`
      : "Use apenas as imagens enviadas como base do video.",
    property?.description ? `Descricao atual do imovel: ${clipText(property.description, 500)}.` : "",
    "Nao inclua textos sobrepostos, legendas, logos, marcas d'agua ou interfaces.",
    "Mantenha aparencia fotografica realista, pronta para uso comercial imobiliario.",
    "Preserve a coerencia arquitetonica do imovel e nao invente caracteristicas conflitantes com as imagens.",
    input.additionalInstructions ? `Observacoes adicionais do corretor: ${input.additionalInstructions}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function getStudioVideoProviderConfig() {
  const provider = process.env.STUDIO_IA_VIDEO_PROVIDER?.trim().toLowerCase() || "openai"

  return {
    provider,
    isConfigured: provider === "openai" && Boolean(getOpenAIClient()),
    estimatedCredits: studioVideoEstimatedCredits,
  }
}

function mapVideoStatus(status: OpenAI.Videos.Video["status"]): StudioVideoResult["generationStatus"] {
  if (status === "completed") return "completed"
  if (status === "failed") return "failed"
  if (status === "in_progress") return "processing"
  return "queued"
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

  if (config.provider !== "openai") {
    throw new Error("VIDEO_PROVIDER_NOT_IMPLEMENTED")
  }

  const client = getOpenAIClient()
  if (!client) {
    throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED")
  }

  const prompt = buildVideoPrompt(input, property)
  const storyboard = buildStoryboard(input, property)
  const shotPlan = buildShotPlan(input, property)
  const script = buildScript(input, property)
  const video = await client.videos.create({
    model: "sora-2",
    prompt,
    seconds: durationSecondsMap[input.duration],
    size: formatSizeMap[input.format],
    input_reference:
      referenceInput.kind === "file"
        ? referenceInput.file
        : {
            image_url: referenceInput.url,
          },
  })

  const jobContent: StudioVideoJobContent = {
    provider: config.provider,
    providerVideoId: video.id,
    estimatedCredits: config.estimatedCredits,
    propertyId: property?.id,
    propertyTitle: property?.title,
    propertyLocation: property?.location,
    referenceImageUrls: input.referenceImageUrls,
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
    generationStatus: mapVideoStatus(video.status),
    progress: Math.max(0, Math.min(100, video.progress || 0)),
    creditsCharged: false,
    creditsRefunded: false,
  }

  return {
    providerVideoId: video.id,
    jobContent,
  }
}

export async function refreshStudioVideoJob(job: StudioVideoJobContent) {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED")
  }

  const providerVideo = await client.videos.retrieve(job.providerVideoId)
  const nextStatus = mapVideoStatus(providerVideo.status)
  let videoUrl = job.videoUrl

  if (providerVideo.status === "completed" && !videoUrl) {
    const response = await client.videos.downloadContent(providerVideo.id)
    if (!response.ok) {
      throw new Error("VIDEO_DOWNLOAD_FAILED")
    }

    const arrayBuffer = await response.arrayBuffer()
    videoUrl = await savePropertyGeneratedVideo(job.propertyId || job.providerVideoId, Buffer.from(arrayBuffer), "video/mp4")
  }

  return {
    ...job,
    generationStatus: nextStatus,
    progress: Math.max(0, Math.min(100, providerVideo.progress || (nextStatus === "completed" ? 100 : 0))),
    videoUrl,
    errorMessage: providerVideo.error?.message ? clipText(providerVideo.error.message, 400) : job.errorMessage,
  } satisfies StudioVideoJobContent
}

export function getStudioVideoResult(requestId: string, job: StudioVideoJobContent) {
  return createResultFromJob(requestId, job)
}
