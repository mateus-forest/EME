import "server-only"

import { prisma } from "@/lib/prisma"
import { buildMonetizationPlanSuggestions, buildOperationalCreditTable, estimateCatalogEntryCost, USD_TO_BRL_RATE, USD_TO_BRL_RATE_DATE } from "@/lib/ai-cost-engine"
import { listAiOperationCatalog } from "@/lib/ai-operation-catalog"
import type { AdminMonetizationReport, MonetizationInventoryRow, MonetizationRankingRow } from "@/lib/admin-monetization-contract"

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function bucketLastDays(entries: Array<{ createdAt: Date; value: number }>, days: number) {
  const today = startOfDay()
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index - (days - 1))
    const key = day.toISOString().slice(0, 10)
    const value = entries
      .filter((entry) => startOfDay(entry.createdAt).toISOString().slice(0, 10) === key)
      .reduce((sum, entry) => sum + entry.value, 0)
    return {
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(day),
      value: Number(value.toFixed(2)),
    }
  })
}

function bucketLastWeeks(entries: Array<{ createdAt: Date; value: number }>, weeks: number) {
  const now = new Date()
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(startOfDay(now), -7 * (weeks - 1 - index))
    const end = addDays(start, 6)
    const value = entries
      .filter((entry) => entry.createdAt >= start && entry.createdAt <= end)
      .reduce((sum, entry) => sum + entry.value, 0)
    return {
      label: `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(start)}-${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(end)}`,
      value: Number(value.toFixed(2)),
    }
  })
}

function bucketLastMonths(entries: Array<{ createdAt: Date; value: number }>, months: number) {
  const now = new Date()
  return Array.from({ length: months }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1)
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    const value = entries
      .filter((entry) => entry.createdAt >= month && entry.createdAt < next)
      .reduce((sum, entry) => sum + entry.value, 0)
    return {
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(month),
      value: Number(value.toFixed(2)),
    }
  })
}

function topRows(map: Map<string, number>, limit = 8, helpers?: Map<string, string>): MonetizationRankingRow[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value: Number(value.toFixed(2)),
      helper: helpers?.get(label) ?? "",
    }))
}

function avg(values: number[]) {
  if (!values.length) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6))
}

export async function getAdminMonetizationReport(): Promise<AdminMonetizationReport> {
  const [telemetry, planAccounts] = await Promise.all([
    prisma.aiOperationTelemetry.findMany({
      orderBy: { createdAt: "desc" },
      take: 4000,
    }),
    prisma.brokerPlanAccount.findMany({
      select: { planKey: true },
    }),
  ])

  const now = new Date()
  const last30DaysStart = addDays(startOfDay(now), -29)
  const last30Days = telemetry.filter((item) => item.createdAt >= last30DaysStart)
  const allCosts = last30Days.map((item) => ({
    createdAt: item.createdAt,
    value: toNumber(item.costBrl),
  }))
  const totalCostBrl = allCosts.reduce((sum, item) => sum + item.value, 0)
  const totalCostUsd = last30Days.reduce((sum, item) => sum + toNumber(item.costUsd), 0)
  const totalOperations = last30Days.length
  const activeCostUsers = new Set(last30Days.map((item) => item.userId).filter(Boolean)).size
  const avgCostPerOperationBrl = totalOperations > 0 ? totalCostBrl / totalOperations : 0

  const plans = buildMonetizationPlanSuggestions()
  const planCounts = new Map<string, number>()
  planAccounts.forEach((item) => {
    planCounts.set(item.planKey, (planCounts.get(item.planKey) ?? 0) + 1)
  })
  const estimatedRevenueBrl = plans.reduce((sum, plan) => sum + ((planCounts.get(plan.key) ?? 0) * (plan.priceCents / 100)), 0)

  const operationCounts = new Map<string, number>()
  const operationCosts = new Map<string, number>()
  const capabilityCosts = new Map<string, number>()
  const modelCosts = new Map<string, number>()
  const workflowCosts = new Map<string, number>()
  const conversationCosts = new Map<string, number>()
  const userCosts = new Map<string, number>()
  const planCosts = new Map<string, number>()
  const moduleCosts = new Map<string, number>()
  const inputTokenMap = new Map<string, number[]>()
  const outputTokenMap = new Map<string, number[]>()

  last30Days.forEach((item) => {
    const cost = toNumber(item.costBrl)
    operationCounts.set(item.operationKey, (operationCounts.get(item.operationKey) ?? 0) + 1)
    operationCosts.set(item.operationKey, (operationCosts.get(item.operationKey) ?? 0) + cost)

    if (item.capability) capabilityCosts.set(item.capability, (capabilityCosts.get(item.capability) ?? 0) + cost)
    if (item.model) modelCosts.set(item.model, (modelCosts.get(item.model) ?? 0) + cost)
    if (item.workflowId) workflowCosts.set(item.workflowId, (workflowCosts.get(item.workflowId) ?? 0) + cost)
    if (item.conversationId) conversationCosts.set(item.conversationId, (conversationCosts.get(item.conversationId) ?? 0) + cost)
    if (item.userId) userCosts.set(item.userId, (userCosts.get(item.userId) ?? 0) + cost)
    if (item.planKey) planCosts.set(item.planKey, (planCosts.get(item.planKey) ?? 0) + cost)
    moduleCosts.set(item.module, (moduleCosts.get(item.module) ?? 0) + cost)

    if (typeof item.inputTokens === "number") {
      inputTokenMap.set(item.operationKey, [...(inputTokenMap.get(item.operationKey) ?? []), item.inputTokens])
    }
    if (typeof item.outputTokens === "number") {
      outputTokenMap.set(item.operationKey, [...(outputTokenMap.get(item.operationKey) ?? []), item.outputTokens])
    }
  })

  const inventory: MonetizationInventoryRow[] = listAiOperationCatalog().map((entry) => {
    const estimated = estimateCatalogEntryCost(entry)
    const requestCount = operationCounts.get(entry.id) ?? 0
    const totalOperationCost = operationCosts.get(entry.id) ?? 0
    const avgCostBrl = requestCount > 0 ? totalOperationCost / requestCount : estimated.estimatedCostBrl
    return {
      operationKey: entry.id,
      module: entry.module,
      feature: entry.feature,
      capability: entry.capability,
      provider: entry.provider,
      model: entry.model,
      file: entry.file,
      handler: entry.handler,
      requestCount,
      avgInputTokens: requestCount > 0 ? avg(inputTokenMap.get(entry.id) ?? []) : entry.avgInputTokens ?? 0,
      avgOutputTokens: requestCount > 0 ? avg(outputTokenMap.get(entry.id) ?? []) : entry.avgOutputTokens ?? 0,
      avgCostBrl: Number(avgCostBrl.toFixed(6)),
      monthlyCostBrl: Number((requestCount > 0 ? totalOperationCost : avgCostBrl * entry.expectedUsagePerBrokerMonthly).toFixed(2)),
      suggestedCredits: entry.suggestedCredits,
      cacheable: entry.cacheable,
      retryProfile: entry.retryProfile,
      criticity: entry.criticity,
    }
  })

  const expensivePlans = topRows(planCosts, 8, new Map(plans.map((plan) => [plan.key, plan.name])))
  const expensiveOperations = topRows(operationCosts, 10, new Map(inventory.map((row) => [row.operationKey, `${row.module} - ${row.feature}`])))
  const expensiveUsers = topRows(userCosts, 10)
  const expensiveModules = topRows(moduleCosts, 10)

  const averageEstimatedPlanCost = plans.reduce((sum, plan) => sum + plan.estimatedMonthlyCostBrl, 0) / Math.max(plans.length, 1)

  return {
    generatedAt: now.toISOString(),
    pricingReference: {
      usdToBrlRate: USD_TO_BRL_RATE,
      usdToBrlDate: USD_TO_BRL_RATE_DATE,
    },
    overview: [
      {
        label: "Custo total 30d",
        value: formatBRL(totalCostBrl),
        helper: `${totalOperations} operacoes monitoradas`,
      },
      {
        label: "Receita estimada",
        value: formatBRL(estimatedRevenueBrl),
        helper: "Baseada nos planos ativos registrados em BrokerPlanAccount.",
      },
      {
        label: "Margem estimada",
        value: formatBRL(estimatedRevenueBrl - totalCostBrl),
        helper: estimatedRevenueBrl > 0 ? `${(((estimatedRevenueBrl - totalCostBrl) / estimatedRevenueBrl) * 100).toFixed(1)}% de margem bruta` : "Sem receita recorrente suficiente para calcular margem.",
      },
      {
        label: "Custo medio por operacao",
        value: formatBRL(avgCostPerOperationBrl),
        helper: `${activeCostUsers} usuarios com consumo no periodo`,
      },
      {
        label: "Consumo IA em USD",
        value: `$${totalCostUsd.toFixed(2)}`,
        helper: `Cambio de referencia ${USD_TO_BRL_RATE.toFixed(4)} em ${USD_TO_BRL_RATE_DATE}`,
      },
      {
        label: "Custo medio por plano sugerido",
        value: formatBRL(averageEstimatedPlanCost),
        helper: "Media dos custos mensais esperados dos planos Free, Pro, Growth e Scale.",
      },
    ],
    inventory,
    ranking: {
      expensiveOperations,
      expensiveUsers,
      expensivePlans,
      expensiveModules,
    },
    distribution: {
      costByCapability: topRows(capabilityCosts, 10),
      costByModel: topRows(modelCosts, 10),
      costByWorkflow: topRows(workflowCosts, 10),
      costByConversation: topRows(conversationCosts, 10),
    },
    reports: {
      dailyCostBrl: bucketLastDays(allCosts, 14),
      weeklyCostBrl: bucketLastWeeks(allCosts, 8),
      monthlyCostBrl: bucketLastMonths(allCosts, 6),
    },
    creditSystem: buildOperationalCreditTable(),
    plans: plans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      price: formatBRL(plan.priceCents / 100),
      propertyLimit: plan.propertyLimit,
      monthlyCredits: plan.monthlyCredits,
      estimatedMonthlyCostBrl: plan.estimatedMonthlyCostBrl,
      estimatedMarginBrl: plan.estimatedMarginBrl,
      estimatedMarginPercent: plan.estimatedMarginPercent,
      targetProfile: plan.targetProfile,
    })),
    extraPackages: [
      { key: "credit_100", label: "+100 creditos IA", price: formatBRL(49.9), credits: 100, estimatedMarginPercent: 93.5 },
      { key: "credit_300", label: "+300 creditos IA", price: formatBRL(119.9), credits: 300, estimatedMarginPercent: 94.1 },
      { key: "credit_800", label: "+800 creditos IA", price: formatBRL(249.9), credits: 800, estimatedMarginPercent: 94.7 },
      { key: "property_50", label: "+50 imoveis", price: formatBRL(39.9), properties: 50, estimatedMarginPercent: 99 },
      { key: "property_200", label: "+200 imoveis", price: formatBRL(119.9), properties: 200, estimatedMarginPercent: 99 },
    ],
  }
}
