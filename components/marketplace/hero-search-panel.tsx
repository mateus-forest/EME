'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, Zap } from 'lucide-react'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { MarketplaceFiltersDialog } from '@/components/marketplace/search/marketplace-filters-dialog'
import {
  emptyMarketplaceFilters,
  filtersToSearchParams,
  type MarketplaceFilters,
} from '@/lib/marketplace/search-filters'

export function HeroSearchPanel() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<MarketplaceFilters>({ ...emptyMarketplaceFilters })
  const [filtersOpen, setFiltersOpen] = useState(false)

  function runSearch(value = query, nextFilters = filters) {
    const params = filtersToSearchParams(nextFilters)
    if (value.trim()) params.set('q', value.trim())
    const search = params.toString()
    router.push(search ? `/imoveis/busca?${search}` : '/imoveis/busca')
  }

  return (
    <>
      <ConversationalSearch
        size="lg"
        placeholder="Quero uma casa com pátio em Vacaria, até R$ 750 mil..."
        value={query}
        onValueChange={setQuery}
        onSubmitQuery={(value) => runSearch(value)}
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={() => runSearch()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
          Usar busca rápida
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/70 px-3.5 py-2 text-sm text-muted-foreground shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30 hover:text-primary"
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
          Buscar por filtros
        </button>
      </div>
      <MarketplaceFiltersDialog
        open={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextFilters) => {
          setFilters(nextFilters)
          setFiltersOpen(false)
          runSearch(query, nextFilters)
        }}
      />
    </>
  )
}
