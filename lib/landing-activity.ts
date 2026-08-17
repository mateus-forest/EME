export const landingActivityPeriods = ["today", "sevenDays", "thirtyDays", "total"] as const

export type LandingActivityPeriod = (typeof landingActivityPeriods)[number]
export type LandingActivityMetricId = "properties" | "proposals" | "studioMaterials" | "cities"

export type LandingActivityCounts = Record<
  LandingActivityMetricId,
  Record<LandingActivityPeriod, number>
>

export type LandingActivityMetric = {
  id: LandingActivityMetricId
  value: number
  period: LandingActivityPeriod
  title: string
  subtitle: string
}

export type LandingActivityResponse = {
  metrics: LandingActivityMetric[]
  generatedAt: string
}

const metricOrder: LandingActivityMetricId[] = ["properties", "proposals", "studioMaterials", "cities"]

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value)
}

function periodSuffix(period: Exclude<LandingActivityPeriod, "total">) {
  if (period === "today") return "hoje"
  if (period === "sevenDays") return "nos últimos 7 dias"
  return "nos últimos 30 dias"
}

export function selectFirstRelevantPeriod(
  counts: Record<LandingActivityPeriod, number>,
): { period: LandingActivityPeriod; value: number } | null {
  for (const period of landingActivityPeriods) {
    const value = counts[period]
    if (Number.isFinite(value) && value > 0) return { period, value }
  }

  return null
}

function buildMetric(
  id: LandingActivityMetricId,
  selection: { period: LandingActivityPeriod; value: number },
): LandingActivityMetric {
  const { period, value } = selection
  const amount = formatNumber(value)
  const plural = value !== 1

  if (id === "properties") {
    return {
      id,
      value,
      period,
      title:
        period === "total"
          ? `${amount} ${plural ? "imóveis disponíveis" : "imóvel disponível"} agora`
          : `${amount} ${plural ? "imóveis publicados" : "imóvel publicado"} ${periodSuffix(period)}`,
      subtitle: "Direto da carteira dos corretores.",
    }
  }

  if (id === "proposals") {
    return {
      id,
      value,
      period,
      title:
        period === "total"
          ? `${amount} ${plural ? "propostas criadas" : "proposta criada"} no EME`
          : `${amount} ${plural ? "propostas criadas" : "proposta criada"} ${periodSuffix(period)}`,
      subtitle: "Negociações ganhando forma no EME.",
    }
  }

  if (id === "studioMaterials") {
    return {
      id,
      value,
      period,
      title:
        period === "total"
          ? `${amount} ${plural ? "materiais criados" : "material criado"} no Studio`
          : `${amount} ${plural ? "materiais criados" : "material criado"} ${periodSuffix(period)}`,
      subtitle: "Conteúdo real produzido no Studio IA.",
    }
  }

  return {
    id,
    value,
    period,
    title:
      period === "total"
        ? `${amount} ${plural ? "cidades com imóveis" : "cidade com imóveis"} disponíveis agora`
        : `${amount} ${plural ? "cidades com imóveis publicados" : "cidade com imóvel publicado"} ${periodSuffix(period)}`,
    subtitle: "Atividade agregada, sem expor usuários.",
  }
}

export function buildLandingActivityMetrics(counts: LandingActivityCounts): LandingActivityMetric[] {
  return metricOrder.flatMap((id) => {
    const selection = selectFirstRelevantPeriod(counts[id])
    return selection ? [buildMetric(id, selection)] : []
  })
}
