"use client"

import { Gift, History, Megaphone, PlusCircle, Sparkles, TicketPercent } from "lucide-react"

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

export function AdminBonusesPage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Bonificacoes" subtitle="Administre creditos promocionais, campanhas e ajustes manuais com historico completo">
      {isLoading && !insights ? <EmeLoading message="Carregando bonificacoes..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? <div className="grid gap-5">
        <AdminMetricGrid>
          <AdminMetricCard label="Bonificacoes totais" value={String(insights.bonuses.totalBonuses)} icon={<Gift className="size-5" />} />
          <AdminMetricCard label="Ultimos 30 dias" value={String(insights.bonuses.last30Days)} icon={<History className="size-5" />} />
          <AdminMetricCard label="Campanhas promocionais" value={String(insights.bonuses.campaigns)} icon={<Megaphone className="size-5" />} />
          <AdminMetricCard label="Creditos manuais" value={String(insights.bonuses.manual)} icon={<Sparkles className="size-5" />} />
        </AdminMetricGrid>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <AdminSurface title="Resumo de campanhas" subtitle="Como as bonificacoes estao sendo distribuídas na operacao.">
            <AdminDefinitionGrid
              columns={3}
              items={[
                { label: "Promocionais", value: String(insights.bonuses.campaigns) },
                { label: "Indicacao", value: String(insights.bonuses.indications) },
                { label: "Assinatura", value: String(insights.bonuses.subscriptions) },
                { label: "Manuais", value: String(insights.bonuses.manual) },
                { label: "Historico", value: `${insights.bonuses.totalBonuses} registros` },
                { label: "Modelo", value: "Persistencia real na carteira" },
              ]}
            />
          </AdminSurface>

          <AdminSurface title="Operacoes cobertas" subtitle="Frentes de bonificacao prontas para uso administrativo.">
            <AdminDefinitionGrid
              items={[
                { label: "Usuario individual", value: "Bonificar usuario especifico com confirmação" },
                { label: "Todos os corretores", value: "Campanhas promocionais em lote" },
                { label: "Por indicacao", value: "Acompanhar entradas vinculadas a indicação" },
                { label: "Por assinatura", value: "Créditos de ativação, upgrade e retenção" },
              ]}
            />
          </AdminSurface>
        </section>

        <AdminSurface title="Historico recente" subtitle="Ultimas bonificacoes registradas no banco com contexto operacional.">
          <AdminActivityFeed items={insights.bonuses.history} />
        </AdminSurface>

        <AdminMetricGrid>
          <AdminMetricCard label="Promocao" value={`${insights.bonuses.campaigns}`} icon={<TicketPercent className="size-5" />} tone="success" />
          <AdminMetricCard label="Assinatura" value={`${insights.bonuses.subscriptions}`} icon={<PlusCircle className="size-5" />} />
          <AdminMetricCard label="Manual" value={`${insights.bonuses.manual}`} icon={<Sparkles className="size-5" />} />
          <AdminMetricCard label="Historico" value={`${insights.bonuses.totalBonuses}`} icon={<History className="size-5" />} />
        </AdminMetricGrid>
      </div> : null}
    </AdminPageShell>
  )
}
