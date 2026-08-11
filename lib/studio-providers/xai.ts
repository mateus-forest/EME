import "server-only"

import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { getAiOperationCatalogEntry } from "@/lib/ai-operation-catalog"
import { getAiOperationContext } from "@/lib/ai-operation-context"
import { recordAiOperationTelemetry } from "@/lib/ai-operation-telemetry"
import { USD_TO_BRL_RATE } from "@/lib/ai-cost-engine"
import { getXAIEnv } from "@/lib/env.server"
import type {
  StudioImageEditProviderInput,
  StudioImageProviderInput,
  StudioImageProviderOutput,
  StudioProviderResult,
  StudioVideoProviderInput,
  StudioVideoProviderJob,
  StudioVideoProviderStatus,
} from "@/lib/studio-providers/types"

const XAI_BASE_URL = "https://api.x.ai/v1"

export const XAI_MODELS = {
  structuredText: "grok-4.5",
  image: "grok-imagine-image-quality",
  video: "grok-imagine-video-1.5",
} as const

const xaiUsageSchema = z.object({
  cost_in_usd_ticks: z.number().nonnegative().optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  total_tokens: z.number().int().nonnegative().optional(),
}).passthrough()

const xaiImageResponseSchema = z.object({
  data: z.array(z.object({
    url: z.string().url(),
    mime_type: z.string().optional(),
    revised_prompt: z.string().optional(),
  })).min(1),
  usage: xaiUsageSchema.optional(),
})

const xaiVideoStartSchema = z.object({
  request_id: z.string().min(1),
})

const xaiVideoStatusSchema = z.object({
  status: z.enum(["pending", "done", "expired", "failed"]),
  progress: z.number().min(0).max(100).optional(),
  model: z.string().optional(),
  video: z.object({
    url: z.string().url(),
    duration: z.number().nonnegative().optional(),
  }).optional(),
  usage: xaiUsageSchema.optional(),
})

let xaiClient: OpenAI | null = null

export class XAIProviderError extends Error {
  code: "XAI_NOT_CONFIGURED" | "XAI_PROVIDER_ERROR" | "XAI_INVALID_RESPONSE"
  status: number

  constructor(
    code: XAIProviderError["code"],
    message: string,
    status = 500,
  ) {
    super(message)
    this.name = "XAIProviderError"
    this.code = code
    this.status = status
  }
}

function getXAIClient() {
  const { apiKey } = getXAIEnv()
  if (!apiKey) {
    throw new XAIProviderError("XAI_NOT_CONFIGURED", "A geração com Grok não está configurada.", 503)
  }

  xaiClient ??= new OpenAI({ apiKey, baseURL: XAI_BASE_URL })
  return xaiClient
}

function costFromUsage(usage?: z.infer<typeof xaiUsageSchema>) {
  return typeof usage?.cost_in_usd_ticks === "number"
    ? usage.cost_in_usd_ticks / 10_000_000_000
    : null
}

function usageFromUnknown(response: unknown) {
  const parsed = xaiUsageSchema.safeParse((response as { usage?: unknown }).usage)
  return parsed.success ? parsed.data : undefined
}

async function recordXaiTextTelemetry(input: {
  operationKey: string
  model: string
  response?: unknown
  durationMs: number
  status: "completed" | "failed" | "incomplete"
  errorCode?: string
  metadata?: Record<string, unknown>
}) {
  const entry = getAiOperationCatalogEntry(input.operationKey)
  const context = getAiOperationContext()
  const usage = input.response ? usageFromUnknown(input.response) : undefined
  const costUsd = costFromUsage(usage)

  await recordAiOperationTelemetry({
    operationKey: input.operationKey,
    module: entry?.module ?? "Studio IA",
    feature: entry?.feature ?? "Grok structured content",
    capability: context?.capability ?? entry?.capability ?? "campaign.structured_content",
    handler: entry?.handler,
    route: context?.route ?? entry?.route,
    provider: "xai",
    model: input.model,
    status: input.status,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorCode ? "Falha na operação xAI" : null,
    source: context?.source ?? null,
    workflowId: context?.workflowId ?? null,
    conversationId: context?.conversationId ?? null,
    userId: context?.userId ?? null,
    brokerId: context?.brokerId ?? null,
    agencyId: context?.agencyId ?? null,
    planKey: context?.planKey ?? null,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    durationMs: input.durationMs,
    costUsd,
    costBrl: costUsd == null ? null : Number((costUsd * USD_TO_BRL_RATE).toFixed(6)),
    creditsConsumed: context?.creditsConsumed ?? null,
    metadata: {
      ...context?.metadata,
      ...input.metadata,
      pricingSource: costUsd == null ? "unavailable" : "provider_reported",
    },
  })
}

export async function createXaiStructuredOutput<T>(input: {
  schema: z.ZodType<T>
  schemaName: string
  instructions: string
  prompt: string
  operationKey: string
  maxOutputTokens?: number
  metadata?: Record<string, unknown>
}): Promise<StudioProviderResult<T>> {
  const startedAt = Date.now()
  const model = XAI_MODELS.structuredText
  let telemetryRecorded = false

  try {
    const response = await getXAIClient().responses.create({
      model,
      instructions: input.instructions,
      input: input.prompt,
      max_output_tokens: input.maxOutputTokens ?? 2200,
      text: {
        format: zodTextFormat(input.schema, input.schemaName),
      },
    })

    if (response.status === "incomplete") {
      await recordXaiTextTelemetry({
        operationKey: input.operationKey,
        model,
        response,
        durationMs: Date.now() - startedAt,
        status: "incomplete",
        errorCode: "XAI_INCOMPLETE_RESPONSE",
        metadata: input.metadata,
      })
      telemetryRecorded = true
      throw new XAIProviderError("XAI_INVALID_RESPONSE", "A resposta do Grok ficou incompleta.", 502)
    }

    let raw: unknown
    try {
      raw = JSON.parse(response.output_text)
    } catch {
      throw new XAIProviderError("XAI_INVALID_RESPONSE", "O Grok retornou conteúdo inválido.", 502)
    }

    const parsed = input.schema.safeParse(raw)
    if (!parsed.success) {
      throw new XAIProviderError("XAI_INVALID_RESPONSE", "O Grok retornou conteúdo fora do contrato.", 502)
    }

    const durationMs = Date.now() - startedAt
    const usage = usageFromUnknown(response)
    const costUsd = costFromUsage(usage)
    await recordXaiTextTelemetry({
      operationKey: input.operationKey,
      model,
      response,
      durationMs,
      status: "completed",
      metadata: input.metadata,
    })
    telemetryRecorded = true

    return {
      provider: "xai",
      model,
      capability: "campaign.structured_content",
      status: "completed",
      data: parsed.data,
      durationMs,
      externalRequestId: response.id,
      costUsd,
      costSource: costUsd == null ? "unavailable" : "provider_reported",
    }
  } catch (caughtError) {
    if (!telemetryRecorded) {
      await recordXaiTextTelemetry({
        operationKey: input.operationKey,
        model,
        durationMs: Date.now() - startedAt,
        status: "failed",
        errorCode: caughtError instanceof XAIProviderError ? caughtError.code : "XAI_PROVIDER_ERROR",
        metadata: input.metadata,
      })
    }

    if (caughtError instanceof XAIProviderError) throw caughtError
    throw new XAIProviderError("XAI_PROVIDER_ERROR", "Não foi possível concluir a geração com Grok.", 502)
  }
}

async function xaiFetch(path: string, init?: RequestInit) {
  const { apiKey } = getXAIEnv()
  if (!apiKey) {
    throw new XAIProviderError("XAI_NOT_CONFIGURED", "A geração com Grok não está configurada.", 503)
  }

  let response: Response
  try {
    response = await fetch(`${XAI_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(120_000),
      cache: "no-store",
    })
  } catch {
    throw new XAIProviderError("XAI_PROVIDER_ERROR", "Não foi possível acessar o serviço de geração.", 502)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new XAIProviderError("XAI_PROVIDER_ERROR", "O serviço de geração recusou a solicitação.", 502)
  }
  return payload
}

async function runXaiImage(
  path: "/images/generations" | "/images/edits",
  input: StudioImageProviderInput,
): Promise<StudioProviderResult<StudioImageProviderOutput>> {
  const startedAt = Date.now()
  const isEdit = path === "/images/edits"
  const payload = await xaiFetch(path, {
    method: "POST",
    body: JSON.stringify({
      model: XAI_MODELS.image,
      prompt: input.prompt,
      ...(isEdit && input.imageUrl ? { image: { url: input.imageUrl, type: "image_url" } } : {}),
      ...(!isEdit && input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
      ...(!isEdit && input.resolution ? { resolution: input.resolution } : {}),
    }),
  })
  const parsed = xaiImageResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new XAIProviderError("XAI_INVALID_RESPONSE", "O serviço retornou uma imagem inválida.", 502)
  }

  const image = parsed.data.data[0]
  const costUsd = costFromUsage(parsed.data.usage)
  return {
    provider: "xai",
    model: XAI_MODELS.image,
    capability: isEdit ? "image.edit" : "image.generate",
    status: "completed",
    data: {
      url: image.url,
      mimeType: image.mime_type ?? null,
      revisedPrompt: image.revised_prompt ?? null,
    },
    durationMs: Date.now() - startedAt,
    costUsd,
    costSource: costUsd == null ? "unavailable" : "provider_reported",
  }
}

export function generateXaiImage(input: StudioImageProviderInput) {
  return runXaiImage("/images/generations", { ...input, imageUrl: undefined })
}

export function editXaiImage(input: StudioImageEditProviderInput) {
  return runXaiImage("/images/edits", input)
}

export async function startXaiVideoGeneration(
  input: StudioVideoProviderInput,
): Promise<StudioProviderResult<StudioVideoProviderJob>> {
  const startedAt = Date.now()
  const payload = await xaiFetch("/videos/generations", {
    method: "POST",
    body: JSON.stringify({
      model: XAI_MODELS.video,
      prompt: input.prompt,
      ...(input.imageUrl ? { image: { url: input.imageUrl } } : {}),
      ...(input.duration ? { duration: input.duration } : {}),
      ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
      ...(input.resolution ? { resolution: input.resolution } : {}),
    }),
  })
  const parsed = xaiVideoStartSchema.safeParse(payload)
  if (!parsed.success) {
    throw new XAIProviderError("XAI_INVALID_RESPONSE", "O serviço não retornou um job de vídeo válido.", 502)
  }

  return {
    provider: "xai",
    model: XAI_MODELS.video,
    capability: "video.image_to_video",
    status: "completed",
    data: { requestId: parsed.data.request_id },
    durationMs: Date.now() - startedAt,
    externalRequestId: parsed.data.request_id,
    costUsd: null,
    costSource: "unavailable",
  }
}

export async function getXaiVideoGeneration(
  requestId: string,
): Promise<StudioProviderResult<StudioVideoProviderStatus>> {
  const startedAt = Date.now()
  const payload = await xaiFetch(`/videos/${encodeURIComponent(requestId)}`)
  const parsed = xaiVideoStatusSchema.safeParse(payload)
  if (!parsed.success) {
    throw new XAIProviderError("XAI_INVALID_RESPONSE", "O serviço retornou um status de vídeo inválido.", 502)
  }

  const costUsd = costFromUsage(parsed.data.usage)
  return {
    provider: "xai",
    model: parsed.data.model ?? XAI_MODELS.video,
    capability: "video.image_to_video",
    status: "completed",
    data: {
      status: parsed.data.status,
      progress: parsed.data.progress ?? null,
      videoUrl: parsed.data.video?.url ?? null,
      duration: parsed.data.video?.duration ?? null,
      model: parsed.data.model ?? null,
    },
    durationMs: Date.now() - startedAt,
    externalRequestId: requestId,
    costUsd,
    costSource: costUsd == null ? "unavailable" : "provider_reported",
  }
}
