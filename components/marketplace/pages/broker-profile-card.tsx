import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MapPin, Star } from 'lucide-react'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'

const transactionLabel: Record<BrokerProfile['transaction'], string> = {
  compra: 'Atende compra',
  aluguel: 'Atende locação',
  ambos: 'Compra e locação',
}

export function BrokerProfileCard({ broker }: { broker: BrokerProfile }) {
  return (
    <Link
      href={`/imoveis/corretores/${broker.slug}`}
      aria-label={`Ver perfil de ${broker.name}`}
      className="group flex flex-col rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-float)]"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
          <Image
            src={broker.image || '/marketplace/placeholder-user.jpg'}
            alt={broker.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-pretty text-base font-semibold leading-tight text-foreground">
              {broker.name}
            </h3>
            {broker.verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{broker.creci}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            {broker.region}
          </p>
        </div>
      </div>

      <p className="mt-4 text-pretty text-sm leading-relaxed text-foreground">{broker.specialty}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-eme-50 px-2.5 py-1 text-xs font-medium text-primary">
          {transactionLabel[broker.transaction]}
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          {broker.activeListings} imóveis ativos
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
          {broker.reviewCount > 0 ? `${broker.rating.toFixed(1).replace('.', ',')} · ${broker.reviewCount} avaliações` : 'Perfil novo · sem avaliações'}
        </span>
        <span className="text-sm font-medium text-primary transition-transform duration-300 group-hover:translate-x-0.5">
          Ver perfil &rarr;
        </span>
      </div>
    </Link>
  )
}
