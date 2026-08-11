import { createHash } from "node:crypto"

import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"
import {
  deletePropertyStorageFile,
  savePropertyGeneratedImage,
  saveStudioPropertyPreparationReferenceImage,
} from "@/lib/property-storage"
import { createStudioCampaign, getStudioCampaignById } from "@/lib/studio-campaigns"
import { getStudioCapabilityProviders, type StudioCapabilityId } from "@/lib/studio-provider-catalog"
import { editOpenAIImage, OpenAIImageProviderError } from "@/lib/studio-providers/openai-image"
import type { StudioImageProviderOutput, StudioProviderResult } from "@/lib/studio-providers/types"
import { editXaiImage, XAIProviderError } from "@/lib/studio-providers/xai"

export const dynamic = "force-dynamic"
export const maxDuration = 90

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_RESULT_BYTES = 30 * 1024 * 1024
const LOCK_KEY = "__project_visualization_lock__"
const requestSchema = z.object({
  provider: z.enum(["openai", "xai"]),
  case: z.enum(["terrain", "construction", "design", "custom"]),
  prompt: z.string().trim().min(8).max(800),
  quantity: z.coerce.number().int().min(1).max(3).default(1),
  idempotencyKey: z.string().uuid(),
})

type User = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>

class ProjectRouteError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message)
  }
}

function json(body: unknown, status: number) {
  const response = NextResponse.json(body, { status })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function workspace(user: User) {
  if (user.role === UserRole.BROKER && user.broker?.id) return `broker:${user.broker.id}`
  if (user.role === UserRole.AGENCY && user.ownedAgency?.id) return `agency:${user.ownedAgency.id}`
  throw new ProjectRouteError("WORKSPACE_NOT_FOUND", "Não foi possível identificar o espaço de trabalho.", 403)
}

function capability(value: z.infer<typeof requestSchema>["case"]): StudioCapabilityId {
  if (value === "terrain") return "project.terrain_to_construction"
  if (value === "construction") return "project.construction_to_finished"
  return "project.design_to_realistic"
}

function title(value: z.infer<typeof requestSchema>["case"]): string {
  return {
    terrain: "Construção no terreno",
    construction: "Obra finalizada",
    design: "Projeto mais realista",
    custom: "Visualização personalizada",
  }[value]
}

function providerPrompt(input: z.infer<typeof requestSchema>) {
  return [
    "Crie uma representação arquitetônica conceitual a partir da imagem fornecida.",
    `Objetivo: ${title(input.case)}.`,
    `Orientação do usuário: ${input.prompt}`,
    "Preserve perspectiva, enquadramento e elementos do entorno sempre que forem compatíveis com o pedido.",
    "Não inclua textos, marcas, placas, pessoas identificáveis ou marca-d'água.",
    "O resultado é uma representação ilustrativa, não uma promessa técnica de execução.",
  ].join("\n")
}

async function normalizeResult(result: StudioProviderResult<StudioImageProviderOutput>) {
  if (result.data.base64) {
    const buffer = Buffer.from(result.data.base64, "base64")
    if (!buffer.length || buffer.length > MAX_RESULT_BYTES) throw new ProjectRouteError("INVALID_RESULT", "A IA retornou uma imagem inválida.", 502)
    return { buffer, mimeType: result.data.mimeType || "image/png" }
  }
  if (!result.data.url) throw new ProjectRouteError("INVALID_RESULT", "A IA não retornou uma imagem válida.", 502)
  const response = await fetch(result.data.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) }).catch(() => null)
  if (!response?.ok) throw new ProjectRouteError("RESULT_DOWNLOAD_FAILED", "Não foi possível salvar a visualização gerada.", 502)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.length || buffer.length > MAX_RESULT_BYTES) throw new ProjectRouteError("INVALID_RESULT", "A IA retornou uma imagem inválida.", 502)
  return { buffer, mimeType: response.headers.get("content-type")?.split(";")[0] || "image/png" }
}

async function runProvider(provider: "openai" | "xai", imageUrl: string, prompt: string) {
  return provider === "openai"
    ? editOpenAIImage({ imageUrl, prompt })
    : editXaiImage({ imageUrl, prompt })
}

function isUnique(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002")
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? json({ error: "Não autenticado." }, 401)
  const jobId = request.nextUrl.searchParams.get("jobId")
  if (!jobId) return json({ error: "Informe o processamento." }, 400)
  const campaign = await getStudioCampaignById(user, jobId)
  if (!campaign) return json({ error: "Processamento não encontrado." }, 404)
  if (campaign.status === "PROCESSING") return json({ jobId, status: "PROCESSING" }, 202)
  if (campaign.status === "FAILED") return json({ error: "A visualização não pôde ser concluída." }, 409)
  return json({ campaign }, 200)
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? json({ error: "Não autenticado." }, 401)
  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) return json({ error: "Acesso não permitido." }, 403)

  let campaignId: string | null = null
  let lockId: string | null = null
  let sourceUrl: string | null = null
  const resultUrls: string[] = []
  try {
    const form = await request.formData()
    const parsed = requestSchema.parse({
      provider: form.get("provider"), case: form.get("case"), prompt: form.get("prompt"),
      quantity: form.get("quantity") || 1, idempotencyKey: form.get("idempotencyKey"),
    })
    const image = form.get("image")
    if (!(image instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(image.type) || !image.size || image.size > MAX_UPLOAD_BYTES) {
      throw new ProjectRouteError("INVALID_IMAGE", "Envie uma imagem JPG, PNG ou WEBP de até 15 MB.")
    }

    const providerEntry = getStudioCapabilityProviders(capability(parsed.case), ["active", "adapter_ready"])
      .find((entry) => entry.provider === parsed.provider)
    if (!providerEntry) throw new ProjectRouteError("PROVIDER_NOT_COMPATIBLE", "A IA selecionada não é compatível com esta visualização.")

    const bytes = Buffer.from(await image.arrayBuffer())
    const signature = hash(JSON.stringify({ provider: parsed.provider, case: parsed.case, prompt: parsed.prompt, quantity: parsed.quantity, image: hash(bytes) }))
    const base = workspace(user)
    campaignId = `pvreq_${hash(`${base}:${parsed.idempotencyKey}`).slice(0, 32)}`
    lockId = `pvlock_${hash(`${base}:${signature}`).slice(0, 32)}`

    const existing = await getStudioCampaignById(user, campaignId)
    if (existing) {
      const existingSignature = (existing.metadata as { idempotency?: { signature?: string } } | null)?.idempotency?.signature
      if (existingSignature !== signature) throw new ProjectRouteError("IDEMPOTENCY_KEY_REUSED", "Esta solicitação já foi usada com outros dados.", 409)
      return existing.status === "PROCESSING" ? json({ jobId: existing.id, status: "PROCESSING", reused: true }, 202) : json({ campaign: existing, reused: true }, 200)
    }

    try {
      await createStudioCampaign(user, {
        id: campaignId, kind: "CONSTRUCTION", status: "PROCESSING", goal: title(parsed.case),
        provider: parsed.provider, model: providerEntry.model, prompt: parsed.prompt,
        sourceRoute: "/api/studio-ia/visualize-project",
        metadata: {
          category: "project_visualization", illustrative: true, projectCase: parsed.case,
          provider: parsed.provider, capability: capability(parsed.case), processingStatus: "processing",
          creditsConsumed: null, emeCreditsCharged: false,
          idempotency: { key: parsed.idempotencyKey, signature, lockId },
        },
        assets: [{ id: lockId, assetKey: LOCK_KEY, label: "Processamento", type: "IMAGE", provider: parsed.provider, model: providerEntry.model, status: "DRAFT", content: { internalType: "idempotency_lock" } }],
      })
    } catch (caughtError) {
      if (!isUnique(caughtError)) throw caughtError
      const lock = await prisma.studioCampaignAsset.findUnique({ where: { id: lockId }, select: { campaignId: true } })
      const duplicate = lock ? await getStudioCampaignById(user, lock.campaignId) : null
      if (duplicate) return duplicate.status === "PROCESSING"
        ? json({ jobId: duplicate.id, status: duplicate.status, reused: true }, 202)
        : json({ campaign: duplicate, reused: true }, 200)
      throw caughtError
    }

    sourceUrl = await saveStudioPropertyPreparationReferenceImage(campaignId, image)
    const prompt = providerPrompt(parsed)
    const generated: Array<{ result: Awaited<ReturnType<typeof runProvider>>; url: string }> = []
    for (let index = 0; index < parsed.quantity; index += 1) {
      const result = await runProvider(parsed.provider, sourceUrl, prompt)
      const normalized = await normalizeResult(result)
      const url = await savePropertyGeneratedImage(campaignId, normalized.buffer, normalized.mimeType)
      resultUrls.push(url)
      generated.push({ result, url })
    }

    const completedAt = new Date().toISOString()
    await prisma.$transaction(async (transaction) => {
      await transaction.studioCampaignAsset.deleteMany({ where: { id: lockId!, campaignId: campaignId! } })
      await transaction.studioCampaignAsset.createMany({ data: generated.map(({ result, url }, index) => ({
        campaignId: campaignId!, assetKey: `project_option_${index + 1}`, label: `Opção ${index + 1}`,
        type: "IMAGE", provider: parsed.provider, model: result.model, fileUrl: url, thumbnailUrl: url,
        status: "PENDING_REVIEW", prompt: parsed.prompt,
        content: { sourceImageUrl: sourceUrl, resultImageUrl: url, illustrative: true } as Prisma.InputJsonValue,
        metadata: {
          category: "project_visualization", illustrative: true, projectCase: parsed.case,
          sourceImageUrl: sourceUrl, resultImageUrl: url, provider: parsed.provider, model: result.model,
          capability: capability(parsed.case), durationMs: result.durationMs, externalCostUsd: result.costUsd,
          externalRequestId: result.externalRequestId, creditsConsumed: null, emeCreditsCharged: false,
        } as Prisma.InputJsonValue,
      })) })
      await transaction.studioCampaign.update({ where: { id: campaignId! }, data: {
        status: "PENDING_REVIEW", model: generated[0]?.result.model,
        metadata: {
          category: "project_visualization", illustrative: true, projectCase: parsed.case,
          sourceImageUrl: sourceUrl, resultImageUrls: resultUrls, provider: parsed.provider,
          capability: capability(parsed.case), prompt: parsed.prompt, processingStatus: "completed", completedAt,
          creditsConsumed: null, emeCreditsCharged: false, idempotency: { key: parsed.idempotencyKey, signature, lockId },
        } as Prisma.InputJsonValue,
      } })
    })

    const campaign = await getStudioCampaignById(user, campaignId)
    return json({ campaign }, 201)
  } catch (caughtError) {
    if (campaignId && lockId) {
      await prisma.$transaction([
        prisma.studioCampaignAsset.deleteMany({ where: { id: lockId, campaignId } }),
        prisma.studioCampaign.updateMany({ where: { id: campaignId, status: "PROCESSING" }, data: { status: "FAILED" } }),
      ]).catch(() => null)
    }
    for (const url of resultUrls) await deletePropertyStorageFile(url).catch(() => null)
    if (sourceUrl) await deletePropertyStorageFile(sourceUrl).catch(() => null)
    if (caughtError instanceof ProjectRouteError || caughtError instanceof OpenAIImageProviderError || caughtError instanceof XAIProviderError) {
      return json({ error: caughtError.message, code: caughtError.code }, caughtError.status)
    }
    if (caughtError instanceof z.ZodError) return json({ error: "Revise os dados da visualização." }, 400)
    return json({ error: "Não foi possível gerar a visualização agora." }, 500)
  }
}
