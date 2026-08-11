import "server-only"

import { createHash, randomUUID } from "node:crypto"

import { getLumaAIEnv } from "@/lib/env.server"
import { recordEstimatedCatalogTelemetry } from "@/lib/ai-operation-telemetry"
import { savePropertyGeneratedImage, savePropertyGeneratedVideo, saveStudioVideoReferenceImage } from "@/lib/property-storage"
import {
  studioVideoActionType,
  studioVideoActiveStages,
  studioVideoCameraMovementConfig,
  studioVideoCameraMovementOptions,
  type StudioVideoCameraMovement,
  studioVideoDefaultDuration,
  studioVideoDurationAdjustedMessage,
  studioVideoFinalActionType,
  studioVideoFormats,
  getStudioVideoDurationLabel,
  getStudioVideoEstimatedCredits,
  getStudioVideoProviderAcceptedDurations,
  getStudioVideoRequestKind,
  getStudioVideoVideoStageCredits,
  normalizeStudioVideoDuration,
  studioVideoInvalidDurationMessage,
  studioVideoJobContentSchema,
  studioVideoObjectiveConfig,
  studioVideoObjectiveGroups,
  studioVideoObjectives,
  getStudioVideoPreviewCredits,
  studioVideoPreviewActionType,
  studioVideoPreviewImageModel,
  studioVideoPreviewRegenerationActionType,
  studioVideoPreviewVideoModel,
  studioVideoRequestKinds,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  studioVideoRhythmConfig,
  studioVideoRhythmOptions,
  studioVideoSelectableDurationOptions,
  type StudioVideoRhythm,
  studioVideoStyles,
  studioVideoStyleConfig,
  studioVideoTechnicalSpendLimits,
  studioVideoTransformationConfig,
  studioVideoTransformationOptions,
  type StudioVideoTransformation,
  type StudioVideoActiveStage,
  type StudioVideoDuration,
  type StudioVideoJobContent,
  type StudioVideoObjective,
  type StudioVideoRequest,
  type StudioVideoRequestKind,
  type StudioVideoResult,
  type StudioVideoStyle,
  requiresTransformationPreview,
} from "@/lib/studio-ia-video-shared"

export {
  studioVideoActionType,
  studioVideoActiveStages,
  studioVideoCameraMovementConfig,
  studioVideoCameraMovementOptions,
  studioVideoDefaultDuration,
  studioVideoDurationAdjustedMessage,
  studioVideoFinalActionType,
  studioVideoFormats,
  getStudioVideoDurationLabel,
  getStudioVideoEstimatedCredits,
  studioVideoInvalidDurationMessage,
  studioVideoObjectiveConfig,
  studioVideoObjectiveGroups,
  studioVideoObjectives,
  studioVideoPreviewActionType,
  studioVideoPreviewRegenerationActionType,
  studioVideoPreviewVideoModel,
  studioVideoRequestKinds,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  studioVideoRhythmConfig,
  studioVideoRhythmOptions,
  studioVideoSelectableDurationOptions,
  studioVideoStyles,
  studioVideoStyleConfig,
  studioVideoTechnicalSpendLimits,
  studioVideoTransformationConfig,
  studioVideoTransformationOptions,
  requiresTransformationPreview,
  getStudioVideoRequestKind,
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

type LumaVideoGenerationCreateRequest = {
  prompt: string
  model: string
  resolution: "540p" | "720p" | "1080p"
  duration: "5s" | "9s"
  aspect_ratio: "9:16" | "16:9" | "1:1"
  loop?: boolean
  keyframes?: {
    frame0?: {
      type: "image"
      url: string
    }
    frame1?: {
      type: "image"
      url: string
    }
  }
}

type LumaImageGenerationCreateRequest = {
  prompt: string
  model: string
  aspect_ratio: "9:16" | "16:9" | "1:1"
  modify_image_ref: {
    url: string
    weight: number
  }
}

type LumaGeneration = {
  id: string
  state: string
  failure_reason: string | null
  created_at?: string
  assets?: {
    video?: string | null
    image?: string | null
  }
  version?: string
  request?: {
    prompt?: string
    aspect_ratio?: string
    loop?: boolean
  }
}

type StudioVideoStageCostSummary = {
  estimatedCredits: number
  stageEstimatedCredits: number
  actionType: string
  description: string
}

type StudioVideoPromptInput = Pick<
  StudioVideoRequest,
  "format" | "duration" | "objective" | "style" | "transformation" | "rhythm" | "cameraMovement" | "additionalInstructions"
>

const LUMA_API_BASE_URL = "https://api.lumalabs.ai/dream-machine/v1"
const PREVIEW_QUALITY_DIFF_THRESHOLD = 0.065

const formatAspectRatioMap: Record<(typeof studioVideoFormats)[number], LumaVideoGenerationCreateRequest["aspect_ratio"]> = {
  "Reel vertical 9:16": "9:16",
  "Story vertical 9:16": "9:16",
  "Paisagem 16:9": "16:9",
  "Quadrado 1:1": "1:1",
}

const formatResolutionMap: Record<(typeof studioVideoFormats)[number], LumaVideoGenerationCreateRequest["resolution"]> = {
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

  return "O provedor nao conseguiu concluir esta etapa. Os creditos foram preservados."
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

async function createLumaVideoGeneration(payload: LumaVideoGenerationCreateRequest) {
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

async function createLumaImageGeneration(payload: LumaImageGenerationCreateRequest) {
  const response = await fetch(`${LUMA_API_BASE_URL}/generations/image`, {
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const LUMA_STATUS_RETRY_DELAYS_MS = [800, 1600, 3200]

// A Luma tem um unico recurso "generations": a criacao usa endpoints separados
// (POST /generations para video, POST /generations/image para imagem), mas a consulta de status
// e sempre GET /generations/{id}, seja qual for o tipo — o corpo retornado ja diferencia via
// assets.image/assets.video (mesmo formato que refreshStudioVideoJob ja le abaixo). Usar
// GET /generations/image/{id} para a etapa de previa nao existe na API da Luma e sempre retornava
// 404 "Not Found" nessa etapa — nao era uma condicao de corrida, era URL errada.
//
// Mesmo com a URL corrigida, um 404/5xx pontual logo apos a criacao (ou uma instabilidade
// passageira do lado da Luma) ainda pode acontecer — mantemos um retry curto com backoff aqui
// (nao no cliente) para nao derrubar o job inteiro por causa de uma unica consulta de status
// transitoria. Isso e so uma checagem de status: nao dispara nova geracao nem cobra credito.
async function getLumaGeneration(generationId: string) {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= LUMA_STATUS_RETRY_DELAYS_MS.length; attempt++) {
    const response = await fetch(`${LUMA_API_BASE_URL}/generations/${generationId}`, {
      method: "GET",
      headers: getLumaAuthHeaders(),
      cache: "no-store",
    })

    const isRetryableStatus = response.status === 404 || response.status >= 500
    if (!isRetryableStatus) {
      return parseLumaJsonResponse<LumaGeneration>(response)
    }

    try {
      return await parseLumaJsonResponse<LumaGeneration>(response)
    } catch (caughtError) {
      lastError = caughtError
    }

    const delayMs = LUMA_STATUS_RETRY_DELAYS_MS[attempt]
    if (delayMs === undefined) break
    await delay(delayMs)
  }

  throw lastError instanceof Error ? lastError : new Error("Luma AI nao respondeu a consulta de status.")
}

async function resolveReferenceImageUrl(referenceInput: ReferenceInput, propertyId?: string) {
  if (referenceInput.kind === "url") {
    return referenceInput.url
  }

  const referenceId = propertyId || randomUUID()
  return saveStudioVideoReferenceImage(referenceId, referenceInput.file)
}

function createIsoNow() {
  return new Date().toISOString()
}

function logStudioVideoMetric(event: string, payload: Record<string, unknown>) {
  console.info(`[studio-ia][video][${event}]`, payload)
}

function hashObject(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function buildStudioVideoRequestSignature(input: StudioVideoRequest, sourceReferenceUrl: string) {
  return hashObject({
    provider: input.provider,
    propertyId: input.propertyId ?? null,
    sourceAssetId: input.sourceAssetId ?? null,
    referenceImageUrl: input.referenceImageUrls[0] ?? null,
    uploadedImages: input.uploadedImages.map((item) => ({ name: item.name, size: item.size, type: item.type })),
    sourceReferenceUrl,
    format: input.format,
    duration: input.duration,
    objective: input.objective,
    style: input.style,
    transformation: input.transformation,
    rhythm: input.rhythm,
    cameraMovement: input.cameraMovement,
    additionalInstructions: input.additionalInstructions,
  })
}

function buildStoryboard(input: StudioVideoPromptInput, property?: StudioVideoPropertyContext | null) {
  const area = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ") || "localizacao do imovel"
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)

  return [
    `Abertura com fachada e contexto de ${clipText(area, 70)}.`,
    `Entrada mostrando ${clipText(property?.title || "apresentacao principal do imovel", 80)} com foco em ${clipText(objective.commercialFocus, 90)}.`,
    `Ambientes internos guiados por ${clipText(objective.storyline, 120)}.`,
    input.transformation !== "Nenhuma"
      ? `Transformacao principal: ${clipText(transformation.sceneDirection, 120)}.`
      : `Movimento principal: ${clipText(getCameraMovementConfig(input.cameraMovement).shotDirection, 120)}.`,
    `Tratamento visual com ${clipText(style.visualDirection, 120)}.`,
  ]
}

function buildShotPlan(input: StudioVideoPromptInput, property?: StudioVideoPropertyContext | null) {
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)
  const cameraMovement = getCameraMovementConfig(input.cameraMovement)

  return [
    "Plano aberto da fachada ou vista principal.",
    clipText(cameraMovement.shotDirection, 150),
    `Destaque para ${clipText(property?.type?.toLowerCase() || "ambientes principais", 80)} com foco em amplitude.`,
    `Detalhes de apoio reforcando ${clipText(style.cameraDirection, 120)}.`,
    input.transformation !== "Nenhuma"
      ? `Momento de transformacao: ${clipText(transformation.sceneDirection, 120)}.`
      : `Continuidade visual: ${clipText(cameraMovement.shotDirection, 120)}.`,
    "Fechamento com cena aspiracional e CTA visual.",
  ]
}

function buildScript(input: StudioVideoPromptInput, property?: StudioVideoPropertyContext | null) {
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
      input.transformation !== "Nenhuma" ? `Transformacao: ${transformation.promptDirection}.` : "",
      `Ritmo: ${rhythm.promptDirection}.`,
      `Camera: ${cameraMovement.promptDirection}.`,
      input.additionalInstructions ? `Instrucoes extras: ${input.additionalInstructions}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    2200,
  )
}

function buildDirectVideoPrompt(input: StudioVideoPromptInput, property?: StudioVideoPropertyContext | null) {
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
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
    property
      ? `Contexto do imovel: ${property.title}; tipo ${property.type}; finalidade ${property.purpose}; localizacao ${location}; preco ${property.price}; quartos ${property.bedrooms}; banheiros ${property.bathrooms}; vagas ${property.parkingSpots}.`
      : "Use apenas a imagem enviada como base do video.",
    property?.description ? `Descricao atual do imovel: ${clipText(property.description, 500)}.` : "",
    `Direcao de camera complementar: ${style.cameraDirection}`,
    `Ritmo narrativo complementar: ${style.rhythmDirection}`,
    `CTA final: ${objective.ctaDirection}`,
    "Evite apenas aplicar zoom sobre imagem estatica; crie narrativa visual com progressao real e leitura espacial do ambiente.",
    "Preserve fidelidade ao espaco original e valorize o que ja existe no ambiente.",
    "Nao inclua textos sobrepostos, legendas, logos, marcas d'agua ou interfaces.",
    "Mantenha aparencia fotografica realista, pronta para uso comercial imobiliario.",
    "Preserve a coerencia arquitetonica do imovel e nao invente caracteristicas conflitantes com a imagem de referencia.",
    "A imagem de referencia deve ser tratada como frame inicial e guia principal da cena.",
    input.additionalInstructions ? `Observacoes adicionais do corretor: ${input.additionalInstructions}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function buildTransformationPreviewPrompt(input: StudioVideoPromptInput, property?: StudioVideoPropertyContext | null) {
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)
  const rhythm = getRhythmConfig(input.rhythm)
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")

  return [
    "Preserve exatamente a arquitetura, perspectiva, paredes, janelas, portas, pilares, enquadramento, proporcoes e iluminacao natural da imagem original.",
    "Nao altere a estrutura do imovel. Nao crie novas portas, janelas, lajes, escadas ou vistas externas. Nao deforme paredes e nao mude o angulo da camera.",
    `Objetivo comercial: ${input.objective}. ${objective.promptBase}`,
    `Transformacao principal: ${input.transformation}. ${transformation.promptDirection}`,
    `Comportamento visual da transformacao: ${transformation.sceneDirection}`,
    `Estilo visual: ${input.style}. ${style.visualDirection}`,
    `Narrativa e atmosfera: ${style.narrativeDirection}`,
    `Ritmo visual da composicao final: ${rhythm.promptDirection}`,
    property
      ? `Contexto do imovel: ${property.title}; tipo ${property.type}; finalidade ${property.purpose}; localizacao ${location}; preco ${property.price}.`
      : "Use a foto enviada como unico guia estrutural da composicao.",
    property?.description ? `Descricao do imovel: ${clipText(property.description, 500)}.` : "",
    "Adicione apenas os elementos solicitados com realismo fotografico e proporcao correta.",
    "Se o ambiente estiver vazio, mobiliario e decoracao devem parecer instalados de forma natural, sofisticada e comercialmente desejavel.",
    "Se a solicitacao envolver obra ou acabamentos, finalize materiais, pintura, iluminacao, marcenaria, metais, revestimentos e decoracao sem alterar a estrutura real.",
    "Entregue a cena final como foto imobiliaria premium, limpa, coerente e pronta para aprovacao comercial.",
    input.additionalInstructions ? `Complemento do corretor: ${input.additionalInstructions}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function buildTransformationVideoPrompt(input: StudioVideoPromptInput, property?: StudioVideoPropertyContext | null) {
  const objective = getObjectiveConfig(input.objective)
  const style = getStyleConfig(input.style)
  const transformation = getTransformationConfig(input.transformation)
  const location = property?.location || [property?.neighborhood, property?.city].filter(Boolean).join(", ")

  return [
    "Crie um video imobiliario em portugues do Brasil baseado em frame inicial e frame final aprovados.",
    `Duracao final obrigatoria: ${getStudioVideoDurationLabel(input.duration)} (${input.duration}).`,
    `Objetivo principal: ${input.objective}. ${objective.promptBase}`,
    `Estilo visual: ${input.style}. ${style.visualDirection}`,
    `Transformacao continua: ${input.transformation}. ${transformation.promptDirection}`,
    "Transformacao continua e realista do ambiente original para o ambiente completamente transformado mostrado no frame final.",
    "Os moveis, acabamentos, iluminacao e elementos decorativos devem surgir progressivamente em suas posicoes finais com transicoes suaves e coerentes.",
    "Preserve a arquitetura, perspectiva e enquadramento durante todo o video.",
    "A camera permanece quase estatica, com apenas um movimento cinematografico muito sutil.",
    "Nao fazer apenas zoom, pan, travelling ou orbit sobre a imagem original.",
    "O principal acontecimento do video deve ser a transformacao do imovel.",
    property
      ? `Contexto do imovel: ${property.title}; tipo ${property.type}; finalidade ${property.purpose}; localizacao ${location}; preco ${property.price}.`
      : "Use os quadros inicial e final como guia integral da cena.",
    input.additionalInstructions ? `Complemento do corretor: ${input.additionalInstructions}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

async function fetchBufferFromUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Nao foi possivel acessar uma das imagens da geracao.")
  }

  return Buffer.from(await response.arrayBuffer())
}

async function compareImageDifference(referenceUrl: string, candidateUrl: string) {
  const sharp = (await import("sharp")).default
  const [referenceBuffer, candidateBuffer] = await Promise.all([
    fetchBufferFromUrl(referenceUrl),
    fetchBufferFromUrl(candidateUrl),
  ])

  const [referencePixels, candidatePixels] = await Promise.all([
    sharp(referenceBuffer).resize(48, 48, { fit: "fill" }).grayscale().raw().toBuffer(),
    sharp(candidateBuffer).resize(48, 48, { fit: "fill" }).grayscale().raw().toBuffer(),
  ])

  let totalDifference = 0
  for (let index = 0; index < referencePixels.length; index += 1) {
    totalDifference += Math.abs(referencePixels[index]! - candidatePixels[index]!)
  }

  return totalDifference / referencePixels.length / 255
}

function mapProcessingStatus(state: string): StudioVideoResult["generationStatus"] {
  if (state === "completed") return "completed"
  if (state === "failed") return "failed"
  if (state === "dreaming") return "processing"
  return "queued"
}

function mapProcessingProgress(state: string, activeStage: StudioVideoActiveStage) {
  if (state === "completed") return 100
  if (state === "failed") return 0
  if (state === "dreaming") return activeStage === "preview" ? 48 : 68
  return activeStage === "preview" ? 18 : 28
}

export function getStudioVideoStageCostSummary(job: StudioVideoJobContent): StudioVideoStageCostSummary {
  if (job.requestKind === "transformation_pipeline") {
    if (job.activeStage === "preview") {
      const regeneration = job.metrics.previewAttempts > 1
      return {
        estimatedCredits: job.estimatedCredits,
        stageEstimatedCredits: job.stageEstimatedCredits,
        actionType: regeneration ? studioVideoPreviewRegenerationActionType : studioVideoPreviewActionType,
        description: regeneration
          ? "Regenerar previa transformada do Studio IA"
          : "Criar previa transformada do Studio IA",
      }
    }

    return {
      estimatedCredits: job.estimatedCredits,
      stageEstimatedCredits: job.stageEstimatedCredits,
      actionType: studioVideoFinalActionType,
      description:
        job.providerModel === studioVideoPreviewVideoModel
          ? "Criar video economico da transformacao no Studio IA"
          : "Criar video final da transformacao no Studio IA",
    }
  }

  return {
    estimatedCredits: job.estimatedCredits,
    stageEstimatedCredits: job.stageEstimatedCredits,
    actionType: studioVideoActionType,
    description: "Criar video do imovel no Studio IA",
  }
}

function createResultFromJob(requestId: string, job: StudioVideoJobContent): StudioVideoResult {
  return {
    requestId,
    provider: job.provider,
    estimatedCredits: job.estimatedCredits,
    stageEstimatedCredits: job.stageEstimatedCredits,
    totalCreditsConsumed: job.metrics.totalCreditsConsumed,
    generationStatus: job.generationStatus,
    requestKind: job.requestKind,
    jobStage: job.jobStage,
    activeStage: job.activeStage,
    requiresPreviewApproval: job.requiresPreviewApproval,
    previewApproved: job.previewApproved,
    previewImageUrl: job.previewImageUrl,
    previewPrompt: job.previewPrompt,
    previewErrorMessage: job.previewErrorMessage,
    previewQualityScore: job.metrics.qualityDifferenceScore,
    canCreateVideo: job.requestKind === "transformation_pipeline" && job.previewApproved && job.jobStage === "preview_approved",
    canRegeneratePreview:
      job.requestKind === "transformation_pipeline" && (job.jobStage === "preview_ready" || job.jobStage === "failed"),
    storyboard: job.storyboard,
    script: job.script,
    shotPlan: job.shotPlan,
    duration: job.duration,
    promptPreview: job.prompt,
    videoUrl: job.videoUrl,
    fileSaved: Boolean(job.savedDocumentId),
    progress: job.progress,
    providerModel: job.providerModel,
    previewModel: job.previewModel,
    errorMessage: job.errorMessage,
    noticeMessage: job.noticeMessage,
    technicalLimitReached: job.technicalLimitReached,
  }
}

function validateProviderDuration(duration: StudioVideoDuration, model: string) {
  const acceptedDurations = getStudioVideoProviderAcceptedDurations(model)
  return acceptedDurations.includes(duration)
}

function incrementAttemptMetrics(job: StudioVideoJobContent, activeStage: StudioVideoActiveStage) {
  if (activeStage === "preview") {
    return {
      ...job.metrics,
      previewAttempts: job.metrics.previewAttempts + 1,
      retryCount: job.metrics.retryCount + (job.metrics.previewAttempts > 0 ? 1 : 0),
      stageStartedAt: createIsoNow(),
    }
  }

  return {
    ...job.metrics,
    videoAttempts: job.metrics.videoAttempts + 1,
    retryCount: job.metrics.retryCount + (job.metrics.videoAttempts > 0 ? 1 : 0),
    stageStartedAt: createIsoNow(),
  }
}

function baseJobContent({
  input,
  property,
  sourceReferenceUrl,
  requestKind,
  prompt,
  storyboard,
  shotPlan,
  script,
  requestSignature,
  providerModel,
  previewModel,
}: {
  input: StudioVideoRequest
  property?: StudioVideoPropertyContext | null
  sourceReferenceUrl: string
  requestKind: StudioVideoRequestKind
  prompt: string
  storyboard: string[]
  shotPlan: string[]
  script: string
  requestSignature: string
  providerModel?: string
  previewModel?: string
}) {
  return {
    provider: "lumaai",
    estimatedCredits: requestKind === "transformation_pipeline"
      ? getStudioVideoPreviewCredits()
      : getStudioVideoEstimatedCredits({
          duration: input.duration,
          objective: input.objective,
          transformation: input.transformation,
          stage: "direct",
        }),
    stageEstimatedCredits: requestKind === "transformation_pipeline"
      ? getStudioVideoPreviewCredits()
      : getStudioVideoEstimatedCredits({
          duration: input.duration,
          objective: input.objective,
          transformation: input.transformation,
          stage: "direct",
        }),
    propertyId: property?.id,
    propertyTitle: property?.title,
    propertyLocation: property?.location,
    referenceImageUrls: input.referenceImageUrls.length > 0 ? input.referenceImageUrls : [sourceReferenceUrl],
    uploadedImages: input.uploadedImages,
    sourceReferenceUrl,
    requestKind,
    jobStage: requestKind === "transformation_pipeline" ? "preview_processing" : "video_processing",
    activeStage: requestKind === "transformation_pipeline" ? "preview" : "video",
    requiresPreviewApproval: requestKind === "transformation_pipeline",
    previewApproved: false,
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
    generationStatus: "queued" as const,
    progress: 12,
    creditsCharged: false,
    creditsRefunded: false,
    stageCreditsCharged: 0,
    stageCreditsRefunded: 0,
    providerModel,
    previewModel,
    requestSignature,
    technicalLimitReached: false,
    metrics: {
      previewEstimatedCredits:
        requestKind === "transformation_pipeline"
          ? getStudioVideoPreviewCredits()
          : 0,
      previewRegenerationCredits: 0,
      videoEstimatedCredits:
        requestKind === "transformation_pipeline"
          ? getStudioVideoVideoStageCredits(getLumaAIEnv().videoModel || studioVideoPreviewVideoModel)
          : 0,
      totalCreditsConsumed: 0,
      totalCreditsRefunded: 0,
      previewAttempts: 0,
      videoAttempts: 0,
      retryCount: 0,
      stageStartedAt: createIsoNow(),
    },
  } satisfies StudioVideoJobContent
}

export function parseStudioVideoJobContent(content: string) {
  const parsed = JSON.parse(content) as Record<string, unknown>
  const normalizedDuration = normalizeStudioVideoDuration(parsed.duration)
  const requestKind =
    typeof parsed.requestKind === "string" && studioVideoRequestKinds.includes(parsed.requestKind as StudioVideoRequestKind)
      ? (parsed.requestKind as StudioVideoRequestKind)
      : getStudioVideoRequestKind(
          typeof parsed.transformation === "string" && parsed.transformation in studioVideoTransformationConfig
            ? (parsed.transformation as StudioVideoTransformation)
            : "Nenhuma",
        )
  const activeStage =
    typeof parsed.activeStage === "string" && studioVideoActiveStages.includes(parsed.activeStage as StudioVideoActiveStage)
      ? (parsed.activeStage as StudioVideoActiveStage)
      : requestKind === "transformation_pipeline" && !parsed.videoUrl
        ? "preview"
        : "video"
  const derivedJobStage =
    typeof parsed.jobStage === "string"
      ? parsed.jobStage
      : parsed.videoUrl
        ? "completed"
        : requestKind === "transformation_pipeline"
          ? "preview_processing"
          : "video_processing"

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
    requestKind,
    activeStage,
    jobStage: derivedJobStage,
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

export function getStudioVideoProviderConfig() {
  const { apiKey, videoModel, previewVideoModel, imageModel } = getLumaAIEnv()

  return {
    provider: "lumaai",
    model: videoModel,
    previewVideoModel,
    previewImageModel: imageModel || studioVideoPreviewImageModel,
    isConfigured: Boolean(apiKey),
    estimatedCredits: getStudioVideoEstimatedCredits({
      duration: studioVideoDefaultDuration,
      objective: studioVideoObjectives[0],
      transformation: studioVideoTransformationOptions[0],
      stage: "direct",
    }),
  }
}

export async function createInitialStudioVideoJob({
  input,
  property,
  referenceInput,
  targetReferenceUrl,
  requestSignature: providedRequestSignature,
}: {
  input: StudioVideoRequest
  property?: StudioVideoPropertyContext | null
  referenceInput: ReferenceInput
  targetReferenceUrl?: string
  requestSignature?: string
}) {
  const config = getStudioVideoProviderConfig()
  if (!config.isConfigured) {
    throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED")
  }

  const requestKind = getStudioVideoRequestKind(input.transformation)
  const sourceReferenceUrl = await resolveReferenceImageUrl(referenceInput, property?.id)
  const requestSignature = providedRequestSignature || buildStudioVideoRequestSignature(input, sourceReferenceUrl)
  const storyboard = buildStoryboard(input, property)
  const shotPlan = buildShotPlan(input, property)
  const script = buildScript(input, property)

  if (requestKind === "transformation_pipeline") {
    const previewPrompt = buildTransformationPreviewPrompt(input, property)
    const generation = await createLumaImageGeneration({
      prompt: previewPrompt,
      model: config.previewImageModel,
      aspect_ratio: formatAspectRatioMap[input.format],
      modify_image_ref: {
        url: sourceReferenceUrl,
        weight: 0.85,
      },
    })

    const job = baseJobContent({
      input,
      property,
      sourceReferenceUrl,
      requestKind,
      prompt: previewPrompt,
      storyboard,
      shotPlan,
      script,
      requestSignature,
      providerModel: config.model,
      previewModel: config.previewImageModel,
    })

    const nextJob: StudioVideoJobContent = {
      ...job,
      providerImageId: generation.id,
      previewPrompt,
      previewModel: config.previewImageModel,
      generationStatus: mapProcessingStatus(generation.state),
      progress: mapProcessingProgress(generation.state, "preview"),
      stageEstimatedCredits: getStudioVideoPreviewCredits(),
      metrics: {
        ...incrementAttemptMetrics(job, "preview"),
        previewEstimatedCredits: getStudioVideoPreviewCredits(),
      },
      previewErrorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
      errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
    }

    logStudioVideoMetric("preview-created", {
      brokerFlow: input.transformation,
      model: config.previewImageModel,
      stage: "preview",
      providerJobId: generation.id,
      duration: input.duration,
      resolution: formatResolutionMap[input.format],
      estimatedCredits: nextJob.stageEstimatedCredits,
      actualProviderCostUsd: null,
      retries: nextJob.metrics.retryCount,
      requestKind,
    })

    await recordEstimatedCatalogTelemetry({
      operationKey: "studio.video.preview",
      model: config.previewImageModel,
      imageCount: 1,
      retryCount: nextJob.metrics.retryCount,
      metadata: {
        requestKind,
        duration: input.duration,
        format: input.format,
        objective: input.objective,
        transformation: input.transformation,
        providerJobId: generation.id,
      },
    })

    return {
      requestSignature,
      jobContent: nextJob,
    }
  }

  if (!validateProviderDuration(input.duration, config.model)) {
    throw new Error("STUDIO_VIDEO_DURATION_NOT_SUPPORTED")
  }

  const prompt = buildDirectVideoPrompt(input, property)
  const generation = await createLumaVideoGeneration({
    prompt,
    model: config.model,
    resolution: formatResolutionMap[input.format],
    duration: input.duration,
    aspect_ratio: formatAspectRatioMap[input.format],
    keyframes: {
      frame0: {
        type: "image",
        url: sourceReferenceUrl,
      },
      ...(targetReferenceUrl ? {
        frame1: {
          type: "image" as const,
          url: targetReferenceUrl,
        },
      } : {}),
    },
  })

  const job = baseJobContent({
    input,
    property,
    sourceReferenceUrl,
    requestKind,
    prompt,
    storyboard,
    shotPlan,
    script,
    requestSignature,
    providerModel: config.model,
  })

  const directCredits = getStudioVideoEstimatedCredits({
    duration: input.duration,
    objective: input.objective,
    transformation: input.transformation,
    stage: "direct",
  })

  const nextJob: StudioVideoJobContent = {
    ...job,
    sourceAssetId: input.sourceAssetId,
    targetReferenceUrl,
    providerVideoId: generation.id,
    providerModel: config.model,
    estimatedCredits: directCredits,
    stageEstimatedCredits: directCredits,
    generationStatus: mapProcessingStatus(generation.state),
    progress: mapProcessingProgress(generation.state, "video"),
    metrics: {
      ...incrementAttemptMetrics(job, "video"),
    },
    errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
  }

  logStudioVideoMetric("video-created", {
    brokerFlow: input.transformation,
    model: config.model,
    stage: "video",
    providerJobId: generation.id,
    duration: input.duration,
    resolution: formatResolutionMap[input.format],
    estimatedCredits: directCredits,
    actualProviderCostUsd: null,
    retries: nextJob.metrics.retryCount,
    requestKind,
  })

  await recordEstimatedCatalogTelemetry({
    operationKey: "studio.video.final",
    model: config.model,
    videoCount: 1,
    retryCount: nextJob.metrics.retryCount,
    metadata: {
      requestKind,
      duration: input.duration,
      format: input.format,
      objective: input.objective,
      transformation: input.transformation,
      providerJobId: generation.id,
    },
  })

  return {
    requestSignature,
    jobContent: nextJob,
  }
}

export async function regenerateStudioVideoPreview(job: StudioVideoJobContent) {
  if (job.requestKind !== "transformation_pipeline" || !job.sourceReferenceUrl) {
    throw new Error("STUDIO_VIDEO_PREVIEW_NOT_SUPPORTED")
  }

  const config = getStudioVideoProviderConfig()
  const previewPrompt = buildTransformationPreviewPrompt(job, job.propertyId
    ? {
        id: job.propertyId,
        title: job.propertyTitle || "",
        city: "",
        neighborhood: "",
        location: job.propertyLocation || "",
        type: "",
        purpose: "",
        price: "",
        bedrooms: 0,
        bathrooms: 0,
        parkingSpots: 0,
        description: "",
      }
    : null)

  const generation = await createLumaImageGeneration({
    prompt: previewPrompt,
    model: config.previewImageModel,
    aspect_ratio: formatAspectRatioMap[job.format],
    modify_image_ref: {
      url: job.sourceReferenceUrl,
      weight: 0.85,
    },
  })

  const nextJob: StudioVideoJobContent = {
    ...job,
    providerImageId: generation.id,
    previewPrompt,
    previewImageUrl: undefined,
    previewApproved: false,
    previewApprovedAt: undefined,
    previewErrorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
    providerVideoId: job.providerVideoId,
    activeStage: "preview",
    jobStage: "preview_processing",
    generationStatus: mapProcessingStatus(generation.state),
    progress: mapProcessingProgress(generation.state, "preview"),
    stageEstimatedCredits: getStudioVideoEstimatedCredits({
      duration: job.duration,
      objective: job.objective,
      transformation: job.transformation,
      stage: "preview_regeneration",
    }),
    creditsRefunded: false,
    stageCreditsRefunded: 0,
    errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
    metrics: {
      ...incrementAttemptMetrics(job, "preview"),
      previewRegenerationCredits: getStudioVideoEstimatedCredits({
        duration: job.duration,
        objective: job.objective,
        transformation: job.transformation,
        stage: "preview_regeneration",
      }),
      qualityDifferenceScore: undefined,
      qualityDifferenceThreshold: PREVIEW_QUALITY_DIFF_THRESHOLD,
    },
  }

  logStudioVideoMetric("preview-regenerated", {
    brokerFlow: job.transformation,
    model: config.previewImageModel,
    stage: "preview",
    providerJobId: generation.id,
    duration: job.duration,
    resolution: formatResolutionMap[job.format],
    estimatedCredits: nextJob.stageEstimatedCredits,
    actualProviderCostUsd: null,
    retries: nextJob.metrics.retryCount,
    requestKind: job.requestKind,
  })

  await recordEstimatedCatalogTelemetry({
    operationKey: "studio.video.preview_regeneration",
    model: config.previewImageModel,
    imageCount: 1,
    retryCount: nextJob.metrics.retryCount,
    metadata: {
      requestKind: job.requestKind,
      duration: job.duration,
      format: job.format,
      objective: job.objective,
      transformation: job.transformation,
      providerJobId: generation.id,
    },
  })

  return nextJob
}

export function approveStudioVideoPreview(job: StudioVideoJobContent) {
  if (job.requestKind !== "transformation_pipeline" || !job.previewImageUrl || job.jobStage !== "preview_ready") {
    throw new Error("STUDIO_VIDEO_PREVIEW_NOT_READY")
  }

  return {
    ...job,
    previewApproved: true,
    previewApprovedAt: createIsoNow(),
    jobStage: "preview_approved",
    generationStatus: "completed" as const,
    progress: 100,
    errorMessage: undefined,
    previewErrorMessage: undefined,
  } satisfies StudioVideoJobContent
}

export async function createApprovedStudioVideoAnimation(job: StudioVideoJobContent) {
  if (job.requestKind !== "transformation_pipeline" || !job.previewApproved || !job.previewImageUrl || !job.sourceReferenceUrl) {
    throw new Error("STUDIO_VIDEO_PREVIEW_APPROVAL_REQUIRED")
  }

  const config = getStudioVideoProviderConfig()
  if (!validateProviderDuration(job.duration, config.model)) {
    throw new Error("STUDIO_VIDEO_DURATION_NOT_SUPPORTED")
  }

  const prompt = buildTransformationVideoPrompt(job, job.propertyId
    ? {
        id: job.propertyId,
        title: job.propertyTitle || "",
        city: "",
        neighborhood: "",
        location: job.propertyLocation || "",
        type: "",
        purpose: "",
        price: "",
        bedrooms: 0,
        bathrooms: 0,
        parkingSpots: 0,
        description: "",
      }
    : null)

  const generation = await createLumaVideoGeneration({
    prompt,
    model: config.model,
    resolution: formatResolutionMap[job.format],
    duration: job.duration,
    aspect_ratio: formatAspectRatioMap[job.format],
    keyframes: {
      frame0: {
        type: "image",
        url: job.sourceReferenceUrl,
      },
      frame1: {
        type: "image",
        url: job.previewImageUrl,
      },
    },
  })

  const stageEstimatedCredits = getStudioVideoEstimatedCredits({
    duration: job.duration,
    objective: job.objective,
    transformation: job.transformation,
    stage: "video",
    model: config.model,
  })

  const nextJob: StudioVideoJobContent = {
    ...job,
    providerVideoId: generation.id,
    providerModel: config.model,
    prompt,
    activeStage: "video",
    jobStage: "video_processing",
    generationStatus: mapProcessingStatus(generation.state),
    progress: mapProcessingProgress(generation.state, "video"),
    stageEstimatedCredits,
    creditsRefunded: false,
    stageCreditsRefunded: 0,
    errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason),
    metrics: {
      ...incrementAttemptMetrics(job, "video"),
    },
  }

  logStudioVideoMetric("video-created", {
    brokerFlow: job.transformation,
    model: config.model,
    stage: "video",
    providerJobId: generation.id,
    duration: job.duration,
    resolution: formatResolutionMap[job.format],
    estimatedCredits: stageEstimatedCredits,
    actualProviderCostUsd: null,
    retries: nextJob.metrics.retryCount,
    requestKind: job.requestKind,
  })

  await recordEstimatedCatalogTelemetry({
    operationKey: "studio.video.final",
    model: config.model,
    videoCount: 1,
    retryCount: nextJob.metrics.retryCount,
    metadata: {
      requestKind: job.requestKind,
      duration: job.duration,
      format: job.format,
      objective: job.objective,
      transformation: job.transformation,
      providerJobId: generation.id,
    },
  })

  return nextJob
}

export async function refreshStudioVideoJob(job: StudioVideoJobContent): Promise<StudioVideoJobContent> {
  if (
    job.jobStage !== "preview_processing" &&
    job.jobStage !== "video_processing" &&
    !(job.requestKind === "direct_video" && (job.generationStatus === "queued" || job.generationStatus === "processing"))
  ) {
    return job
  }

  const activeStage = job.jobStage === "preview_processing" ? "preview" : "video"
  const providerJobId = activeStage === "preview" ? job.providerImageId : job.providerVideoId
  if (!providerJobId) return job

  const generation = await getLumaGeneration(providerJobId)

  if (generation.failure_reason) {
    logStudioVideoMetric("provider-failure", {
      provider: job.provider,
      activeStage,
      providerJobId,
      failureReason: generation.failure_reason,
      requestKind: job.requestKind,
    })
  }

  if (activeStage === "preview") {
    if (generation.state === "completed" && generation.assets?.image) {
      const differenceScore = await compareImageDifference(job.sourceReferenceUrl || job.referenceImageUrls[0] || generation.assets.image, generation.assets.image)
      if (differenceScore < PREVIEW_QUALITY_DIFF_THRESHOLD) {
        return {
          ...job,
          generationStatus: "failed",
          jobStage: "failed",
          progress: 0,
          previewErrorMessage:
            "A previa ficou muito parecida com a imagem original. Aprove ou gere novamente somente quando a transformacao estiver visivel.",
          errorMessage:
            "A previa ficou muito parecida com a imagem original. Aprove ou gere novamente somente quando a transformacao estiver visivel.",
          metrics: {
            ...job.metrics,
            qualityDifferenceScore: differenceScore,
            qualityDifferenceThreshold: PREVIEW_QUALITY_DIFF_THRESHOLD,
            stageCompletedAt: createIsoNow(),
          },
        } satisfies StudioVideoJobContent
      }

      const response = await fetch(generation.assets.image, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("PREVIEW_DOWNLOAD_FAILED")
      }

      const contentType = response.headers.get("content-type")?.trim() || "image/png"
      const arrayBuffer = await response.arrayBuffer()
      const previewImageUrl = await savePropertyGeneratedImage(job.propertyId || job.providerImageId || providerJobId, Buffer.from(arrayBuffer), contentType)

      return {
        ...job,
        previewImageUrl,
        generationStatus: "completed",
        jobStage: "preview_ready",
        progress: 100,
        previewErrorMessage: undefined,
        errorMessage: undefined,
        metrics: {
          ...job.metrics,
          qualityDifferenceScore: differenceScore,
          qualityDifferenceThreshold: PREVIEW_QUALITY_DIFF_THRESHOLD,
          stageCompletedAt: createIsoNow(),
        },
      } satisfies StudioVideoJobContent
    }

    return {
      ...job,
      generationStatus: mapProcessingStatus(generation.state),
      jobStage: generation.state === "failed" ? "failed" : "preview_processing",
      progress: mapProcessingProgress(generation.state, "preview"),
      previewErrorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason) ?? job.previewErrorMessage,
      errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason) ?? job.errorMessage,
    } satisfies StudioVideoJobContent
  }

  let videoUrl = job.videoUrl

  if (generation.state === "completed" && generation.assets?.video && !videoUrl) {
    const response = await fetch(generation.assets.video, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("VIDEO_DOWNLOAD_FAILED")
    }

    const arrayBuffer = await response.arrayBuffer()
    videoUrl = await savePropertyGeneratedVideo(job.propertyId || job.providerVideoId || providerJobId, Buffer.from(arrayBuffer), "video/mp4")
  }

  return {
    ...job,
    generationStatus: mapProcessingStatus(generation.state),
    jobStage: generation.state === "completed" ? "completed" : generation.state === "failed" ? "failed" : "video_processing",
    progress: mapProcessingProgress(generation.state, "video"),
    videoUrl,
    errorMessage: sanitizeStudioVideoErrorMessage(generation.failure_reason) ?? job.errorMessage,
    metrics: generation.state === "completed"
      ? {
          ...job.metrics,
          stageCompletedAt: createIsoNow(),
        }
      : job.metrics,
  } satisfies StudioVideoJobContent
}

export function getStudioVideoResult(requestId: string, job: StudioVideoJobContent) {
  return createResultFromJob(requestId, job)
}
