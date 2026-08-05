"use client"

import { Activity, BarChart3, Building2, MessageCircle, Sparkles, TrendingUp, Users } from "lucide-react"

import {
  AdminDefinitionGrid,
  AdminKpiList,
  AdminMetricCard,
  AdminMetricGrid,
  AdminMiniChart,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

export function AdminAnalyticsPage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Analytics" subtitle="Indicadores úteis da plataforma, sem métricas comerciais antigas">
      {isLoading && !insights ? <EmeLoading message="Consolidando analytics..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Usuários ativos" value={String(insights.analytics.activeUsers)} icon={<Users className="size-5" />} />
            <AdminMetricCard label="Imóveis ativos" value={String(insights.analytics.properties)} icon={<Building2 className="size-5" />} />
            <AdminMetricCard label="Clientes" value={String(insights.analytics.clients)} icon={<MessageCircle className="size-5" />} />
            <AdminMetricCard label="Engajamento" value={insights.analytics.engagement == null ? "Sem base" : `${insights.analytics.engagement}`} icon={<Activity className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Indicadores principais" subtitle="Leitura objetiva do que move a operação hoje.">
              <AdminDefinitionGrid
                columns={4}
                items={[
                  { label: "Propostas", value: String(insights.analytics.proposals) },
                  { label: "Conversões", value: String(insights.analytics.conversions) },
                  { label: "Studio IA", value: String(insights.analytics.studioIa) },
                  { label: "COS", value: String(insights.analytics.cos) },
                  { label: "Vídeos", value: String(insights.analytics.videos) },
                  { label: "Imagens", value: String(insights.analytics.images) },
                  { label: "Vendas", value: String(insights.analytics.sales) },
                  { label: "Retenção", value: insights.analytics.retention == null ? "Sem base" : `${insights.analytics.retention}%` },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Leitura de uso" subtitle="Profundidade operacional da base e da IA.">
              <AdminDefinitionGrid
                items={[
                  { label: "Créditos usados", value: String(insights.aiConsumption.totalCreditsConsumed) },
                  { label: "OpenAI", value: insights.aiConsumption.openAiCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
                  { label: "Conversas COS", value: String(insights.cos.conversationsTotal) },
                  { label: "Campanhas Studio IA", value: String(insights.studioIa.campaigns) },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="COS por dia" subtitle="Últimos 7 dias" points={insights.cos.usageByDay} />
            <AdminMiniChart title="Studio IA por dia" subtitle="Últimos 7 dias" points={insights.studioIa.generationByDay} />
            <AdminMiniChart title="Receita ativa por mês" subtitle="Base paga observada" points={insights.revenue.monthlySeries} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <AdminSurface title="Adoção do COS" subtitle="Usuários que mais movimentam a operação conversacional.">
              <AdminKpiList rows={insights.cos.usageByBroker} />
            </AdminSurface>

            <AdminSurface title="Uso do Studio IA" subtitle="Recursos criativos com maior tração atual.">
              <AdminKpiList rows={insights.studioIa.consumptionByFeature} />
            </AdminSurface>
          </section>

          <AdminMetricGrid>
            <AdminMetricCard label="Crescimento" value={insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%`} icon={<TrendingUp className="size-5" />} tone="success" />
            <AdminMetricCard label="COS" value={`${insights.cos.commandsExecuted} comandos`} icon={<MessageCircle className="size-5" />} />
            <AdminMetricCard label="Studio IA" value={`${insights.studioIa.creditsUsed} créditos`} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Operações IA" value={`${insights.aiConsumption.totalOperations}`} icon={<BarChart3 className="size-5" />} />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
