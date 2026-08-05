"use client"

import { AlertTriangle, MessageSquareWarning, Sparkles, Users } from "lucide-react"

import { AdminAlertsList, AdminMetricCard, AdminMetricGrid, AdminSurface } from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

export function AdminAlertsPage() {
  const { insights, isLoading, error } = useAdminInsights()

  const highSeverity = insights?.alerts.items.filter((item) => item.severity === "high").length ?? 0
  const studioAlerts = insights?.alerts.items.filter((item) => item.title.toLowerCase().includes("studio")).length ?? 0
  const userAlerts = insights?.alerts.items.filter((item) => item.title.toLowerCase().includes("usu")).length ?? 0

  return (
    <AdminPageShell title="Alertas" subtitle="Central de alertas reais da operação, sem dependências legadas">
      {isLoading && !insights ? <EmeLoading message="Carregando alertas..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Alertas ativos" value={String(insights.alerts.items.length)} icon={<AlertTriangle className="size-5" />} tone="warning" />
            <AdminMetricCard label="Alta prioridade" value={String(highSeverity)} icon={<MessageSquareWarning className="size-5" />} tone="warning" />
            <AdminMetricCard label="Studio IA" value={String(studioAlerts)} icon={<Sparkles className="size-5" />} tone="warning" />
            <AdminMetricCard label="Usuários" value={String(userAlerts)} icon={<Users className="size-5" />} tone="warning" />
          </AdminMetricGrid>

          <AdminSurface title="Central de alertas" subtitle="Somente sinais reais da base atual do EME.">
            <AdminAlertsList items={insights.alerts.items} />
          </AdminSurface>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
