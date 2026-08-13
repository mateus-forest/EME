'use client'

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X, Zap } from 'lucide-react'
import {
  brokerProfiles,
  brokerRegionOptions,
  brokerSpecialtyOptions,
  brokerTransactionOptions,
} from '@/lib/marketplace/pages-data'
import { BrokerProfileCard } from '@/components/marketplace/pages/broker-profile-card'
import { cn } from '@/lib/utils'

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              value === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-eme-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BrokersDirectory() {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('all')
  const [specialty, setSpecialty] = useState('all')
  const [transaction, setTransaction] = useState('all')
  const [fastOnly, setFastOnly] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return brokerProfiles.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !b.region.toLowerCase().includes(q) && !b.specialty.toLowerCase().includes(q))
        return false
      if (region !== 'all' && b.regionSlug !== region) return false
      if (specialty !== 'all' && !b.propertyTypes.includes(specialty as never)) return false
      if (transaction !== 'all' && b.transaction !== transaction && b.transaction !== 'ambos') return false
      if (fastOnly && !b.respondsFast) return false
      return true
    })
  }, [query, region, specialty, transaction, fastOnly])

  const activeFilters =
    (region !== 'all' ? 1 : 0) + (specialty !== 'all' ? 1 : 0) + (transaction !== 'all' ? 1 : 0) + (fastOnly ? 1 : 0)

  function reset() {
    setRegion('all')
    setSpecialty('all')
    setTransaction('all')
    setFastOnly(false)
  }

  const filterControls = (
    <div className="flex flex-col gap-6">
      <Segmented label="Região" options={brokerRegionOptions} value={region} onChange={setRegion} />
      <Segmented label="Especialidade" options={brokerSpecialtyOptions} value={specialty} onChange={setSpecialty} />
      <Segmented label="Finalidade" options={brokerTransactionOptions} value={transaction} onChange={setTransaction} />
      <button
        type="button"
        onClick={() => setFastOnly((v) => !v)}
        aria-pressed={fastOnly}
        className={cn(
          'inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
          fastOnly
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-eme-50',
        )}
      >
        <Zap className="h-4 w-4" aria-hidden="true" />
        Responde rápido
      </button>
    </div>
  )

  return (
    <div>
      {/* Barra de busca + botão de filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, região ou especialidade"
            aria-label="Buscar corretores"
            className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-eme-50 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros
          {activeFilters > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filtros fixos no desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Filtrar</h2>
              {activeFilters > 0 && (
                <button type="button" onClick={reset} className="text-xs font-medium text-primary hover:underline">
                  Limpar
                </button>
              )}
            </div>
            {filterControls}
          </div>
        </aside>

        {/* Resultados */}
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'especialista encontrado' : 'especialistas encontrados'}
          </p>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {filtered.map((broker) => (
                <BrokerProfileCard key={broker.slug} broker={broker} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-card p-10 text-center">
              <p className="text-pretty text-sm text-muted-foreground">
                Nenhum especialista encontrado com esses filtros. Ajuste a busca para ver mais opções.
              </p>
              <button
                type="button"
                onClick={() => {
                  reset()
                  setQuery('')
                }}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet de filtros no mobile */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] bg-card p-6 shadow-[var(--shadow-float)]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Filtrar especialistas</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Fechar filtros"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-eme-50 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {filterControls}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="h-11 flex-1 rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-eme-50"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="h-11 flex-[2] rounded-full bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-eme-600"
              >
                Ver {filtered.length} especialistas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
