'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  alternatives,
  defaultCriteria,
  defaultQuery,
  formatPrice,
  searchResults,
  sortResults,
  type Criterion,
  type SortValue,
} from '@/lib/marketplace/search-data'
import { brokers } from '@/lib/marketplace/data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { SearchInterpretation } from '@/components/marketplace/search/search-interpretation'
import { ResultsToolbar, type QuickFilters } from '@/components/marketplace/search/results-toolbar'
import { FiltersSheet } from '@/components/marketplace/search/filters-sheet'
import { ResultsPropertyCard } from '@/components/marketplace/search/results-property-card'
import { ResultsMap } from '@/components/marketplace/search/results-map'
import { AlternativePropertyCard } from '@/components/marketplace/search/alternative-card'
import { CompareTray } from '@/components/marketplace/search/compare-tray'
import { ComparisonPanel } from '@/components/marketplace/search/comparison-panel'
import { LeadAssistancePanel } from '@/components/marketplace/search/lead-assistance-panel'
import {
  IncompleteSearchHint,
  ResultsSkeleton,
  SearchEmptyState,
  SearchErrorState,
} from '@/components/marketplace/search/search-states'
import type { ResultsView } from '@/components/marketplace/search/view-toggle'
import { cn } from '@/lib/utils'
import { EmeLoader } from '@/components/marketplace/eme-loader'

type Phase = 'loading' | 'ready' | 'error'
const MAX_COMPARE = 3

export function SearchResults({
  initialQuery,
  estado,
}: {
  initialQuery?: string
  estado?: 'erro' | 'vazio'
}) {
  const [query, setQuery] = useState(initialQuery?.trim() || defaultQuery)
  const [criteria, setCriteria] = useState<Criterion[]>(defaultCriteria)
  const [sort, setSort] = useState<SortValue>('compatibilidade')
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({})
  const [moreSelected, setMoreSelected] = useState<Set<string>>(new Set())
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [compare, setCompare] = useState<string[]>([])
  const [view, setView] = useState<ResultsView>('lista')
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>(estado === 'erro' ? 'error' : 'loading')
  const forceEmpty = estado === 'vazio'

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [leadOpen, setLeadOpen] = useState(false)

  const alternativesRef = useRef<HTMLDivElement | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)

  // Simula o processamento da intenção ao abrir a página.
  useEffect(() => {
    if (phase !== 'loading') return
    const t = setTimeout(() => setPhase('ready'), 650)
    return () => clearTimeout(t)
  }, [phase])

  function runSearch(nextQuery?: string) {
    if (nextQuery) setQuery(nextQuery)
    setPhase('loading')
  }

  const filtered = useMemo(() => {
    if (forceEmpty) return []
    let list = searchResults.filter((r) => {
      if (quickFilters.precoMax && r.price > quickFilters.precoMax) return false
      if (quickFilters.quartos && r.bedrooms < quickFilters.quartos) return false
      if (quickFilters.areaMin && r.area < quickFilters.areaMin) return false
      return true
    })
    list = sortResults(list, sort)
    return list
  }, [forceEmpty, quickFilters, sort])

  const selectedResults = useMemo(
    () => compare.map((slug) => searchResults.find((r) => r.slug === slug)).filter(Boolean) as typeof searchResults,
    [compare],
  )

  function toggleFavorite(slug: string) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function toggleCompare(slug: string) {
    setCompare((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, slug]
    })
  }

  function removeCriterion(key: Criterion['key']) {
    setCriteria((prev) => prev.filter((c) => c.key !== key))
    // Remover a faixa de valor também libera o filtro rápido correspondente.
    if (key === 'valorMax') setQuickFilters((f) => ({ ...f, precoMax: undefined }))
  }

  function toggleMore(value: string) {
    setMoreSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function clearFilters() {
    setQuickFilters({})
    setMoreSelected(new Set())
  }

  const showMap = view === 'mapa'
  const showList = view === 'lista'
  const isVeryBroad = criteria.length <= 1

  return (
    <div ref={topRef}>
      {/* Abertura + interpretação */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-24 md:px-8 md:pt-28">
        <Reveal>
          <SearchInterpretation
            query={query}
            criteria={criteria}
            onSubmitQuery={(value) => runSearch(value)}
            onRemoveCriterion={removeCriterion}
          />
        </Reveal>
      </section>

      {/* Toolbar */}
      <section className="mx-auto mt-8 w-full max-w-6xl px-5 md:px-8">
        <Reveal>
          <ResultsToolbar
            count={filtered.length}
            sort={sort}
            onSortChange={setSort}
            filters={quickFilters}
            onFiltersChange={setQuickFilters}
            onOpenMoreFilters={() => setFiltersOpen(true)}
            onClear={clearFilters}
            view={view}
            onViewChange={setView}
          />
        </Reveal>
        {isVeryBroad && phase === 'ready' && !forceEmpty && (
          <div className="mt-4">
            <IncompleteSearchHint onHelp={() => setLeadOpen(true)} />
          </div>
        )}
      </section>

      {/* Área principal: lista + mapa */}
      <section className="mx-auto mt-6 w-full max-w-6xl px-5 md:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_44%]">
          {/* Coluna de resultados */}
          <div className={cn('min-w-0', showMap && 'hidden lg:block')}>
            {phase === 'loading' ? (
              <ResultsSkeleton />
            ) : phase === 'error' ? (
              <SearchErrorState onRetry={() => runSearch()} />
            ) : filtered.length === 0 ? (
              <SearchEmptyState
                onAdjust={() => {
                  clearFilters()
                  topRef.current?.scrollIntoView({ behavior: 'smooth' })
                }}
                onAlternatives={() =>
                  alternativesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                onHelp={() => setLeadOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {filtered.map((result, i) => (
                  <Reveal key={result.slug} delay={i * 70}>
                    <ResultsPropertyCard
                      result={result}
                      favorite={favorites.has(result.slug)}
                      onToggleFavorite={toggleFavorite}
                      selected={compare.includes(result.slug)}
                      onToggleCompare={toggleCompare}
                      compareDisabled={!compare.includes(result.slug) && compare.length >= MAX_COMPARE}
                      highlighted={highlighted === result.slug}
                      onHover={setHighlighted}
                    />
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          {/* Mapa */}
          <div className={cn(showList && 'hidden lg:block')}>
            <div className="lg:sticky lg:top-24">
              <div className="h-[70vh] lg:h-[calc(100vh-7rem)]">
                {phase === 'loading' ? (
                  <div className="grid h-full w-full place-items-center rounded-[1.75rem] border border-border/70 bg-card">
                    <EmeLoader label="Carregando mapa" />
                  </div>
                ) : (
                  <ResultsMap
                    results={phase === 'ready' ? filtered : []}
                    highlighted={highlighted}
                    onHover={setHighlighted}
                    onSelect={setHighlighted}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparação — construtor de seleção */}
      <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-20 md:px-8">
        <Reveal>
          <SectionHeading
            title="Compare suas melhores opções"
            support="Selecione até 3 imóveis para ver lado a lado."
          />
        </Reveal>
        <Reveal className="mt-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: MAX_COMPARE }).map((_, i) => {
              const item = selectedResults[i]
              if (item) {
                return (
                  <div
                    key={item.slug}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-[var(--shadow-soft)]"
                  >
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image || '/marketplace/placeholder.svg'} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{formatPrice(item.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCompare(item.slug)}
                      aria-label={`Remover ${item.title} da comparação`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )
              }
              return (
                <div
                  key={`slot-${i}`}
                  className="flex min-h-[88px] items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar imóvel
                </div>
              )
            })}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setComparisonOpen(true)}
              disabled={selectedResults.length < 2}
              className={cn(
                'inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-transform',
                selectedResults.length < 2
                  ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                  : 'bg-primary text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.35)] hover:scale-[1.02] active:scale-95',
              )}
            >
              Comparar imóveis
            </button>
            {selectedResults.length > 0 && (
              <button
                type="button"
                onClick={() => setCompare([])}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </Reveal>
      </section>

      {/* Alternativas */}
      <section ref={alternativesRef} className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-20 md:px-8">
        <Reveal>
          <SectionHeading
            title="Talvez você também considere"
            support="Opções próximas que fogem de algum critério, com transparência."
          />
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {alternatives.map((alternative, i) => (
            <Reveal key={alternative.slug} delay={i * 90}>
              <AlternativePropertyCard alternative={alternative} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Profissionais da região */}
      <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-20 md:px-8">
        <Reveal>
          <SectionHeading
            title="Quem conhece a região que você procura"
            support="Profissionais locais prontos para ajudar na sua busca em Vacaria e região."
          />
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {brokers.map((broker, i) => (
            <Reveal key={broker.slug} delay={i * 90} className="flex flex-col gap-2">
              {i === 0 && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-eme-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Mais perto da sua busca
                </span>
              )}
              <BrokerCard broker={broker} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Ajuda para encontrar */}
      <LeadAssistancePanel open={leadOpen} onOpenChange={setLeadOpen} searchSummary={query} />

      {/* Sobreposições */}
      <CompareTray
        selected={selectedResults}
        onRemove={toggleCompare}
        onClear={() => setCompare([])}
        onCompare={() => setComparisonOpen(true)}
      />
      <ComparisonPanel
        open={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        results={selectedResults}
      />
      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        selected={moreSelected}
        onToggle={toggleMore}
        onClear={() => setMoreSelected(new Set())}
      />
    </div>
  )
}
