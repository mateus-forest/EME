'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BedDouble,
  Car,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  Maximize,
  ScanLine,
  Store,
} from 'lucide-react'
import { CompatibilityBadge } from '@/components/marketplace/search/compatibility-badge'
import { formatPrice, type Compatibility } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'
import { CATALOG_GLASS_SURFACE_CLASS } from '@/lib/catalog-visual-system'

export type MarketplacePropertyCardItem = {
  slug: string
  title: string
  city: string
  state: string
  price: number
  bedrooms: number
  area: number
  parking: number
  image: string
  compatibility: Compatibility
  reasons: string[]
  priceSuffix?: string
  priceDetail?: string
  commercial?: boolean
}

export function PropertyCard({
  property,
  favorite,
  onToggleFavorite,
  selected = false,
  onToggleCompare,
  compareDisabled = false,
  highlighted = false,
  onHover,
}: {
  property: MarketplacePropertyCardItem
  favorite?: boolean
  onToggleFavorite?: (slug: string) => void
  selected?: boolean
  onToggleCompare?: (slug: string) => void
  compareDisabled?: boolean
  highlighted?: boolean
  onHover?: (slug: string | null) => void
}) {
  const [localFavorite, setLocalFavorite] = useState(false)
  const [open, setOpen] = useState(false)
  const reasonsId = useId()
  const isFavorite = favorite ?? localFavorite
  const hasControlledComparison = Boolean(onToggleCompare)

  function toggleFavorite() {
    if (onToggleFavorite) onToggleFavorite(property.slug)
    else setLocalFavorite((value) => !value)
  }

  const compareContent = (
    <>
      <ScanLine className="h-4 w-4" aria-hidden="true" />
      Comparar
    </>
  )

  return (
    <article
      data-marketplace-property-card
      onMouseEnter={() => onHover?.(property.slug)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        CATALOG_GLASS_SURFACE_CLASS,
        'marketplace-card group mx-auto flex h-full min-h-[690px] w-full max-w-[560px] flex-col overflow-hidden rounded-[1.75rem] transition-all duration-300',
        highlighted
          ? '-translate-y-1 border-primary/40 shadow-[var(--shadow-float)] ring-1 ring-primary/20'
          : 'hover:-translate-y-1 hover:shadow-[var(--shadow-float)]',
      )}
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden">
        <Link
          href={`/imoveis/imovel/${property.slug}`}
          className="absolute inset-0"
          aria-label={`Ver ${property.title}`}
        >
          <Image
            src={property.image || '/marketplace/placeholder.svg'}
            alt={property.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 560px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
          />
        </Link>

        <CompatibilityBadge
          level={property.compatibility}
          className="absolute left-4 top-4 shadow-[var(--shadow-soft)]"
        />

        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/85 bg-white/90 text-foreground shadow-[var(--shadow-soft)] backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <Heart
            className={cn('h-5 w-5 transition-colors', isFavorite && 'fill-primary text-primary')}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="flex min-h-[360px] flex-1 flex-col p-5 sm:p-6">
        <div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-pretty text-lg font-semibold leading-snug tracking-[-0.01em] text-foreground">
              <Link
                href={`/imoveis/imovel/${property.slug}`}
                className="outline-none transition-colors hover:text-primary focus-visible:text-primary"
              >
                {property.title}
              </Link>
            </h3>
            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{property.city} - {property.state}</span>
            </p>
          </div>
          <div className="max-w-[12rem] shrink-0 text-right">
            <p className="whitespace-nowrap text-xl font-semibold tracking-tight text-foreground">
              {formatPrice(property.price)}
              {property.priceSuffix ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">{property.priceSuffix}</span> : null}
            </p>
            {property.priceDetail ? <p className="mt-1 text-xs text-muted-foreground">{property.priceDetail}</p> : null}
          </div>
        </div>

        <div className="mt-5 grid min-h-12 grid-cols-3 items-center gap-2 text-sm text-muted-foreground sm:gap-4">
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            {property.commercial ? <Store className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <BedDouble className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            <span className="truncate">{property.commercial ? 'Comercial' : `${property.bedrooms} ${property.bedrooms === 1 ? 'quarto' : 'quartos'}`}</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <Maximize className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{property.area} m²</span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <Car className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{property.parking} {property.parking === 1 ? 'vaga' : 'vagas'}</span>
          </span>
        </div>

        <div className="mt-5 border-t border-border/70 pt-4">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={reasonsId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-9 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-foreground"
          >
            Por que combina com você
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <ul id={reasonsId} className="mt-2 max-h-24 space-y-1.5 overflow-y-auto pr-2 text-sm text-muted-foreground">
              {property.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-eme-50 text-primary" aria-hidden="true">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
          {hasControlledComparison ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={compareDisabled}
              onClick={() => onToggleCompare?.(property.slug)}
              className={cn(
                'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors',
                selected ? 'border-primary bg-eme-50 text-primary' : 'border-border/90 bg-white/40 text-foreground hover:border-primary/35 hover:bg-eme-50',
                compareDisabled && 'cursor-not-allowed opacity-45',
              )}
            >
              {compareContent}
            </button>
          ) : (
            <Link
              href={`/imoveis/comparar?imoveis=${encodeURIComponent(property.slug)}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/90 bg-white/40 px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-eme-50"
            >
              {compareContent}
            </Link>
          )}

          <Link
            href={`/imoveis/imovel/${property.slug}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/90 bg-white/40 px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/35 hover:bg-eme-50"
          >
            Ver imóvel
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
