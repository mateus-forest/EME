export type AiPricingSource = "observed_runtime" | "official_pricing" | "catalog_estimate" | "inferred_fallback"

export type AiOperationProvider = "openai" | "lumaai" | "pedra" | "xai" | "supabase" | "internal"

export type AiOperationCriticality = "low" | "medium" | "high"

export type AiOperationCadence = "low" | "medium" | "high"

export type AiOperationCatalogEntry = {
  id: string
  module: string
  feature: string
  capability: string
  route?: string
  file: string
  handler: string
  provider: AiOperationProvider
  model: string
  description: string
  billableUnit: "request" | "image" | "video" | "document" | "storage"
  avgInputTokens?: number
  avgOutputTokens?: number
  avgImages?: number
  avgVideos?: number
  avgAudioMinutes?: number
  avgStorageMb?: number
  retryProfile: "none" | "rare" | "moderate"
  cacheable: boolean
  criticity: AiOperationCriticality
  expectedUsagePerBrokerMonthly: number
  expectedCadence: AiOperationCadence
  currentCreditActionKey?: string
  suggestedCredits: number
  notes?: string
}

export type AiOperationCostBreakdown = {
  provider: AiOperationProvider
  model: string
  pricingSource: AiPricingSource
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  imageCount: number
  videoCount: number
  audioCount: number
  storageBytes: number
  usdToBrlRate: number
  estimatedCostUsd: number
  estimatedCostBrl: number
}

export type AiTelemetryContext = {
  operationKey?: string
  route?: string
  capability?: string
  source?: string
  userId?: string | null
  brokerId?: string | null
  agencyId?: string | null
  planKey?: string | null
  workflowId?: string | null
  conversationId?: string | null
  creditsConsumed?: number | null
  metadata?: Record<string, unknown>
}

export type AiTelemetryRecordInput = {
  operationKey: string
  module: string
  feature: string
  capability?: string
  handler?: string
  route?: string
  provider: AiOperationProvider
  model?: string | null
  status: "completed" | "failed" | "cancelled" | "incomplete"
  errorCode?: string | null
  errorMessage?: string | null
  source?: string | null
  workflowId?: string | null
  conversationId?: string | null
  userId?: string | null
  brokerId?: string | null
  agencyId?: string | null
  planKey?: string | null
  inputTokens?: number | null
  cachedInputTokens?: number | null
  outputTokens?: number | null
  reasoningTokens?: number | null
  totalTokens?: number | null
  imageCount?: number | null
  videoCount?: number | null
  audioCount?: number | null
  storageBytes?: number | null
  durationMs?: number | null
  costUsd?: number | null
  costBrl?: number | null
  creditsConsumed?: number | null
  retryCount?: number | null
  metadata?: Record<string, unknown> | null
}

export type MonetizationPlanSuggestion = {
  key: "free" | "pro" | "growth" | "scale"
  name: string
  priceCents: number
  propertyLimit: number
  monthlyCredits: number
  includedFeatures: string[]
  estimatedMonthlyCostBrl: number
  estimatedMarginBrl: number
  estimatedMarginPercent: number
  targetProfile: string
}
