'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { RegionDetail } from '@/lib/marketplace/pages-data'
import { RegionFeatureCard } from '@/components/marketplace/pages/region-feature-card'
import { Reveal } from '@/components/marketplace/reveal'
import { CATALOG_GLASS_SURFACE_CLASS } from '@/lib/catalog-visual-system'
import { cn } from '@/lib/utils'

// Busca local por cidade, bairro ou região, filtrando os destaques exibidos.
export function RegionsDirectory({ regions }: { regions: RegionDetail[] }) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return regions
    return regions.filter((region) => {
      const haystack = [region.name, ...region.tags, ...region.areas].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [query, regions])

  return (
    <div>
      <div className="mx-auto max-w-xl">
        <div className={cn(CATALOG_GLASS_SURFACE_CLASS, 'marketplace-field group flex items-center gap-2 overflow-visible rounded-full p-2 pl-5 transition-all duration-300')}>
          <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cidade, bairro ou região"
            aria-label="Buscar por cidade, bairro ou região"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-6">
        {results.map((region, i) => (
          <Reveal key={region.slug} delay={i * 80}>
            <RegionFeatureCard region={region} reversed={i % 2 === 1} />
          </Reveal>
        ))}
      </div>

      {results.length === 0 && (
        <div className={cn(CATALOG_GLASS_SURFACE_CLASS, 'mx-auto mt-10 max-w-md rounded-[1.75rem] p-8 text-center')}>
          <p className="text-base font-medium text-foreground">Nenhuma região encontrada</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tente outro nome de cidade, bairro ou região da serra e dos campos.
          </p>
        </div>
      )}
    </div>
  )
}
