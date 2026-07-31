"use client"

import { CreditCard, DollarSign, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import {
  AdminDefinitionGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminMiniChart,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

function formatCurrency(value: number | null) {
  if (value == null) return "Sem base"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminRevenuePage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Receita" subtitle="Dashboard financeiro do Admin com recorrência, crescimento e risco">
      {isLoading && !insights ? <EmeLoading message="Carregando receita..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="MRR" value={formatCurrency(insights.revenue.mrr)} icon={<Wallet className="size-5" />} />
            <AdminMetricCard label="ARR" value={formatCurrency(insights.revenue.arr)} icon={<DollarSign className="size-5" />} />
            <AdminMetricCard label="Ticket médio" value={formatCurrency(insights.revenue.averageTicket)} icon={<CreditCard className="size-5" />} />
            <AdminMetricCard label="Inadimplência" value={String(insights.revenue.delinquency)} icon={<TrendingDown className="size-5" />} tone="warning" />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Painel financeiro" subtitle="Receita atual, risco e movimentos comerciais do ciclo de planos.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Receita mensal", value: formatCurrency(insights.revenue.monthlyRevenue) },
                  { label: "Receita anual", value: formatCurrency(insights.revenue.annualRevenue) },
                  { label: "Crescimento", value: insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%` },
                  { label: "Upgrades", value: String(insights.revenue.upgrades) },
                  { label: "Downgrades", value: String(insights.revenue.downgrades) },
                  { label: "Cancelamentos", value: String(insights.revenue.cancellations) },
                  { label: "LTV", value: formatCurrency(insights.revenue.ltv) },
                  { label: "Inadimplência", value: String(insights.revenue.delinquency) },
                  { label: "Atualizado em", value: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(insights.generatedAt)) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Leitura executiva" subtitle="Interprete o momento da receita com clareza comercial.">
              <AdminDefinitionGrid
                items={[
                  { label: "Plano atual", value: insights.revenue.mrr > 0 ? "Base recorrente ativa" : "Sem receita recorrente" },
                  { label: "Risco", value: insights.revenue.delinquency > 0 ? "Cobrar e recuperar" : "Controlado" },
                  { label: "Expansão", value: insights.revenue.upgrades > 0 ? "Há sinais de upgrade" : "Acompanhar contas com potencial" },
                  { label: "Retenção", value: insights.analytics.retention == null ? "Sem base" : `${insights.analytics.retention}%` },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Receita ativa por mês" subtitle="Base mensal observada." points={insights.revenue.monthlySeries} />
            <AdminMetricCard label="Crescimento" value={insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%`} icon={<TrendingUp className="size-5" />} tone="success" />
            <AdminMetricCard label="Movimento comercial" value={`${insights.revenue.upgrades + insights.revenue.downgrades} mudanças`} icon={<RefreshCw className="size-5" />} />
          </section>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
