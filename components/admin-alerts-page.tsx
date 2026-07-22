"use client"

import { AlertTriangle, MessageSquareWarning, PlugZap, Sparkles } from "lucide-react"

import { AdminAlertsList, AdminMetricCard, AdminMetricGrid, AdminSurface } from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

export function AdminAlertsPage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Alertas" subtitle="Pontos de atencao reais da plataforma e da operacao administrativa">
      {isLoading && !insights ? <EmeLoading message="Carregando alertas..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Alertas ativos" value={String(insights.alerts.items.length)} icon={<AlertTriangle className="size-5" />} tone="warning" />
            <AdminMetricCard label="Erros do COS" value={String(insights.assessor.failures)} icon={<MessageSquareWarning className="size-5" />} tone="warning" />
            <AdminMetricCard label="Falhas de Studio IA" value={String(insights.alerts.items.filter((item) => item.title.toLowerCase().includes("studio")).length)} icon={<Sparkles className="size-5" />} tone="warning" />
            <AdminMetricCard label="Integracoes offline" value={String(insights.alerts.items.filter((item) => item.title.toLowerCase().includes("integra")).length)} icon={<PlugZap className="size-5" />} tone="warning" />
          </AdminMetricGrid>

          <AdminSurface title="Central de alertas" subtitle="Priorize o que impacta suporte, receita, IA e conectividade.">
            <AdminAlertsList items={insights.alerts.items} />
          </AdminSurface>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
