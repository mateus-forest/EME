import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MessageCircle } from 'lucide-react'
import type { Broker } from '@/lib/marketplace/data'
import { brokerProfiles } from '@/lib/marketplace/pages-data'

export function BrokerCard({ broker }: { broker: Broker }) {
  const profile = brokerProfiles.find((item) => item.slug === broker.slug)

  return (
    <article className="group relative flex items-center gap-5 rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-float)]">
      <Link
        href={`/imoveis/corretores/${broker.slug}`}
        aria-label={`Conhecer o perfil de ${broker.name}`}
        className="absolute inset-0 z-10 rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <div className="pointer-events-none relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem]">
        <Image
          src={broker.image || '/marketplace/placeholder-user.jpg'}
          alt={broker.name}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-pretty text-base font-semibold leading-tight text-foreground">
            {broker.name}
          </h3>
          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" />
        </div>
        <p className="mt-1 text-pretty text-xs leading-snug text-muted-foreground">{profile?.specialty || broker.role}</p>
        <p className="mt-1 text-xs text-muted-foreground">{profile?.region || broker.region}</p>
        {profile && (
          <span className="mt-2 inline-flex rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            {profile.activeListings} imóveis ativos
          </span>
        )}
        <div className="mt-4 flex items-center justify-between">
          {broker.respondsFast && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Responde rápido
            </span>
          )}
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
