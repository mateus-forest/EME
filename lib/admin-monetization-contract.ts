export type MonetizationOverviewMetric = {
  label: string
  value: string
  helper: string
}

export type MonetizationInventoryRow = {
  operationKey: string
  module: string
  feature: string
  capability: string
  provider: string
  model: string
  file: string
  handler: string
  requestCount: number
  avgInputTokens: number
  avgOutputTokens: number
  avgCostBrl: number
  monthlyCostBrl: number
  suggestedCredits: number
  cacheable: boolean
  retryProfile: string
  criticity: string
}

export type MonetizationRankingRow = {
  label: string
  value: number
  helper: string
}

export type MonetizationPlanRow = {
  key: string
  name: string
  price: string
  propertyLimit: number
  monthlyCredits: number
  estimatedMonthlyCostBrl: number
  estimatedMarginBrl: number
  estimatedMarginPercent: number
  targetProfile: string
}

export type AdminMonetizationReport = {
  generatedAt: string
  pricingReference: {
    usdToBrlRate: number
    usdToBrlDate: string
  }
  overview: MonetizationOverviewMetric[]
  inventory: MonetizationInventoryRow[]
  ranking: {
    expensiveOperations: MonetizationRankingRow[]
    expensiveUsers: MonetizationRankingRow[]
    expensivePlans: MonetizationRankingRow[]
    expensiveModules: MonetizationRankingRow[]
  }
  distribution: {
    costByCapability: MonetizationRankingRow[]
    costByModel: MonetizationRankingRow[]
    costByWorkflow: MonetizationRankingRow[]
    costByConversation: MonetizationRankingRow[]
  }
  reports: {
    dailyCostBrl: Array<{ label: string; value: number }>
    weeklyCostBrl: Array<{ label: string; value: number }>
    monthlyCostBrl: Array<{ label: string; value: number }>
  }
  creditSystem: Array<{
    operationKey: string
    module: string
    feature: string
    suggestedCredits: number
    estimatedCostBrl: number
  }>
  plans: MonetizationPlanRow[]
  extraPackages: Array<{
    key: string
    label: string
    price: string
    credits?: number
    properties?: number
    estimatedMarginPercent: number
  }>
}
