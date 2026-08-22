"use client"

import { useMemo, useState } from "react"
import { CreditCard, DollarSign, PackagePlus, ReceiptText, Sparkles, Wallet } from "lucide-react"

import { AdminBadge, AdminDataTable, AdminDefinitionGrid, AdminEmpty, AdminMetricCard, AdminMetricGrid, AdminSurface } from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminRevenue } from "@/components/use-admin-revenue"
import { Button } from "@/components/ui/button"
import { EmeLoading } from "@/components/ui/eme-loading"
import type { AdminChargeType } from "@/lib/admin-revenue-contract"

function formatCurrency(value: number, currency = "brl") {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: currency.toUpperCase() })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

export function AdminRevenuePage() {
  const { report, isLoading, error, refresh } = useAdminRevenue()
  const [period, setPeriod] = useState("90")
  const [type, setType] = useState<AdminChargeType | "all">("all")

  const charges = useMemo(() => {
    const minimumDate = period === "all" ? null : new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000)
    return (report?.charges ?? []).filter((charge) => (!minimumDate || new Date(charge.createdAt) >= minimumDate) && (type === "all" || charge.type === type))
  }, [period, report, type])

  return (
    <AdminPageShell title="Receita" subtitle="Receita recorrente e cobranças avulsas consolidadas a partir do Stripe">
      <div className="grid min-w-0 gap-5">
        {isLoading && !report ? <EmeLoading message="Consultando cobranças no Stripe..." /> : null}
        {error ? <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318] sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><Button variant="outline" disabled={isLoading} onClick={() => void refresh()}>{isLoading ? "Consultando..." : "Tentar novamente"}</Button></div> : null}

        {report ? (
          <>
            <AdminMetricGrid>
              <AdminMetricCard label="Receita do mês" value={formatCurrency(report.overview.monthlyRevenueCents)} icon={<DollarSign className="size-5" />} />
              <AdminMetricCard label="Receita recorrente" value={formatCurrency(report.overview.recurringRevenueCents)} hint="Assinaturas pagas no mês." icon={<Wallet className="size-5" />} />
              <AdminMetricCard label="Receita avulsa" value={formatCurrency(report.overview.oneOffRevenueCents)} hint="Créditos, expansões e pacotes extras." icon={<ReceiptText className="size-5" />} />
              <AdminMetricCard label="Créditos vendidos" value={String(report.overview.creditsSold)} icon={<Sparkles className="size-5" />} />
              <AdminMetricCard label="Expansões vendidas" value={String(report.overview.expansionsSold)} icon={<PackagePlus className="size-5" />} />
              <AdminMetricCard label="Ticket médio" value={formatCurrency(report.overview.averageTicketCents)} icon={<CreditCard className="size-5" />} />
            </AdminMetricGrid>

            <AdminSurface title="Composição da receita" subtitle="Separação financeira das cobranças pagas no mês atual.">
              <AdminDefinitionGrid columns={3} items={[{ label: "Receita total", value: formatCurrency(report.overview.monthlyRevenueCents) }, { label: "Recorrente / assinaturas", value: formatCurrency(report.overview.recurringRevenueCents) }, { label: "Avulsa / extras", value: formatCurrency(report.overview.oneOffRevenueCents) }]} />
            </AdminSurface>

            <AdminSurface
              title="Histórico de cobranças"
              subtitle="Faturas e recibos reais, sem consumo de créditos ou movimentações sem pagamento."
              aside={<div className="flex flex-wrap gap-2"><select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-9 rounded-xl border border-black/[0.08] bg-white px-3 text-xs text-[#4b5563]"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="all">Todo o histórico</option></select><select value={type} onChange={(event) => setType(event.target.value as AdminChargeType | "all")} className="h-9 rounded-xl border border-black/[0.08] bg-white px-3 text-xs text-[#4b5563]"><option value="all">Todos os tipos</option><option value="Assinatura">Assinatura</option><option value="Créditos IA">Créditos IA</option><option value="Expansão da Carteira">Expansão da Carteira</option><option value="Pacote extra">Pacote extra</option></select></div>}
            >
              {charges.length ? <AdminDataTable columns={["Usuário", "Produto / tipo", "Valor", "Data", "Status", "Referência Stripe", "Documento"]} rows={charges.map((charge) => [
                <div key="user" className="min-w-48"><p className="font-semibold text-[#111827]">{charge.userName}</p><p className="mt-1 text-xs text-[#7b8491]">{charge.userEmail}</p></div>,
                <div key="product" className="min-w-52"><p>{charge.description}</p><p className="mt-1 text-xs text-[#7b8491]">{charge.type}</p></div>,
                <span key="amount" className="whitespace-nowrap font-semibold text-[#111827]">{formatCurrency(charge.amountCents, charge.currency)}</span>,
                <span key="date" className="whitespace-nowrap">{formatDate(charge.createdAt)}</span>,
                <AdminBadge key="status" tone={["paid", "succeeded"].includes(charge.status) ? "success" : charge.status === "open" ? "warning" : "danger"}>{charge.status}</AdminBadge>,
                <span key="reference" className="font-mono text-xs">{charge.stripeReference}</span>,
                charge.receiptUrl ? <Button key="receipt" asChild size="sm" variant="outline"><a href={charge.receiptUrl} target="_blank" rel="noreferrer">Abrir fatura/recibo</a></Button> : <span key="receipt-empty" className="text-xs text-[#98a2b3]">Indisponível</span>,
              ])} /> : <AdminEmpty title="Nenhuma cobrança encontrada" description="Não há pagamentos reais para os filtros selecionados." />}
            </AdminSurface>
          </>
        ) : null}
      </div>
    </AdminPageShell>
  )
}
