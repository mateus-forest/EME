import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, MapPin, MessageCircle, ShieldCheck, Star } from 'lucide-react'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { BrokerSpecialtyChips } from '@/components/marketplace/broker-specialty-chips'
import { CATALOG_GLASS_SURFACE_CLASS } from '@/lib/catalog-visual-system'
import { cn } from '@/lib/utils'

export function BrokerCard({ broker }: { broker: BrokerProfile }) {
  const reviewLabel = broker.reviewCount > 0
    ? `${broker.reviewCount} ${broker.reviewCount === 1 ? 'avaliação publicada' : 'avaliações publicadas'}`
    : 'Sem avaliações publicadas'

  return (
    <article
      data-marketplace-broker-card
      className={cn(
        CATALOG_GLASS_SURFACE_CLASS,
        'marketplace-card group relative mx-auto flex h-full min-h-[430px] w-full max-w-[560px] flex-col overflow-hidden rounded-[1.75rem] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-float)] sm:p-6',
      )}
    >
      <Link
        href={`/imoveis/corretores/${broker.slug}`}
        aria-label={`Ver perfil de ${broker.name}`}
        className="absolute inset-0 z-10 rounded-[1.75rem]"
      />

      <div className="pointer-events-none grid min-h-[238px] grid-cols-[minmax(128px,42%)_minmax(0,1fr)] gap-4 sm:gap-5">
        <div className="relative aspect-[4/5] w-full self-start overflow-visible rounded-[1.5rem]">
          <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_8px_20px_rgba(35,39,34,.1)]">
            <Image
              src={broker.image || '/marketplace/placeholder-user.jpg'}
              alt={broker.name}
              fill
              sizes="(max-width: 640px) 42vw, 230px"
              className="object-cover"
            />
          </div>
          {broker.verified ? (
            <span className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full border-4 border-white/90 bg-white text-primary shadow-[var(--shadow-soft)]" aria-label="Perfil verificado">
              <ShieldCheck className="h-6 w-6 fill-primary text-white" aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-start gap-1.5">
            <h3 className="line-clamp-2 min-w-0 text-pretty text-lg font-semibold leading-tight tracking-[-0.015em] text-foreground sm:text-xl">
              {broker.name}
            </h3>
            {broker.verified ? <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 fill-primary text-white" aria-label="Perfil verificado" /> : null}
          </div>
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground sm:text-sm">{broker.creci}</p>
          <BrokerSpecialtyChips specialties={broker.specialties} className="mt-4" />
          <p className="mt-auto flex min-w-0 items-center gap-1.5 pb-1 text-xs text-muted-foreground sm:text-sm">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{broker.region}</span>
          </p>
        </div>
      </div>

      <div className="pointer-events-none mt-5 grid min-h-[72px] grid-cols-2 border-y border-border/70 py-4">
        <span className="inline-flex items-center justify-center gap-2 border-r border-border/70 px-2 text-sm font-semibold text-foreground">
          <Star className="h-5 w-5 fill-primary text-primary" aria-hidden="true" />
          {broker.reviewCount > 0 ? broker.rating.toFixed(1).replace('.', ',') : 'Perfil novo'}
        </span>
        <span className="inline-flex items-center justify-center px-2 text-center text-sm text-muted-foreground">
          {broker.activeListings} {broker.activeListings === 1 ? 'imóvel ativo' : 'imóveis ativos'}
        </span>
      </div>

      <div className="pointer-events-none mt-auto flex min-h-[62px] items-end justify-between gap-3 pt-4">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">{reviewLabel}</span>
        </span>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f0] text-primary transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
}
