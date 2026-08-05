"use client"

import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangle, CreditCard, Search, Users, Wallet } from "lucide-react"

import {
  AdminBadge,
  AdminDataTable,
  AdminDefinitionGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import {
  formatCurrencyBRL,
  notifyAdminSubscription,
  type AdminSubscriptionRecord,
  updateAdminSubscription,
  useAdminSubscriptions,
} from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const statusFilters = ["Todos", "Ativo", "Cancelado"] as const
const planFilters = ["Todos", "Free", "Pro", "Scale"] as const

export function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useAdminSubscriptions()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [planFilter, setPlanFilter] = useState<(typeof planFilters)[number]>("Todos")
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filteredSubscriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return subscriptions.filter((subscription) => {
      const matchesSearch =
        !normalizedSearch ||
        subscription.clientName.toLowerCase().includes(normalizedSearch) ||
        subscription.plan.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === "Todos" || subscription.status === statusFilter
      const matchesPlan = planFilter === "Todos" || subscription.plan === planFilter
      return matchesSearch && matchesStatus && matchesPlan
    })
  }, [planFilter, search, statusFilter, subscriptions])

  const summary = useMemo(
    () => ({
      active: subscriptions.filter((subscription) => subscription.status === "Ativo").length,
      delinquent: subscriptions.filter((subscription) => subscription.financialStatus === "Inadimplente").length,
      revenue: subscriptions
        .filter((subscription) => subscription.status === "Ativo")
        .reduce((sum, subscription) => sum + subscription.monthlyValue, 0),
      payingUsers: subscriptions.filter((subscription) => subscription.monthlyValue > 0 && subscription.status === "Ativo").length,
    }),
    [subscriptions],
  )

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2400)
  }

  async function handleToggleStatus(subscription: AdminSubscriptionRecord) {
    const nextStatus = subscription.status === "Ativo" ? "Cancelado" : "Ativo"

    try {
      const updated = await updateAdminSubscription(subscription.id, { status: nextStatus })
      setSubscriptions(subscriptions.map((current) => (current.id === subscription.id ? updated : current)))
      setSelectedSubscription((current) => (current?.id === subscription.id ? updated : current))
      showFeedback(
        nextStatus === "Cancelado"
          ? `Assinatura de ${subscription.clientName} cancelada com sucesso.`
          : `Assinatura de ${subscription.clientName} reativada com sucesso.`,
      )
    } catch (caughtError) {
      showFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar a assinatura.")
    }
  }

  async function handleSendNotification(subscription: AdminSubscriptionRecord) {
    try {
      const updated = await notifyAdminSubscription(subscription.id)
      setSubscriptions(subscriptions.map((current) => (current.id === subscription.id ? updated : current)))
      setSelectedSubscription((current) => (current?.id === subscription.id ? updated : current))
      showFeedback(`Notificação enviada com sucesso para ${subscription.clientName}.`)
    } catch (caughtError) {
      showFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível enviar a notificação.")
    }
  }

  return (
    <AdminPageShell
      title="Assinaturas"
      subtitle="Acompanhamento real dos planos Free, Pro e Scale na base do EME"
      headerControls={
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-[22rem]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98A2B3]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar usuário ou plano" className="h-10 rounded-xl pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <FilterChip key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
                {filter}
              </FilterChip>
            ))}
            {planFilters.map((filter) => (
              <FilterChip key={filter} active={planFilter === filter} onClick={() => setPlanFilter(filter)}>
                {filter}
              </FilterChip>
            ))}
          </div>
        </div>
      }
    >
      {feedback ? <div className="mb-5 rounded-[1.1rem] border border-[#d7ebdd] bg-[#eef9f1] px-4 py-3 text-sm text-[#0f7a35]">{feedback}</div> : null}

      <div className="grid gap-5">
        <AdminMetricGrid>
          <AdminMetricCard label="Assinaturas ativas" value={String(summary.active)} icon={<CreditCard className="size-5" />} />
          <AdminMetricCard label="Usuários pagantes" value={String(summary.payingUsers)} icon={<Users className="size-5" />} />
          <AdminMetricCard label="Receita mensal" value={formatCurrencyBRL(summary.revenue)} icon={<Wallet className="size-5" />} />
          <AdminMetricCard label="Inadimplência" value={String(summary.delinquent)} icon={<AlertTriangle className="size-5" />} tone="warning" />
        </AdminMetricGrid>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <AdminSurface title="Leitura comercial" subtitle="O Portal Master agora reflete apenas a arquitetura ativa do EME.">
            <AdminDefinitionGrid
              columns={2}
              items={[
                { label: "Planos ativos", value: `${summary.active} contas` },
                { label: "Pagantes", value: `${summary.payingUsers} usuários` },
                { label: "Receita mensal", value: formatCurrencyBRL(summary.revenue) },
                { label: "Inadimplência", value: `${summary.delinquent} contas` },
              ]}
            />
          </AdminSurface>

          <AdminSurface title="Ações disponíveis" subtitle="Gestão leve, clara e alinhada ao restante do Portal Master.">
            <AdminDefinitionGrid
              items={[
                { label: "Ver detalhes", value: "Consulte plano, cobrança e próximo ciclo." },
                { label: "Notificar", value: "Envie aviso quando houver atraso ou regularização pendente." },
                { label: "Ativar ou cancelar", value: "Atualize o status da assinatura sem cards legados." },
                { label: "Planos", value: "Somente Free, Pro e Scale." },
              ]}
            />
          </AdminSurface>
        </section>

        <AdminSurface title="Base de assinaturas" subtitle="Dados reais do ciclo de cobrança do Portal do Corretor.">
          <AdminDataTable
            columns={["Usuário", "Plano", "Status", "Financeiro", "Valor", "Próxima cobrança", "Ações"]}
            rows={filteredSubscriptions.map((subscription) => [
              <div key={`${subscription.id}-name`}>
                <p className="font-semibold text-[#111827]">{subscription.clientName}</p>
                <p className="mt-1 text-xs text-[#8B95A1]">{subscription.type}</p>
              </div>,
              <span key={`${subscription.id}-plan`} className="text-[#111827]">{subscription.plan}</span>,
              <AdminBadge key={`${subscription.id}-status`} tone={subscription.status === "Ativo" ? "success" : "warning"}>
                {subscription.status}
              </AdminBadge>,
              <AdminBadge
                key={`${subscription.id}-financial`}
                tone={
                  subscription.financialStatus === "Em dia"
                    ? "success"
                    : subscription.financialStatus === "Atraso leve"
                      ? "warning"
                      : "danger"
                }
              >
                {subscription.financialStatus}
              </AdminBadge>,
              <span key={`${subscription.id}-value`} className="text-[#111827]">{formatCurrencyBRL(subscription.monthlyValue)}</span>,
              <span key={`${subscription.id}-next`}>{subscription.nextBillingAt}</span>,
              <div key={`${subscription.id}-actions`} className="flex flex-wrap justify-end gap-2">
                <ActionButton label="Detalhes" onClick={() => setSelectedSubscription(subscription)} />
                {(subscription.financialStatus === "Atraso leve" || subscription.financialStatus === "Inadimplente") && (
                  <ActionButton label="Notificar" onClick={() => void handleSendNotification(subscription)} />
                )}
                <ActionButton
                  label={subscription.status === "Ativo" ? "Cancelar" : "Ativar"}
                  onClick={() => void handleToggleStatus(subscription)}
                />
              </div>,
            ])}
          />
        </AdminSurface>
      </div>

      <Dialog open={Boolean(selectedSubscription)} onOpenChange={(open) => !open && setSelectedSubscription(null)}>
        <DialogContent className="max-w-xl border-black/[0.06] bg-white text-[#050505]">
          {selectedSubscription ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSubscription.clientName}</DialogTitle>
                <DialogDescription className="text-[#6B7280]">
                  Detalhes do plano, da cobrança e do ciclo atual da assinatura.
                </DialogDescription>
              </DialogHeader>

              <AdminDefinitionGrid
                columns={2}
                items={[
                  { label: "Plano", value: selectedSubscription.plan },
                  { label: "Status", value: selectedSubscription.status },
                  { label: "Financeiro", value: selectedSubscription.financialStatus },
                  { label: "Valor mensal", value: formatCurrencyBRL(selectedSubscription.monthlyValue) },
                  { label: "Início", value: selectedSubscription.startedAt },
                  { label: "Último pagamento", value: selectedSubscription.lastPaymentAt },
                  { label: "Próxima cobrança", value: selectedSubscription.nextBillingAt },
                  { label: "Em aberto", value: formatCurrencyBRL(selectedSubscription.valueOpen ?? 0) },
                ]}
              />

              <DialogFooter>
                {(selectedSubscription.financialStatus === "Atraso leve" || selectedSubscription.financialStatus === "Inadimplente") && (
                  <Button type="button" variant="ghost" onClick={() => void handleSendNotification(selectedSubscription)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#111827]">
                    Enviar notificação
                  </Button>
                )}
                <Button type="button" onClick={() => void handleToggleStatus(selectedSubscription)} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
                  {selectedSubscription.status === "Ativo" ? "Cancelar assinatura" : "Ativar assinatura"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-[#d7ebdd] bg-[#eef9f1] text-[#0f7a35]"
          : "border-black/[0.06] bg-white text-[#5F6B7A] hover:border-black/[0.12] hover:text-[#111827]"
      }`}
    >
      {children}
    </button>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-medium text-[#4B5563] transition-colors hover:border-black/[0.12] hover:text-[#111827]"
    >
      {label}
    </button>
  )
}
