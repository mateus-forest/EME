import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MessageCircle } from 'lucide-react'
import type { Broker } from '@/lib/marketplace/data'

export function BrokerCard({ broker }: { broker: Broker }) {
  return (
    <article className="flex items-center gap-5 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem]">
        <Image
          src={broker.image || '/marketplace/placeholder-user.jpg'}
          alt={broker.name}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-pretty text-base font-semibold leading-tight text-foreground">
            {broker.name}
          </h3>
          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" />
        </div>
        <p className="mt-1 text-pretty text-xs leading-snug text-muted-foreground">{broker.role}</p>
        <div className="mt-4 flex items-center justify-between">
          {broker.respondsFast && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Responde rápido
            </span>
          )}
          <Link
            href={`/imoveis/corretores/${broker.slug}`}
            aria-label={`Conhecer o perfil de ${broker.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-eme-50 hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
