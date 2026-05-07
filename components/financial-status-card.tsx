"use client"

import { AlertCircle, CheckCircle2, Clock3, CreditCard, Info } from "lucide-react"

import type { FinancialSummary, PaymentNotificationStatus } from "@/components/use-payment-notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FinancialStatusCardProps = {
  title: string
  summary: FinancialSummary
  onRegularize?: () => void
  onViewHistory?: () => void
}

const statusUi: Record<
  PaymentNotificationStatus,
  {
    label: string
    chip: string
    accent: string
    icon: typeof CheckCircle2
  }
> = {
  "em-dia": {
    label: "Em dia",
    chip: "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]",
    accent: "text-[#69F0AE]",
    icon: CheckCircle2,
  },
  "vencimento-proximo": {
    label: "Vencendo",
    chip: "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]",
    accent: "text-[#69F0AE]",
    icon: Clock3,
  },
  "atraso-leve": {
    label: "Atraso leve",
    chip: "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]",
    accent: "text-[#ffe082]",
    icon: AlertCircle,
  },
  inadimplente: {
    label: "Inadimplente",
    chip: "border-[#ff6b6b]/20 bg-[#ff6b6b]/10 text-[#ff9b9b]",
    accent: "text-[#ff9b9b]",
    icon: AlertCircle,
  },
  "notificacao-recebida": {
    label: "Notificação recebida",
    chip: "border-white/[0.08] bg-white/[0.06] text-white/80",
    accent: "text-white",
    icon: Info,
  },
  "aguardando-regularizacao": {
    label: "Aguardando regularização",
    chip: "border-[#8ecae6]/20 bg-[#8ecae6]/10 text-[#c9f0ff]",
    accent: "text-[#c9f0ff]",
    icon: CreditCard,
  },
}

export function FinancialStatusCard({
  title,
  summary,
  onRegularize,
  onViewHistory,
}: FinancialStatusCardProps) {
  const ui = statusUi[summary.financialStatus]
  const Icon = ui.icon
  const hasPendingIssue =
    summary.financialStatus === "atraso-leve" ||
    summary.financialStatus === "inadimplente"

  return (
    <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardHeader className="px-6 py-5">
        <CardTitle className="text-xl text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 pt-0">
        <div className="flex flex-col gap-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex size-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] ${ui.accent}`}>
              <Icon className="size-4.5" />
            </div>
            <div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] ${ui.chip}`}>{ui.label}</span>
              <p className="mt-3 text-sm leading-6 text-white/60">{summary.contextMessage}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            {onViewHistory && (
              <Button
                type="button"
                variant="ghost"
                onClick={onViewHistory}
                className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
              >
                Ver histórico
              </Button>
            )}
            {hasPendingIssue && onRegularize && (
              <Button
                type="button"
                onClick={onRegularize}
                className="h-9 rounded-xl bg-[#00C853] px-3 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
              >
                Regularizar pagamento
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoBlock label="Último pagamento" value={summary.lastPaymentAt} />
          <InfoBlock label="Próxima cobrança" value={summary.nextBillingAt} />
          <InfoBlock label="Valor atual do plano" value={summary.currentAmount} />
          <InfoBlock label="Valor em aberto" value={summary.valueOpen ?? "Sem pendências"} />
        </div>
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}
