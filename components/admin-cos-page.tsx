"use client"

import { Clock3, MessagesSquare, Search, Sparkles, UserRound } from "lucide-react"

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
import { EmeLoading } from "@/components/ui/eme-loading"

export function AdminCosPage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="COS" subtitle="Dashboard vivo do assistente conversacional e da operacao apoiada por IA">
      {isLoading && !insights ? <EmeLoading message="Carregando dashboard do COS..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Conversas hoje" value={String(insights.cos.conversationsToday)} icon={<MessagesSquare className="size-5" />} />
            <AdminMetricCard label="Mensagens" value={String(insights.cos.messages)} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Buscas de imoveis" value={String(insights.cos.propertySearches)} icon={<Search className="size-5" />} />
            <AdminMetricCard label="Tempo medio" value={insights.cos.avgResponseMinutes == null ? "Sem base" : `${insights.cos.avgResponseMinutes} min`} icon={<Clock3 className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Resumo do COS" subtitle="Conversas, comandos e entregas operacionais geradas pelo assistente.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Conversas totais", value: String(insights.cos.conversationsTotal) },
                  { label: "Comandos", value: String(insights.cos.commandsExecuted) },
                  { label: "Clientes criados", value: String(insights.cos.clientsCreated) },
                  { label: "Imoveis criados", value: String(insights.cos.propertiesCreated) },
                  { label: "Propostas criadas", value: String(insights.cos.proposalsCreated) },
                  { label: "Agendamentos", value: String(insights.cos.appointments) },
                  { label: "Consumo IA", value: String(insights.cos.aiConsumption) },
                  { label: "Creditos gastos", value: String(insights.cos.creditsSpent) },
                  { label: "Satisfacao", value: insights.cos.satisfaction || "Sem coleta ainda" },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Ranking de corretores" subtitle="Quem mais usa o COS como motor da operacao comercial.">
              <AdminKpiList rows={insights.cos.ranking} />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Uso por dia" subtitle="Interacoes nos ultimos 7 dias." points={insights.cos.usageByDay} />
            <AdminMiniChart title="Uso por horario" subtitle="Volume por faixa do dia." points={insights.cos.usageByHour} />
            <AdminMiniChart
              title="Uso por corretor"
              subtitle="Top corretores mais ativos."
              points={insights.cos.usageByBroker.map((row) => ({ label: row.label.split(" ")[0] || row.label, value: row.value }))}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AdminSurface title="Ultimas conversas" subtitle="As retomadas mais recentes do COS.">
              <AdminActivityFeed items={insights.cos.latestConversations} />
            </AdminSurface>

            <AdminSurface title="Uso por corretor" subtitle="Leitura rapida de profundidade de uso por corretor.">
              <AdminKpiList rows={insights.cos.usageByBroker} />
            </AdminSurface>
          </section>

          <AdminMetricGrid>
            <AdminMetricCard label="Corretores engajados" value={String(insights.cos.ranking.length)} icon={<UserRound className="size-5" />} />
            <AdminMetricCard label="Producao" value={`${insights.cos.clientsCreated + insights.cos.propertiesCreated + insights.cos.proposalsCreated}`} icon={<MessagesSquare className="size-5" />} tone="success" />
            <AdminMetricCard label="Assistente" value={`${insights.cos.aiConsumption} créditos`} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Busca inteligente" value={`${insights.cos.propertySearches} consultas`} icon={<Search className="size-5" />} />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
