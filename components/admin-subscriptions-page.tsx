"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  BellRing,
  CreditCard,
  DollarSign,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import {
  formatCurrencyBRL,
  notifyAdminSubscription,
  type AdminSubscriptionRecord,
  updateAdminSubscription,
  useAdminSubscriptions,
} from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const typeFilters = ["Todos", "Corretor", "Imobiliária"] as const
const statusFilters = ["Todos", "Ativo", "Cancelado"] as const
const planFilters = ["Todos", "Corretor", "Plano Imobiliária"] as const

export function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useAdminSubscriptions()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("Todos")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [planFilter, setPlanFilter] = useState<(typeof planFilters)[number]>("Todos")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filteredSubscriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return subscriptions.filter((subscription) => {
      const matchesSearch =
        !normalizedSearch || subscription.clientName.toLowerCase().includes(normalizedSearch)
      const matchesType = typeFilter === "Todos" || subscription.type === typeFilter
      const matchesStatus = statusFilter === "Todos" || subscription.status === statusFilter
      const matchesPlan = planFilter === "Todos" || subscription.plan === planFilter

      return matchesSearch && matchesType && matchesStatus && matchesPlan
    })
  }, [planFilter, search, statusFilter, subscriptions, typeFilter])

  const summary = useMemo(
    () => ({
      active: subscriptions.filter((subscription) => subscription.status === "Ativo").length,
      delinquent: subscriptions.filter((subscription) => subscription.financialStatus === "Inadimplente").length,
      revenue: subscriptions
        .filter((subscription) => subscription.status === "Ativo")
        .reduce((sum, subscription) => sum + subscription.monthlyValue, 0),
      risk: subscriptions.reduce((sum, subscription) => sum + (subscription.valueOpen ?? 0), 0),
    }),
    [subscriptions],
  )

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 1800)
  }

  function updateSubscription(
    subscriptionId: string,
    updates: Partial<AdminSubscriptionRecord>,
    feedbackMessage?: string,
  ) {
    const nextSubscriptions = subscriptions.map((subscription) =>
      subscription.id === subscriptionId ? { ...subscription, ...updates } : subscription,
    )

    setSubscriptions(nextSubscriptions)
    setSelectedSubscription((current) =>
      current?.id === subscriptionId ? { ...current, ...updates } : current,
    )

    if (feedbackMessage) {
      showFeedback(feedbackMessage)
    }
  }

  async function handleToggleStatus(subscription: AdminSubscriptionRecord) {
    const nextStatus = subscription.status === "Ativo" ? "Cancelado" : "Ativo"

    try {
      const updated = await updateAdminSubscription(subscription.id, { status: nextStatus })
      updateSubscription(
        subscription.id,
        updated,
        nextStatus === "Cancelado"
          ? `Assinatura de ${subscription.clientName} cancelada com sucesso.`
          : `Assinatura de ${subscription.clientName} reativada com sucesso.`,
      )
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "N?o foi poss?vel atualizar a assinatura.")
    }
  }

  async function handleSendNotification(subscription: AdminSubscriptionRecord) {
    try {
      const updated = await notifyAdminSubscription(subscription.id)
      updateSubscription(
        subscription.id,
        updated,
        `Notifica??o enviada com sucesso para ${subscription.clientName}.`,
      )
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "N?o foi poss?vel enviar a notifica??o.")
    }
  }

  return (
    <AdminPageShell
      title="Assinaturas"
      subtitle="Gerencie os planos ativos dos usuários"
      headerControls={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative w-full max-w-[18rem] lg:max-w-[19rem] xl:max-w-[20rem]">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente"
              className="h-8.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-10 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-[#00C853]/35"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((current) => !current)}
            className={`h-8.5 rounded-xl border px-4 ${filtersOpen ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"}`}
          >
            <SlidersHorizontal className="size-4" />
            Filtros
          </Button>
        </div>
      }
    >
      {feedback && (
        <div className="mb-6 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          {feedback}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Assinaturas ativas" value={String(summary.active)} icon={CreditCard} />
        <SummaryCard label="Inadimplentes" value={String(summary.delinquent)} icon={AlertTriangle} />
        <SummaryCard label="Receita mensal" value={formatCurrencyBRL(summary.revenue)} icon={DollarSign} />
        <SummaryCard label="Receita em risco" value={formatCurrencyBRL(summary.risk)} icon={BellRing} />
      </section>

      {filtersOpen && (
        <section className="mt-6 rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterGroup title="Tipo">
              {typeFilters.map((filter) => (
                <FilterButton key={filter} active={typeFilter === filter} onClick={() => setTypeFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
            <FilterGroup title="Status">
              {statusFilters.map((filter) => (
                <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
            <FilterGroup title="Plano">
              {planFilters.map((filter) => (
                <FilterButton key={filter} active={planFilter === filter} onClick={() => setPlanFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-4">
        {filteredSubscriptions.length > 0 ? filteredSubscriptions.map((subscription) => (
          <Card
            key={subscription.id}
            className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
          >
            <CardContent className="grid gap-5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-white">{subscription.clientName}</p>
                    <TypeBadge type={subscription.type} />
                    <StatusBadge status={subscription.status} />
                    <FinancialBadge status={subscription.financialStatus} />
                    {subscription.notificationSent && <InfoBadge label="Notificação automática enviada" />}
                    {subscription.awaitingRegularization && <InfoBadge label="Aguardando regularização" />}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-white/60 sm:grid-cols-2 xl:grid-cols-4">
                    <span>Plano: {subscription.plan}</span>
                    <span>Valor mensal: {formatCurrencyBRL(subscription.monthlyValue)}</span>
                    <span>Data de início: {subscription.startedAt}</span>
                    <span>Status: {subscription.status}</span>
                    <span>Último pagamento: {subscription.lastPaymentAt}</span>
                    <span>Próxima cobrança: {subscription.nextBillingAt}</span>
                    <span>Dias de atraso: {subscription.daysOverdue}</span>
                    <span>Valor em aberto: {formatCurrencyBRL(subscription.valueOpen ?? 0)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton label="Ver detalhes" onClick={() => setSelectedSubscription(subscription)} />
                  {(subscription.financialStatus === "Atraso leve" || subscription.financialStatus === "Inadimplente") && (
                    <ActionButton label="Enviar notificação" onClick={() => void handleSendNotification(subscription)} />
                  )}
                  <ActionButton
                    label={subscription.status === "Ativo" ? "Cancelar assinatura" : "Ativar assinatura"}
                    onClick={() => void handleToggleStatus(subscription)}
                  />
                </div>
              </div>

              {subscription.type === "Imobiliária" && subscription.breakdown && (
                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white/65">Breakdown da assinatura</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                    <BreakdownBlock label="Base" value={formatCurrencyBRL(subscription.breakdown.base)} />
                    <span className="hidden text-white/25 md:block">+</span>
                    <BreakdownBlock label="Corretores ativos" value={`${subscription.breakdown.activeBrokers} x ${formatCurrencyBRL(subscription.breakdown.perBroker)}`} />
                    <span className="hidden text-white/25 md:block">=</span>
                    <BreakdownBlock label="Total" value={formatCurrencyBRL(subscription.breakdown.total)} highlight />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )) : (
          <AdminEmptyState
            icon={CreditCard}
            title="Assinaturas prontas para gestão"
            description="Ainda não há assinaturas para os filtros atuais. A área já está preparada para planos ativos, inadimplência, notificações e detalhes em modal."
          >
            <AdminStructureCards items={["Cards de status financeiro", "Tabela/lista de assinaturas", "Modal de detalhes e ações"]} />
          </AdminEmptyState>
        )}
      </section>

      <SubscriptionDetailsDialog
        subscription={selectedSubscription}
        onOpenChange={(open) => !open && setSelectedSubscription(null)}
        onToggleStatus={() => {
          if (!selectedSubscription) return
          void handleToggleStatus(selectedSubscription)
        }}
        onSendNotification={() => {
          if (!selectedSubscription) return
          void handleSendNotification(selectedSubscription)
        }}
      />
    </AdminPageShell>
  )
}

function SubscriptionDetailsDialog({
  subscription,
  onOpenChange,
  onToggleStatus,
  onSendNotification,
}: {
  subscription: AdminSubscriptionRecord | null
  onOpenChange: (open: boolean) => void
  onToggleStatus: () => void
  onSendNotification: () => void
}) {
  return (
    <Dialog open={Boolean(subscription)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {subscription && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">{subscription.clientName}</DialogTitle>
              <DialogDescription className="text-white/55">Detalhes do plano, cobrança e status atual da assinatura.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2">
              <DetailItem label="Tipo" value={subscription.type} />
              <DetailItem label="Plano" value={subscription.plan} />
              <DetailItem label="Valor mensal" value={formatCurrencyBRL(subscription.monthlyValue)} />
              <DetailItem label="Status" value={subscription.status} />
              <DetailItem label="Status financeiro" value={subscription.financialStatus} />
              <DetailItem label="Data de início" value={subscription.startedAt} />
              <DetailItem label="Último pagamento" value={subscription.lastPaymentAt} />
              <DetailItem label="Próxima cobrança" value={subscription.nextBillingAt} />
              <DetailItem label="Dias de atraso" value={String(subscription.daysOverdue)} />
              <DetailItem label="Valor em aberto" value={formatCurrencyBRL(subscription.valueOpen ?? 0)} />
            </div>

            {subscription.breakdown && (
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white/65">Cálculo da assinatura</p>
                <p className="mt-3 text-sm text-white/70">
                  Base {formatCurrencyBRL(subscription.breakdown.base)} + {subscription.breakdown.activeBrokers} corretores x {formatCurrencyBRL(subscription.breakdown.perBroker)} = {formatCurrencyBRL(subscription.breakdown.total)}
                </p>
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2">
              {(subscription.financialStatus === "Atraso leve" || subscription.financialStatus === "Inadimplente") && (
                <Button type="button" variant="ghost" onClick={onSendNotification} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                  Enviar notificação
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={onToggleStatus} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                {subscription.status === "Ativo" ? "Cancelar assinatura" : "Ativar assinatura"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CreditCard }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2.5 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-white/65">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-9 rounded-full border px-4 text-sm ${active ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE] hover:bg-[#00C853]/14" : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"}`}
    >
      {label}
    </Button>
  )
}

function TypeBadge({ type }: { type: AdminSubscriptionRecord["type"] }) {
  const tone = type === "Imobiliária" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.04] text-white/70"
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{type}</span>
}

function StatusBadge({ status }: { status: AdminSubscriptionRecord["status"] }) {
  const tone = status === "Ativo" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-[#ffb74d]/15 bg-[#ffb74d]/8 text-[#ffcc80]"
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>
}

function FinancialBadge({ status }: { status: AdminSubscriptionRecord["financialStatus"] }) {
  const tone =
    status === "Em dia"
      ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
      : status === "Atraso leve"
        ? "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]"
        : "border-[#ff6b6b]/15 bg-[#ff6b6b]/8 text-[#ff9b9b]"

  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>
}

function InfoBadge({ label }: { label: string }) {
  return <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/65">{label}</span>
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
    >
      {label}
    </Button>
  )
}

function BreakdownBlock({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[1.1rem] border p-4 ${highlight ? "border-[#00C853]/20 bg-[#00C853]/10" : "border-white/[0.08] bg-black/20"}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-sm text-white/78">{value}</p>
    </div>
  )
}
