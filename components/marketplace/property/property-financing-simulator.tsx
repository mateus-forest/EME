'use client'

import { useId, useMemo, useState } from 'react'
import { Calculator, ChevronDown } from 'lucide-react'
import { StructuredInput } from '@/components/ui/structured-input'
import { calculateFixedInstallmentCents } from '@/lib/proposal-template'
import { CATALOG_GLASS_SURFACE_CLASS, CATALOG_INPUT_CLASS } from '@/lib/catalog-visual-system'
import { cn } from '@/lib/utils'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

function formatCurrencyFromCents(value: number) {
  return currencyFormatter.format(Math.max(0, value) / 100)
}

function parseMonthlyRate(value: string) {
  const parsed = Number(value.trim().replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

export function PropertyFinancingSimulator({ price }: { price: number }) {
  const contentId = useId()
  const propertyValueCents = Math.max(0, Math.round(price * 100))
  const [open, setOpen] = useState(false)
  const [entryCents, setEntryCents] = useState(() => Math.round(propertyValueCents * 0.2))
  const [installmentCount, setInstallmentCount] = useState(360)
  const [monthlyInterest, setMonthlyInterest] = useState('0,89')
  const financedValueCents = Math.max(0, propertyValueCents - entryCents)
  const estimatedInstallmentCents = useMemo(
    () => calculateFixedInstallmentCents(financedValueCents, installmentCount, parseMonthlyRate(monthlyInterest)),
    [financedValueCents, installmentCount, monthlyInterest],
  )
  const inputClass = cn(CATALOG_INPUT_CLASS, 'h-10 w-full min-w-0 px-3 text-sm')

  return (
    <section className={cn(CATALOG_GLASS_SURFACE_CLASS, 'mx-auto w-full max-w-4xl overflow-hidden rounded-[1.75rem]')}>
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls={contentId} className="flex min-h-16 w-full items-center gap-3 px-5 text-left sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/75 bg-white/55 text-primary shadow-[var(--shadow-soft)]">
          <Calculator className="size-4.5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Simule seu financiamento</h2>
        <ChevronDown className={cn('ml-auto size-5 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180')} aria-hidden="true" />
      </button>

      <div id={contentId} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-white/70 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField label="Valor do imóvel" value={formatCurrencyFromCents(propertyValueCents)} />
              <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
                Entrada
                <StructuredInput kind="currency" value={entryCents / 100} onValueChange={(_, normalized) => setEntryCents(Math.min(propertyValueCents, typeof normalized === 'number' ? Math.max(0, normalized) : 0))} className={inputClass} aria-label="Valor da entrada" />
              </label>
              <ReadOnlyField label="Valor financiado" value={formatCurrencyFromCents(financedValueCents)} />
              <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
                Parcelas
                <StructuredInput kind="quantity" value={installmentCount} onValueChange={(_, normalized) => setInstallmentCount(Math.min(600, Math.max(1, typeof normalized === 'number' ? Math.round(normalized) : 1)))} className={inputClass} aria-label="Quantidade de parcelas" />
              </label>
              <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground">
                Juros mensais (%)
                <input value={monthlyInterest} onChange={(event) => setMonthlyInterest(event.target.value.replace(/[^\d,.]/g, '').slice(0, 8))} inputMode="decimal" className={inputClass} aria-label="Juros mensais em percentual" />
              </label>
              <ReadOnlyField label="Parcela estimada" value={formatCurrencyFromCents(estimatedInstallmentCents)} emphasis />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Esta é apenas uma simulação. Condições, taxas e valores devem ser confirmados com a instituição financeira.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ReadOnlyField({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn('flex h-10 min-w-0 items-center overflow-hidden rounded-xl border border-white/70 bg-white/40 px-3 text-sm font-semibold', emphasis ? 'text-primary' : 'text-foreground')}>
        <span className="truncate">{value}</span>
      </span>
    </div>
  )
}
