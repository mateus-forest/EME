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
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#111111]">Custo por corretor</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                {brokers.map((broker) => (
                  <div
                    key={broker.id}
                    className="flex flex-col gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-[#111111]">{broker.name}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">{broker.aiCreditsUsedThisMonth} créditos usados no mês</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs text-[#5F6B7A]">
                        {formatBRL(broker.aiCreditsUsedThisMonth * ESTIMATED_COST_PER_CREDIT)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedBroker(broker)}
                        className="h-8 rounded-xl border border-black/[0.06] bg-white px-3 text-xs text-[#4B5563] hover:bg-white hover:text-[#111111]"
                      >
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
        <DialogContent className="max-w-lg border-black/[0.06] bg-white text-[#111111]">
          {selectedBroker ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBroker.name}</DialogTitle>
                <DialogDescription className="text-[#6B7280]">Detalhes do custo estimado de IA por corretor.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
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
    <Card className="rounded-[1.5rem] border-black/[0.06] bg-white py-0 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-[#6B7280]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[#111111]">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[#98A2B3]">{label}</p>
      <p className="mt-2 text-sm text-[#111111]">{value}</p>
    </div>
  )
}
