import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, hasBrokerAiCredits, refundBrokerAiCredits } from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"
import {
  createStudioCampaign,
  updateStudioCampaignAssetStatus,
  updateStudioCampaignById,
  upsertStudioCampaignAssetByKey,
} from "@/lib/studio-campaigns"
import {
  approveStudioVideoPreview,
  buildStudioVideoRequestSignature,
  createApprovedStudioVideoAnimation,
  createInitialStudioVideoJob,
  getStudioVideoEstimatedCredits,
  getStudioVideoProviderConfig,
  getStudioVideoResult,
  getStudioVideoStageCostSummary,
  parseStudioVideoJobContent,
  refreshStudioVideoJob,
  regenerateStudioVideoPreview,
  requiresTransformationPreview,
  studioVideoActionType,
  studioVideoDefaultDuration,
  studioVideoFinalActionType,
  studioVideoInvalidDurationMessage,
  studioVideoPreviewActionType,
  studioVideoPreviewRegenerationActionType,
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

type PostAction = "create" | "regenerate-preview" | "create-video"

async function resolveAccessibleProperty(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  })

  if (!property) {
    return NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 })
  }

  if (!user.broker || property.brokerId !== user.broker.id) {
    return NextResponse.json({ error: "Acesso nao permitido a este imovel." }, { status: 403 })
  }

  return property
}

function mapPropertyContext(property: Awaited<ReturnType<typeof resolveAccessibleProperty>> extends NextResponse ? never : Exclude<Awaited<ReturnType<typeof resolveAccessibleProperty>>, NextResponse>) {
  return {
    id: property.id,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood ?? "",
    location: [property.neighborhood, property.city].filter(Boolean).join(", "),
    type: property.type,
    purpose: property.purpose,
    price: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(property.price / 100),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parkingSpots: property.parkingSpots,
    description: property.description ?? "",
  }
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
    (caughtError instanceof Error &&
      (caughtError.message === "STUDIO_VIDEO_DURATION_NOT_SUPPORTED" ||
        caughtError.message === "LUMA_DURATION_NOT_SUPPORTED" ||
        caughtError.message.includes(studioVideoInvalidDurationMessage)))
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
    return NextResponse.json({ error: "Solicitacao de video nao encontrada." }, { status: 404 })
  }

  return document
}

function isSimultaneousJob(job: ReturnType<typeof parseStudioVideoJobContent>) {
  return (
    job.generationStatus !== "failed" &&
    (job.jobStage === "queued" ||
      job.jobStage === "preview_processing" ||
      job.jobStage === "video_processing")
  )
}

async function findExistingJobBySignature(brokerId: string, requestSignature: string) {
  const documents = await prisma.brokerDocument.findMany({
    where: {
      brokerId,
      type: "studio_ia_video_job",
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  })

  for (const document of documents) {
    try {
      const job = parseStudioVideoJobContent(document.content)
      if (job.requestSignature === requestSignature && isSimultaneousJob(job)) {
        return { document, job }
      }
    } catch {
      continue
    }
  }

  return null
}

function buildConcurrentJobPayload() {
  return {
    error:
      "Ja existe uma geracao deste video em andamento. Aguarde a etapa atual terminar antes de iniciar outra.",
    technicalLimitReached: true,
  }
}

async function chargeStageCredits({
  brokerId,
  requestId,
  job,
}: {
  brokerId: string
  requestId: string
  job: ReturnType<typeof parseStudioVideoJobContent>
}): Promise<ReturnType<typeof parseStudioVideoJobContent>> {
  const summary = getStudioVideoStageCostSummary(job)
  if (summary.stageEstimatedCredits <= 0 || job.stageCreditsCharged >= summary.stageEstimatedCredits) {
    return job
  }

  await consumeBrokerAiCredits({
    brokerId,
    amount: summary.stageEstimatedCredits,
    actionType: summary.actionType,
    description: summary.description,
    metadata: {
      requestId,
      requestKind: job.requestKind,
      activeStage: job.activeStage,
      provider: job.provider,
      providerImageId: job.providerImageId ?? null,
      providerVideoId: job.providerVideoId ?? null,
      providerModel: job.providerModel ?? null,
      previewModel: job.previewModel ?? null,
      format: job.format,
      duration: job.duration,
      objective: job.objective,
      style: job.style,
      transformation: job.transformation,
      stageEstimatedCredits: summary.stageEstimatedCredits,
      totalEstimatedCredits: job.estimatedCredits,
      providerEstimatedCostUsd: job.metrics.estimatedProviderCostUsd ?? null,
      providerActualCostUsd: job.metrics.actualProviderCostUsd ?? null,
      retryCount: job.metrics.retryCount,
    },
  })

  return {
    ...job,
    creditsCharged: true,
    creditsRefunded: false,
    stageCreditsCharged: summary.stageEstimatedCredits,
    stageCreditsRefunded: 0,
    metrics: {
      ...job.metrics,
      totalCreditsConsumed: job.metrics.totalCreditsConsumed + summary.stageEstimatedCredits,
    },
  }
}

async function refundStageCredits({
  brokerId,
  requestId,
  job,
}: {
  brokerId: string
  requestId: string
  job: ReturnType<typeof parseStudioVideoJobContent>
}): Promise<ReturnType<typeof parseStudioVideoJobContent>> {
  const refundableCredits = Math.max(0, job.stageCreditsCharged - job.stageCreditsRefunded)
  if (refundableCredits <= 0) {
    return job
  }

  const summary = getStudioVideoStageCostSummary(job)
  await refundBrokerAiCredits({
    brokerId,
    amount: refundableCredits,
    actionType: summary.actionType,
    description: `Estorno de ${summary.description.toLowerCase()} com falha`,
    metadata: {
      requestId,
      requestKind: job.requestKind,
      activeStage: job.activeStage,
      providerImageId: job.providerImageId ?? null,
      providerVideoId: job.providerVideoId ?? null,
      retryCount: job.metrics.retryCount,
    },
  })

  return {
    ...job,
    creditsRefunded: true,
    stageCreditsRefunded: refundableCredits,
    metrics: {
      ...job.metrics,
      totalCreditsRefunded: job.metrics.totalCreditsRefunded + refundableCredits,
    },
  }
}

async function updateJobDocument(documentId: string, job: ReturnType<typeof parseStudioVideoJobContent>) {
  await prisma.brokerDocument.update({
    where: { id: documentId },
    data: {
      content: stringifyStudioVideoJobContent(job),
      status:
        job.jobStage === "completed"
          ? "generated"
          : job.jobStage === "failed"
            ? "archived"
            : "draft",
    },
  })
}

function getStudioCampaignUser(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  return {
    id: user.id,
    role: user.role,
    broker: user.broker ? { id: user.broker.id } : null,
    ownedAgency: user.ownedAgency ? { id: user.ownedAgency.id } : null,
  }
}

async function syncStudioVideoCampaign(input: {
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>
  requestId: string
  job: ReturnType<typeof parseStudioVideoJobContent>
}) {
  const { user, requestId, job } = input
  if (!job.campaignId) return

  const metadata = {
    requestId,
    requestKind: job.requestKind,
    activeStage: job.activeStage,
    jobStage: job.jobStage,
    generationStatus: job.generationStatus,
    format: job.format,
    duration: job.duration,
    objective: job.objective,
    style: job.style,
    transformation: job.transformation,
    rhythm: job.rhythm,
    cameraMovement: job.cameraMovement,
    technicalLimitReached: job.technicalLimitReached,
    savedDocumentId: job.savedDocumentId ?? null,
    sourceReferenceUrl: job.sourceReferenceUrl ?? null,
    providerImageId: job.providerImageId ?? null,
    providerVideoId: job.providerVideoId ?? null,
    previewApproved: job.previewApproved,
    previewApprovedAt: job.previewApprovedAt ?? null,
    progress: job.progress,
  }

  const baseStatus =
    job.jobStage === "failed"
      ? "FAILED"
      : job.jobStage === "completed"
        ? "PENDING_REVIEW"
        : job.jobStage === "preview_ready" || job.jobStage === "preview_approved"
          ? "PENDING_REVIEW"
          : "PROCESSING"

  await updateStudioCampaignById({
    campaignId: job.campaignId,
    status: baseStatus,
    provider: job.provider,
    model: job.providerModel ?? job.previewModel ?? null,
    prompt: job.prompt,
    promptRevised: job.previewPrompt ?? null,
    metadata,
  })

  if (job.requestKind === "transformation_pipeline" && job.previewImageUrl) {
    await upsertStudioCampaignAssetByKey({
      campaignId: job.campaignId,
      asset: {
        assetKey: "preview_image",
        label: "Previa de transformacao",
        type: "IMAGE",
        prompt: job.previewPrompt ?? job.prompt,
        promptRevised: job.previewPrompt ?? null,
        provider: job.provider,
        model: job.previewModel ?? null,
        fileUrl: job.previewImageUrl,
        thumbnailUrl: job.previewImageUrl,
        status:
          job.jobStage === "failed"
            ? "FAILED"
            : job.previewApproved
              ? "APPROVED"
              : "PENDING_REVIEW",
        approvedAt: job.previewApprovedAt ?? null,
        metadata,
      },
      campaignStatus:
        job.jobStage === "failed"
          ? "FAILED"
          : job.previewApproved
            ? job.videoUrl
              ? "PENDING_REVIEW"
              : "PROCESSING"
            : "PENDING_REVIEW",
    })
  }

  if (job.videoUrl) {
    await upsertStudioCampaignAssetByKey({
      campaignId: job.campaignId,
      asset: {
        assetKey: "video_final",
        label: "Video final",
        type: "VIDEO",
        prompt: job.prompt,
        promptRevised: job.previewPrompt ?? null,
        provider: job.provider,
        model: job.providerModel ?? null,
        fileUrl: job.videoUrl,
        thumbnailUrl: job.previewImageUrl ?? null,
        status: job.jobStage === "failed" ? "FAILED" : "PENDING_REVIEW",
        metadata,
      },
      campaignStatus: job.jobStage === "failed" ? "FAILED" : "PENDING_REVIEW",
    })
  }

  if (job.jobStage === "failed" && !job.previewImageUrl && !job.videoUrl) {
    await upsertStudioCampaignAssetByKey({
      campaignId: job.campaignId,
      asset: {
        assetKey: "video_request",
        label: "Solicitacao de video",
        type: "VIDEO",
        prompt: job.prompt,
        promptRevised: job.previewPrompt ?? null,
        provider: job.provider,
        model: job.providerModel ?? job.previewModel ?? null,
        status: "FAILED",
        metadata,
      },
      campaignStatus: "FAILED",
    })
  }
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
    if (jobDocument instanceof NextResponse) return jobDocument

    const currentJob = parseStudioVideoJobContent(jobDocument.content)
    const refreshedJob = await runWithAiOperationContext(
      {
        route: "/api/studio-ia/video",
        source: "portal",
        userId: user.id,
        brokerId: user.broker.id,
        planKey: user.plan ?? null,
        conversationId: requestId,
      },
      () => refreshStudioVideoJob(currentJob),
    )
    const finalJob: ReturnType<typeof parseStudioVideoJobContent> =
      refreshedJob.jobStage === "failed"
        ? await refundStageCredits({
            brokerId: user.broker.id,
            requestId,
            job: refreshedJob,
          })
        : refreshedJob

    await updateJobDocument(jobDocument.id, finalJob)
    await syncStudioVideoCampaign({
      user,
      requestId,
      job: finalJob,
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
    const contentType = request.headers.get("content-type") || ""
    const requestBody = contentType.includes("multipart/form-data")
      ? null
      : ((await request.json().catch(() => null)) as { action?: PostAction; requestId?: string } | null)
    const action: PostAction = contentType.includes("multipart/form-data")
      ? "create"
      : (requestBody?.action ?? "create")

    if (action === "create") {
      const { payload, uploadedFiles } = await parseVideoRequestForm(request)
      const accessible = payload.propertyId ? await resolveAccessibleProperty(payload.propertyId, user) : null
      if (accessible instanceof NextResponse) return accessible

      const property = accessible ? mapPropertyContext(accessible) : null
      const signatureSeed = payload.referenceImageUrls[0] || payload.uploadedImages[0]?.name || payload.propertyId || "studio-video"
      const requestSignature = buildStudioVideoRequestSignature(payload, signatureSeed)
      const existingJob = await findExistingJobBySignature(user.broker.id, requestSignature)

      if (existingJob) {
        console.info("[api][studio-ia][video][post] blocked-concurrent-create", {
          brokerId: user.broker.id,
          requestSignature,
          existingRequestId: existingJob.document.id,
          existingJobStage: existingJob.job.jobStage,
          existingGenerationStatus: existingJob.job.generationStatus,
        })

        return NextResponse.json(
          {
            ...getStudioVideoResult(existingJob.document.id, existingJob.job),
            ...buildConcurrentJobPayload(),
          },
          { status: 409 },
        )
      }

      const firstStageCredits = getStudioVideoEstimatedCredits({
        duration: payload.duration,
        objective: payload.objective,
        transformation: payload.transformation,
        stage: requiresTransformationPreview(payload.transformation) ? "preview" : "direct",
      })

      const credits = await hasBrokerAiCredits(user.broker.id, firstStageCredits)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }

      const created = await runWithAiOperationContext(
        {
          route: "/api/studio-ia/video",
          source: "portal",
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          creditsConsumed: firstStageCredits,
        },
        () =>
          createInitialStudioVideoJob({
            input: payload,
            property,
            referenceInput:
              uploadedFiles[0]
                ? { kind: "file", file: uploadedFiles[0] }
                : { kind: "url", url: payload.referenceImageUrls[0]! },
          }),
      )

      const campaign = await createStudioCampaign(getStudioCampaignUser(user), {
        kind: "VIDEO",
        status: "PROCESSING",
        goal: payload.objective,
        visualIdentity: payload.style,
        version: payload.version,
        provider: created.jobContent.provider,
        model: created.jobContent.providerModel ?? created.jobContent.previewModel ?? null,
        prompt: created.jobContent.prompt,
        promptRevised: created.jobContent.previewPrompt ?? null,
        sourceRoute: "/api/studio-ia/video",
        propertyId: payload.propertyId ?? null,
        metadata: {
          requestKind: created.jobContent.requestKind,
          format: payload.format,
          duration: payload.duration,
          objective: payload.objective,
          style: payload.style,
          transformation: payload.transformation,
          rhythm: payload.rhythm,
          cameraMovement: payload.cameraMovement,
          referenceImageUrls: created.jobContent.referenceImageUrls,
          uploadedImages: payload.uploadedImages,
        },
        assets: [
          {
            assetKey: "video_request",
            label: "Solicitacao de video",
            type: "VIDEO",
            prompt: created.jobContent.prompt,
            promptRevised: created.jobContent.previewPrompt ?? null,
            provider: created.jobContent.provider,
            model: created.jobContent.providerModel ?? created.jobContent.previewModel ?? null,
            status: "DRAFT",
            metadata: {
              requestKind: created.jobContent.requestKind,
              format: payload.format,
              duration: payload.duration,
            },
          },
        ],
      })

      const jobWithCampaign = {
        ...created.jobContent,
        campaignId: campaign.id,
      } satisfies ReturnType<typeof parseStudioVideoJobContent>

      const document = await prisma.brokerDocument.create({
        data: {
          brokerId: user.broker.id,
          propertyId: payload.propertyId ?? null,
          type: "studio_ia_video_job",
          title: buildVideoTitle(property?.title),
          content: stringifyStudioVideoJobContent(jobWithCampaign),
          status: "draft",
        },
      })

      const chargedJob = await chargeStageCredits({
        brokerId: user.broker.id,
        requestId: document.id,
        job: jobWithCampaign,
      })

      await updateJobDocument(document.id, chargedJob)
      await syncStudioVideoCampaign({
        user,
        requestId: document.id,
        job: chargedJob,
      })

      const response = NextResponse.json(getStudioVideoResult(document.id, chargedJob), { status: 202 })
      response.headers.set("Cache-Control", "no-store, max-age=0")
      return response
    }

    const requestId = typeof requestBody?.requestId === "string" ? requestBody.requestId.trim() : ""
    if (!requestId) {
      return NextResponse.json({ error: "Informe o requestId." }, { status: 400 })
    }

    const jobDocument = await resolveJobDocument(requestId, user.broker.id)
    if (jobDocument instanceof NextResponse) return jobDocument

    const currentJob = parseStudioVideoJobContent(jobDocument.content)

    if (action === "regenerate-preview") {
      if (currentJob.requestKind !== "transformation_pipeline") {
        return NextResponse.json({ error: "Este fluxo nao utiliza previa mobiliada." }, { status: 409 })
      }

      if (currentJob.jobStage === "preview_processing") {
        console.info("[api][studio-ia][video][post] blocked-concurrent-preview-regeneration", {
          brokerId: user.broker.id,
          requestId,
          jobStage: currentJob.jobStage,
          generationStatus: currentJob.generationStatus,
        })

        return NextResponse.json(
          {
            ...getStudioVideoResult(requestId, currentJob),
            ...buildConcurrentJobPayload(),
          },
          { status: 409 },
        )
      }

      const stageCredits = getStudioVideoEstimatedCredits({
        duration: currentJob.duration,
        objective: currentJob.objective,
        transformation: currentJob.transformation,
        stage: "preview_regeneration",
      })
      const credits = await hasBrokerAiCredits(user.broker.id, stageCredits)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }

      const regeneratedJob = await runWithAiOperationContext(
        {
          route: "/api/studio-ia/video",
          source: "portal",
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          conversationId: requestId,
          creditsConsumed: stageCredits,
        },
        () => regenerateStudioVideoPreview(currentJob),
      )
      await updateJobDocument(jobDocument.id, regeneratedJob)

      const chargedJob = await chargeStageCredits({
        brokerId: user.broker.id,
        requestId,
        job: regeneratedJob,
      })

      await updateJobDocument(jobDocument.id, chargedJob)
      await syncStudioVideoCampaign({
        user,
        requestId,
        job: chargedJob,
      })

      return NextResponse.json(getStudioVideoResult(requestId, chargedJob), { status: 202 })
    }

    if (action === "create-video") {
      if (currentJob.requestKind !== "transformation_pipeline") {
        return NextResponse.json({ error: "Este fluxo nao exige aprovacao de previa." }, { status: 409 })
      }

      if (currentJob.jobStage === "video_processing" || currentJob.jobStage === "completed") {
        if (currentJob.jobStage === "video_processing") {
          console.info("[api][studio-ia][video][post] blocked-concurrent-video-create", {
            brokerId: user.broker.id,
            requestId,
            jobStage: currentJob.jobStage,
            generationStatus: currentJob.generationStatus,
          })

          return NextResponse.json(
            {
              ...getStudioVideoResult(requestId, currentJob),
              ...buildConcurrentJobPayload(),
            },
            { status: 409 },
          )
        }

        return NextResponse.json(getStudioVideoResult(requestId, currentJob), { status: 202 })
      }

      if (!currentJob.previewApproved) {
        return NextResponse.json({ error: "Aprove a previa mobiliada antes de criar o video." }, { status: 409 })
      }

      const stageCredits = getStudioVideoEstimatedCredits({
        duration: currentJob.duration,
        objective: currentJob.objective,
        transformation: currentJob.transformation,
        stage: "video",
        model: getStudioVideoProviderConfig().model,
      })
      const credits = await hasBrokerAiCredits(user.broker.id, stageCredits)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }

      const nextJob = await runWithAiOperationContext(
        {
          route: "/api/studio-ia/video",
          source: "portal",
          userId: user.id,
          brokerId: user.broker.id,
          planKey: user.plan ?? null,
          conversationId: requestId,
          creditsConsumed: stageCredits,
        },
        () => createApprovedStudioVideoAnimation(currentJob),
      )
      await updateJobDocument(jobDocument.id, nextJob)

      const chargedJob = await chargeStageCredits({
        brokerId: user.broker.id,
        requestId,
        job: nextJob,
      })

      await updateJobDocument(jobDocument.id, chargedJob)
      await syncStudioVideoCampaign({
        user,
        requestId,
        job: chargedJob,
      })

      return NextResponse.json(getStudioVideoResult(requestId, chargedJob), { status: 202 })
    }

    return NextResponse.json({ error: "Acao nao suportada para este fluxo." }, { status: 400 })
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
          estimatedCredits: getStudioVideoEstimatedCredits({
            duration: studioVideoDefaultDuration,
            objective: "Atrair interessados",
            transformation: "Nenhuma",
            stage: "direct",
          }),
          providerConfigured: false,
        },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "LUMAAI_API_KEY_INVALID") {
      return NextResponse.json(
        {
          error: "A chave LUMAAI_API_KEY foi rejeitada pela Luma AI.",
          estimatedCredits: getStudioVideoEstimatedCredits({
            duration: studioVideoDefaultDuration,
            objective: "Atrair interessados",
            transformation: "Nenhuma",
            stage: "direct",
          }),
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
    const action = typeof body?.action === "string" ? body.action.trim() : "save-video"
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : ""
    if (!requestId) {
      return NextResponse.json({ error: "Informe o requestId." }, { status: 400 })
    }

    const jobDocument = await resolveJobDocument(requestId, user.broker.id)
    if (jobDocument instanceof NextResponse) return jobDocument

    const job = parseStudioVideoJobContent(jobDocument.content)

    if (action === "approve-preview") {
      const approvedJob = approveStudioVideoPreview(job)
      await updateJobDocument(jobDocument.id, approvedJob)
      await syncStudioVideoCampaign({
        user,
        requestId,
        job: approvedJob,
      })

      if (approvedJob.campaignId && approvedJob.previewImageUrl) {
        const previewCampaign = await prisma.studioCampaign.findUnique({
          where: { id: approvedJob.campaignId },
          select: {
            assets: {
              where: { assetKey: "preview_image" },
              select: { id: true },
              take: 1,
            },
          },
        })

        const previewAssetId = previewCampaign?.assets[0]?.id
        if (previewAssetId) {
          await updateStudioCampaignAssetStatus(getStudioCampaignUser(user), previewAssetId, "APPROVED")
        }
      }

      return NextResponse.json(getStudioVideoResult(requestId, approvedJob))
    }

    if (job.generationStatus !== "completed" || !job.videoUrl || job.jobStage !== "completed") {
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
          previewImageUrl: job.previewImageUrl,
          provider: job.provider,
          providerVideoId: job.providerVideoId,
          providerImageId: job.providerImageId,
          format: job.format,
          duration: job.duration,
          promptPreview: job.prompt,
          previewPrompt: job.previewPrompt,
          style: job.style,
          objective: job.objective,
          transformation: job.transformation,
          rhythm: job.rhythm,
          cameraMovement: job.cameraMovement,
          requestKind: job.requestKind,
        }),
        status: "generated",
      },
    })

    await updateJobDocument(jobDocument.id, {
      ...job,
      savedDocumentId: savedDocument.id,
    })

    if (job.campaignId) {
      await updateStudioCampaignById({
        campaignId: job.campaignId,
        metadata: {
          requestId,
          savedDocumentId: savedDocument.id,
          requestKind: job.requestKind,
          format: job.format,
          duration: job.duration,
          objective: job.objective,
          style: job.style,
          transformation: job.transformation,
        },
      })
    }

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
