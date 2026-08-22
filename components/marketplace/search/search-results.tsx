'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  formatPrice,
  sortResults,
  type Criterion,
  type SearchResult,
  type SortValue,
} from '@/lib/marketplace/search-data'
import {
  emptyMarketplaceFilters,
  filterSearchResults,
  replaceInferredMarketplaceFilters,
  filtersToCriteria,
  filtersToSearchParams,
  removeFilterCriterion,
  type MarketplaceFilters,
} from '@/lib/marketplace/search-filters'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { SearchInterpretation } from '@/components/marketplace/search/search-interpretation'
import { ResultsToolbar, type QuickFilters } from '@/components/marketplace/search/results-toolbar'
import { MarketplaceFiltersDialog } from '@/components/marketplace/search/marketplace-filters-dialog'
import { PropertyCard } from '@/components/marketplace/property-card'
import { ResultsMap } from '@/components/marketplace/search/results-map'
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
import { trackMarketplaceEvent } from '@/lib/marketplace/analytics'
import { useMarketplaceSearchLoading } from '@/components/marketplace/search/cinematic-search-loading'

type Phase = 'loading' | 'ready' | 'error'
const MAX_COMPARE = 3

export function SearchResults({
  initialQuery,
  initialFilters,
  estado,
  results,
  brokers,
}: {
  initialQuery?: string
  initialFilters: MarketplaceFilters
  estado?: 'erro' | 'vazio'
  results: SearchResult[]
  brokers: BrokerProfile[]
}) {
  const { finishSearchLoading, startSearchLoading } = useMarketplaceSearchLoading()
  const [query, setQuery] = useState(initialQuery?.trim() || '')
  const [filters, setFilters] = useState<MarketplaceFilters>(() => initialFilters)
  const [sort, setSort] = useState<SortValue>('compatibilidade')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [compare, setCompare] = useState<string[]>([])
  const [view, setView] = useState<ResultsView>('lista')
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>(estado === 'erro' ? 'error' : 'loading')
  const [forceEmpty, setForceEmpty] = useState(estado === 'vazio')

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [leadOpen, setLeadOpen] = useState(false)

  const alternativesRef = useRef<HTMLDivElement | null>(null)
  const topRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (phase !== 'loading') {
      finishSearchLoading()
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setPhase('ready')
      finishSearchLoading()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [finishSearchLoading, phase])

  function runSearch(nextQuery?: string) {
    const resolvedQuery = nextQuery?.trim() || query
    if (nextQuery) setQuery(resolvedQuery)
    const nextFilters = replaceInferredMarketplaceFilters(filters, query, resolvedQuery, results)
    setFilters(nextFilters)
    const params = filtersToSearchParams(nextFilters)
    if (resolvedQuery) params.set('q', resolvedQuery)
    window.history.replaceState(null, '', `/imoveis/busca?${params.toString()}`)
    startSearchLoading()
    setPhase('loading')
  }

  const criteria = useMemo(() => filtersToCriteria(filters), [filters])
  const quickFilters: QuickFilters = {
    precoMax: filters.priceMax,
    quartos: filters.bedrooms,
    areaMin: filters.areaMin,
  }

  const filtered = useMemo(() => {
    if (forceEmpty) return []
    let list: SearchResult[] = filterSearchResults(results, filters, query)
    list = sortResults(list, sort)
    return list
  }, [filters, forceEmpty, query, results, sort])

  const trackedSearch = useRef('')
  useEffect(() => {
    if (phase !== 'ready') return
    const signature = JSON.stringify([query, filters, filtered.map((item) => item.id)])
    if (trackedSearch.current === signature) return
    trackedSearch.current = signature
    void trackMarketplaceEvent({ eventType: 'marketplace_search', query: query || 'Busca por filtros', filters, resultCount: filtered.length, propertyIds: filtered.map((item) => item.id) })
  }, [filtered, filters, phase, query])

  const selectedResults = useMemo(
    () => compare.map((slug) => results.find((r) => r.slug === slug)).filter(Boolean) as SearchResult[],
    [compare, results],
  )

  const rankedBrokers = useMemo(() => {
    const position = new Map<string, number>()
    filtered.forEach((property, index) => {
      if (!position.has(property.brokerSlug)) position.set(property.brokerSlug, index)
    })
    return [...brokers].sort((a, b) =>
      (position.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.slug) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [brokers, filtered])

  const availableLocations = useMemo(
    () => [...new Set(results.flatMap((property) => [property.city, property.neighborhood, property.region]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [results],
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
    setQuery('')
    applyFilters(removeFilterCriterion(filters, key), false, '')
  }

  function clearFilters() {
    setQuery('')
    applyFilters({ ...emptyMarketplaceFilters }, false, '')
  }

  function applyFilters(nextFilters: MarketplaceFilters, closeDialog = true, activeQuery = query) {
    setFilters({
      ...nextFilters,
      features: [...nextFilters.features],
      intentions: [...nextFilters.intentions],
    })
    setForceEmpty(false)
    if (closeDialog) setFiltersOpen(false)
    const params = filtersToSearchParams(nextFilters)
    if (activeQuery) params.set('q', activeQuery)
    const search = params.toString()
    window.history.replaceState(null, '', search ? `/imoveis/busca?${search}` : '/imoveis/busca')
    startSearchLoading()
    setPhase('loading')
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
            onAdjustFilters={() => setFiltersOpen(true)}
          />
        </Reveal>
      </section>

      {/* Toolbar */}
      <section className="relative z-40 mx-auto mt-8 w-full max-w-6xl overflow-visible px-5 md:px-8">
        <Reveal>
          <ResultsToolbar
            count={filtered.length}
            sort={sort}
            onSortChange={setSort}
            filters={quickFilters}
            onFiltersChange={(next) => applyFilters({
              ...filters,
              priceMax: next.precoMax,
              bedrooms: next.quartos,
              areaMin: next.areaMin,
            }, false)}
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
      <section data-testid="results-area" className="mx-auto mt-6 w-full max-w-6xl px-5 md:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,34%)]">
          {/* Coluna de resultados */}
          <div className={cn('min-w-0', showMap && 'hidden lg:block')}>
            {phase === 'loading' ? (
              <ResultsSkeleton />
            ) : phase === 'error' ? (
              <SearchErrorState onRetry={() => runSearch()} />
            ) : filtered.length === 0 ? (
              <SearchEmptyState
                onAdjust={() => setFiltersOpen(true)}
                onAlternatives={() =>
                  alternativesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                onHelp={() => setLeadOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 items-stretch gap-5">
                {filtered.map((result, i) => (
                  <Reveal key={result.slug} delay={i * 70}>
                    <PropertyCard
                      property={result}
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
          <div className={cn('relative z-0', showList && 'hidden lg:block')}>
            <div className="lg:sticky lg:top-24">
              <div className={cn(
                'h-[52vh] min-h-[320px] max-h-[460px]',
                filtered.length <= 2 ? 'lg:h-[360px] lg:min-h-0' : 'lg:h-[min(58vh,520px)] lg:max-h-[520px]',
              )}>
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
      <section data-testid="comparison-builder" className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-20 md:px-8">
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
          {results.filter((item) => (!filters.purpose || item.purpose === filters.purpose) && !filtered.some((match) => match.id === item.id)).slice(0, 2).map((alternative, i) => (
            <Reveal key={alternative.slug} delay={i * 90}>
              <PropertyCard
                property={alternative}
                favorite={favorites.has(alternative.slug)}
                onToggleFavorite={toggleFavorite}
                selected={compare.includes(alternative.slug)}
                onToggleCompare={toggleCompare}
                compareDisabled={!compare.includes(alternative.slug) && compare.length >= MAX_COMPARE}
              />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Profissionais da região */}
      <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-20 md:px-8">
        <Reveal>
          <SectionHeading
            title="Quem conhece a região que você procura"
            support="Profissionais da rede EME que atendem o contexto da sua busca."
          />
        </Reveal>
        <div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
          {rankedBrokers.slice(0, 3).map((broker, i) => (
            <Reveal key={broker.slug} delay={i * 90} className="flex flex-col gap-2">
              {i === 0 && filtered.some((property) => property.brokerSlug === broker.slug) && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-eme-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Atende o imóvel mais compatível
                </span>
              )}
              <BrokerCard broker={broker} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Ajuda para encontrar */}
      <LeadAssistancePanel open={leadOpen} onOpenChange={setLeadOpen} searchSummary={query} availableLocations={availableLocations} />

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
      <MarketplaceFiltersDialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={applyFilters}
        title="Ajustar busca"
      />
    </div>
  )
}
