import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MessageCircle, Star } from 'lucide-react'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { BrokerSpecialtyChips } from '@/components/marketplace/broker-specialty-chips'
import { CATALOG_GLASS_SURFACE_CLASS } from '@/lib/catalog-visual-system'
import { cn } from '@/lib/utils'

export function BrokerCard({ broker }: { broker: BrokerProfile }) {
  return (
    <article className={cn(CATALOG_GLASS_SURFACE_CLASS, 'marketplace-card group relative flex h-full min-h-[220px] items-stretch gap-5 overflow-visible rounded-[1.75rem] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]')}>
      <Link
        href={`/imoveis/corretores/${broker.slug}`}
        aria-label={`Conhecer o perfil de ${broker.name}`}
        className="absolute inset-0 z-10 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <div className="pointer-events-none relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_8px_20px_rgba(35,39,34,.1)]">
        <Image
          src={broker.image || '/marketplace/placeholder-user.jpg'}
          alt={broker.name}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <h3 className="text-pretty text-base font-semibold leading-tight text-foreground">{broker.name}</h3>
          {broker.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" />}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{broker.creci}</p>
        <BrokerSpecialtyChips specialties={broker.specialties} className="mt-2 min-h-6" />
        <p className="mt-1 text-xs text-muted-foreground">{broker.region}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
            {broker.reviewCount > 0 ? broker.rating.toFixed(1).replace('.', ',') : 'Perfil novo'}
          </span>
          <span className="rounded-full border border-border px-2.5 py-1">{broker.activeListings} imóveis ativos</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-xs text-muted-foreground">{broker.reviewCount > 0 ? `${broker.reviewCount} avaliações publicadas` : 'Sem avaliações publicadas'}</span>
          <Link
            href={`/imoveis/corretores/${broker.slug}#contato-corretor`}
            aria-label={`Falar com ${broker.name}`}
            className="pointer-events-auto relative z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-eme-50 hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
