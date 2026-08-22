'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, Car, Check, ChevronDown, Heart, Maximize } from 'lucide-react'
import { formatPrice, type SearchResult } from '@/lib/marketplace/search-data'
import { CompatibilityBadge } from '@/components/marketplace/search/compatibility-badge'
import { cn } from '@/lib/utils'
import { CATALOG_GLASS_SURFACE_CLASS } from '@/lib/catalog-visual-system'

export function ResultsPropertyCard({
  result,
  favorite,
  onToggleFavorite,
  selected,
  onToggleCompare,
  compareDisabled,
  highlighted,
  onHover,
}: {
  result: SearchResult
  favorite: boolean
  onToggleFavorite: (slug: string) => void
  selected: boolean
  onToggleCompare: (slug: string) => void
  compareDisabled: boolean
  highlighted: boolean
  onHover: (slug: string | null) => void
}) {
  // O primeiro nível ("muito compatível") já nasce com a explicação aberta.
  const [open, setOpen] = useState(result.compatibility === 'muito')

  return (
    <article
      onMouseEnter={() => onHover(result.slug)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        CATALOG_GLASS_SURFACE_CLASS,
        'marketplace-card group flex h-full flex-col overflow-hidden rounded-[1.75rem] transition-all duration-300',
        highlighted
          ? '-translate-y-1 border-primary/40 shadow-[var(--shadow-float)] ring-1 ring-primary/20'
          : 'border-border/70 shadow-[var(--shadow-soft)] hover:-translate-y-1 hover:shadow-[var(--shadow-float)]',
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Link
          href={`/imoveis/imovel/${result.slug}`}
          className="absolute inset-0"
          aria-label={`Ver ${result.title}`}
        >
          <Image
            src={result.image || '/marketplace/placeholder.svg'}
            alt={result.title}
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />

        <CompatibilityBadge
          level={result.compatibility}
          className="absolute left-3 top-3 shadow-[var(--shadow-soft)]"
        />

        <button
          type="button"
          onClick={() => onToggleFavorite(result.slug)}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className="glass absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-110 active:scale-90"
        >
          <Heart
            className={cn('h-4 w-4 transition-colors', favorite && 'fill-primary text-primary')}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-pretty text-base font-medium leading-snug text-foreground">
              <Link
                href={`/imoveis/imovel/${result.slug}`}
                className="outline-none transition-colors hover:text-primary focus-visible:text-primary"
              >
                {result.title}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {result.city} · {result.state}
            </p>
          </div>
          <p className="shrink-0 text-lg font-semibold tracking-tight text-foreground">
            {formatPrice(result.price)}
          </p>
        </div>

        <div className="mt-4 flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {result.bedrooms} quartos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Maximize className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {result.area} m²
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Car className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {result.parking} {result.parking > 1 ? 'vagas' : 'vaga'}
          </span>
        </div>

        {/* Compatibilidade explicada */}
        <div className="mt-4 border-t border-border/60 pt-4">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-foreground"
          >
            Por que combina com você
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
          {open && (
            <ul className="mt-3 flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
              {result.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eme-50 text-primary"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seletor de comparação */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            disabled={compareDisabled}
            onClick={() => onToggleCompare(result.slug)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium transition-colors',
              compareDisabled ? 'cursor-not-allowed text-muted-foreground/50' : 'text-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
              )}
              aria-hidden="true"
            >
              {selected && <Check className="h-3.5 w-3.5" />}
            </span>
            Comparar
          </button>

          <Link
            href={`/imoveis/imovel/${result.slug}`}
            className="text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Ver imóvel
          </Link>
        </div>
      </div>
    </article>
  )
}
