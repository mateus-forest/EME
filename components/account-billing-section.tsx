"use client"

import {
  CalendarClock,
  CreditCard,
  ExternalLink,
  FileText,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"

type BillingInvoice = {
  id: string
  number: string | null
  description: string
  type: "Assinatura" | "Créditos IA" | "Expansão da Carteira" | "Pacote extra"
  createdAt: number
  amount: number
  currency: string
  status: string | null
  receiptUrl: string | null
  documentLabel: "Abrir fatura" | "Abrir recibo"
}

type BillingSnapshot = {
  plan: {
    name: string
    status: string
    amount: number
    currency: string
    interval: string | null
    intervalCount: number
    nextBillingAt: number | null
    cancelAtPeriodEnd: boolean
  }
  paymentMethod: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  } | null
  capacityAddon: {
    quantity: number
    status: string
    amount: number
    currency: string
    interval: string
    intervalCount: number
    nextBillingAt: number | null
  } | null
  totalMonthly: {
    amount: number
    currency: string
  }
  invoices: BillingInvoice[]
  portalAvailable: boolean
  hasSubscription: boolean
}

function isBillingSnapshot(value: BillingSnapshot | { error?: string }): value is BillingSnapshot {
  return "plan" in value && "invoices" in value && Array.isArray(value.invoices)
}

let billingRequest: Promise<BillingSnapshot> | null = null

function requestBillingSnapshot() {
  if (!billingRequest) {
    billingRequest = fetch("/api/stripe/billing", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as BillingSnapshot | { error?: string } | null
        if (!response.ok || !data || !isBillingSnapshot(data)) {
          throw new Error(data && "error" in data ? data.error : "Não foi possível carregar o faturamento.")
        }
        return data
      })
      .finally(() => {
        billingRequest = null
      })
  }
  return billingRequest
}

const subscriptionStatusLabels: Record<string, string> = {
  active: "Ativa",
  trialing: "Período de teste",
  past_due: "Pagamento pendente",
  unpaid: "Pagamento não realizado",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  paused: "Pausada",
  inactive: "Sem assinatura",
}

const invoiceStatusLabels: Record<string, string> = {
  paid: "Pago",
  open: "Em aberto",
  draft: "Rascunho",
  void: "Cancelado",
  uncollectible: "Não recebido",
}

const cardBrandLabels: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return "Não disponível"
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(timestamp * 1000),
  )
}

function formatInterval(interval: string | null, count: number) {
  if (!interval) return "Sem recorrência"
  if (interval === "month") return count === 1 ? "Mensal" : `A cada ${count} meses`
  if (interval === "year") return count === 1 ? "Anual" : `A cada ${count} anos`
  if (interval === "week") return count === 1 ? "Semanal" : `A cada ${count} semanas`
  return "Recorrente"
}

function getStatusTone(status: string | null) {
  if (status === "active" || status === "trialing" || status === "paid") {
    return "border-[#009b3a]/20 bg-[#009b3a]/10 text-[#007f31]"
  }
  if (status === "past_due" || status === "open" || status === "incomplete") {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }
  return "border-black/[0.06] bg-[#f4f5f3] text-[#667085]"
}

export function AccountBillingSection() {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [portalAction, setPortalAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadBilling = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setBilling(await requestBillingSnapshot())
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar o faturamento.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBilling()
  }, [loadBilling])

  async function openCustomerPortal(action: "payment_method" | "manage" | "cancel") {
    setPortalAction(action)
    setError(null)

    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null

      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? "Não foi possível abrir o portal de faturamento.")
      }

      window.location.assign(data.url)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível abrir o portal de faturamento.")
      setPortalAction(null)
    }
  }

  if (isLoading) return <EmeLoading message="Carregando faturamento..." />

  if (!billing) {
    return (
      <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
        <CardContent className="grid justify-items-center gap-3 px-5 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600">
            <CreditCard className="size-5" />
          </span>
          <p className="font-semibold text-[#111111]">Não foi possível carregar o faturamento.</p>
          <p className="max-w-lg text-sm text-[#667085]">{error}</p>
          <Button type="button" variant="ghost" onClick={() => void loadBilling()} className="rounded-xl border border-black/[0.06]">
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const paymentMethodLabel = billing.paymentMethod
    ? `${cardBrandLabels[billing.paymentMethod.brand] ?? billing.paymentMethod.brand} final ${billing.paymentMethod.last4}`
    : "Nenhuma forma de pagamento cadastrada"

  return (
    <div className="grid gap-4">
      {error ? (
        <div className="rounded-[var(--broker-radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
        <CardHeader className="border-b border-[var(--broker-border)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#009b3a]">Assinatura</p>
              <CardTitle className="mt-1 text-xl text-[#111111]">{billing.plan.name}</CardTitle>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(billing.plan.status)}`}>
              {subscriptionStatusLabels[billing.plan.status] ?? "Status indisponível"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <BillingDetail
              icon={<ReceiptText className="size-4" />}
              label="Plano"
              value={formatCurrency(billing.plan.amount, billing.plan.currency)}
            />
            <BillingDetail
              icon={<RefreshCw className="size-4" />}
              label="Periodicidade"
              value={formatInterval(billing.plan.interval, billing.plan.intervalCount)}
            />
            <BillingDetail
              icon={<CalendarClock className="size-4" />}
              label="Próxima cobrança"
              value={formatDate(billing.plan.nextBillingAt)}
            />
            <BillingDetail icon={<CreditCard className="size-4" />} label="Forma de pagamento" value={paymentMethodLabel} />
            <BillingDetail
              icon={<ReceiptText className="size-4" />}
              label="Total mensal"
              value={formatCurrency(billing.totalMonthly.amount, billing.totalMonthly.currency)}
            />
          </div>

          {billing.capacityAddon ? (
            <div className="rounded-[var(--broker-radius-md)] border border-[#009b3a]/15 bg-[#f2fbf5] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#008832]">Capacidade adicional mensal</p>
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-base font-semibold text-[#050505]">+{billing.capacityAddon.quantity} imóveis</p>
                <p className="text-sm font-semibold text-[#009b3a]">
                  {formatCurrency(billing.capacityAddon.amount, billing.capacityAddon.currency)}/mês
                </p>
              </div>
              <p className="mt-1 text-xs text-[#55705f]">
                {billing.capacityAddon.status === "active" || billing.capacityAddon.status === "trialing"
                  ? "Ativa na mesma assinatura do seu plano."
                  : "Status sincronizado com sua assinatura Stripe."}
              </p>
            </div>
          ) : null}

          {billing.plan.cancelAtPeriodEnd ? (
            <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              O cancelamento está agendado. O acesso permanece ativo até o fim do período contratado.
            </div>
          ) : null}

          {billing.hasSubscription ? (
            <div className="flex flex-col gap-2 border-t border-[var(--broker-border)] pt-4 sm:flex-row">
              <Button
                type="button"
                onClick={() => void openCustomerPortal("payment_method")}
                disabled={!billing.portalAvailable || portalAction !== null}
                className="h-10 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]"
              >
                <CreditCard className="size-4" />
                {portalAction === "payment_method" ? "Abrindo Stripe..." : "Alterar forma de pagamento"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void openCustomerPortal("manage")}
                disabled={!billing.portalAvailable || portalAction !== null}
                className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#4B5563] hover:bg-[#f8f8f5] hover:text-[#111111]"
              >
                <ExternalLink className="size-4" />
                {portalAction === "manage" ? "Abrindo Stripe..." : "Gerenciar assinatura"}
              </Button>
            </div>
          ) : (
            <p className="border-t border-[var(--broker-border)] pt-4 text-xs leading-5 text-[#7B8491]">
              {billing.plan.amount === 0
                ? "O Plano Free não possui cobrança recorrente nem exige forma de pagamento cadastrada."
                : "Não há uma assinatura recorrente ativa vinculada a esta conta."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
        <CardHeader className="border-b border-[var(--broker-border)] px-4 py-4 sm:px-5">
          <CardTitle className="flex items-center gap-2.5 text-lg text-[#111111]">
            <span className="flex size-9 items-center justify-center rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
              <FileText className="size-4" />
            </span>
            Histórico de cobranças
          </CardTitle>
          <p className="text-sm text-[#667085]">Faturas e pagamentos registrados na sua conta Stripe.</p>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {billing.invoices.length === 0 ? (
            <div className="rounded-[1rem] border border-dashed border-black/[0.08] px-4 py-8 text-center text-sm text-[#7B8491]">
              Nenhuma cobrança encontrada.
            </div>
          ) : (
            <div className="grid gap-2">
              {billing.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="grid gap-3 rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111111]">{invoice.description}</p>
                    <p className="mt-1 text-xs text-[#7B8491]">
                      {invoice.type} · {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#111111]">{formatCurrency(invoice.amount, invoice.currency)}</p>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(invoice.status)}`}>
                    {invoiceStatusLabels[invoice.status ?? ""] ?? "Status indisponível"}
                  </span>
                  {invoice.receiptUrl ? (
                    <Button asChild type="button" variant="ghost" className="h-9 w-fit rounded-xl border border-black/[0.06] bg-white px-3 text-xs text-[#4B5563]">
                      <a href={invoice.receiptUrl} target="_blank" rel="noreferrer">
                        {invoice.documentLabel}
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-[#98A2B3]">Fatura indisponível</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {billing.hasSubscription ? (
        <div className="flex flex-col gap-2 rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#7B8491]" />
            <p className="max-w-2xl text-xs leading-5 text-[#7B8491]">
              O cancelamento é realizado com segurança no Stripe. O EME não recebe nem armazena os dados do seu cartão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openCustomerPortal("cancel")}
            disabled={!billing.portalAvailable || portalAction !== null}
            className="w-fit shrink-0 text-xs font-medium text-[#7B8491] underline-offset-4 hover:text-red-600 hover:underline disabled:opacity-50"
          >
            {portalAction === "cancel" ? "Abrindo Stripe..." : "Cancelar assinatura"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function BillingDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] p-3.5">
      <div className="flex items-center gap-2 text-[#009b3a]">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#111111]">{value}</p>
    </div>
  )
}
