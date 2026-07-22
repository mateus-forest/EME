"use client"

import { Bot, MessageCircle, Phone, TimerReset, TriangleAlert } from "lucide-react"

import {
  AdminActivityFeed,
  AdminDefinitionGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

export function AdminAssessorEmePage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Assessor EME" subtitle="Central operacional do canal oficial do EME com o corretor">
      {isLoading && !insights ? <EmeLoading message="Carregando Assessor EME..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Status da integracao" value={insights.assessor.status} icon={<Bot className="size-5" />} />
            <AdminMetricCard label="Mensagens recebidas" value={String(insights.assessor.messagesReceived)} icon={<MessageCircle className="size-5" />} />
            <AdminMetricCard label="Comandos executados" value={String(insights.assessor.commandsExecuted)} icon={<Phone className="size-5" />} />
            <AdminMetricCard
              label="Tempo medio de resposta"
              value={insights.assessor.avgResponseMinutes == null ? "Sem base" : `${insights.assessor.avgResponseMinutes} min`}
              icon={<TimerReset className="size-5" />}
            />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Visao operacional" subtitle="Status atual, numero oficial e produtividade do canal.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Numero oficial", value: insights.assessor.officialNumber },
                  { label: "Sessoes", value: String(insights.assessor.sessions) },
                  { label: "Mensagens enviadas", value: String(insights.assessor.messagesSent) },
                  { label: "Cadastros de clientes", value: String(insights.assessor.createdClients) },
                  { label: "Imoveis criados", value: String(insights.assessor.createdProperties) },
                  { label: "Consumo IA", value: String(insights.assessor.aiConsumption) },
                  { label: "Falhas", value: String(insights.assessor.failures) },
                  { label: "Webhook", value: insights.assessor.status === "Ativo" ? "Pronto para operacao" : "Acompanhar configuracao" },
                  { label: "Data de leitura", value: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(insights.generatedAt)) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Pontos de atencao" subtitle="O que precisa ser acompanhado para manter o canal confiavel.">
              <AdminDefinitionGrid
                items={[
                  { label: "Falhas recentes", value: String(insights.assessor.failures) },
                  { label: "Mensagens recebidas", value: String(insights.assessor.messagesReceived) },
                  { label: "Mensagens enviadas", value: String(insights.assessor.messagesSent) },
                  { label: "Saude operacional", value: insights.assessor.failures > 0 ? "Revisar ocorrencias" : "Sem falhas criticas" },
                ]}
              />
            </AdminSurface>
          </section>

          <AdminSurface title="Timeline das ultimas operacoes" subtitle="Fluxo recente do canal oficial para suporte, produto e operacao.">
            <AdminActivityFeed items={insights.assessor.timeline} />
          </AdminSurface>

          <AdminMetricGrid>
            <AdminMetricCard label="Numero oficial" value={insights.assessor.officialNumber === "Não configurado" ? "Pendente" : "Ativo"} icon={<Phone className="size-5" />} tone="warning" />
            <AdminMetricCard label="Canal" value={insights.assessor.status} icon={<Bot className="size-5" />} tone="success" />
            <AdminMetricCard label="Risco" value={insights.assessor.failures > 0 ? "Atenção" : "Controlado"} icon={<TriangleAlert className="size-5" />} tone="warning" />
            <AdminMetricCard label="Assistente" value={`${insights.assessor.aiConsumption} créditos`} icon={<MessageCircle className="size-5" />} />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
