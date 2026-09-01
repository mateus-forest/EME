"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  HandCoins,
  Landmark,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StructuredInput } from "@/components/ui/structured-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrencyBRLFromCents, parseCurrencyInputToCents, parseDecimalInput } from "@/lib/structured-fields"

type IncomeStatus = "EXPECTED" | "RECEIVED" | "OVERDUE"
type ExpenseStatus = "PENDING" | "PAID"
type EntryType = "income" | "expense" | "commission"
type FinancialTab = "summary" | "receipts" | "expenses" | "commissions"

type ReceiptItem = {
  id: string
  source: "ENTRY" | "COMMISSION" | "RENTAL_PAYMENT"
  description: string
  category: string
  client: { id: string; name: string } | null
  property: { id: string; title: string } | null
  amount: number
  dueDate: string
  occurredAt: string | null
  status: IncomeStatus
  notes: string | null
  editable: boolean
}

type ExpenseItem = {
  id: string
  description: string
  category: string
  client: { id: string; name: string } | null
  property: { id: string; title: string } | null
  amount: number
  date: string
  occurredAt: string | null
  status: ExpenseStatus
  notes: string | null
}

type CommissionItem = {
  id: string
  client: { id: string; name: string } | null
  property: { id: string; title: string } | null
  operationAmount: number
  commissionPercent: number
  commissionAmount: number
  dueDate: string
  receivedAt: string | null
  status: IncomeStatus
  notes: string | null
}

type FinancialSnapshot = {
  config: { commissionPercent: number }
  summary: {
    portfolioValue: number
    receivedThisMonth: number
    expensesThisMonth: number
    monthResult: number
    receivable: number
    overdue: number
  }
  portfolio: {
    totalValue: number
    totalProperties: number
    activeProperties: number
    unpricedProperties: number
    forSale: { count: number; value: number; unpricedCount: number }
    forRent: { count: number; value: number; unpricedCount: number }
    activeRentals: { count: number; value: number; unpricedCount: number }
  }
  receipts: ReceiptItem[]
  expenses: ExpenseItem[]
  commissions: CommissionItem[]
  upcoming: {
    next7Days: ReceiptItem[]
    next30Days: ReceiptItem[]
    overdue: ReceiptItem[]
  }
  references: {
    clients: Array<{ id: string; name: string }>
    properties: Array<{ id: string; title: string; purpose: string; price: number }>
    documents: Array<{ id: string; title: string; type: string; leadId: string | null; propertyId: string | null }>
    rentals: Array<{ id: string; label: string; propertyId: string; leadId: string; status: string }>
  }
}

type Draft = {
  entryType: EntryType
  description: string
  category: string
  leadId: string
  propertyId: string
  sourceRef: string
  amount: string
  operationAmount: string
  commissionPercent: string
  dueDate: string
  occurredAt: string
  status: string
  notes: string
}

const incomeCategories = [
  ["COMMISSION", "Comissão"],
  ["FEES", "Honorários"],
  ["RENT", "Locação"],
  ["DEPOSIT", "Sinal"],
  ["OTHER", "Outro"],
] as const

const expenseCategories = [
  ["ADS", "Tráfego/anúncios"],
  ["PHOTOGRAPHY", "Fotografia"],
  ["TRAVEL", "Deslocamento"],
  ["DOCUMENTATION", "Documentação"],
  ["TOOLS", "Ferramentas"],
  ["OTHER", "Outros"],
] as const

const categoryLabels = Object.fromEntries([...incomeCategories, ...expenseCategories]) as Record<string, string>
const statusLabels: Record<string, string> = {
  EXPECTED: "Previsto",
  RECEIVED: "Recebido",
  OVERDUE: "Atrasado",
  PENDING: "Prevista",
  PAID: "Paga",
}

function todayInput() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function createDraft(entryType: EntryType, commissionPercent = 6): Draft {
  return {
    entryType,
    description: "",
    category: entryType === "expense" ? "ADS" : entryType === "commission" ? "COMMISSION" : "FEES",
    leadId: "",
    propertyId: "",
    sourceRef: "",
    amount: "",
    operationAmount: "",
    commissionPercent: String(commissionPercent),
    dueDate: todayInput(),
    occurredAt: todayInput(),
    status: entryType === "expense" ? "PENDING" : "EXPECTED",
    notes: "",
  }
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value))
}

function total(items: ReceiptItem[]) {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

export function BrokerFinancialPage() {
  const [data, setData] = useState<FinancialSnapshot | null>(null)
  const [activeTab, setActiveTab] = useState<FinancialTab>("summary")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => createDraft("income"))
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [updatingId, setUpdatingId] = useState("")

  const loadData = useCallback(async () => {
    setError("")
    try {
      const response = await fetch("/api/brokers/financial", { credentials: "include", cache: "no-store" })
      const body = (await response.json().catch(() => null)) as FinancialSnapshot & { error?: string }
      if (!response.ok) throw new Error(body?.error || "Não foi possível carregar o financeiro.")
      setData(body)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar o financeiro.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const isCommission = draft.entryType === "commission" || (draft.entryType === "income" && draft.category === "COMMISSION")
  const calculatedCommission = useMemo(() => {
    const operationAmount = parseCurrencyInputToCents(draft.operationAmount) ?? 0
    const percent = parseDecimalInput(draft.commissionPercent) ?? 0
    return Math.round(operationAmount * (percent / 100))
  }, [draft.commissionPercent, draft.operationAmount])

  function openNew(entryType: EntryType) {
    setDraft(createDraft(entryType, data?.config.commissionPercent ?? 6))
    setFeedback("")
    setDialogOpen(true)
  }

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function changeEntryType(entryType: EntryType) {
    setDraft(createDraft(entryType, data?.config.commissionPercent ?? 6))
    setFeedback("")
  }

  function changeSource(sourceRef: string) {
    const next: Partial<Draft> = { sourceRef }
    if (sourceRef.startsWith("document:")) {
      const document = data?.references.documents.find((item) => `document:${item.id}` === sourceRef)
      if (document?.leadId) next.leadId = document.leadId
      if (document?.propertyId) next.propertyId = document.propertyId
    }
    if (sourceRef.startsWith("rental:")) {
      const rental = data?.references.rentals.find((item) => `rental:${item.id}` === sourceRef)
      if (rental) {
        next.leadId = rental.leadId
        next.propertyId = rental.propertyId
      }
    }
    setDraft((current) => ({ ...current, ...next }))
  }

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setFeedback("")
    const source = draft.sourceRef.split(":")
    const payload = {
      ...draft,
      entryType: isCommission ? "commission" : draft.entryType,
      brokerDocumentId: source[0] === "document" ? source[1] : null,
      propertyRentalId: source[0] === "rental" ? source[1] : null,
    }
    try {
      const response = await fetch("/api/brokers/financial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error || "Não foi possível registrar o lançamento.")
      setDialogOpen(false)
      await loadData()
      setActiveTab(isCommission ? "commissions" : draft.entryType === "expense" ? "expenses" : "receipts")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível registrar o lançamento.")
    } finally {
      setIsSaving(false)
    }
  }

  async function updateStatus(id: string, source: "ENTRY" | "COMMISSION", status: "RECEIVED" | "PAID") {
    setUpdatingId(id)
    try {
      const response = await fetch("/api/brokers/financial", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", id, source, status, occurredAt: todayInput() }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(body?.error || "Não foi possível atualizar o status.")
      await loadData()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status.")
    } finally {
      setUpdatingId("")
    }
  }

  const primaryType: EntryType = activeTab === "expenses" ? "expense" : activeTab === "commissions" ? "commission" : "income"

  return (
    <BrokerPageShell
      title="Financeiro"
      eyebrow="Operação"
      subtitle="Carteira, recebimentos, despesas e comissões"
      primaryActionLabel="Novo lançamento"
      primaryActionOnClick={() => openNew(primaryType)}
    >
      <div className="grid gap-4">
        {error ? (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-[var(--broker-radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} className="shrink-0 bg-white">Tentar novamente</Button>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinancialTab)} className="gap-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-10 min-w-max rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface)] p-1 shadow-[var(--broker-shadow-xs)]">
              <TabsTrigger value="summary" className="px-3.5">Resumo</TabsTrigger>
              <TabsTrigger value="receipts" className="px-3.5">Recebimentos</TabsTrigger>
              <TabsTrigger value="expenses" className="px-3.5">Despesas</TabsTrigger>
              <TabsTrigger value="commissions" className="px-3.5">Comissões</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="summary" className="grid gap-4">
            {isLoading || !data ? <FinancialLoading /> : <SummaryView data={data} />}
          </TabsContent>

          <TabsContent value="receipts" className="grid gap-4">
            <SectionHeader
              title="Recebimentos"
              description="Comissões, honorários, locações, sinais e outras entradas operacionais."
              action="Novo recebimento"
              onAction={() => openNew("income")}
            />
            {isLoading || !data ? <FinancialLoading /> : (
              <ReceiptList items={data.receipts} updatingId={updatingId} onReceive={(item) => void updateStatus(item.id, item.source as "ENTRY" | "COMMISSION", "RECEIVED")} />
            )}
          </TabsContent>

          <TabsContent value="expenses" className="grid gap-4">
            <SectionHeader
              title="Despesas"
              description="Custos essenciais da operação, sem pretensão contábil ou fiscal."
              action="Nova despesa"
              onAction={() => openNew("expense")}
            />
            {isLoading || !data ? <FinancialLoading /> : (
              <ExpenseList items={data.expenses} updatingId={updatingId} onPay={(item) => void updateStatus(item.id, "ENTRY", "PAID")} />
            )}
          </TabsContent>

          <TabsContent value="commissions" className="grid gap-4">
            <SectionHeader
              title="Comissões"
              description="Valor calculado automaticamente sobre cada operação registrada."
              action="Nova comissão"
              onAction={() => openNew("commission")}
            />
            <div className="rounded-[var(--broker-radius-md)] border border-[var(--broker-accent-border)] bg-[var(--broker-accent-soft)] px-4 py-3 text-sm text-[var(--broker-accent-strong)]">
              Exemplo: R$ 500.000,00 × 6% = R$ 30.000,00 de comissão.
            </div>
            {isLoading || !data ? <FinancialLoading /> : (
              <CommissionList items={data.commissions} updatingId={updatingId} onReceive={(item) => void updateStatus(item.id, "COMMISSION", "RECEIVED")} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[var(--broker-radius-lg)] border-[#d0d5dd] bg-white text-[#101828] sm:max-w-2xl [&_[data-slot=dialog-close]]:text-[#475467] [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]:hover]:bg-[#f2f4f7] [&_[data-slot=dialog-close]:hover]:text-[#101828] [&_[data-slot=dialog-close]:focus-visible]:ring-[#08783e]/25">
          <DialogHeader className="gap-1.5 pr-8">
            <DialogTitle className="text-xl font-semibold leading-tight tracking-[-0.02em] text-[#101828]">Novo lançamento</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#475467]">Registre somente a movimentação operacional do corretor.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={saveEntry}
            className="grid gap-4 text-[#101828] [&_[data-slot=input]]:border-[#d0d5dd] [&_[data-slot=input]]:bg-white [&_[data-slot=input]]:text-[#101828] [&_[data-slot=input]]:placeholder:text-[#667085] [&_[data-slot=input]:disabled]:border-[#e4e7ec] [&_[data-slot=input]:disabled]:bg-[#f2f4f7] [&_[data-slot=input]:disabled]:text-[#667085] [&_[data-slot=input]:disabled]:opacity-100 [&_[data-slot=input]:focus-visible]:border-[#08783e] [&_[data-slot=input]:focus-visible]:ring-[#08783e]/15 [&_[data-slot=textarea]]:border-[#d0d5dd] [&_[data-slot=textarea]]:bg-white [&_[data-slot=textarea]]:text-[#101828] [&_[data-slot=textarea]]:placeholder:text-[#667085] [&_[data-slot=textarea]:disabled]:border-[#e4e7ec] [&_[data-slot=textarea]:disabled]:bg-[#f2f4f7] [&_[data-slot=textarea]:disabled]:text-[#667085] [&_[data-slot=textarea]:disabled]:opacity-100 [&_[data-slot=textarea]:focus-visible]:border-[#08783e] [&_[data-slot=textarea]:focus-visible]:ring-[#08783e]/15"
          >
            <div className="grid grid-cols-3 gap-2 rounded-[var(--broker-radius-md)] border border-[#e4e7ec] bg-[#f2f4f7] p-1.5">
              {(["income", "expense", "commission"] as EntryType[]).map((entryType) => (
                <button
                  key={entryType}
                  type="button"
                  onClick={() => changeEntryType(entryType)}
                  className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783e]/25 ${draft.entryType === entryType ? "bg-white text-[#101828] shadow-sm ring-1 ring-black/[0.05]" : "text-[#475467] hover:bg-white/70 hover:text-[#101828]"}`}
                >
                  {entryType === "income" ? "Recebimento" : entryType === "expense" ? "Despesa" : "Comissão"}
                </button>
              ))}
            </div>

            {!isCommission ? (
              <>
                <FormField label="Descrição" required>
                  <Input value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} maxLength={180} placeholder={draft.entryType === "expense" ? "Ex.: Fotos do imóvel Jardins" : "Ex.: Honorários da consultoria"} />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Categoria" required>
                    <NativeSelect value={draft.category} onChange={(value) => updateDraft("category", value)}>
                      {(draft.entryType === "expense" ? expenseCategories : incomeCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </FormField>
                  <FormField label="Valor" required>
                    <StructuredInput kind="currency" value={draft.amount} onValueChange={(formatted) => updateDraft("amount", formatted)} placeholder="R$ 0,00" />
                  </FormField>
                </div>
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={isCommission ? "Cliente" : "Cliente (opcional)"} required={isCommission}>
                <NativeSelect value={draft.leadId} onChange={(value) => updateDraft("leadId", value)} required={isCommission}>
                  <option value="">Selecione um cliente</option>
                  {data?.references.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label={isCommission ? "Imóvel" : "Imóvel (opcional)"} required={isCommission}>
                <NativeSelect value={draft.propertyId} onChange={(value) => updateDraft("propertyId", value)} required={isCommission}>
                  <option value="">Selecione um imóvel</option>
                  {data?.references.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
                </NativeSelect>
              </FormField>
            </div>

            <FormField label="Origem no EME (opcional)">
              <NativeSelect value={draft.sourceRef} onChange={changeSource}>
                <option value="">Sem vínculo de origem</option>
                {data?.references.documents.map((document) => (
                  <option key={document.id} value={`document:${document.id}`}>{document.type === "proposal" ? "Proposta" : "Contrato"} · {document.title}</option>
                ))}
                {data?.references.rentals.map((rental) => (
                  <option key={rental.id} value={`rental:${rental.id}`}>Locação · {rental.label}</option>
                ))}
              </NativeSelect>
            </FormField>

            {isCommission ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Valor da operação" required>
                    <StructuredInput kind="currency" value={draft.operationAmount} onValueChange={(formatted) => updateDraft("operationAmount", formatted)} placeholder="R$ 500.000,00" />
                  </FormField>
                  <FormField label="Percentual de comissão" required>
                    <StructuredInput kind="percent" value={draft.commissionPercent} onValueChange={(formatted) => updateDraft("commissionPercent", formatted)} placeholder="6%" />
                  </FormField>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[var(--broker-radius-md)] border border-[#a6e3b8] bg-[#f0fdf4] p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#08783e]">Comissão calculada</p>
                    <p className="mt-1 text-xl font-semibold text-[#101828]">{formatCurrencyBRLFromCents(calculatedCommission)}</p>
                  </div>
                  <HandCoins className="size-6 text-[#08783e]" />
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={draft.entryType === "expense" ? "Data" : "Data prevista"} required>
                <Input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} className="[color-scheme:light]" />
              </FormField>
              <FormField label="Status" required>
                <NativeSelect value={draft.status} onChange={(value) => updateDraft("status", value)}>
                  {draft.entryType === "expense" ? (
                    <><option value="PENDING">Prevista</option><option value="PAID">Paga</option></>
                  ) : (
                    <><option value="EXPECTED">Previsto</option><option value="RECEIVED">Recebido</option><option value="OVERDUE">Atrasado</option></>
                  )}
                </NativeSelect>
              </FormField>
            </div>

            {draft.status === "RECEIVED" || draft.status === "PAID" ? (
              <FormField label={draft.status === "PAID" ? "Pago em" : "Recebido em"} required>
                <Input type="date" value={draft.occurredAt} onChange={(event) => updateDraft("occurredAt", event.target.value)} className="[color-scheme:light]" />
              </FormField>
            ) : null}

            <FormField label="Observação">
              <Textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} maxLength={2000} placeholder="Informações úteis para acompanhar este lançamento." />
            </FormField>

            {feedback ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{feedback}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-[#d0d5dd] bg-white font-semibold text-[#344054] shadow-sm hover:border-[#98a2b3] hover:bg-[#f9fafb] hover:text-[#101828] disabled:bg-[#f2f4f7] disabled:text-[#667085] disabled:opacity-100">Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="bg-[#08783e] font-semibold text-white shadow-sm hover:bg-[#056332] disabled:bg-[#d1fadf] disabled:text-[#667085] disabled:opacity-100">
                {isSaving ? "Salvando..." : "Registrar lançamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  )
}

function SummaryView({ data }: { data: FinancialSnapshot }) {
  const metrics = [
    { label: "Valor da carteira", value: data.summary.portfolioValue, icon: Building2, tone: "neutral" },
    { label: "Entradas no mês", value: data.summary.receivedThisMonth, icon: ArrowUpRight, tone: "positive" },
    { label: "Saídas no mês", value: data.summary.expensesThisMonth, icon: ArrowDownRight, tone: "negative" },
    { label: "Resultado do mês", value: data.summary.monthResult, icon: data.summary.monthResult >= 0 ? TrendingUp : TrendingDown, tone: data.summary.monthResult >= 0 ? "positive" : "negative" },
    { label: "A receber", value: data.summary.receivable, icon: Clock3, tone: "warning" },
    { label: "Atrasado", value: data.summary.overdue, icon: TriangleAlert, tone: "danger" },
  ] as const

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <PortfolioCard portfolio={data.portfolio} />
        <UpcomingCard upcoming={data.upcoming} />
      </section>
      <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
        <CardHeader className="px-4 py-4 sm:px-5">
          <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="size-4 text-[var(--broker-accent)]" />Últimos lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4 pb-4 sm:px-5">
          {[...data.receipts].sort((left, right) => new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime()).slice(0, 5).map((item) => (
            <div key={`${item.source}-${item.id}`} className="flex flex-col gap-2 rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--broker-ink)]">{item.description}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--broker-muted)]">{item.client?.name ?? "Sem cliente"} · {formatDate(item.dueDate)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <StatusBadge status={item.status} />
                <span className="text-sm font-semibold text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(item.amount)}</span>
              </div>
            </div>
          ))}
          {data.receipts.length === 0 ? <EmptyState message="Nenhum recebimento registrado ainda." /> : null}
        </CardContent>
      </Card>
    </>
  )
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: "neutral" | "positive" | "negative" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    positive: "bg-emerald-50 text-emerald-700",
    negative: "bg-rose-50 text-rose-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  }
  return (
    <Card className="rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="size-4" /></div>
        <div className="min-w-0">
          <p className="text-xs text-[var(--broker-muted)]">{label}</p>
          <p className="mt-1 break-words text-base font-semibold tracking-[-0.02em] text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(value)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PortfolioCard({ portfolio }: { portfolio: FinancialSnapshot["portfolio"] }) {
  const groups = [
    { label: "À venda", icon: Landmark, data: portfolio.forSale },
    { label: "Para locação", icon: WalletCards, data: portfolio.forRent },
    { label: "Locações ativas", icon: HandCoins, data: portfolio.activeRentals },
  ]
  return (
    <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
      <CardHeader className="px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4 text-[var(--broker-accent)]" />Carteira ativa</CardTitle>
            <p className="mt-1 text-xs leading-5 text-[var(--broker-muted)]">Indicador operacional. Não compõe receita nem resultado.</p>
          </div>
          <Badge variant="outline" className="border-[var(--broker-border)] bg-white text-[var(--broker-muted)]">{portfolio.totalProperties} {portfolio.totalProperties === 1 ? "imóvel" : "imóveis"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 pb-4 sm:px-5">
        <div>
          <p className="text-2xl font-semibold tracking-[-0.035em] text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(portfolio.totalValue)}</p>
          <p className="mt-1 text-xs text-[var(--broker-muted)]">{portfolio.activeProperties} imóveis em carteira ativa</p>
          {portfolio.unpricedProperties > 0 ? <p className="mt-1 text-xs text-amber-700">{portfolio.unpricedProperties} {portfolio.unpricedProperties === 1 ? "imóvel sem valor informado" : "imóveis sem valor informado"}; não incluído na soma.</p> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {groups.map(({ label, icon: Icon, data }) => (
            <div key={label} className="rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] p-3">
              <div className="flex items-center gap-2 text-xs text-[var(--broker-muted)]"><Icon className="size-3.5" />{label}</div>
              <p className="mt-2 text-sm font-semibold text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(data.value)}</p>
              <p className="mt-0.5 text-xs text-[var(--broker-muted-soft)]">{data.count} {data.count === 1 ? "imóvel" : "imóveis"}{data.unpricedCount > 0 ? ` · ${data.unpricedCount} sem valor` : ""}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function UpcomingCard({ upcoming }: { upcoming: FinancialSnapshot["upcoming"] }) {
  const groups = [
    { label: "Próximos 7 dias", items: upcoming.next7Days, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Próximos 30 dias", items: upcoming.next30Days, tone: "text-blue-700 bg-blue-50" },
    { label: "Atrasados", items: upcoming.overdue, tone: "text-red-700 bg-red-50" },
  ]
  return (
    <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
      <CardHeader className="px-4 py-4 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4 text-[var(--broker-accent)]" />Próximos recebimentos</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 pb-4 sm:px-5">
        {groups.map((group) => (
          <div key={group.label} className="flex items-center justify-between gap-3 rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] p-3">
            <div className="flex items-center gap-2.5">
              <span className={`flex size-8 items-center justify-center rounded-lg ${group.tone}`}><Clock3 className="size-3.5" /></span>
              <div><p className="text-sm font-medium text-[var(--broker-ink)]">{group.label}</p><p className="text-xs text-[var(--broker-muted)]">{group.items.length} lançamento(s)</p></div>
            </div>
            <span className="text-sm font-semibold text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(total(group.items))}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ReceiptList({ items, updatingId, onReceive }: { items: ReceiptItem[]; updatingId: string; onReceive: (item: ReceiptItem) => void }) {
  if (items.length === 0) return <EmptyCard message="Nenhum recebimento registrado. Use “Novo recebimento” para começar." />
  return (
    <div className="grid gap-2.5">
      {items.map((item) => (
        <Card key={`${item.source}-${item.id}`} className="rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[var(--broker-ink)]">{item.description}</p><StatusBadge status={item.status} /></div>
              <p className="mt-1 text-xs text-[var(--broker-muted)]">{categoryLabels[item.category] ?? item.category}{item.source === "RENTAL_PAYMENT" ? " · Integrado da locação" : ""}</p>
            </div>
            <div className="min-w-0 text-xs text-[var(--broker-muted)]"><p className="truncate">{item.client?.name ?? "Sem cliente"}</p><p className="mt-1 truncate">{item.property?.title ?? "Sem imóvel"}</p></div>
            <div className="text-left lg:text-right"><p className="text-sm font-semibold text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(item.amount)}</p><p className="mt-1 text-xs text-[var(--broker-muted)]">Previsto {formatDate(item.dueDate)}</p></div>
            {item.editable && item.status !== "RECEIVED" ? (
              <Button type="button" size="sm" variant="outline" disabled={updatingId === item.id} onClick={() => onReceive(item)} className="justify-self-start lg:justify-self-end"><Check className="size-3.5" />{updatingId === item.id ? "Atualizando..." : "Marcar recebido"}</Button>
            ) : <span className="text-xs text-[var(--broker-muted-soft)] lg:text-right">{item.status === "RECEIVED" ? `Recebido ${formatDate(item.occurredAt)}` : "Somente leitura"}</span>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ExpenseList({ items, updatingId, onPay }: { items: ExpenseItem[]; updatingId: string; onPay: (item: ExpenseItem) => void }) {
  if (items.length === 0) return <EmptyCard message="Nenhuma despesa registrada. Use “Nova despesa” para começar." />
  return (
    <div className="grid gap-2.5">
      {items.map((item) => (
        <Card key={item.id} className="rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] lg:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[var(--broker-ink)]">{item.description}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-xs text-[var(--broker-muted)]">{categoryLabels[item.category] ?? item.category}</p></div>
            <div className="min-w-0 text-xs text-[var(--broker-muted)]"><p className="truncate">{item.client?.name ?? "Sem cliente vinculado"}</p><p className="mt-1 truncate">{item.property?.title ?? "Sem imóvel vinculado"}</p></div>
            <div className="text-left lg:text-right"><p className="text-sm font-semibold text-rose-700">{formatCurrencyBRLFromCents(item.amount)}</p><p className="mt-1 text-xs text-[var(--broker-muted)]">{formatDate(item.date)}</p></div>
            {item.status !== "PAID" ? (
              <Button type="button" size="sm" variant="outline" disabled={updatingId === item.id} onClick={() => onPay(item)} className="justify-self-start lg:justify-self-end"><Check className="size-3.5" />{updatingId === item.id ? "Atualizando..." : "Marcar paga"}</Button>
            ) : <span className="text-xs text-[var(--broker-muted-soft)] lg:text-right">Paga {formatDate(item.occurredAt)}</span>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CommissionList({ items, updatingId, onReceive }: { items: CommissionItem[]; updatingId: string; onReceive: (item: CommissionItem) => void }) {
  if (items.length === 0) return <EmptyCard message="Nenhuma comissão registrada. Use “Nova comissão” para começar." />
  return (
    <div className="grid gap-2.5">
      {items.map((item) => (
        <Card key={item.id} className="rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
          <CardContent className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[var(--broker-ink)]">{item.property?.title ?? "Imóvel não disponível"}</p><StatusBadge status={item.status} /></div><p className="mt-1 truncate text-xs text-[var(--broker-muted)]">{item.client?.name ?? "Cliente não disponível"}</p></div>
            <div className="text-xs text-[var(--broker-muted)]"><p>Operação: <span className="font-medium text-[var(--broker-ink)]">{formatCurrencyBRLFromCents(item.operationAmount)}</span></p><p className="mt-1">Percentual: <span className="font-medium text-[var(--broker-ink)]">{item.commissionPercent.toLocaleString("pt-BR")}%</span></p></div>
            <div><p className="text-base font-semibold text-emerald-700">{formatCurrencyBRLFromCents(item.commissionAmount)}</p><p className="mt-1 text-xs text-[var(--broker-muted)]">Previsão {formatDate(item.dueDate)}</p></div>
            {item.status !== "RECEIVED" ? (
              <Button type="button" size="sm" variant="outline" disabled={updatingId === item.id} onClick={() => onReceive(item)} className="justify-self-start xl:justify-self-end"><Check className="size-3.5" />{updatingId === item.id ? "Atualizando..." : "Marcar recebida"}</Button>
            ) : <span className="text-xs text-[var(--broker-muted-soft)] xl:text-right">Recebida {formatDate(item.receivedAt)}</span>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    EXPECTED: "border-blue-200 bg-blue-50 text-blue-700",
    RECEIVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    OVERDUE: "border-red-200 bg-red-50 text-red-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }
  return <Badge variant="outline" className={styles[status] ?? ""}>{statusLabels[status] ?? status}</Badge>
}

function SectionHeader({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-semibold text-[var(--broker-ink)]">{title}</h2><p className="mt-1 text-sm text-[var(--broker-muted)]">{description}</p></div>
      <Button type="button" onClick={onAction} className="self-start bg-[var(--broker-accent)] text-white hover:bg-[#008633]"><Plus className="size-4" />{action}</Button>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-[13px] font-semibold leading-5 text-[#344054]">{label}{required ? <span aria-hidden="true" className="ml-0.5 text-red-700">*</span> : null}</Label>{children}</div>
}

function NativeSelect({ value, onChange, required, children }: { value: string; onChange: (value: string) => void; required?: boolean; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} required={required} className={`h-9 w-full rounded-xl border border-[#d0d5dd] bg-white px-3 text-sm font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none [color-scheme:light] focus:border-[#08783e] focus:ring-[3px] focus:ring-[#08783e]/15 disabled:border-[#e4e7ec] disabled:bg-[#f2f4f7] disabled:text-[#667085] disabled:opacity-100 ${value ? "text-[#101828]" : "text-[#667085]"}`}>
      {children}
    </select>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-[var(--broker-radius-sm)] border border-dashed border-[var(--broker-border-strong)] bg-[var(--broker-surface-subtle)] p-5 text-center text-sm text-[var(--broker-muted)]">{message}</div>
}

function EmptyCard({ message }: { message: string }) {
  return <Card className="rounded-[var(--broker-radius-lg)] border-dashed border-[var(--broker-border-strong)] bg-[var(--broker-surface)] py-0"><CardContent className="p-8"><EmptyState message={message} /></CardContent></Card>
}

function FinancialLoading() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="eme-shimmer h-24 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-inset)]" />)}</div>
}
