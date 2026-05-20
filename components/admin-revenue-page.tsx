"use client"

import { useMemo, useState } from "react"
import { CreditCard, Eye, Sparkles, TrendingUp, Wallet } from "lucide-react"

import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import { AdminPageShell } from "@/components/admin-page-shell"
import { formatCurrencyBRL, useAdminBrokers, useAdminSubscriptions, type AdminSubscriptionRecord } from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function AdminRevenuePage() {
  const [subscriptions] = useAdminSubscriptions()
  const [brokers] = useAdminBrokers()
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionRecord | null>(null)
  const summary = useMemo(() => {
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "Ativo")
    const evaluationSubscriptions = subscriptions.filter((subscription) => subscription.monthlyValue === 0 || subscription.plan === "Sem plano")
    const recurringRevenue = activeSubscriptions.reduce((sum, subscription) => sum + subscription.monthlyValue, 0)
    const usedCredits = brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0)

    return {
      predictedRevenue: recurringRevenue,
      recurringRevenue,
      activePlans: activeSubscriptions.length,
      evaluationSubscriptions: evaluationSubscriptions.length,
      usedCredits,
    }
  }, [brokers, subscriptions])
  const hasSubscriptions = subscriptions.length > 0

  return (
    <AdminPageShell title="Receita" subtitle="Visão financeira da plataforma">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Receita prevista" value={formatCurrencyBRL(summary.predictedRevenue)} icon={TrendingUp} />
          <Metric label="Receita recorrente" value={formatCurrencyBRL(summary.recurringRevenue)} icon={Wallet} />
          <Metric label="Planos ativos" value={String(summary.activePlans)} icon={CreditCard} />
          <Metric label="Em avaliação" value={String(summary.evaluationSubscriptions)} icon={CreditCard} />
          <Metric label="Créditos IA usados" value={String(summary.usedCredits)} icon={Sparkles} />
        </section>

        {hasSubscriptions ? (
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Histórico de receita</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-white">{subscription.clientName}</p>
                    <p className="mt-1 text-sm text-white/50">{subscription.plan} · {subscription.status}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/65">
                      {formatCurrencyBRL(subscription.monthlyValue)}
                    </span>
                    <Button type="button" variant="ghost" onClick={() => setSelectedSubscription(subscription)} className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white">
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
            icon={Wallet}
            title="Receita pronta para acompanhar"
            description="Ainda não há lançamentos consolidados. A tela já está estruturada para receita prevista, recorrência, planos ativos, avaliações e créditos IA."
            actionLabel="Ver detalhes"
            onAction={() => setSelectedSubscription(null)}
          >
            <AdminStructureCards items={["Tabela de histórico preparada", "Cards de receita e recorrência", "Detalhes de assinatura em modal"]} />
          </AdminEmptyState>
        )}
      </div>

      <Dialog open={Boolean(selectedSubscription)} onOpenChange={(open) => !open && setSelectedSubscription(null)}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-[#111111] text-white">
          {selectedSubscription ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSubscription.clientName}</DialogTitle>
                <DialogDescription className="text-white/55">Detalhes de receita e assinatura.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2">
                <Info label="Plano" value={selectedSubscription.plan} />
                <Info label="Valor mensal" value={formatCurrencyBRL(selectedSubscription.monthlyValue)} />
                <Info label="Status" value={selectedSubscription.status} />
                <Info label="Próxima cobrança" value={selectedSubscription.nextBillingAt} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Wallet }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
      <CardContent className="p-4">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
        <p className="mt-4 text-sm text-white/55">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
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
