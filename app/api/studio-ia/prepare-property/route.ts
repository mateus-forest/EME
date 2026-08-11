import { createHash } from "node:crypto"

import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"

import { recordAiOperationTelemetry } from "@/lib/ai-operation-telemetry"
import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { executePropertyPreparation, PedraApiError, ensurePedraConfigured } from "@/lib/pedra"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"
import {
  deletePropertyStorageFile,
  savePropertyGeneratedImage,
  saveStudioPropertyPreparationReferenceImage,
} from "@/lib/property-storage"
import { createStudioCampaign, getStudioCampaignById } from "@/lib/studio-campaigns"
import {
  getPropertyPreparationExternalCredits,
  getPropertyPreparationOperation,
  propertyPreparationRequestSchema,
  type PropertyPreparationRequest,
} from "@/lib/studio-property-preparation"

export const dynamic = "force-dynamic"
export const maxDuration = 90

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_RESULT_BYTES = 30 * 1024 * 1024
const ACTIVE_GENERATION_TTL_MS = 3 * 60 * 1000
const IDEMPOTENCY_KEY_SCHEMA = z.string().uuid()
const LOCK_ASSET_KEY = "__property_preparation_generation_lock__"

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>
type StudioCampaignResponse = NonNullable<Awaited<ReturnType<typeof getStudioCampaignById>>>

class PreparationRouteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "PreparationRouteError"
  }
}

function noStoreJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002")
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function workspaceKey(user: AuthenticatedUser) {
  if (user.role === UserRole.BROKER && user.broker?.id) return `broker:${user.broker.id}`
  if (user.role === UserRole.AGENCY && user.ownedAgency?.id) return `agency:${user.ownedAgency.id}`
  throw new PreparationRouteError("WORKSPACE_NOT_FOUND", "Não foi possível identificar o espaço de trabalho.", 403)
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function getRequestIds(workspace: string, idempotencyKey: string, signature: string) {
  return {
    campaignId: `ppreq_${sha256(`${workspace}:${idempotencyKey}`).slice(0, 32)}`,
    lockId: `pplock_${sha256(`${workspace}:${signature}`).slice(0, 32)}`,
  }
}

async function resolveAccessibleProperty(id: string, user: AuthenticatedUser) {
  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      imageUrls: true,
      brokerId: true,
      agencyId: true,
    },
  })

  if (!property) throw new PreparationRouteError("PROPERTY_NOT_FOUND", "Imóvel não encontrado.", 404)

  if (user.role === UserRole.BROKER && (!user.broker || property.brokerId !== user.broker.id)) {
    throw new PreparationRouteError("PROPERTY_ACCESS_DENIED", "Acesso não permitido a este imóvel.", 403)
  }

  if (user.role === UserRole.AGENCY && (!user.ownedAgency || property.agencyId !== user.ownedAgency.id)) {
    throw new PreparationRouteError("PROPERTY_ACCESS_DENIED", "Acesso não permitido a este imóvel.", 403)
  }

  return property
}

function getPropertyImages(property: { imageUrls: unknown }) {
  return Array.isArray(property.imageUrls)
    ? property.imageUrls.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
    : []
}

function requireHttpsUrl(value: string, message: string, status = 400) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") throw new Error("invalid protocol")
    return url.toString()
  } catch {
    throw new PreparationRouteError("INVALID_IMAGE_URL", message, status)
  }
}

async function validateUploadedImage(buffer: Buffer) {
  try {
    const sharp = (await import("sharp")).default
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error("missing image metadata")
  } catch {
    throw new PreparationRouteError("INVALID_IMAGE_FILE", "O arquivo enviado não contém uma imagem válida.", 400)
  }
}

async function downloadGeneratedImage(imageUrl: string) {
  const url = requireHttpsUrl(imageUrl, "O serviço visual retornou uma imagem com URL inválida.", 502)
  let response: Response

  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000) })
  } catch {
    throw new PreparationRouteError("RESULT_DOWNLOAD_FAILED", "Não foi possível salvar a imagem gerada.", 502)
  }

  if (!response.ok) {
    throw new PreparationRouteError("RESULT_DOWNLOAD_FAILED", "Não foi possível salvar a imagem gerada.", 502)
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new PreparationRouteError("INVALID_RESULT_FILE", "O serviço visual retornou um arquivo de imagem inválido.", 502)
  }

  const contentLength = Number(response.headers.get("content-length") || 0)
  if (contentLength > MAX_RESULT_BYTES) {
    throw new PreparationRouteError("RESULT_TOO_LARGE", "A imagem gerada excede o limite de armazenamento.", 502)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_RESULT_BYTES) {
    throw new PreparationRouteError("RESULT_TOO_LARGE", "A imagem gerada excede o limite de armazenamento.", 502)
  }

  await validateUploadedImage(buffer).catch(() => {
    throw new PreparationRouteError("INVALID_RESULT_FILE", "O serviço visual retornou um arquivo de imagem inválido.", 502)
  })

  return { buffer, mimeType }
}

function getConfiguration(formData: FormData) {
  return propertyPreparationRequestSchema.parse({
    operation: formData.get("operation"),
    roomType: formData.get("roomType"),
    style: formData.get("style"),
    creativity: formData.get("creativity"),
    preserveWindows: formData.get("preserveWindows"),
    furnish: formData.get("furnish"),
    prompt: formData.get("prompt"),
    highFidelity: formData.get("highFidelity"),
    preserveOriginalFraming: formData.get("preserveOriginalFraming"),
    skyStyle: formData.get("skyStyle"),
    objectsToBlur: formData.get("objectsToBlur"),
  })
}

function getParameters(configuration: PropertyPreparationRequest) {
  const { operation: _operation, ...parameters } = configuration
  return parameters
}

function getGenerationPrompt(configuration: PropertyPreparationRequest) {
  switch (configuration.operation) {
    case "furnish":
      return `Mobiliar ${configuration.roomType} em estilo ${configuration.style}`
    case "renovation":
      return `Reformar ambiente em estilo ${configuration.style}`
    case "edit_via_prompt":
      return configuration.prompt
    default:
      return getPropertyPreparationOperation(configuration.operation).label
  }
}

function getVisualIdentity(configuration: PropertyPreparationRequest) {
  return "style" in configuration ? configuration.style : null
}

function getAssetLabel(configuration: PropertyPreparationRequest) {
  const labels: Record<PropertyPreparationRequest["operation"], string> = {
    furnish: "Ambiente mobiliado",
    empty_room: "Ambiente vazio",
    renovation: "Ambiente reformado",
    edit_via_prompt: "Imagem editada",
    enhance: "Fotografia melhorada",
    enhance_and_correct_perspective: "Perspectiva corrigida",
    sky_blue: "Céu melhorado",
    blur: "Elementos sensíveis desfocados",
  }
  return labels[configuration.operation]
}

function campaignStateResponse(campaign: StudioCampaignResponse, reused: boolean) {
  if (campaign.status === "PROCESSING") {
    return noStoreJson({ jobId: campaign.id, status: "PROCESSING", reused }, 202)
  }
  if (campaign.status === "FAILED") {
    return noStoreJson({ error: "Esta preparação não pôde ser concluída. Inicie uma nova tentativa.", code: "GENERATION_FAILED" }, 409)
  }
  return noStoreJson({ campaign, reused }, reused ? 200 : 201)
}

async function findCampaignBySignature(user: AuthenticatedUser, signature: string) {
  const campaign = await prisma.studioCampaign.findFirst({
    where: {
      kind: "PROPERTY_PREPARATION",
      brokerId: user.role === UserRole.BROKER ? user.broker?.id : undefined,
      agencyId: user.role === UserRole.AGENCY ? user.ownedAgency?.id : undefined,
      metadata: { path: ["idempotency", "signature"], equals: signature },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  return campaign ? getStudioCampaignById(user, campaign.id) : null
}

async function expireStaleCampaign(campaign: StudioCampaignResponse) {
  if (campaign.status !== "PROCESSING") return false
  const updatedAt = new Date(campaign.updatedAt).getTime()
  if (!Number.isFinite(updatedAt) || updatedAt > Date.now() - ACTIVE_GENERATION_TTL_MS) return false

  await prisma.$transaction(async (transaction) => {
    const stale = await transaction.studioCampaign.findFirst({
      where: {
        id: campaign.id,
        status: "PROCESSING",
        updatedAt: { lte: new Date(Date.now() - ACTIVE_GENERATION_TTL_MS) },
      },
      select: { id: true, metadata: true },
    })
    if (!stale) return

    await transaction.studioCampaignAsset.deleteMany({
      where: { campaignId: stale.id, assetKey: LOCK_ASSET_KEY },
    })
    await transaction.studioCampaign.update({
      where: { id: stale.id },
      data: {
        status: "FAILED",
        metadata: {
          ...asRecord(stale.metadata),
          processingStatus: "failed",
          errorCode: "GENERATION_EXPIRED",
          failedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
  })
  return true
}

async function claimGeneration(input: {
  user: AuthenticatedUser
  campaignId: string
  lockId: string
  signature: string
  idempotencyKey: string
  propertyId: string | null
  sourceType: "property" | "upload"
  sourceImageUrl: string | null
  configuration: PropertyPreparationRequest
  startedAt: string
}) {
  const existingRequest = await getStudioCampaignById(input.user, input.campaignId)
  if (existingRequest) {
    const metadata = asRecord(existingRequest.metadata)
    const idempotency = asRecord(metadata.idempotency)
    if (idempotency.signature !== input.signature) {
      throw new PreparationRouteError("IDEMPOTENCY_KEY_REUSED", "Esta solicitação já foi usada com outros dados.", 409)
    }
    if (!(await expireStaleCampaign(existingRequest))) return { acquired: false as const, campaign: existingRequest }
    throw new PreparationRouteError("GENERATION_EXPIRED", "A tentativa anterior expirou. Inicie uma nova preparação.", 409)
  }

  const operation = getPropertyPreparationOperation(input.configuration.operation)
  const externalCredits = getPropertyPreparationExternalCredits(input.configuration)
  const metadata = {
    origin: input.sourceType === "property" ? "property_photo" : "direct_upload",
    sourceImageUrl: input.sourceImageUrl,
    resultImageUrl: null,
    transformation: input.configuration.operation,
    parameters: getParameters(input.configuration),
    providerInternal: "pedra",
    providerOperation: `/api/${input.configuration.operation}`,
    processingStatus: "processing",
    startedAt: input.startedAt,
    completedAt: null,
    externalCredits,
    creditsConsumed: null,
    emeCreditsCharged: false,
    idempotency: {
      key: input.idempotencyKey,
      signature: input.signature,
      lockId: input.lockId,
    },
  }

  try {
    const campaign = await createStudioCampaign(input.user, {
      id: input.campaignId,
      kind: "PROPERTY_PREPARATION",
      status: "PROCESSING",
      goal: operation.label,
      visualIdentity: getVisualIdentity(input.configuration),
      version: 1,
      provider: "EME",
      model: "Preparação visual",
      prompt: getGenerationPrompt(input.configuration),
      sourceRoute: "/api/studio-ia/prepare-property",
      propertyId: input.propertyId,
      metadata,
      assets: [{
        id: input.lockId,
        assetKey: LOCK_ASSET_KEY,
        label: "Processamento",
        type: "IMAGE",
        provider: "EME",
        model: "Preparação visual",
        status: "DRAFT",
        content: { internalType: "idempotency_lock" },
      }],
    })
    return { acquired: true as const, campaign }
  } catch (caughtError) {
    if (!isUniqueConstraintError(caughtError)) throw caughtError

    const sameRequest = await getStudioCampaignById(input.user, input.campaignId)
    if (sameRequest) return { acquired: false as const, campaign: sameRequest }

    const activeLock = await prisma.studioCampaignAsset.findUnique({
      where: { id: input.lockId },
      select: { campaignId: true },
    })
    const equivalentCampaign = activeLock
      ? await getStudioCampaignById(input.user, activeLock.campaignId)
      : await findCampaignBySignature(input.user, input.signature)

    if (equivalentCampaign) return { acquired: false as const, campaign: equivalentCampaign }
    throw caughtError
  }
}

async function markGenerationFailed(input: {
  campaignId: string
  lockId: string
  initialMetadata: Record<string, unknown>
  errorCode: string
}) {
  await prisma.$transaction([
    prisma.studioCampaignAsset.deleteMany({ where: { id: input.lockId, campaignId: input.campaignId } }),
    prisma.studioCampaign.updateMany({
      where: { id: input.campaignId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        metadata: {
          ...input.initialMetadata,
          processingStatus: "failed",
          errorCode: input.errorCode,
          failedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    }),
  ])
}

async function recordPreparationTelemetry(input: {
  user: AuthenticatedUser
  configuration: PropertyPreparationRequest
  status: "completed" | "failed"
  durationMs: number
  workflowId: string
  errorCode?: string
  sourceType: string
  storageBytes?: number
  providerRequestStarted: boolean
}) {
  const operation = getPropertyPreparationOperation(input.configuration.operation)
  await recordAiOperationTelemetry({
    operationKey: `studio.property_preparation.${input.configuration.operation}`,
    module: "Studio IA",
    feature: "Preparar imóvel",
    capability: operation.label,
    handler: "POST",
    route: "/api/studio-ia/prepare-property",
    provider: "pedra",
    model: input.configuration.operation,
    status: input.status,
    errorCode: input.errorCode ?? null,
    source: "portal",
    workflowId: input.workflowId,
    userId: input.user.id,
    brokerId: input.user.broker?.id ?? null,
    agencyId: input.user.ownedAgency?.id ?? null,
    planKey: input.user.plan ?? null,
    imageCount: input.status === "completed" ? 1 : 0,
    storageBytes: input.storageBytes ?? null,
    durationMs: input.durationMs,
    creditsConsumed: null,
    retryCount: 0,
    metadata: {
      sourceType: input.sourceType,
      parameters: getParameters(input.configuration),
      providerRequestStarted: input.providerRequestStarted,
      externalCredits: input.status === "completed" ? getPropertyPreparationExternalCredits(input.configuration) : null,
      emeCreditsCharged: false,
    },
  })
}

async function authenticate() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? noStoreJson({ error: "Não autenticado." }, 401), user: null }
  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return { response: noStoreJson({ error: "Acesso não permitido para este perfil." }, 403), user: null }
  }
  return { response: null, user }
}

export async function GET(request: NextRequest) {
  const authentication = await authenticate()
  if (!authentication.user) return authentication.response

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim()
  if (!jobId) return noStoreJson({ error: "Solicitação não informada." }, 400)

  const campaign = await getStudioCampaignById(authentication.user, jobId)
  if (!campaign || campaign.kind !== "PROPERTY_PREPARATION") {
    return noStoreJson({ error: "Solicitação não encontrada." }, 404)
  }
  return campaignStateResponse(campaign, true)
}

export async function POST(request: NextRequest) {
  const startedAtMs = Date.now()
  const startedAt = new Date().toISOString()
  const authentication = await authenticate()
  if (!authentication.user) return authentication.response
  const user = authentication.user

  let persistedSourceUrl: string | null = null
  let persistedResultUrl: string | null = null
  let campaignId: string | null = null
  let lockId: string | null = null
  let claimedMetadata: Record<string, unknown> | null = null
  let configuration: PropertyPreparationRequest | null = null
  let sourceType: "property" | "upload" | null = null
  let providerRequestStarted = false

  try {
    ensurePedraConfigured()
    const formData = await request.formData()
    const rawSourceType = formData.get("sourceType")
    if (rawSourceType !== "property" && rawSourceType !== "upload") {
      throw new PreparationRouteError("SOURCE_REQUIRED", "Selecione uma fotografia do imóvel ou envie uma imagem.", 400)
    }
    sourceType = rawSourceType
    configuration = getConfiguration(formData)
    const idempotencyKey = IDEMPOTENCY_KEY_SCHEMA.parse(formData.get("idempotencyKey"))

    let property: Awaited<ReturnType<typeof resolveAccessibleProperty>> | null = null
    let sourceImageUrl: string | null = null
    let sourceIdentity: string
    let uploadedImage: File | null = null

    if (sourceType === "property") {
      const propertyId = String(formData.get("propertyId") ?? "").trim()
      const requestedImageUrl = String(formData.get("imageUrl") ?? "").trim()
      if (!propertyId || !requestedImageUrl) {
        throw new PreparationRouteError("PROPERTY_IMAGE_REQUIRED", "Selecione um imóvel e uma fotografia cadastrada.", 400)
      }
      property = await resolveAccessibleProperty(propertyId, user)
      if (!getPropertyImages(property).includes(requestedImageUrl)) {
        throw new PreparationRouteError("PROPERTY_IMAGE_MISMATCH", "A fotografia selecionada não pertence a este imóvel.", 400)
      }
      sourceImageUrl = requireHttpsUrl(requestedImageUrl, "A fotografia selecionada precisa possuir uma URL HTTPS válida.")
      sourceIdentity = `property:${property.id}:${sourceImageUrl}`
    } else {
      const image = formData.get("image")
      if (!(image instanceof File) || image.size === 0) {
        throw new PreparationRouteError("UPLOAD_REQUIRED", "Envie uma imagem para continuar.", 400)
      }
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        throw new PreparationRouteError("INVALID_IMAGE_TYPE", "Use uma imagem JPG, PNG ou WEBP.", 400)
      }
      if (image.size > MAX_UPLOAD_BYTES) {
        throw new PreparationRouteError("IMAGE_TOO_LARGE", "A imagem deve ter no máximo 15 MB.", 400)
      }
      const imageBuffer = Buffer.from(await image.arrayBuffer())
      await validateUploadedImage(imageBuffer)
      uploadedImage = image
      sourceIdentity = `upload:${image.type}:${sha256(imageBuffer)}`
    }

    const signature = sha256(JSON.stringify({ sourceIdentity, configuration }))
    const ids = getRequestIds(workspaceKey(user), idempotencyKey, signature)
    campaignId = ids.campaignId
    lockId = ids.lockId

    const claim = await claimGeneration({
      user,
      campaignId,
      lockId,
      signature,
      idempotencyKey,
      propertyId: property?.id ?? null,
      sourceType,
      sourceImageUrl,
      configuration,
      startedAt,
    })
    if (!claim.acquired) return campaignStateResponse(claim.campaign, true)
    claimedMetadata = asRecord(claim.campaign.metadata)

    if (sourceType === "upload" && uploadedImage) {
      try {
        persistedSourceUrl = await saveStudioPropertyPreparationReferenceImage(campaignId, uploadedImage)
        sourceImageUrl = requireHttpsUrl(persistedSourceUrl, "Não foi possível disponibilizar a imagem enviada para processamento.")
      } catch (caughtError) {
        if (caughtError instanceof PreparationRouteError) throw caughtError
        throw new PreparationRouteError("SOURCE_STORAGE_FAILED", "Não foi possível salvar a imagem enviada.", 502)
      }
    }

    if (!sourceImageUrl) {
      throw new PreparationRouteError("SOURCE_URL_UNAVAILABLE", "Não foi possível preparar a imagem selecionada.", 500)
    }

    providerRequestStarted = true
    const generated = await executePropertyPreparation({ ...configuration, imageUrl: sourceImageUrl })
    const downloaded = await downloadGeneratedImage(generated.imageUrl)

    try {
      persistedResultUrl = await savePropertyGeneratedImage(property?.id ?? campaignId, downloaded.buffer, downloaded.mimeType)
    } catch {
      throw new PreparationRouteError("RESULT_STORAGE_FAILED", "Não foi possível armazenar o resultado gerado.", 502)
    }

    const completedAt = new Date().toISOString()
    const parameters = getParameters(configuration)
    const externalCredits = getPropertyPreparationExternalCredits(configuration)
    const completedMetadata = {
      ...claimedMetadata,
      sourceImageUrl,
      resultImageUrl: persistedResultUrl,
      processingStatus: "completed",
      completedAt,
      externalCredits,
    }

    try {
      await prisma.$transaction(async (transaction) => {
        const deleted = await transaction.studioCampaignAsset.deleteMany({
          where: { id: lockId!, campaignId: campaignId!, assetKey: LOCK_ASSET_KEY },
        })
        if (deleted.count !== 1) throw new Error("PROPERTY_PREPARATION_LOCK_LOST")

        await transaction.studioCampaignAsset.create({
          data: {
            campaignId: campaignId!,
            assetKey: `prepared_${configuration!.operation}`,
            label: getAssetLabel(configuration!),
            type: "IMAGE",
            provider: "EME",
            model: "Preparação visual",
            fileUrl: persistedResultUrl,
            thumbnailUrl: persistedResultUrl,
            status: "PENDING_REVIEW",
            content: {
              transformation: configuration!.operation,
              parameters,
              sourceImageUrl,
              resultImageUrl: persistedResultUrl,
            },
            metadata: {
              origin: sourceType === "property" ? "property_photo" : "direct_upload",
              propertyId: property?.id ?? null,
              sourceImageUrl,
              resultImageUrl: persistedResultUrl,
              providerInternal: "pedra",
              providerOperation: `/api/${configuration!.operation}`,
              externalCredits,
              creditsConsumed: null,
              emeCreditsCharged: false,
              startedAt,
              completedAt,
            },
          },
        })
        await transaction.studioCampaign.update({
          where: { id: campaignId! },
          data: { status: "PENDING_REVIEW", metadata: completedMetadata as Prisma.InputJsonValue },
        })
      })
    } catch {
      throw new PreparationRouteError("PERSISTENCE_FAILED", "O resultado foi gerado, mas não pôde ser salvo na Biblioteca.", 500)
    }

    const campaign = await getStudioCampaignById(user, campaignId)
    if (!campaign) throw new PreparationRouteError("PERSISTENCE_FAILED", "Não foi possível carregar o resultado salvo.", 500)

    await recordPreparationTelemetry({
      user,
      configuration,
      status: "completed",
      durationMs: Date.now() - startedAtMs,
      workflowId: campaignId,
      sourceType,
      storageBytes: downloaded.buffer.byteLength,
      providerRequestStarted,
    })

    return campaignStateResponse(campaign, false)
  } catch (caughtError) {
    if (persistedResultUrl) await deletePropertyStorageFile(persistedResultUrl)
    if (persistedSourceUrl) await deletePropertyStorageFile(persistedSourceUrl)

    const errorCode = caughtError instanceof PedraApiError || caughtError instanceof PreparationRouteError
      ? caughtError.code
      : caughtError instanceof ZodError
        ? "INPUT_INVALID"
        : caughtError instanceof Error
          ? caughtError.name
          : "UNKNOWN"

    if (campaignId && lockId && claimedMetadata) {
      await markGenerationFailed({ campaignId, lockId, initialMetadata: claimedMetadata, errorCode }).catch(() => undefined)
    }

    if (configuration && sourceType && campaignId) {
      await recordPreparationTelemetry({
        user,
        configuration,
        status: "failed",
        durationMs: Date.now() - startedAtMs,
        workflowId: campaignId,
        errorCode,
        sourceType,
        providerRequestStarted,
      })
    }

    console.error("[api][studio-ia][prepare-property] generation failed", { errorCode })

    if (caughtError instanceof PedraApiError || caughtError instanceof PreparationRouteError) {
      return noStoreJson({ error: caughtError.message, code: errorCode }, caughtError.status)
    }
    if (caughtError instanceof ZodError) {
      return noStoreJson({ error: "Revise os dados necessários para esta preparação.", code: "INPUT_INVALID" }, 400)
    }
    if (isPrismaSchemaMismatch(caughtError)) return prismaSchemaMismatchResponse("Studio IA / preparação de imóvel")
    if (isPrismaUnavailable(caughtError)) {
      return noStoreJson({ error: "O serviço do Studio IA está indisponível no momento.", code: "DATABASE_UNAVAILABLE" }, 503)
    }
    return noStoreJson({ error: "Não foi possível preparar a imagem agora.", code: "UNEXPECTED_ERROR" }, 500)
  }
}
