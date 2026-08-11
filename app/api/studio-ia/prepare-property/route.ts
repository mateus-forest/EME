import { randomUUID } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { recordAiOperationTelemetry } from "@/lib/ai-operation-telemetry"
import { PedraApiError, ensurePedraConfigured, furnishRoom } from "@/lib/pedra"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import {
  deletePropertyStorageFile,
  savePropertyGeneratedImage,
  saveStudioPropertyPreparationReferenceImage,
} from "@/lib/property-storage"
import { createStudioCampaign } from "@/lib/studio-campaigns"
import { furnishRoomRequestSchema } from "@/lib/studio-property-preparation"

export const dynamic = "force-dynamic"
export const maxDuration = 90

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_RESULT_BYTES = 30 * 1024 * 1024

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>

class PreparationRouteError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = "PreparationRouteError"
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

  if (!property) throw new PreparationRouteError("Imóvel não encontrado.", 404)

  if (user.role === UserRole.BROKER && (!user.broker || property.brokerId !== user.broker.id)) {
    throw new PreparationRouteError("Acesso não permitido a este imóvel.", 403)
  }

  if (user.role === UserRole.AGENCY && (!user.ownedAgency || property.agencyId !== user.ownedAgency.id)) {
    throw new PreparationRouteError("Acesso não permitido a este imóvel.", 403)
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
    throw new PreparationRouteError(message, status)
  }
}

async function downloadGeneratedImage(imageUrl: string) {
  const url = requireHttpsUrl(imageUrl, "O serviço visual retornou uma imagem com URL inválida.", 502)
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null)

  if (!response?.ok) {
    throw new PreparationRouteError("Não foi possível salvar a imagem gerada.", 502)
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new PreparationRouteError("O serviço visual retornou um arquivo de imagem inválido.", 502)
  }

  const contentLength = Number(response.headers.get("content-length") || 0)
  if (contentLength > MAX_RESULT_BYTES) {
    throw new PreparationRouteError("A imagem gerada excede o limite de armazenamento.", 502)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_RESULT_BYTES) {
    throw new PreparationRouteError("A imagem gerada excede o limite de armazenamento.", 502)
  }

  return { buffer, mimeType }
}

async function recordPreparationTelemetry(input: {
  user: AuthenticatedUser
  status: "completed" | "failed"
  durationMs: number
  errorCode?: string
  sourceType?: string
  roomType?: string
  style?: string
  creativity?: string
  storageBytes?: number
}) {
  await recordAiOperationTelemetry({
    operationKey: "studio.property_preparation.furnish",
    module: "Studio IA",
    feature: "Preparar imóvel",
    capability: "Mobiliar ambiente",
    handler: "POST",
    route: "/api/studio-ia/prepare-property",
    provider: "pedra",
    model: "furnish",
    status: input.status,
    errorCode: input.errorCode ?? null,
    source: "portal",
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
      sourceType: input.sourceType ?? null,
      roomType: input.roomType ?? null,
      style: input.style ?? null,
      creativity: input.creativity ?? null,
      emeCreditsCharged: false,
    },
  })
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  let persistedSourceUrl: string | null = null
  let persistedResultUrl: string | null = null
  let telemetryContext: {
    sourceType?: string
    roomType?: string
    style?: string
    creativity?: string
  } = {}

  try {
    ensurePedraConfigured()

    const formData = await request.formData()
    const sourceType = formData.get("sourceType")
    if (sourceType !== "property" && sourceType !== "upload") {
      throw new PreparationRouteError("Selecione uma fotografia do imóvel ou envie uma imagem.", 400)
    }

    const configuration = furnishRoomRequestSchema.parse({
      roomType: formData.get("roomType"),
      style: formData.get("style"),
      creativity: formData.get("creativity"),
    })
    telemetryContext = { sourceType, ...configuration }

    let property: Awaited<ReturnType<typeof resolveAccessibleProperty>> | null = null
    let sourceImageUrl = ""

    if (sourceType === "property") {
      const propertyId = String(formData.get("propertyId") ?? "").trim()
      const requestedImageUrl = String(formData.get("imageUrl") ?? "").trim()
      if (!propertyId || !requestedImageUrl) {
        throw new PreparationRouteError("Selecione um imóvel e uma fotografia cadastrada.", 400)
      }

      property = await resolveAccessibleProperty(propertyId, user)
      if (!getPropertyImages(property).includes(requestedImageUrl)) {
        throw new PreparationRouteError("A fotografia selecionada não pertence a este imóvel.", 400)
      }
      sourceImageUrl = requireHttpsUrl(requestedImageUrl, "A fotografia selecionada precisa possuir uma URL HTTPS válida.")
    } else {
      const image = formData.get("image")
      if (!(image instanceof File) || image.size === 0) {
        throw new PreparationRouteError("Envie uma imagem para mobiliar o ambiente.", 400)
      }
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        throw new PreparationRouteError("Use uma imagem JPG, PNG ou WEBP.", 400)
      }
      if (image.size > MAX_UPLOAD_BYTES) {
        throw new PreparationRouteError("A imagem deve ter no máximo 15 MB.", 400)
      }

      persistedSourceUrl = await saveStudioPropertyPreparationReferenceImage(randomUUID(), image)
      sourceImageUrl = requireHttpsUrl(persistedSourceUrl, "Não foi possível disponibilizar a imagem enviada para processamento.")
    }

    const generated = await furnishRoom({ ...configuration, imageUrl: sourceImageUrl })
    const downloaded = await downloadGeneratedImage(generated.imageUrl)
    const storageReference = property?.id ?? randomUUID()
    persistedResultUrl = await savePropertyGeneratedImage(storageReference, downloaded.buffer, downloaded.mimeType)

    const campaign = await createStudioCampaign(user, {
      kind: "PROPERTY_PREPARATION",
      status: "PENDING_REVIEW",
      goal: "Mobiliar ambiente",
      visualIdentity: configuration.style,
      version: 1,
      provider: "EME",
      model: "Preparação visual",
      prompt: `Mobiliar ${configuration.roomType} em estilo ${configuration.style}`,
      sourceRoute: "/api/studio-ia/prepare-property",
      propertyId: property?.id ?? null,
      metadata: {
        origin: sourceType === "property" ? "property_photo" : "direct_upload",
        sourceImageUrl,
        transformation: "furnish",
        roomType: configuration.roomType,
        style: configuration.style,
        creativity: configuration.creativity,
      },
      assets: [
        {
          assetKey: "furnished_room",
          label: "Ambiente mobiliado",
          type: "IMAGE",
          provider: "EME",
          model: "Preparação visual",
          fileUrl: persistedResultUrl,
          thumbnailUrl: persistedResultUrl,
          status: "PENDING_REVIEW",
          content: {
            transformation: "furnish",
            roomType: configuration.roomType,
            style: configuration.style,
          },
          metadata: {
            origin: sourceType === "property" ? "property_photo" : "direct_upload",
            sourceImageUrl,
            creativity: configuration.creativity,
          },
        },
      ],
    })

    await recordPreparationTelemetry({
      user,
      status: "completed",
      durationMs: Date.now() - startedAt,
      storageBytes: downloaded.buffer.byteLength,
      ...telemetryContext,
    })

    const response = NextResponse.json({ campaign }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    if (persistedResultUrl) await deletePropertyStorageFile(persistedResultUrl)
    if (persistedSourceUrl) await deletePropertyStorageFile(persistedSourceUrl)

    const errorCode = caughtError instanceof PedraApiError ? caughtError.code : caughtError instanceof Error ? caughtError.name : "UNKNOWN"
    await recordPreparationTelemetry({
      user,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorCode,
      ...telemetryContext,
    })

    console.error("[api][studio-ia][prepare-property] generation failed", { errorCode })

    if (caughtError instanceof PedraApiError || caughtError instanceof PreparationRouteError) {
      return NextResponse.json({ error: caughtError.message, code: errorCode }, { status: caughtError.status })
    }

    if (caughtError instanceof ZodError) {
      return NextResponse.json({ error: "Selecione um ambiente, estilo e composição válidos." }, { status: 400 })
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Studio IA / preparação de imóvel")
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível preparar a imagem agora." }, { status: 500 })
  }
}
