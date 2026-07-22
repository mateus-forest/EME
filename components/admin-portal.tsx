"use client"

import { BarChart3, Bot, CreditCard, LayoutDashboard, MessageCircle, Sparkles, Users, Wand2 } from "lucide-react"

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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminPortal() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Admin EME" subtitle="Visao executiva da plataforma, operacao e crescimento">
      {isLoading && !insights ? <EmeLoading message="Carregando dashboards do Admin..." /> : null}

      {error ? (
        <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">
          {error}
        </div>
      ) : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Usuarios ativos hoje" value={String(insights.analytics.activeUsers)} hint="Base ativa usando portal, COS ou Studio IA." icon={<Users className="size-5" />} />
            <AdminMetricCard label="MRR atual" value={formatCurrency(insights.revenue.mrr)} hint="Receita recorrente mensal consolidada." icon={<CreditCard className="size-5" />} />
            <AdminMetricCard label="Consumo IA" value={`${insights.aiConsumption.totalCreditsConsumed} créditos`} hint="Uso agregado entre COS e Studio IA." icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Conversas no COS hoje" value={String(insights.cos.conversationsToday)} hint="Conversas abertas e continuadas no dia." icon={<MessageCircle className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <AdminSurface
              title="Resumo da plataforma"
              subtitle="Indicadores essenciais para acompanhar tracao, valor entregue e saude da operacao."
            >
              <AdminDefinitionGrid
                columns={4}
                items={[
                  { label: "Corretores", value: String(insights.brokers.total) },
                  { label: "Imoveis", value: String(insights.analytics.properties) },
                  { label: "Clientes", value: String(insights.analytics.clients) },
                  { label: "Propostas", value: String(insights.analytics.proposals) },
                  { label: "Studio IA", value: `${insights.analytics.studioIa} acoes` },
                  { label: "COS", value: `${insights.analytics.cos} comandos` },
                  { label: "Videos", value: String(insights.analytics.videos) },
                  { label: "Imagens", value: String(insights.analytics.images) },
                ]}
              />
            </AdminSurface>

            <AdminSurface
              title="Alertas imediatos"
              subtitle="Pontos que merecem acao de produto, suporte, receita ou integracao."
            >
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
            <AdminSurface title="Receita e crescimento" subtitle="Visao comercial para upgrades, inadimplencia e previsibilidade.">
              <AdminDefinitionGrid
                items={[
                  { label: "MRR", value: formatCurrency(insights.revenue.mrr) },
                  { label: "ARR", value: formatCurrency(insights.revenue.arr) },
                  { label: "Ticket medio", value: formatCurrency(insights.revenue.averageTicket) },
                  { label: "Inadimplencia", value: String(insights.revenue.delinquency) },
                  { label: "Crescimento", value: insights.revenue.growth == null ? "Sem base" : `${insights.revenue.growth}%` },
                  { label: "LTV", value: insights.revenue.ltv == null ? "Sem base" : formatCurrency(insights.revenue.ltv) },
                ]}
                columns={2}
              />
            </AdminSurface>

            <AdminSurface title="COS" subtitle="Uso operacional do assistente pelos corretores.">
              <AdminDefinitionGrid
                items={[
                  { label: "Conversas totais", value: String(insights.cos.conversationsTotal) },
                  { label: "Mensagens", value: String(insights.cos.messages) },
                  { label: "Buscas", value: String(insights.cos.propertySearches) },
                  { label: "Agendamentos", value: String(insights.cos.appointments) },
                  { label: "Clientes criados", value: String(insights.cos.clientsCreated) },
                  { label: "Creditos", value: String(insights.cos.creditsSpent) },
                ]}
                columns={2}
              />
            </AdminSurface>

            <AdminSurface title="Studio IA" subtitle="Uso criativo, geracao visual e potencial economizado.">
              <AdminDefinitionGrid
                items={[
                  { label: "Imagens", value: String(insights.studioIa.imagesCreated) },
                  { label: "Videos", value: String(insights.studioIa.videosCreated) },
                  { label: "Instagram", value: String(insights.studioIa.postsInstagram) },
                  { label: "Anuncios", value: String(insights.studioIa.anuncios) },
                  { label: "Creditos", value: String(insights.studioIa.creditsUsed) },
                  { label: "Economia", value: formatCurrency(insights.studioIa.estimatedSavings) },
                ]}
                columns={2}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AdminSurface title="Produtividade dos corretores" subtitle="Ranking vivo com base em imoveis, clientes, propostas e uso de IA.">
              <AdminKpiList rows={insights.brokers.topProductivity} />
            </AdminSurface>

            <AdminSurface title="Ultimas conversas do COS" subtitle="Contexto recente das conversas retomadas pelos corretores.">
              <AdminActivityFeed items={insights.cos.latestConversations} />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Uso do COS por dia" subtitle="Ultimos 7 dias" points={insights.cos.usageByDay} />
            <AdminMiniChart title="Studio IA por dia" subtitle="Ultimos 7 dias" points={insights.studioIa.generationByDay} />
            <AdminMiniChart title="Receita ativa por mes" subtitle="Serie consolidada" points={insights.revenue.monthlySeries} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <AdminSurface title="Assessor EME" subtitle="Status do canal oficial, execucoes recentes e resposta da operacao.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Status", value: insights.assessor.status },
                  { label: "Numero oficial", value: insights.assessor.officialNumber },
                  { label: "Sessoes", value: String(insights.assessor.sessions) },
                  { label: "Recebidas", value: String(insights.assessor.messagesReceived) },
                  { label: "Enviadas", value: String(insights.assessor.messagesSent) },
                  { label: "Comandos", value: String(insights.assessor.commandsExecuted) },
                  { label: "Falhas", value: String(insights.assessor.failures) },
                  { label: "Consumo IA", value: String(insights.assessor.aiConsumption) },
                  { label: "Tempo medio", value: insights.assessor.avgResponseMinutes == null ? "Sem base" : `${insights.assessor.avgResponseMinutes} min` },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Fluxo recente do Assessor" subtitle="Timeline operacional para suporte e acompanhamento.">
              <AdminActivityFeed items={insights.assessor.timeline} />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-4">
            <AdminMetricCard label="Dashboard" value="Pronto" hint="Painel administrativo unificado no padrão atual da EME." icon={<LayoutDashboard className="size-5" />} tone="success" />
            <AdminMetricCard label="Analytics" value={`${insights.analytics.engagement ?? 0}`} hint="Engajamento médio diário por usuário ativo." icon={<BarChart3 className="size-5" />} />
            <AdminMetricCard label="Studio IA" value={`${insights.studioIa.ranking.length} frentes`} hint="Funcionalidades mais usadas do conteúdo visual." icon={<Wand2 className="size-5" />} />
            <AdminMetricCard label="Assessor" value={insights.assessor.status} hint="Canal oficial preparado para operação comercial." icon={<Bot className="size-5" />} />
          </section>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
