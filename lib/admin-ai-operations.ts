import "server-only"

import { prisma } from "@/lib/prisma"
import type {
  AdminAiBreakdown,
  AdminAiOperationRow,
  AdminAiOperationsReport,
} from "@/lib/admin-ai-operations-contract"

const HISTORY_LIMIT = 3000

function providerLabel(provider: string) {
  const normalized = provider.trim().toLowerCase()
  if (normalized === "openai") return "OpenAI"
  if (normalized === "xai" || normalized === "grok") return "Grok / xAI"
  if (normalized === "pedra") return "Pedra"
  if (normalized === "luma" || normalized === "lumaai") return "Luma"
  if (normalized === "internal") return "Interno"
  return provider || "Não informado"
}

function operationCategory(item: {
  imageCount: number | null
  videoCount: number | null
  module: string
  feature: string
  operationKey: string
}): AdminAiOperationRow["category"] {
  const searchable = `${item.module} ${item.feature} ${item.operationKey}`.toLowerCase()
  if ((item.videoCount ?? 0) > 0 || searchable.includes("video")) return "Vídeo"
  if ((item.imageCount ?? 0) > 0 || searchable.includes("image") || searchable.includes("imagem")) return "Imagem"
  if (searchable.includes("text") || searchable.includes("copy") || searchable.includes("cos") || searchable.includes("chat")) return "Texto"
  return "Outro"
}

function addBreakdown(
  target: Map<string, AdminAiBreakdown>,
  label: string,
  row: AdminAiOperationRow,
) {
  const current = target.get(label) ?? {
    label,
    operations: 0,
    credits: 0,
    costBrl: 0,
    unpricedOperations: 0,
  }
  current.operations += 1
  current.credits += row.credits
  current.costBrl += row.costBrl ?? 0
  if (row.costState === "unavailable") current.unpricedOperations += 1
  target.set(label, current)
}

export async function getAdminAiOperationsReport(periodDays = 365): Promise<AdminAiOperationsReport> {
  const since = new Date()
  since.setDate(since.getDate() - Math.max(1, Math.min(periodDays, 365)))

  const [telemetry, total] = await Promise.all([
    prisma.aiOperationTelemetry.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.aiOperationTelemetry.count({ where: { createdAt: { gte: since } } }),
  ])

  const userIds = [...new Set(telemetry.map((item) => item.userId).filter((value): value is string => Boolean(value)))]
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))

  const operations: AdminAiOperationRow[] = telemetry.map((item) => {
    const user = item.userId ? userById.get(item.userId) : null
    const costBrl = item.costBrl === null ? null : Number(item.costBrl)
    const costUsd = item.costUsd === null ? null : Number(item.costUsd)
    return {
      id: item.id,
      provider: providerLabel(item.provider),
      model: item.model || "Não informado",
      module: item.module || item.feature || "Não informado",
      operation: item.operationKey || item.feature || "Operação não informada",
      category: operationCategory(item),
      userName: user?.name || "Sistema",
      userEmail: user?.email || null,
      quantity: Math.max(1, (item.imageCount ?? 0) + (item.videoCount ?? 0)),
      credits: item.creditsConsumed ?? 0,
      costBrl,
      costUsd,
      costState: costBrl === null && costUsd === null ? "unavailable" : "recorded",
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    }
  })

  const providers = new Map<string, AdminAiBreakdown>()
  const categories = new Map<string, AdminAiBreakdown>()
  operations.forEach((row) => {
    addBreakdown(providers, `${row.provider} · ${row.model}`, row)
    addBreakdown(categories, row.category, row)
  })

  const activeUsers = new Set(operations.map((row) => row.userEmail || row.userName)).size
  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    truncated: total > operations.length,
    summary: {
      operations: total,
      credits: operations.reduce((sum, row) => sum + row.credits, 0),
      recordedCostBrl: operations.reduce((sum, row) => sum + (row.costBrl ?? 0), 0),
      recordedCostUsd: operations.reduce((sum, row) => sum + (row.costUsd ?? 0), 0),
      activeUsers,
      unpricedOperations: operations.filter((row) => row.costState === "unavailable").length,
    },
    providers: [...providers.values()].sort((a, b) => b.operations - a.operations),
    categories: [...categories.values()].sort((a, b) => b.operations - a.operations),
    operations,
  }
}
