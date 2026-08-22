'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import {
  brokerTransactionOptions,
  type BrokerProfile,
} from '@/lib/marketplace/pages-data'
import { BrokerProfileCard } from '@/components/marketplace/pages/broker-profile-card'
import { cn } from '@/lib/utils'
import {
  CATALOG_GLASS_SURFACE_CLASS,
  CATALOG_INPUT_CLASS,
  CATALOG_SECONDARY_CTA_CLASS,
} from '@/lib/catalog-visual-system'

const ratingOptions = [
  { value: 'all', label: 'Todas as avaliações' },
  { value: '4', label: '4,0+' },
  { value: '4.5', label: '4,5+' },
  { value: '4.8', label: '4,8+' },
]

const featuredOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'featured', label: 'Corretores em destaque' },
]

function Segmented({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-start justify-start gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'inline-flex min-h-8 max-w-full items-center rounded-full border px-2.5 py-1 text-left text-xs leading-4 transition-colors',
              value === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-eme-50',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BrokersDirectory({ brokers }: { brokers: BrokerProfile[] }) {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('all')
  const [specialty, setSpecialty] = useState('all')
  const [transaction, setTransaction] = useState('all')
  const [rating, setRating] = useState('all')
  const [featured, setFeatured] = useState('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const regionOptions = useMemo(() => [{ value: 'all', label: 'Todas as regiões' }, ...Array.from(new Map(brokers.map((broker) => [broker.regionSlug, broker.region])).entries()).map(([value, label]) => ({ value, label }))], [brokers])
  const specialtyOptions = useMemo(() => {
    const specialties = Array.from(new Map(brokers.flatMap((broker) => broker.specialties).map((value) => [value.toLocaleLowerCase('pt-BR'), value])).values())
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
    return [{ value: 'all', label: 'Todas as especialidades' }, ...specialties.map((value) => ({ value, label: value.length > 40 ? `${value.slice(0, 40)}…` : value }))]
  }, [brokers])
  const hasRealRatings = brokers.some((broker) => broker.reviewCount > 0 && broker.rating > 0)
  const hasFeatured = brokers.some((broker) => broker.featured)

  const filtered = useMemo(() => {
    const queryTokens = query.trim().toLocaleLowerCase('pt-BR').split(/\s+/).filter(Boolean)
    return brokers.filter((broker) => {
      const searchable = `${broker.name} ${broker.region} ${broker.specialties.join(' ')}`.toLocaleLowerCase('pt-BR')
      if (queryTokens.some((token) => !searchable.includes(token))) return false
      if (region !== 'all' && broker.regionSlug !== region) return false
      if (specialty !== 'all' && !broker.specialties.some((value) => value.toLocaleLowerCase('pt-BR') === specialty.toLocaleLowerCase('pt-BR'))) return false
      if (transaction !== 'all' && broker.transaction !== transaction && broker.transaction !== 'ambos') return false
      if (rating !== 'all' && broker.rating < Number(rating)) return false
      if (featured === 'featured' && !broker.featured) return false
      return true
    })
  }, [brokers, featured, query, rating, region, specialty, transaction])

  const activeFilters = [region, specialty, transaction, ...(hasRealRatings ? [rating] : []), ...(hasFeatured ? [featured] : [])].filter((value) => value !== 'all').length

  function reset() {
    setRegion('all')
    setSpecialty('all')
    setTransaction('all')
    setRating('all')
    setFeatured('all')
  }

  const filterControls = (
    <div className="flex flex-col gap-6">
      <Segmented label="Região" options={regionOptions} value={region} onChange={setRegion} />
      <Segmented label="Especialidade" options={specialtyOptions} value={specialty} onChange={setSpecialty} />
      <Segmented label="Finalidade" options={brokerTransactionOptions} value={transaction} onChange={setTransaction} />
      {hasRealRatings ? <Segmented label="Avaliação" options={ratingOptions} value={rating} onChange={setRating} /> : null}
      {hasFeatured ? <Segmented label="Destaques" options={featuredOptions} value={featured} onChange={setFeatured} /> : null}
    </div>
  )

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Todos os corretores</h2>
        <p className="mt-2 text-sm text-muted-foreground">Busque e filtre profissionais por região, especialidade e perfil de atuação.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, região ou especialidade"
            aria-label="Buscar corretores"
            className={cn(CATALOG_INPUT_CLASS, 'h-12 w-full rounded-full pl-11 pr-4 text-sm')}
          />
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(CATALOG_SECONDARY_CTA_CLASS, 'inline-flex h-12 shrink-0 items-center justify-center gap-2 px-5 text-sm lg:hidden')}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros
          {activeFilters > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{activeFilters}</span>}
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className={cn(CATALOG_GLASS_SURFACE_CLASS, 'sticky top-24 overflow-visible rounded-[1.75rem] p-6')}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Filtrar</h3>
              {activeFilters > 0 && <button type="button" onClick={reset} className="text-xs font-medium text-primary hover:underline">Limpar</button>}
            </div>
            {filterControls}
          </div>
        </aside>
        <div>
          <p className="mb-4 text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'especialista encontrado' : 'especialistas encontrados'}</p>
          {filtered.length ? (
            <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2">
              {filtered.map((broker) => <BrokerProfileCard key={broker.slug} broker={broker} />)}
            </div>
          ) : (
            <div className={cn(CATALOG_GLASS_SURFACE_CLASS, 'rounded-[1.75rem] border-dashed p-10 text-center')}>
              <p className="text-sm text-muted-foreground">Nenhum especialista encontrado com esses filtros.</p>
              <button type="button" onClick={() => { reset(); setQuery('') }} className="mt-4 text-sm font-medium text-primary hover:underline">Limpar filtros</button>
            </div>
          )}
        </div>
      </div>

      {sheetOpen && createPortal(
        <div className="marketplace-shell marketplace-overlay fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros de corretores">
          <button type="button" aria-label="Fechar filtros" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
          <div className={cn(CATALOG_GLASS_SURFACE_CLASS, 'marketplace-panel absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] p-6')}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Filtrar corretores</h2>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {filterControls}
            <div className="mt-6 flex gap-3 border-t border-border/70 pt-4">
              <button type="button" onClick={reset} className="h-11 flex-1 rounded-full border border-border text-sm font-medium text-foreground">Limpar</button>
              <button type="button" onClick={() => setSheetOpen(false)} className="h-11 flex-[2] rounded-full bg-primary text-sm font-medium text-primary-foreground">Ver {filtered.length} especialistas</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
