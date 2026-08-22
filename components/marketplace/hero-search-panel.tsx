'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, Zap } from 'lucide-react'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { MarketplaceFiltersDialog } from '@/components/marketplace/search/marketplace-filters-dialog'
import { useMarketplaceSearchLoading } from '@/components/marketplace/search/cinematic-search-loading'
import {
  emptyMarketplaceFilters,
  filtersToSearchParams,
  type MarketplaceFilters,
} from '@/lib/marketplace/search-filters'

export function HeroSearchPanel() {
  const router = useRouter()
  const { startSearchLoading } = useMarketplaceSearchLoading()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<MarketplaceFilters>({ ...emptyMarketplaceFilters })
  const [filtersOpen, setFiltersOpen] = useState(false)

  function runSearch(value = query, nextFilters = filters) {
    const params = filtersToSearchParams(nextFilters)
    if (value.trim()) params.set('q', value.trim())
    const search = params.toString()
    startSearchLoading()
    router.push(search ? `/imoveis/busca?${search}` : '/imoveis/busca')
  }

  return (
    <>
      <ConversationalSearch
        size="lg"
        placeholder="Descreva onde e como você gostaria de viver..."
        value={query}
        onValueChange={setQuery}
        onSubmitQuery={(value) => runSearch(value)}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => runSearch()}
          style={{ borderWidth: '0.5px', borderColor: 'rgba(255,255,255,0.12)' }}
          className="inline-flex items-center gap-2 rounded-full border-solid bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white outline-none shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all hover:bg-white/[0.12] focus-visible:ring-4 focus-visible:ring-white/20"
        >
          <Zap className="h-4 w-4 text-eme-300" aria-hidden="true" />
          Usar busca rápida
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          style={{ borderWidth: '0.5px', borderColor: 'rgba(255,255,255,0.12)' }}
          className="inline-flex items-center gap-2 rounded-full border-solid bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white outline-none shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all hover:bg-white/[0.12] focus-visible:ring-4 focus-visible:ring-white/20"
        >
          <SlidersHorizontal className="h-4 w-4 text-white/80" aria-hidden="true" />
          Explorar por filtros
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
        title="Explorar por filtros"
      />
    </>
  )
}
