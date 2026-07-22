"use client"

import { MessageCircle, QrCode, Smartphone, Sparkles } from "lucide-react"

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

export function AdminCorretorEmePage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Corretor EME" subtitle="Operacao de WhatsApp dos corretores, uso assistido e historico de atividade">
      {isLoading && !insights ? <EmeLoading message="Carregando Corretor EME..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Corretores conectados" value={String(insights.corretorEme.connectedBrokers)} icon={<Smartphone className="size-5" />} />
            <AdminMetricCard label="WhatsApps ativos" value={String(insights.corretorEme.activeWhatsApps)} icon={<MessageCircle className="size-5" />} />
            <AdminMetricCard label="Precisa QR Code" value={String(insights.corretorEme.needsQrCode)} icon={<QrCode className="size-5" />} tone="warning" />
            <AdminMetricCard label="Consumo IA" value={`${insights.corretorEme.creditsConsumed} créditos`} icon={<Sparkles className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Resumo da malha conectada" subtitle="Status geral do canal de cada corretor e do uso em campo.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Ultima sincronizacao", value: insights.corretorEme.lastSyncLabel },
                  { label: "Mensagens recebidas", value: String(insights.corretorEme.messagesReceived) },
                  { label: "Mensagens enviadas", value: String(insights.corretorEme.messagesSent) },
                  { label: "Leads gerados", value: String(insights.corretorEme.leadsGenerated) },
                  { label: "Clientes criados", value: String(insights.corretorEme.clientsCreated) },
                  { label: "Uso IA", value: String(insights.corretorEme.aiUsage) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Historico por corretor" subtitle="Quem mais movimenta o canal e consome IA na rotina.">
              <AdminKpiList rows={insights.corretorEme.brokerActivity} />
            </AdminSurface>
          </section>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
