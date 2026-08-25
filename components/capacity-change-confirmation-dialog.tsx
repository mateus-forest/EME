"use client"

import { ArrowRight, Building2, CalendarDays, Loader2, ReceiptText } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CapacityChangePreview } from "@/lib/stripe-capacity-client"

type Props = {
  error: string | null
  isConfirming: boolean
  isLoading: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  preview: CapacityChangePreview | null
}

function formatCurrency(amountInCents: number, currency = "brl") {
  return new Intl.NumberFormat("pt-BR", {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amountInCents / 100)
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(timestamp * 1000),
  )
}

function formatLimit(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value)
}

export function CapacityChangeConfirmationDialog({
  error,
  isConfirming,
  isLoading,
  onConfirm,
  onOpenChange,
  open,
  preview,
}: Props) {
  const isRemoval = preview?.operation === "remove"
  const currentQuantity = preview?.currentCapacity?.quantity ?? 0
  const targetQuantity = preview?.targetCapacity?.quantity ?? 0
  const actionLabel = preview
    ? isRemoval
      ? "Remover capacidade adicional"
      : preview.operation === "change"
        ? `Alterar capacidade de +${currentQuantity} para +${targetQuantity} imóveis`
        : `Adicionar +${targetQuantity} imóveis`
    : "Preparando confirmação"

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isConfirming && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[1.75rem] border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(244,250,246,0.94))] p-0 shadow-[0_32px_90px_rgba(12,54,37,0.22)] sm:max-w-[620px]">
        <div className="border-b border-emerald-950/10 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
          <DialogHeader className="space-y-2 text-left">
            <div className="mb-2 flex size-11 items-center justify-center rounded-2xl border border-emerald-900/10 bg-emerald-600/10 text-emerald-700 shadow-inner">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
              {isRemoval ? "Remover capacidade adicional" : "Confirmar capacidade adicional"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600">
              Confira o impacto operacional e financeiro antes de continuar.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-5 sm:px-8">
          {isLoading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="size-7 animate-spin text-emerald-700" aria-hidden="true" />
              <div>
                <p className="font-medium text-slate-900">Consultando a Stripe</p>
                <p className="mt-1 text-sm text-slate-500">Calculando prorrata e próxima mensalidade.</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-800">
              {error}
            </div>
          ) : preview ? (
            <>
              <section className="rounded-2xl border border-emerald-950/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:p-5">
                <p className="text-lg font-semibold text-slate-950">{actionLabel}</p>
                <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{formatLimit(preview.currentLimit)}</span>
                  <ArrowRight className="size-4 text-emerald-700" aria-hidden="true" />
                  <span className="font-semibold text-emerald-800">{formatLimit(preview.newLimit)} imóveis</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Seu limite passará de {formatLimit(preview.currentLimit)} para {formatLimit(preview.newLimit)} imóveis.
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    <ReceiptText className="size-4 text-emerald-700" aria-hidden="true" />
                    {isRemoval ? "Capacidade após remoção" : "Capacidade adicional"}
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatCurrency(preview.targetCapacity?.amount ?? 0, preview.nextMonthly.currency)}
                    <span className="ml-1 text-sm font-normal text-slate-500">/mês</span>
                  </p>
                  {preview.operation === "change" && preview.currentCapacity ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Atual: {formatCurrency(preview.currentCapacity.amount, preview.currentCapacity.currency)}/mês
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-emerald-900/15 bg-emerald-700/[0.06] p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-emerald-800">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Cobrança hoje
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-950">
                    {formatCurrency(preview.proration.netAmount, preview.proration.currency)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Valor proporcional referente ao período restante até {formatDate(preview.proration.periodEnd)}.
                  </p>
                </div>
              </section>

              {preview.proration.creditAmount > 0 ? (
                <div className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-4">
                    <span>Crédito pelo período não utilizado</span>
                    <strong className="whitespace-nowrap font-semibold text-slate-900">
                      {formatCurrency(preview.proration.creditAmount, preview.proration.currency)}
                    </strong>
                  </div>
                  {preview.proration.netCreditAmount > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Saldo líquido a favor: {formatCurrency(preview.proration.netCreditAmount, preview.proration.currency)}.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-300">Próxima mensalidade</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {formatCurrency(preview.nextMonthly.amount, preview.nextMonthly.currency)}
                </p>
                <div className="mt-4 space-y-2 border-t border-white/15 pt-4 text-sm text-slate-300">
                  <div className="flex justify-between gap-4">
                    <span>Plano {preview.plan.name}</span>
                    <span>{formatCurrency(preview.plan.amount, preview.plan.currency)}/mês</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Capacidade {targetQuantity ? `+${targetQuantity}` : "removida"}</span>
                    <span>{formatCurrency(preview.targetCapacity?.amount ?? 0, preview.nextMonthly.currency)}/mês</span>
                  </div>
                </div>
              </section>

              <p className="text-sm leading-6 text-slate-600">
                {isRemoval
                  ? `A remoção entra em vigor após a confirmação da Stripe. A próxima mensalidade será de ${formatCurrency(preview.nextMonthly.amount, preview.nextMonthly.currency)} e seus imóveis existentes serão preservados.`
                  : `A partir da próxima renovação, o valor mensal da sua assinatura será de ${formatCurrency(preview.nextMonthly.amount, preview.nextMonthly.currency)} enquanto esta capacidade adicional estiver ativa.`}
              </p>
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t border-emerald-950/10 bg-white/55 px-6 py-4 sm:px-8">
          <Button variant="outline" disabled={isConfirming} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-800 text-white hover:bg-emerald-900"
            disabled={!preview || Boolean(error) || isLoading || isConfirming}
            onClick={onConfirm}
          >
            {isConfirming ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            {isRemoval
              ? "Confirmar remoção"
              : preview?.operation === "change"
                ? "Confirmar alteração"
                : "Confirmar e adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
