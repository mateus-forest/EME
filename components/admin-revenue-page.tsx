"use client"

import { CreditCard, DollarSign, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react"

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
    <AdminPageShell title="Receita" subtitle="MRR, ticket médio e receita recorrente com base na arquitetura comercial atual">
      {isLoading && !insights ? <EmeLoading message="Carregando receita..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="MRR" value={formatCurrency(insights.revenue.mrr)} icon={<Wallet className="size-5" />} />
            <AdminMetricCard label="Receita anual" value={formatCurrency(insights.revenue.annualRevenue)} icon={<DollarSign className="size-5" />} />
            <AdminMetricCard label="Ticket médio" value={formatCurrency(insights.revenue.averageTicket)} icon={<CreditCard className="size-5" />} />
            <AdminMetricCard label="Usuários pagantes" value={String(insights.revenue.paidUsers)} icon={<Users className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Painel financeiro" subtitle="Indicadores reais de receita e risco da base.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "MRR", value: formatCurrency(insights.revenue.mrr) },
                  { label: "Receita mensal", value: formatCurrency(insights.revenue.monthlyRevenue) },
                  { label: "Receita anual", value: formatCurrency(insights.revenue.annualRevenue) },
                  { label: "Ticket médio", value: formatCurrency(insights.revenue.averageTicket) },
                  { label: "Pagantes", value: String(insights.revenue.paidUsers) },
                  { label: "Inadimplência", value: String(insights.revenue.delinquency) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Leitura executiva" subtitle="Contexto comercial limpo, sem cards ou métricas antigas.">
              <AdminDefinitionGrid
                items={[
                  { label: "Crescimento", value: insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%` },
                  { label: "Cancelamentos", value: String(insights.revenue.cancellations) },
                  { label: "LTV", value: formatCurrency(insights.revenue.ltv) },
                  { label: "Atualização", value: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(insights.generatedAt)) },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Receita ativa por mês" subtitle="Base recorrente observada" points={insights.revenue.monthlySeries} />
            <AdminMetricCard label="Crescimento" value={insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%`} icon={<TrendingUp className="size-5" />} tone="success" />
            <AdminMetricCard label="Risco de inadimplência" value={String(insights.revenue.delinquency)} icon={<TrendingDown className="size-5" />} tone="warning" />
          </section>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
