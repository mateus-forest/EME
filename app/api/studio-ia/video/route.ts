import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits, refundBrokerAiCredits } from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"
import {
  generateStudioPropertyVideo,
  getStudioVideoEstimatedCredits,
  getStudioVideoProviderConfig,
  getStudioVideoResult,
  parseStudioVideoJobContent,
  refreshStudioVideoJob,
  studioVideoActionType,
  studioVideoDefaultDuration,
  studioVideoInvalidDurationMessage,
  studioVideoRequestSchema,
  stringifyStudioVideoJobContent,
} from "@/lib/studio-ia-video"

export const dynamic = "force-dynamic"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
} as const

async function resolveAccessibleProperty(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  })

  if (!property) {
    return {
      error: NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 }),
      property: null,
    }
  }

  if (!user.broker || property.brokerId !== user.broker.id) {
    return {
      error: NextResponse.json({ error: "Acesso nao permitido a este imovel." }, { status: 403 }),
      property: null,
    }
  }

  return { error: null, property }
}

function buildVideoTitle(propertyTitle?: string | null) {
  return propertyTitle ? `Video Studio IA - ${propertyTitle}` : "Video Studio IA"
}

async function parseVideoRequestForm(request: NextRequest) {
  const formData = await request.formData()
  const rawPayload = formData.get("payload")
  const payload = studioVideoRequestSchema.parse(JSON.parse(typeof rawPayload === "string" ? rawPayload : "{}"))
  const uploadedFiles = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, 12)

  if (uploadedFiles.length !== payload.uploadedImages.length) {
    throw new Error("UPLOADS_MISMATCH")
  }

  return {
    payload,
    uploadedFiles,
  }
}

function isDurationValidationError(caughtError: unknown) {
  return (
    (caughtError instanceof z.ZodError &&
      caughtError.issues.some((issue) => issue.path.includes("duration"))) ||
    caughtError instanceof Error &&
    (caughtError.message === "STUDIO_VIDEO_DURATION_NOT_SUPPORTED" ||
      caughtError.message === "LUMA_DURATION_NOT_SUPPORTED" ||
      caughtError.message.includes(studioVideoInvalidDurationMessage))
  )
}

async function resolveJobDocument(requestId: string, brokerId: string) {
  const document = await prisma.brokerDocument.findFirst({
    where: {
      id: requestId,
      brokerId,
      type: "studio_ia_video_job",
    },
  })

  if (!document) {
    return {
      error: NextResponse.json({ error: "Solicitacao de video nao encontrada." }, { status: 404 }),
      document: null,
    }
  }

  return { error: null, document }
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER || !user.broker) {
    return NextResponse.json({ error: "Acesso nao permitido para este fluxo." }, { status: 403 })
  }

  try {
    const requestId = request.nextUrl.searchParams.get("requestId")?.trim() || ""
    if (!requestId) {
      return NextResponse.json({ error: "Informe o requestId." }, { status: 400 })
    }

    const jobDocument = await resolveJobDocument(requestId, user.broker.id)
    if (jobDocument.error || !jobDocument.document) return jobDocument.error

    const currentJob = parseStudioVideoJobContent(jobDocument.document.content)
    const refreshedJob = await refreshStudioVideoJob(currentJob)

    let finalJob = refreshedJob

    if (refreshedJob.generationStatus === "failed" && refreshedJob.creditsCharged && !refreshedJob.creditsRefunded) {
      await refundBrokerAiCredits({
        brokerId: user.broker.id,
        amount: refreshedJob.estimatedCredits,
        actionType: studioVideoActionType,
        description: "Estorno de video do Studio IA com falha",
        metadata: {
          requestId,
          providerVideoId: refreshedJob.providerVideoId,
        },
      })

      finalJob = {
        ...refreshedJob,
        creditsRefunded: true,
      }
    }

    await prisma.brokerDocument.update({
      where: { id: jobDocument.document.id },
      data: {
        content: stringifyStudioVideoJobContent(finalJob),
        status:
          finalJob.generationStatus === "completed"
            ? "generated"
            : finalJob.generationStatus === "failed"
              ? "archived"
              : "draft",
      },
    })

    const response = NextResponse.json(getStudioVideoResult(requestId, finalJob))
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][video][get] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de videos esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "LUMAAI_API_KEY_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "A chave LUMAAI_API_KEY nao esta configurada para o fluxo de video do Studio IA." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "LUMAAI_API_KEY_INVALID") {
      return NextResponse.json(
        { error: "A chave LUMAAI_API_KEY foi rejeitada pela Luma AI." },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao consultar o video." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER || !user.broker) {
    return NextResponse.json({ error: "Acesso nao permitido para este fluxo." }, { status: 403 })
  }

  try {
    const { payload, uploadedFiles } = await parseVideoRequestForm(request)
    const accessible = payload.propertyId ? await resolveAccessibleProperty(payload.propertyId, user) : null
    if (accessible?.error) return accessible.error

    const property = accessible?.property
      ? {
          id: accessible.property.id,
          title: accessible.property.title,
          city: accessible.property.city,
          neighborhood: accessible.property.neighborhood ?? "",
          location: [accessible.property.neighborhood, accessible.property.city].filter(Boolean).join(", "),
          type: accessible.property.type,
          purpose: accessible.property.purpose,
          price: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(accessible.property.price / 100),
          bedrooms: accessible.property.bedrooms,
          bathrooms: accessible.property.bathrooms,
          parkingSpots: accessible.property.parkingSpots,
          description: accessible.property.description ?? "",
        }
      : null

    const estimatedCredits = getStudioVideoEstimatedCredits(payload.duration)
    const credits = await hasBrokerAiCredits(user.broker.id, estimatedCredits)
    if (!credits.allowed) {
      return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
    }

    const generation = await generateStudioPropertyVideo({
      input: payload,
      property,
      referenceInput:
        uploadedFiles[0]
          ? { kind: "file", file: uploadedFiles[0] }
          : { kind: "url", url: payload.referenceImageUrls[0]! },
    })

    await consumeBrokerAiCredits({
      brokerId: user.broker.id,
      amount: estimatedCredits,
      actionType: studioVideoActionType,
      description: "Criar video do imovel no Studio IA",
      metadata: {
        provider: generation.jobContent.provider,
        providerVideoId: generation.providerVideoId,
        propertyId: payload.propertyId ?? null,
        format: payload.format,
        duration: payload.duration,
        style: payload.style,
      },
    })

    const document = await prisma.brokerDocument.create({
      data: {
        brokerId: user.broker.id,
        propertyId: payload.propertyId ?? null,
        type: "studio_ia_video_job",
        title: buildVideoTitle(property?.title),
        content: stringifyStudioVideoJobContent({
          ...generation.jobContent,
          creditsCharged: true,
        }),
        status: "draft",
      },
    })

    const response = NextResponse.json(getStudioVideoResult(document.id, { ...generation.jobContent, creditsCharged: true }), {
      status: 202,
    })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][video][post] generation failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de imoveis esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "VIDEO_PROVIDER_NOT_CONFIGURED") {
      const config = getStudioVideoProviderConfig()

      return NextResponse.json(
        {
          error: "A geracao de video do Studio IA requer a configuracao da LUMAAI_API_KEY neste ambiente.",
          estimatedCredits: config.estimatedCredits,
          providerConfigured: false,
        },
        { status: 503 },
      )
    }

    if (isDurationValidationError(caughtError)) {
      return NextResponse.json({ error: studioVideoInvalidDurationMessage }, { status: 400 })
    }

    if (caughtError instanceof Error && caughtError.message === "LUMAAI_API_KEY_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error: "A chave LUMAAI_API_KEY nao esta configurada para o fluxo de video do Studio IA.",
          estimatedCredits: getStudioVideoEstimatedCredits(studioVideoDefaultDuration),
          providerConfigured: false,
        },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "LUMAAI_API_KEY_INVALID") {
      return NextResponse.json(
        {
          error: "A chave LUMAAI_API_KEY foi rejeitada pela Luma AI.",
          estimatedCredits: getStudioVideoEstimatedCredits(studioVideoDefaultDuration),
          providerConfigured: true,
        },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "UPLOADS_MISMATCH") {
      return NextResponse.json({ error: "As imagens enviadas nao correspondem ao briefing informado." }, { status: 400 })
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao preparar a geracao de video." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER || !user.broker) {
    return NextResponse.json({ error: "Acesso nao permitido para este fluxo." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : ""
    if (!requestId) {
      return NextResponse.json({ error: "Informe o requestId." }, { status: 400 })
    }

    const jobDocument = await resolveJobDocument(requestId, user.broker.id)
    if (jobDocument.error || !jobDocument.document) return jobDocument.error

    const job = parseStudioVideoJobContent(jobDocument.document.content)
    if (job.generationStatus !== "completed" || !job.videoUrl) {
      return NextResponse.json({ error: "O video ainda nao foi concluido." }, { status: 409 })
    }

    if (job.savedDocumentId) {
      return NextResponse.json({ saved: true, savedDocumentId: job.savedDocumentId })
    }

    const savedDocument = await prisma.brokerDocument.create({
      data: {
        brokerId: user.broker.id,
        propertyId: job.propertyId ?? null,
        type: "studio_ia_video",
        title: buildVideoTitle(job.propertyTitle),
        content: JSON.stringify({
          videoUrl: job.videoUrl,
          provider: job.provider,
          providerVideoId: job.providerVideoId,
          format: job.format,
          duration: job.duration,
          style: job.style,
          objective: job.objective,
        }),
        status: "generated",
      },
    })

    await prisma.brokerDocument.update({
      where: { id: jobDocument.document.id },
      data: {
        content: stringifyStudioVideoJobContent({
          ...job,
          savedDocumentId: savedDocument.id,
        }),
      },
    })

    return NextResponse.json({ saved: true, savedDocumentId: savedDocument.id })
  } catch (caughtError) {
    console.error("[api][studio-ia][video][patch] save failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Servico de documentos indisponivel no momento." }, { status: 503 })
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao salvar o video." },
      { status: 500 },
    )
  }
}
