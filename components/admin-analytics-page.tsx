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
    <AdminPageShell title="Analytics" subtitle="Indicadores reais da plataforma para produto, operação e crescimento">
      {isLoading && !insights ? <EmeLoading message="Consolidando analytics..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Usuários ativos" value={String(insights.analytics.activeUsers)} icon={<Users className="size-5" />} />
            <AdminMetricCard label="Imóveis ativos" value={String(insights.analytics.properties)} icon={<Building2 className="size-5" />} />
            <AdminMetricCard label="Leads e clientes" value={String(insights.analytics.clients)} icon={<MessageCircle className="size-5" />} />
            <AdminMetricCard label="Engajamento" value={insights.analytics.engagement == null ? "Sem base" : `${insights.analytics.engagement}`} icon={<Activity className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Indicadores principais" subtitle="Base consolidada da operação do portal.">
              <AdminDefinitionGrid
                columns={4}
                items={[
                  { label: "Clientes", value: String(insights.analytics.clients) },
                  { label: "Propostas", value: String(insights.analytics.proposals) },
                  { label: "Studio IA", value: String(insights.analytics.studioIa) },
                  { label: "COS", value: String(insights.analytics.cos) },
                  { label: "Vídeos", value: String(insights.analytics.videos) },
                  { label: "Imagens", value: String(insights.analytics.images) },
                  { label: "Conversões", value: String(insights.analytics.conversions) },
                  { label: "Vendas", value: String(insights.analytics.sales) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Retenção e saúde" subtitle="Sinais de recorrência e profundidade de uso.">
              <AdminDefinitionGrid
                items={[
                  { label: "Retenção", value: insights.analytics.retention == null ? "Sem base" : `${insights.analytics.retention}%` },
                  { label: "Engajamento médio", value: insights.analytics.engagement == null ? "Sem base" : `${insights.analytics.engagement}` },
                  { label: "Créditos usados", value: String(insights.aiConsumption.totalCreditsConsumed) },
                  { label: "Saldo atual", value: String(insights.aiConsumption.currentBalance) },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Uso do COS por dia" subtitle="Comandos e interações nos últimos 7 dias." points={insights.cos.usageByDay} />
            <AdminMiniChart title="Uso do Studio IA por dia" subtitle="Ações de geração nos últimos 7 dias." points={insights.studioIa.generationByDay} />
            <AdminMiniChart title="Receita ativa por mês" subtitle="Base de assinaturas ativas." points={insights.revenue.monthlySeries} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <AdminSurface title="Corretores com maior uso" subtitle="Quem mais movimenta o COS na rotina comercial.">
              <AdminKpiList rows={insights.cos.usageByBroker} />
            </AdminSurface>

            <AdminSurface title="Recursos mais utilizados" subtitle="O que mais concentra consumo dentro do Studio IA.">
              <AdminKpiList rows={insights.studioIa.consumptionByFeature} />
            </AdminSurface>
          </section>

          <AdminMetricGrid>
            <AdminMetricCard label="Crescimento" value={insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%`} icon={<TrendingUp className="size-5" />} tone="success" />
            <AdminMetricCard label="COS" value={`${insights.cos.commandsExecuted} comandos`} icon={<MessageCircle className="size-5" />} />
            <AdminMetricCard label="Studio IA" value={`${insights.studioIa.creditsUsed} créditos`} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Plataforma" value="Operacional" icon={<BarChart3 className="size-5" />} tone="warning" />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
