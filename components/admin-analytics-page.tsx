"use client"

import { BarChart3, Building2, MessageCircle, Sparkles, UserRound } from "lucide-react"

import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import { AdminPageShell } from "@/components/admin-page-shell"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useAdminBrokers } from "@/components/use-admin-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AdminAnalyticsPage() {
  const [brokers] = useAdminBrokers()
  const totalProperties = brokers.reduce((sum, broker) => sum + broker.activeProperties, 0)
  const totalLeads = brokers.reduce((sum, broker) => sum + broker.leads, 0)
  const totalCredits = brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0)
  const activeBrokers = brokers.filter((broker) => broker.status === "Ativo").length
  const hasData = brokers.length > 0

  return (
    <AdminPageShell title="Analytics" subtitle="Indicadores gerais de uso e desempenho da plataforma">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Corretores" value={String(brokers.length)} icon={UserRound} />
          <Metric label="Imóveis ativos" value={String(totalProperties)} icon={Building2} />
          <Metric label="Leads registrados" value={String(totalLeads)} icon={MessageCircle} />
          <Metric label="Créditos IA usados" value={String(totalCredits)} icon={Sparkles} />
        </section>

        <ResponsiveCollapsibleSection title="Analytics" defaultMobileOpen>
          {hasData ? (
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#111111]">Resumo operacional</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0 md:grid-cols-3">
                <InfoBlock label="Corretores ativos" value={String(activeBrokers)} />
                <InfoBlock label="Corretores em avaliação" value={String(brokers.filter((broker) => broker.plan === "Sem plano").length)} />
                <InfoBlock
                  label="Corretor EME em preparação"
                  value={String(brokers.filter((broker) => broker.corretorEmeStatus === "Em preparação").length)}
                />
              </CardContent>
            </Card>
          ) : (
            <AdminEmptyState
              icon={BarChart3}
              title="Analytics pronto para consolidar"
              description="Assim que houver corretores, imóveis, leads e uso de IA, os indicadores consolidados aparecerão aqui."
            >
              <AdminStructureCards items={["Cards de uso da plataforma", "Indicadores de leads e catálogo", "Consumo IA consolidado"]} />
            </AdminEmptyState>
          )}
        </ResponsiveCollapsibleSection>
      </div>
    </AdminPageShell>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
  return (
    <Card className="rounded-[1.5rem] border-black/[0.06] bg-white py-0 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
      <CardContent className="p-4">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
          <Icon className="size-5" />
        </div>
        <p className="mt-4 text-sm text-[#6B7280]">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-[#111111]">{value}</p>
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[#111111]">{value}</p>
    </div>
  )
}
