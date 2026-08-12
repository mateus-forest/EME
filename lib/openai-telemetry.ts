import type OpenAI from "openai"

import { getAiOperationCatalogEntry } from "@/lib/ai-operation-catalog"
import { estimateOperationCost } from "@/lib/ai-cost-engine"
import { getAiOperationContext } from "@/lib/ai-operation-context"
import { recordAiOperationTelemetry } from "@/lib/ai-operation-telemetry"

type CreateOpenAIResponseInput = {
  client: OpenAI
  operationKey: string
  request: OpenAI.Responses.ResponseCreateParamsNonStreaming
  options?: OpenAI.RequestOptions
  metadata?: Record<string, unknown>
}

function getUsageMetrics(response: unknown) {
  const usage = (response as { usage?: Record<string, unknown> }).usage
  const outputDetails = usage && typeof usage === "object" && "output_tokens_details" in usage
    ? (usage.output_tokens_details as Record<string, unknown> | undefined)
    : undefined

  return {
    inputTokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : 0,
    cachedInputTokens:
      typeof usage?.input_tokens_details === "object" &&
      usage.input_tokens_details &&
      typeof (usage.input_tokens_details as Record<string, unknown>).cached_tokens === "number"
        ? ((usage.input_tokens_details as Record<string, unknown>).cached_tokens as number)
        : 0,
    outputTokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : 0,
    reasoningTokens:
      outputDetails && typeof outputDetails.reasoning_tokens === "number"
        ? outputDetails.reasoning_tokens
        : 0,
    totalTokens: typeof usage?.total_tokens === "number" ? usage.total_tokens : 0,
  }
}

function countImagesFromRequest(request: OpenAI.Responses.ResponseCreateParamsNonStreaming) {
  const payload = JSON.stringify(request.input ?? "")
  return (payload.match(/input_image/g) ?? []).length
}

export async function createOpenAIResponse(input: CreateOpenAIResponseInput): Promise<OpenAI.Responses.Response> {
  const startedAt = Date.now()
  const entry = getAiOperationCatalogEntry(input.operationKey)
  const context = getAiOperationContext()

  try {
    const response = await input.client.responses.create(input.request, input.options)
    const usage = getUsageMetrics(response)
    const cost = estimateOperationCost({
      operationKey: input.operationKey,
      provider: "openai",
      model: typeof input.request.model === "string" ? input.request.model : entry?.model ?? "gpt-5-mini",
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      imageCount: countImagesFromRequest(input.request),
      metadata: input.metadata,
    })

    await recordAiOperationTelemetry({
      operationKey: input.operationKey,
      module: entry?.module ?? "AI",
      feature: entry?.feature ?? "OpenAI request",
      capability: context?.capability ?? entry?.capability,
      handler: entry?.handler,
      route: context?.route ?? entry?.route,
      provider: "openai",
      model: cost.model,
      status: (response as { status?: string }).status === "incomplete" ? "incomplete" : "completed",
      source: context?.source ?? null,
      workflowId: context?.workflowId ?? null,
      conversationId: context?.conversationId ?? null,
      userId: context?.userId ?? null,
      brokerId: context?.brokerId ?? null,
      agencyId: context?.agencyId ?? null,
      planKey: context?.planKey ?? null,
      inputTokens: cost.inputTokens,
      cachedInputTokens: cost.cachedInputTokens,
      outputTokens: cost.outputTokens,
      reasoningTokens: cost.reasoningTokens,
      totalTokens: usage.totalTokens,
      imageCount: cost.imageCount,
      durationMs: Date.now() - startedAt,
      costUsd: cost.estimatedCostUsd,
      costBrl: cost.estimatedCostBrl,
      creditsConsumed: context?.creditsConsumed ?? null,
      metadata: {
        ...context?.metadata,
        ...input.metadata,
        finishReason: (response as { finish_reason?: string | null }).finish_reason ?? null,
        requestModel: typeof input.request.model === "string" ? input.request.model : null,
      },
    })

    return response
  } catch (caughtError) {
    const model = typeof input.request.model === "string" ? input.request.model : entry?.model ?? "gpt-5-mini"
    const cost = estimateOperationCost({
      operationKey: input.operationKey,
      provider: "openai",
      model,
      imageCount: countImagesFromRequest(input.request),
      metadata: input.metadata,
    })

    await recordAiOperationTelemetry({
      operationKey: input.operationKey,
      module: entry?.module ?? "AI",
      feature: entry?.feature ?? "OpenAI request",
      capability: context?.capability ?? entry?.capability,
      handler: entry?.handler,
      route: context?.route ?? entry?.route,
      provider: "openai",
      model,
      status: "failed",
      errorCode: caughtError instanceof Error ? caughtError.name : "OPENAI_ERROR",
      errorMessage: caughtError instanceof Error ? caughtError.message : "unknown",
      source: context?.source ?? null,
      workflowId: context?.workflowId ?? null,
      conversationId: context?.conversationId ?? null,
      userId: context?.userId ?? null,
      brokerId: context?.brokerId ?? null,
      agencyId: context?.agencyId ?? null,
      planKey: context?.planKey ?? null,
      imageCount: cost.imageCount,
      durationMs: Date.now() - startedAt,
      costUsd: cost.estimatedCostUsd,
      costBrl: cost.estimatedCostBrl,
      creditsConsumed: context?.creditsConsumed ?? null,
      metadata: {
        ...context?.metadata,
        ...input.metadata,
      },
    })
    throw caughtError
  }
}
