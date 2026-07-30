import type {
  AiOperationCatalogEntry,
  AiOperationCostBreakdown,
  AiOperationProvider,
  MonetizationPlanSuggestion,
} from "@/lib/ai-cost-contract"
import { getAiOperationCatalogEntry, listAiOperationCatalog } from "@/lib/ai-operation-catalog"

export const USD_TO_BRL_RATE = 5.1005
export const USD_TO_BRL_RATE_DATE = "2026-07-27"

const OPENAI_PRICING_PER_MILLION = {
  "gpt-5-mini": {
    input: 0.25,
    cachedInput: 0.025,
    output: 2,
  },
  "gpt-image-1": {
    input: 5,
    cachedInput: 5,
    output: 40,
  },
} as const

function resolveOpenAIPrice(model: string) {
  const normalized = model.trim().toLowerCase()
  if (normalized.includes("gpt-image-1")) return OPENAI_PRICING_PER_MILLION["gpt-image-1"]
  return OPENAI_PRICING_PER_MILLION["gpt-5-mini"]
}

function estimateOpenAICostUsd(input: {
  model: string
  inputTokens?: number
  cachedInputTokens?: number
  outputTokens?: number
}) {
  const pricing = resolveOpenAIPrice(input.model)
  const regularInputTokens = Math.max(0, (input.inputTokens ?? 0) - (input.cachedInputTokens ?? 0))
  const cachedInputTokens = Math.max(0, input.cachedInputTokens ?? 0)
  const outputTokens = Math.max(0, input.outputTokens ?? 0)

  return Number(
    (
      (regularInputTokens / 1_000_000) * pricing.input +
      (cachedInputTokens / 1_000_000) * pricing.cachedInput +
      (outputTokens / 1_000_000) * pricing.output
    ).toFixed(6),
  )
}

function estimateLumaCostUsd(input: {
  model: string
  billableUnit: AiOperationCatalogEntry["billableUnit"]
  imageCount?: number
  videoCount?: number
  metadata?: Record<string, unknown> | null
}) {
  const normalized = input.model.trim().toLowerCase()
  if (input.billableUnit === "image") {
    const count = Math.max(1, input.imageCount ?? 1)
    return Number((count * 0.0434).toFixed(6))
  }

  const count = Math.max(1, input.videoCount ?? 1)
  const duration = typeof input.metadata?.duration === "string" ? input.metadata.duration : "5s"
  const isLongerVideo = duration === "9s" || duration === "10s"
  const baseVideoCost = isLongerVideo ? 0.9 : 0.3
  const legacyFactor = normalized.includes("flash") ? 0.7 : 1
  return Number((count * baseVideoCost * legacyFactor).toFixed(6))
}

export function estimateOperationCost(input: {
  operationKey: string
  provider?: AiOperationProvider
  model?: string | null
  inputTokens?: number | null
  cachedInputTokens?: number | null
  outputTokens?: number | null
  reasoningTokens?: number | null
  imageCount?: number | null
  videoCount?: number | null
  audioCount?: number | null
  storageBytes?: number | null
  metadata?: Record<string, unknown> | null
}) : AiOperationCostBreakdown {
  const entry = getAiOperationCatalogEntry(input.operationKey)
  const provider = input.provider ?? entry?.provider ?? "internal"
  const model = input.model ?? entry?.model ?? "internal"
  const inputTokens = input.inputTokens ?? entry?.avgInputTokens ?? 0
  const cachedInputTokens = input.cachedInputTokens ?? 0
  const outputTokens = input.outputTokens ?? entry?.avgOutputTokens ?? 0
  const reasoningTokens = input.reasoningTokens ?? 0
  const imageCount = input.imageCount ?? entry?.avgImages ?? 0
  const videoCount = input.videoCount ?? entry?.avgVideos ?? 0
  const audioCount = input.audioCount ?? 0
  const storageBytes = input.storageBytes ?? Math.round((entry?.avgStorageMb ?? 0) * 1024 * 1024)

  const hasObservedUsage = Boolean(input.inputTokens || input.outputTokens || input.imageCount || input.videoCount)
  let pricingSource: AiOperationCostBreakdown["pricingSource"] = input.inputTokens || input.outputTokens || input.imageCount || input.videoCount
    ? "observed_runtime"
    : "catalog_estimate"
  let estimatedCostUsd: number

  if (provider === "openai") {
    estimatedCostUsd = estimateOpenAICostUsd({
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
    })
    pricingSource = input.model?.includes("gpt-image-1") ? "official_pricing" : pricingSource
  } else if (provider === "lumaai") {
    estimatedCostUsd = estimateLumaCostUsd({
      model,
      billableUnit: entry?.billableUnit ?? "video",
      imageCount,
      videoCount,
      metadata: input.metadata,
    })
    pricingSource = model.includes("ray-2") || model.includes("flash") ? "inferred_fallback" : "official_pricing"
  } else {
    estimatedCostUsd = 0
    pricingSource = "catalog_estimate"
  }

  if (hasObservedUsage && pricingSource === "catalog_estimate" && provider === "openai") {
    pricingSource = "observed_runtime"
  }

  return {
    provider,
    model,
    pricingSource,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    imageCount,
    videoCount,
    audioCount,
    storageBytes,
    usdToBrlRate: USD_TO_BRL_RATE,
    estimatedCostUsd,
    estimatedCostBrl: Number((estimatedCostUsd * USD_TO_BRL_RATE).toFixed(6)),
  }
}

export function estimateCatalogEntryCost(entry: AiOperationCatalogEntry) {
  return estimateOperationCost({
    operationKey: entry.id,
    provider: entry.provider,
    model: entry.model,
    inputTokens: entry.avgInputTokens ?? 0,
    outputTokens: entry.avgOutputTokens ?? 0,
    imageCount: entry.avgImages ?? 0,
    videoCount: entry.avgVideos ?? 0,
    metadata: {
      duration: entry.id === "studio.video.final" ? "5s" : undefined,
    },
  })
}

export function buildMonetizationPlanSuggestions(): MonetizationPlanSuggestion[] {
  const avgCosCost = estimateCatalogEntryCost(getAiOperationCatalogEntry("cos.message")!).estimatedCostBrl
  const avgPropertyCost = estimateCatalogEntryCost(getAiOperationCatalogEntry("property.generate_copy")!).estimatedCostBrl
  const avgCampaignCost = estimateCatalogEntryCost(getAiOperationCatalogEntry("studio.instagram")!).estimatedCostBrl
  const avgVideoCost = estimateCatalogEntryCost(getAiOperationCatalogEntry("studio.video.final")!).estimatedCostBrl

  const suggestions: Array<Omit<MonetizationPlanSuggestion, "estimatedMonthlyCostBrl" | "estimatedMarginBrl" | "estimatedMarginPercent"> & {
    usageMix: {
      cos: number
      property: number
      campaign: number
      video: number
    }
  }> = [
    {
      key: "free",
      name: "Plano Free",
      priceCents: 0,
      propertyLimit: 5,
      monthlyCredits: 25,
      includedFeatures: ["catalog", "leads", "agenda", "documents"],
      targetProfile: "Corretor iniciando operacao e validando fit do produto.",
      usageMix: { cos: 20, property: 3, campaign: 1, video: 0 },
    },
    {
      key: "pro",
      name: "Plano EME Pro",
      priceCents: 9900,
      propertyLimit: 120,
      monthlyCredits: 220,
      includedFeatures: ["all", "assessor_eme", "studio_ia"],
      targetProfile: "Corretor em operacao diaria com uso recorrente de COS, importacao e Studio IA.",
      usageMix: { cos: 120, property: 16, campaign: 6, video: 1 },
    },
    {
      key: "growth",
      name: "Plano EME Growth",
      priceCents: 19900,
      propertyLimit: 320,
      monthlyCredits: 520,
      includedFeatures: ["all", "assessor_eme", "studio_ia", "analytics_plus"],
      targetProfile: "Corretor ou pequena equipe com carteira ativa e publicacao constante.",
      usageMix: { cos: 260, property: 34, campaign: 12, video: 2 },
    },
    {
      key: "scale",
      name: "Plano EME Scale",
      priceCents: 39900,
      propertyLimit: 900,
      monthlyCredits: 1400,
      includedFeatures: ["all", "assessor_eme", "studio_ia", "analytics_plus", "priority_support"],
      targetProfile: "Operacao com alto volume, conteudo recorrente e uso intensivo do COS.",
      usageMix: { cos: 700, property: 90, campaign: 24, video: 5 },
    },
  ]

  return suggestions.map((plan) => {
    const estimatedMonthlyCostBrl = Number(
      (
        plan.usageMix.cos * avgCosCost +
        plan.usageMix.property * avgPropertyCost +
        plan.usageMix.campaign * avgCampaignCost +
        plan.usageMix.video * avgVideoCost
      ).toFixed(2),
    )
    const revenueBrl = plan.priceCents / 100
    const estimatedMarginBrl = Number((revenueBrl - estimatedMonthlyCostBrl).toFixed(2))
    const estimatedMarginPercent = revenueBrl > 0
      ? Number(((estimatedMarginBrl / revenueBrl) * 100).toFixed(1))
      : 0

    return {
      key: plan.key,
      name: plan.name,
      priceCents: plan.priceCents,
      propertyLimit: plan.propertyLimit,
      monthlyCredits: plan.monthlyCredits,
      includedFeatures: plan.includedFeatures,
      estimatedMonthlyCostBrl,
      estimatedMarginBrl,
      estimatedMarginPercent,
      targetProfile: plan.targetProfile,
    }
  })
}

export function buildOperationalCreditTable() {
  return listAiOperationCatalog()
    .sort((first, second) => first.suggestedCredits - second.suggestedCredits)
    .map((entry) => ({
      operationKey: entry.id,
      module: entry.module,
      feature: entry.feature,
      suggestedCredits: entry.suggestedCredits,
      estimatedCostBrl: estimateCatalogEntryCost(entry).estimatedCostBrl,
    }))
}
