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
  featured = false,
  compact = false,
  home = false,
  favorite,
  onToggleFavorite,
  selected = false,
  onToggleCompare,
  compareDisabled = false,
  highlighted = false,
  onHover,
}: {
  property: MarketplacePropertyCardItem
  featured?: boolean
  compact?: boolean
  home?: boolean
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
        'marketplace-card group mx-auto flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] transition-all duration-300',
        featured
          ? home
            ? 'min-h-[430px] max-w-none lg:min-h-0'
            : 'min-h-[620px] max-w-none'
          : home
            ? 'min-h-[380px] max-w-[440px]'
          : compact
            ? 'min-h-[430px] max-w-[440px]'
            : 'min-h-[690px] max-w-[560px]',
        highlighted
          ? '-translate-y-1 border-primary/40 shadow-[var(--shadow-float)] ring-1 ring-primary/20'
          : 'hover:-translate-y-1 hover:shadow-[var(--shadow-float)]',
      )}
    >
      <div
        className={cn(
          'relative shrink-0 overflow-hidden',
          featured
            ? 'aspect-[4/3] lg:aspect-auto lg:min-h-[360px] lg:flex-1'
            : home
              ? 'aspect-[16/7]'
            : compact
              ? 'aspect-[16/9]'
              : 'aspect-[4/3]',
        )}
      >
        <Link
          href={`/imoveis/imovel/${property.slug}`}
          className="absolute inset-0"
          aria-label={`Ver ${property.title}`}
        >
          <Image
            src={property.image || '/marketplace/placeholder.svg'}
            alt={property.title}
            fill
            sizes={featured ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 560px'}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
          />
        </Link>

        <CompatibilityBadge
          level={property.compatibility}
          className={cn('absolute shadow-[var(--shadow-soft)]', compact ? 'left-3 top-3' : 'left-4 top-4')}
        />

        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className={cn(
            'absolute flex items-center justify-center rounded-full border border-white/85 bg-white/90 text-foreground shadow-[var(--shadow-soft)] backdrop-blur-md transition-transform hover:scale-105 active:scale-95',
            compact ? 'right-3 top-3 h-9 w-9' : 'right-4 top-4 h-11 w-11',
          )}
        >
          <Heart
            className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', 'transition-colors', isFavorite && 'fill-primary text-primary')}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className={cn('flex flex-1 flex-col', home ? 'min-h-0 p-3' : compact ? 'min-h-0 p-4' : 'min-h-[360px] p-5 sm:p-6')}>
        <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-start', home ? 'min-h-[52px] gap-2.5' : compact ? 'min-h-[60px] gap-3' : 'min-h-[76px] gap-4')}>
          <div className="min-w-0">
            <h3 className={cn('line-clamp-2 text-pretty font-semibold leading-snug tracking-[-0.01em] text-foreground', compact ? 'min-h-10 text-base' : 'min-h-[2.75rem] text-lg')}>
              <Link
                href={`/imoveis/imovel/${property.slug}`}
                className="outline-none transition-colors hover:text-primary focus-visible:text-primary"
              >
                {property.title}
              </Link>
            </h3>
            <p className={cn('flex min-w-0 items-center gap-1.5 text-muted-foreground', home ? 'mt-1 text-[11px]' : compact ? 'mt-1.5 text-xs' : 'mt-2 text-sm')}>
              <MapPin className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden="true" />
              <span className="truncate">{property.city} - {property.state}</span>
            </p>
          </div>
          <div className={cn('shrink-0 text-right', home ? 'max-w-[8rem]' : compact ? 'max-w-[9rem]' : 'max-w-[12rem]')}>
            <p className={cn('whitespace-nowrap font-semibold tracking-tight text-foreground', home ? 'text-base' : compact ? 'text-lg' : 'text-xl')}>
              {formatPrice(property.price)}
              {property.priceSuffix ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">{property.priceSuffix}</span> : null}
            </p>
            {property.priceDetail ? <p className="mt-1 text-xs text-muted-foreground">{property.priceDetail}</p> : null}
          </div>
        </div>

        <div className={cn('grid grid-cols-3 items-center text-muted-foreground', home ? 'mt-2 min-h-8 gap-1.5 text-[11px]' : compact ? 'mt-3 min-h-9 gap-2 text-xs' : 'mt-5 min-h-12 gap-2 text-sm sm:gap-4')}>
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

        <div className={cn('border-t border-border/70', home ? 'mt-2 pt-2' : compact ? 'mt-3 pt-3' : 'mt-5 pt-4')}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={reasonsId}
            onClick={() => setOpen((value) => !value)}
            className={cn('flex w-full items-center justify-between gap-3 text-left font-semibold text-foreground', home ? 'min-h-7 text-[11px]' : compact ? 'min-h-8 text-xs' : 'min-h-9 text-sm')}
          >
            Por que combina com você
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <ul id={reasonsId} className={cn('mt-2 space-y-1.5 overflow-y-auto pr-2 text-muted-foreground', compact ? 'max-h-20 text-xs' : 'max-h-24 text-sm')}>
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

        <div className={cn('mt-auto grid grid-cols-2', home ? 'gap-2 pt-2' : compact ? 'gap-2 pt-3' : 'gap-3 pt-5')}>
          {hasControlledComparison ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={compareDisabled}
              onClick={() => onToggleCompare?.(property.slug)}
              className={cn(
                'inline-flex items-center justify-center gap-2 border font-semibold transition-colors',
                home ? 'min-h-9 rounded-xl px-2 text-[11px]' : compact ? 'min-h-10 rounded-xl px-3 text-xs' : 'min-h-12 rounded-2xl px-4 text-sm',
                selected ? 'border-primary bg-eme-50 text-primary' : 'border-border/90 bg-white/40 text-foreground hover:border-primary/35 hover:bg-eme-50',
                compareDisabled && 'cursor-not-allowed opacity-45',
              )}
            >
              {compareContent}
            </button>
          ) : (
            <Link
              href={`/imoveis/comparar?imoveis=${encodeURIComponent(property.slug)}`}
              className={cn('inline-flex items-center justify-center gap-2 border border-border/90 bg-white/40 font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-eme-50', home ? 'min-h-9 rounded-xl px-2 text-[11px]' : compact ? 'min-h-10 rounded-xl px-3 text-xs' : 'min-h-12 rounded-2xl px-4 text-sm')}
            >
              {compareContent}
            </Link>
          )}

          <Link
            href={`/imoveis/imovel/${property.slug}`}
            className={cn('inline-flex items-center justify-center gap-2 border border-border/90 bg-white/40 font-semibold text-primary transition-colors hover:border-primary/35 hover:bg-eme-50', home ? 'min-h-9 rounded-xl px-2 text-[11px]' : compact ? 'min-h-10 rounded-xl px-3 text-xs' : 'min-h-12 rounded-2xl px-4 text-sm')}
          >
            Ver imóvel
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
