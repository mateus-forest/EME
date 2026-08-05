"use client"

import { BarChart3, Coins, DollarSign, Sparkles, Users, Wallet } from "lucide-react"

import {
  AdminDefinitionGrid,
  AdminKpiList,
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminAiConsumptionPage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Consumo IA" subtitle="Leitura clara de créditos, operações, custo OpenAI e média real por uso">
      {isLoading && !insights ? <EmeLoading message="Carregando consumo de IA..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Créditos consumidos" value={String(insights.aiConsumption.totalCreditsConsumed)} icon={<Coins className="size-5" />} />
            <AdminMetricCard label="Operações IA" value={String(insights.aiConsumption.totalOperations)} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Custo OpenAI" value={formatBRL(insights.aiConsumption.openAiCost)} icon={<DollarSign className="size-5" />} />
            <AdminMetricCard label="Usuários ativos" value={String(insights.aiConsumption.activeUsers)} icon={<Users className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Resumo de consumo" subtitle="Métricas principais para entender custo e profundidade de uso.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Créditos disponíveis", value: String(insights.aiConsumption.currentBalance) },
                  { label: "Custo total estimado", value: formatBRL(insights.aiConsumption.estimatedCost) },
                  { label: "Média por usuário", value: `${insights.aiConsumption.averagePerUser} créditos` },
                  { label: "Média por operação", value: `${insights.aiConsumption.averagePerOperation} créditos` },
                  { label: "Custo por usuário", value: formatBRL(insights.aiConsumption.averageCostPerUser) },
                  { label: "Custo por operação", value: formatBRL(insights.aiConsumption.averageCostPerOperation) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Leitura financeira" subtitle="Indicadores para acompanhar margem e intensidade de uso.">
              <AdminDefinitionGrid
                items={[
                  { label: "Saldo agregado", value: `${insights.aiConsumption.currentBalance} créditos` },
                  { label: "Adoção ativa", value: `${insights.aiConsumption.activeUsers} usuários` },
                  { label: "Studio IA", value: `${insights.studioIa.creditsUsed} créditos` },
                  { label: "COS", value: `${insights.cos.creditsSpent} créditos` },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AdminSurface title="Consumo por frente" subtitle="Distribuição real entre módulos e tipos de operação.">
              <AdminKpiList rows={insights.aiConsumption.byResource} />
            </AdminSurface>

            <AdminSurface title="Impacto na base" subtitle="Saldo e custo já refletidos na arquitetura atual.">
              <AdminDefinitionGrid
                items={[
                  { label: "MRR", value: formatBRL(insights.revenue.mrr) },
                  { label: "Ticket médio", value: formatBRL(insights.revenue.averageTicket) },
                  { label: "Custo OpenAI", value: formatBRL(insights.aiConsumption.openAiCost) },
                  { label: "Operações", value: String(insights.aiConsumption.totalOperations) },
                ]}
              />
            </AdminSurface>
          </section>

          <AdminMetricGrid>
            <AdminMetricCard label="Saldo" value={`${insights.aiConsumption.currentBalance} créditos`} icon={<Wallet className="size-5" />} />
            <AdminMetricCard label="OpenAI" value={formatBRL(insights.aiConsumption.openAiCost)} icon={<DollarSign className="size-5" />} />
            <AdminMetricCard label="Operações" value={`${insights.aiConsumption.totalOperations}`} icon={<BarChart3 className="size-5" />} />
            <AdminMetricCard label="Base ativa" value={`${insights.aiConsumption.activeUsers} usuários`} icon={<Users className="size-5" />} />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
