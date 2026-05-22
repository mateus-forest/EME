"use client"

import { useMemo, useState } from "react"
import { Calculator, Eye, Receipt, UserRound } from "lucide-react"

import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import { AdminPageShell } from "@/components/admin-page-shell"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useAdminBrokers, type AdminBrokerRecord } from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ESTIMATED_COST_PER_CREDIT = 0.08

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminCostsPage() {
  const [brokers] = useAdminBrokers()
  const [selectedBroker, setSelectedBroker] = useState<AdminBrokerRecord | null>(null)
  const summary = useMemo(() => {
    const usedCredits = brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0)
    const activeUsers = brokers.filter((broker) => broker.aiCreditsUsedThisMonth > 0).length
    const totalCost = usedCredits * ESTIMATED_COST_PER_CREDIT

    return {
      totalCost,
      activeUsers,
      averageUserCost: activeUsers > 0 ? totalCost / activeUsers : 0,
      averageActionCost: usedCredits > 0 ? totalCost / usedCredits : 0,
    }
  }, [brokers])
  const hasCosts = summary.totalCost > 0

  return (
    <AdminPageShell title="Custos" subtitle="Estimativas operacionais de IA e créditos">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Custo estimado de IA" value={formatBRL(summary.totalCost)} icon={Receipt} />
          <Metric label="Custo mensal estimado" value={formatBRL(summary.totalCost)} icon={Calculator} />
          <Metric label="Custo médio por usuário" value={formatBRL(summary.averageUserCost)} icon={UserRound} />
          <Metric label="Custo médio por ação" value={formatBRL(summary.averageActionCost)} icon={Calculator} />
        </section>

        <ResponsiveCollapsibleSection title="Custos" defaultMobileOpen>
        {hasCosts ? (
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Custo por corretor</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {brokers.map((broker) => (
                <div key={broker.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-white">{broker.name}</p>
                    <p className="mt-1 text-sm text-white/50">{broker.aiCreditsUsedThisMonth} créditos usados no mês</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/65">
                      {formatBRL(broker.aiCreditsUsedThisMonth * ESTIMATED_COST_PER_CREDIT)}
                    </span>
                    <Button type="button" variant="ghost" onClick={() => setSelectedBroker(broker)} className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white">
                      <Eye className="size-3.5" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <AdminEmptyState
            icon={Receipt}
            title="Custos prontos para acompanhamento"
            description="Ainda não há consumo de IA suficiente para calcular custos reais. A estrutura fica pronta para custo estimado, custo por corretor e média por ação."
          >
            <AdminStructureCards items={["Custo estimado de IA", "Custo por usuário/corretor", "Custo médio por atendimento ou ação"]} />
          </AdminEmptyState>
        )}
        </ResponsiveCollapsibleSection>
      </div>

      <Dialog open={Boolean(selectedBroker)} onOpenChange={(open) => !open && setSelectedBroker(null)}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-[#111111] text-white">
          {selectedBroker ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBroker.name}</DialogTitle>
                <DialogDescription className="text-white/55">Detalhes do custo estimado de IA por corretor.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <Info label="Créditos usados no mês" value={String(selectedBroker.aiCreditsUsedThisMonth)} />
                <Info label="Custo estimado" value={formatBRL(selectedBroker.aiCreditsUsedThisMonth * ESTIMATED_COST_PER_CREDIT)} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Receipt }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-sm text-white/78">{value}</p>
    </div>
  )
}
