import "server-only"

import type { Prisma } from "@prisma/client"

import { estimateOperationCost } from "@/lib/ai-cost-engine"
import { getAiOperationCatalogEntry } from "@/lib/ai-operation-catalog"
import { getAiOperationContext } from "@/lib/ai-operation-context"
import { prisma } from "@/lib/prisma"
import { isPrismaSchemaMismatch, isPrismaUnavailable } from "@/lib/auth-route"
import type { AiTelemetryRecordInput } from "@/lib/ai-cost-contract"

function toRecordPayload(input: AiTelemetryRecordInput) {
  const metadata = input.metadata ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue) : undefined

  return {
    operationKey: input.operationKey,
    module: input.module,
    feature: input.feature,
    capability: input.capability ?? null,
    handler: input.handler ?? null,
    route: input.route ?? null,
    provider: input.provider,
    model: input.model ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    source: input.source ?? null,
    workflowId: input.workflowId ?? null,
    conversationId: input.conversationId ?? null,
    userId: input.userId ?? null,
    brokerId: input.brokerId ?? null,
    agencyId: input.agencyId ?? null,
    planKey: input.planKey ?? null,
    inputTokens: input.inputTokens ?? null,
    cachedInputTokens: input.cachedInputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    reasoningTokens: input.reasoningTokens ?? null,
    totalTokens: input.totalTokens ?? null,
    imageCount: input.imageCount ?? 0,
    videoCount: input.videoCount ?? 0,
    audioCount: input.audioCount ?? 0,
    storageBytes: input.storageBytes ?? null,
    durationMs: input.durationMs ?? null,
    costUsd: input.costUsd ?? null,
    costBrl: input.costBrl ?? null,
    creditsConsumed: input.creditsConsumed ?? null,
    retryCount: input.retryCount ?? 0,
    metadata,
  }
}

export async function recordAiOperationTelemetry(input: AiTelemetryRecordInput) {
  try {
    await prisma.aiOperationTelemetry.create({
      data: toRecordPayload(input),
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError) || isPrismaSchemaMismatch(caughtError)) {
      console.warn("[ai-telemetry] skipped persistence", {
        operationKey: input.operationKey,
        message: caughtError instanceof Error ? caughtError.message : "unknown",
      })
      return
    }

    console.error("[ai-telemetry] unexpected persistence failure", {
      operationKey: input.operationKey,
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
  }
}

export async function recordEstimatedCatalogTelemetry(input: {
  operationKey: string
  model?: string | null
  status?: "completed" | "failed" | "cancelled" | "incomplete"
  errorCode?: string | null
  errorMessage?: string | null
  imageCount?: number | null
  videoCount?: number | null
  storageBytes?: number | null
  retryCount?: number | null
  metadata?: Record<string, unknown> | null
}) {
  const entry = getAiOperationCatalogEntry(input.operationKey)
  const context = getAiOperationContext()
  const cost = estimateOperationCost({
    operationKey: input.operationKey,
    provider: entry?.provider,
    model: input.model ?? entry?.model ?? null,
    imageCount: input.imageCount ?? undefined,
    videoCount: input.videoCount ?? undefined,
    storageBytes: input.storageBytes ?? undefined,
    metadata: input.metadata,
  })

  await recordAiOperationTelemetry({
    operationKey: input.operationKey,
    module: entry?.module ?? "AI",
    feature: entry?.feature ?? "External operation",
    capability: context?.capability ?? entry?.capability,
    handler: entry?.handler,
    route: context?.route ?? entry?.route,
    provider: entry?.provider ?? "internal",
    model: input.model ?? entry?.model ?? null,
    status: input.status ?? "completed",
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    source: context?.source ?? null,
    workflowId: context?.workflowId ?? null,
    conversationId: context?.conversationId ?? null,
    userId: context?.userId ?? null,
    brokerId: context?.brokerId ?? null,
    agencyId: context?.agencyId ?? null,
    planKey: context?.planKey ?? null,
    imageCount: cost.imageCount,
    videoCount: cost.videoCount,
    storageBytes: input.storageBytes ?? null,
    durationMs: null,
    costUsd: cost.estimatedCostUsd,
    costBrl: cost.estimatedCostBrl,
    creditsConsumed: context?.creditsConsumed ?? null,
    retryCount: input.retryCount ?? 0,
    metadata: {
      ...context?.metadata,
      ...input.metadata,
      pricingSource: cost.pricingSource,
    },
  })
}
