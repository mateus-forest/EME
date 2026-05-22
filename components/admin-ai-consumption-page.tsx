"use client"

import { useMemo, useState } from "react"
import { Bot, CreditCard, Eye, Sparkles, UserRound } from "lucide-react"

import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminBrokers, type AdminBrokerRecord } from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ESTIMATED_COST_PER_CREDIT = 0.08

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminAiConsumptionPage() {
  const [brokers] = useAdminBrokers()
  const [selectedBroker, setSelectedBroker] = useState<AdminBrokerRecord | null>(null)
  const [creditAmount, setCreditAmount] = useState(10)
  const [creditReason, setCreditReason] = useState("Bonificação para testes reais")
  const [feedback, setFeedback] = useState("")
  const summary = useMemo(
    () => ({
      balance: brokers.reduce((sum, broker) => sum + broker.aiCreditsBalance, 0),
      used: brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0),
      estimatedCost: brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0) * ESTIMATED_COST_PER_CREDIT,
      users: brokers.filter((broker) => broker.aiCreditsUsedThisMonth > 0).length,
    }),
    [brokers],
  )
  const hasUsage = summary.used > 0 || summary.balance > 0

  return (
    <AdminPageShell title="Consumo IA" subtitle="Créditos e uso do Assessor EME por corretor">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Créditos usados no mês" value={String(summary.used)} icon={Sparkles} />
          <Metric label="Créditos disponíveis" value={String(summary.balance)} icon={CreditCard} />
          <Metric label="Corretores com uso" value={String(summary.users)} icon={UserRound} />
          <Metric label="Custo estimado" value={formatBRL(summary.estimatedCost)} icon={Bot} />
        </section>

        {hasUsage ? (
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Consumo por corretor</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {brokers.map((broker) => (
                <div key={broker.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-white">{broker.name}</p>
                    <p className="mt-1 text-sm text-white/50">{broker.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={`${broker.aiCreditsBalance} disponíveis`} />
                    <Badge label={`${broker.aiCreditsUsedThisMonth} usados no mês`} />
                    <Badge label={formatBRL(broker.aiCreditsUsedThisMonth * ESTIMATED_COST_PER_CREDIT)} />
                    <Button type="button" variant="ghost" onClick={() => {
                      setSelectedBroker(broker)
                      setFeedback("")
                    }} className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white">
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
            icon={Bot}
            title="Consumo IA pronto para acompanhar"
            description="Quando corretores usarem o Assessor EME, os créditos consumidos, saldos e custos estimados aparecerão nesta área."
          >
            <AdminStructureCards items={["Consumo total de créditos IA", "Consumo por corretor", "Histórico simples de uso"]} />
          </AdminEmptyState>
        )}
      </div>

      <Dialog open={Boolean(selectedBroker)} onOpenChange={(open) => !open && setSelectedBroker(null)}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-[#111111] text-white">
          {selectedBroker ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBroker.name}</DialogTitle>
                <DialogDescription className="text-white/55">Detalhes de créditos IA disponíveis e usados no mês.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2">
                <Info label="Créditos disponíveis" value={String(selectedBroker.aiCreditsBalance)} />
                <Info label="Usados no mês" value={String(selectedBroker.aiCreditsUsedThisMonth)} />
                <Info label="Custo estimado" value={formatBRL(selectedBroker.aiCreditsUsedThisMonth * ESTIMATED_COST_PER_CREDIT)} />
                <Info label="Histórico" value={selectedBroker.aiCreditsUsedThisMonth > 0 ? "Uso registrado no mês." : "Sem uso recente."} />
              </div>
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Bonificação de créditos</p>
                <input type="number" value={creditAmount} onChange={(event) => setCreditAmount(Number(event.target.value) || 0)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none" />
                <input value={creditReason} onChange={(event) => setCreditReason(event.target.value)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none" />
                <Button type="button" onClick={() => void adjustCredits(selectedBroker, creditAmount, creditReason)} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676]">
                  Adicionar créditos
                </Button>
                {feedback ? <p className="text-sm text-[#69F0AE]">{feedback}</p> : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )

  async function adjustCredits(broker: AdminBrokerRecord, amount: number, reason: string) {
    try {
      const response = await fetch(`/api/admin/brokers/${broker.id}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ amount, reason }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível ajustar créditos.")
      setFeedback("Créditos atualizados. Recarregue a lista para ver o saldo atualizado.")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível ajustar créditos.")
    }
  }
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Bot }) {
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

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/65">{label}</span>
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-sm text-white/78">{value}</p>
    </div>
  )
}
