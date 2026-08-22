"use client"

import { BarChart3, CreditCard, MessageCircle, Sparkles, TrendingUp, Users, Wand2 } from "lucide-react"

import {
  AdminActivityFeed,
  AdminDefinitionGrid,
  AdminKpiList,
  AdminMetricCard,
  AdminMetricGrid,
  AdminMiniChart,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { Button } from "@/components/ui/button"
import { EmeLoading } from "@/components/ui/eme-loading"

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminPortal() {
  const { insights, isLoading, error, refresh } = useAdminInsights()

  return (
    <AdminPageShell title="Admin EME" subtitle="Visão consolidada da base, do Studio IA e da operação comercial ativa">
      {isLoading && !insights ? <EmeLoading message="Carregando dashboards do Admin..." /> : null}

      {error ? (
        <div className="mb-5 flex flex-col gap-3 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318] sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => void refresh()} className="shrink-0 border-[#e9bcbc] bg-white text-[#9f241c] hover:bg-[#fff8f8]">
            {isLoading ? "Consultando..." : "Tentar novamente"}
          </Button>
        </div>
      ) : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard
              label="Usuários ativos hoje"
              value={String(insights.analytics.activeUsers)}
              hint="Contas com atividade operacional recente no portal."
              icon={<Users className="size-5" />}
            />
            <AdminMetricCard
              label="MRR atual"
              value={formatCurrency(insights.revenue.mrr)}
              hint="Receita recorrente consolidada dos planos pagos."
              icon={<CreditCard className="size-5" />}
            />
            <AdminMetricCard
              label="Créditos IA consumidos"
              value={String(insights.aiConsumption.totalCreditsConsumed)}
              hint="Consumo agregado entre COS, imóveis e Studio IA."
              icon={<Sparkles className="size-5" />}
            />
            <AdminMetricCard
              label="Campanhas do Studio IA"
              value={String(insights.studioIa.campaigns)}
              hint="Campanhas criadas com dados reais da base."
              icon={<Wand2 className="size-5" />}
            />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <AdminSurface title="Resumo da plataforma" subtitle="Leitura executiva da operação atual do EME.">
              <AdminDefinitionGrid
                columns={4}
                items={[
                  { label: "Usuários", value: String(insights.users.total) },
                  { label: "Planos pagos", value: String(insights.revenue.paidUsers) },
                  { label: "Imóveis ativos", value: String(insights.analytics.properties) },
                  { label: "Clientes", value: String(insights.analytics.clients) },
                  { label: "Propostas", value: String(insights.analytics.proposals) },
                  { label: "Conversas COS", value: String(insights.cos.conversationsTotal) },
                  { label: "Assets Studio IA", value: String(insights.studioIa.libraryAssets) },
                  { label: "OpenAI", value: formatCurrency(insights.aiConsumption.openAiCost) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Alertas imediatos" subtitle="Sinais reais que merecem acompanhamento agora.">
              <AdminActivityFeed
                items={insights.alerts.items.slice(0, 4).map((item) => ({
                  id: item.id,
                  title: item.title,
                  detail: item.description,
                  timestamp: "Atualizado agora",
                  tone: item.severity === "high" ? "danger" : item.severity === "medium" ? "warning" : "success",
                }))}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminSurface title="Receita" subtitle="Plano, ticket médio e recorrência efetiva.">
              <AdminDefinitionGrid
                columns={2}
                items={[
                  { label: "MRR", value: formatCurrency(insights.revenue.mrr) },
                  { label: "Receita anual", value: formatCurrency(insights.revenue.annualRevenue) },
                  { label: "Ticket médio", value: formatCurrency(insights.revenue.averageTicket) },
                  { label: "Usuários pagantes", value: String(insights.revenue.paidUsers) },
                  { label: "Inadimplência", value: String(insights.revenue.delinquency) },
                  { label: "Cancelamentos", value: String(insights.revenue.cancellations) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="COS" subtitle="Adoção operacional do sistema conversacional.">
              <AdminDefinitionGrid
                columns={2}
                items={[
                  { label: "Conversas hoje", value: String(insights.cos.conversationsToday) },
                  { label: "Comandos", value: String(insights.cos.commandsExecuted) },
                  { label: "Buscas", value: String(insights.cos.propertySearches) },
                  { label: "Clientes criados", value: String(insights.cos.clientsCreated) },
                  { label: "Imóveis criados", value: String(insights.cos.propertiesCreated) },
                  { label: "Créditos", value: String(insights.cos.creditsSpent) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Studio IA" subtitle="Volume criativo e biblioteca em produção.">
              <AdminDefinitionGrid
                columns={2}
                items={[
                  { label: "Campanhas", value: String(insights.studioIa.campaigns) },
                  { label: "Biblioteca", value: String(insights.studioIa.libraryItems) },
                  { label: "Posts", value: String(insights.studioIa.postsCreated) },
                  { label: "Stories", value: String(insights.studioIa.storiesCreated) },
                  { label: "Vídeos", value: String(insights.studioIa.videosCreated) },
                  { label: "Créditos", value: String(insights.studioIa.creditsUsed) },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AdminSurface title="Usuários com maior produtividade" subtitle="Baseado em imóveis, clientes, documentos e uso de IA.">
              <AdminKpiList rows={insights.brokers.topProductivity} />
            </AdminSurface>

            <AdminSurface title="Últimas conversas do COS" subtitle="Retomadas recentes registradas na operação.">
              <AdminActivityFeed items={insights.cos.latestConversations} />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="COS por dia" subtitle="Últimos 7 dias" points={insights.cos.usageByDay} />
            <AdminMiniChart title="Studio IA por dia" subtitle="Últimos 7 dias" points={insights.studioIa.generationByDay} />
            <AdminMiniChart title="Receita ativa por mês" subtitle="Série consolidada" points={insights.revenue.monthlySeries} />
          </section>

          <section className="grid gap-5 xl:grid-cols-4">
            <AdminMetricCard
              label="Retenção"
              value={insights.analytics.retention == null ? "Sem base" : `${insights.analytics.retention}%`}
              hint="Participação da base paga sobre a carteira total."
              icon={<TrendingUp className="size-5" />}
              tone="success"
            />
            <AdminMetricCard
              label="Operações IA"
              value={String(insights.aiConsumption.totalOperations)}
              hint="Execuções registradas com telemetria."
              icon={<BarChart3 className="size-5" />}
            />
            <AdminMetricCard
              label="Créditos disponíveis"
              value={String(insights.aiConsumption.currentBalance)}
              hint="Saldo agregado ainda disponível na base."
              icon={<Sparkles className="size-5" />}
            />
            <AdminMetricCard
              label="Conversas COS hoje"
              value={String(insights.cos.conversationsToday)}
              hint="Conversas abertas ou retomadas no dia."
              icon={<MessageCircle className="size-5" />}
            />
          </section>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
