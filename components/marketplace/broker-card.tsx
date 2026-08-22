import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, MapPin, MessageCircle, ShieldCheck, Star } from 'lucide-react'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { BrokerSpecialtyChips } from '@/components/marketplace/broker-specialty-chips'
import { CATALOG_GLASS_SURFACE_CLASS } from '@/lib/catalog-visual-system'
import { cn } from '@/lib/utils'

export function BrokerCard({ broker, compact = false, home = false }: { broker: BrokerProfile; compact?: boolean; home?: boolean }) {
  const reviewLabel = broker.reviewCount > 0
    ? `${broker.reviewCount} ${broker.reviewCount === 1 ? 'avaliação publicada' : 'avaliações publicadas'}`
    : 'Sem avaliações publicadas'

  return (
    <article
      data-marketplace-broker-card
      className={cn(
        CATALOG_GLASS_SURFACE_CLASS,
        'marketplace-card group relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]',
        compact ? 'h-[300px] min-h-[300px] max-w-[390px] p-4' : 'h-[450px] min-h-[450px] max-w-[560px] p-5 sm:p-6',
      )}
    >
      <Link
        href={`/imoveis/corretores/${broker.slug}`}
        aria-label={`Ver perfil de ${broker.name}`}
        className="absolute inset-0 z-10 rounded-[1.75rem]"
      />

      <div className={cn('pointer-events-none grid', home ? 'min-h-[154px] grid-cols-[92px_minmax(0,1fr)] grid-rows-[auto_1fr] gap-x-3 gap-y-2' : compact ? 'min-h-[148px] grid-cols-[104px_minmax(0,1fr)] gap-3' : 'min-h-[238px] grid-cols-[minmax(128px,42%)_minmax(0,1fr)] gap-4 sm:gap-5')}>
        <div className={cn('relative aspect-[4/5] w-full self-start overflow-visible', compact ? 'rounded-[1.25rem]' : 'rounded-[1.5rem]')}>
          <div className={cn('absolute inset-0 overflow-hidden border border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_8px_20px_rgba(35,39,34,.1)]', compact ? 'rounded-[1.25rem]' : 'rounded-[1.5rem]')}>
            <Image
              src={broker.image || '/marketplace/placeholder-user.jpg'}
              alt={broker.name}
              fill
              sizes={home ? '92px' : compact ? '104px' : '(max-width: 640px) 42vw, 230px'}
              className="object-cover"
            />
          </div>
          {broker.verified ? (
            <span className={cn('absolute flex items-center justify-center rounded-full border-white/90 bg-white text-primary shadow-[var(--shadow-soft)]', compact ? '-bottom-1.5 -right-1.5 h-8 w-8 border-[3px]' : '-bottom-2 -right-2 h-11 w-11 border-4')} aria-label="Perfil verificado">
              <ShieldCheck className={cn('fill-primary text-white', compact ? 'h-4 w-4' : 'h-6 w-6')} aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <div className={cn('flex min-w-0 flex-col', home && 'row-span-2')}>
          <div className="flex min-w-0 items-start gap-1.5">
            <h3 className={cn('line-clamp-2 min-w-0 text-pretty font-semibold leading-tight tracking-[-0.015em] text-foreground', compact ? 'text-base' : 'text-lg sm:text-xl')}>
              {broker.name}
            </h3>
            {broker.verified ? <BadgeCheck className={cn('mt-0.5 shrink-0 fill-primary text-white', compact ? 'h-4 w-4' : 'h-5 w-5')} aria-label="Perfil verificado" /> : null}
          </div>
          <p className={cn('line-clamp-1 text-muted-foreground', compact ? 'mt-1 text-[11px]' : 'mt-2 text-xs sm:text-sm')}>{broker.creci}</p>
          <BrokerSpecialtyChips specialties={broker.specialties} compact={home} className={compact ? 'mt-2' : 'mt-4'} />
          {!home ? (
            <p className={cn('mt-auto flex min-w-0 items-center gap-1.5 pb-1 text-muted-foreground', compact ? 'text-[11px]' : 'text-xs sm:text-sm')}>
              <MapPin className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden="true" />
              <span className="line-clamp-2">{broker.region}</span>
            </p>
          ) : null}
        </div>
        {home ? (
          <p className="col-start-1 row-start-2 flex min-w-0 items-start gap-1 text-[9px] leading-tight text-muted-foreground">
            <MapPin className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{broker.region}</span>
          </p>
        ) : null}
      </div>

      <div className={cn('pointer-events-none grid grid-cols-2 border-y border-border/70', compact ? 'mt-3 min-h-12 py-3' : 'mt-5 min-h-[72px] py-4')}>
        <span className={cn('inline-flex items-center justify-center gap-2 border-r border-border/70 px-2 font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>
          <Star className={cn('fill-primary text-primary', compact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
          {broker.reviewCount > 0 ? broker.rating.toFixed(1).replace('.', ',') : 'Perfil novo'}
        </span>
        <span className={cn('inline-flex items-center justify-center px-2 text-center text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          {broker.activeListings} {broker.activeListings === 1 ? 'imóvel ativo' : 'imóveis ativos'}
        </span>
      </div>

      <div className={cn('pointer-events-none mt-auto flex items-end justify-between gap-3', compact ? 'min-h-11 pt-3' : 'min-h-[62px] pt-4')}>
        <span className={cn('inline-flex min-w-0 items-center gap-2 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          <MessageCircle className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden="true" />
          <span className="line-clamp-2">{reviewLabel}</span>
        </span>
        <span className={cn('flex shrink-0 items-center justify-center rounded-xl bg-[#f1f5f0] text-primary transition-transform duration-300 group-hover:translate-x-0.5', compact ? 'h-9 w-9' : 'h-11 w-11')} aria-hidden="true">
          <ArrowRight className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
      </div>
    </article>
  )
}
