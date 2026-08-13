import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, MapPin, Star } from 'lucide-react'
import { brokerProfiles } from '@/lib/marketplace/pages-data'

export function FeaturedBrokers() {
  const featured = brokerProfiles.filter((broker) => broker.featured).slice(0, 3)
  return (
    <section aria-labelledby="featured-brokers-title">
      <div className="max-w-2xl">
        <h2 id="featured-brokers-title" className="text-2xl font-semibold tracking-tight text-foreground">Corretores em destaque</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Profissionais reconhecidos na rede EME por sua atuação, experiência e avaliações.
        </p>
      </div>
      <div className="no-scrollbar -mx-5 mt-7 flex snap-x gap-4 overflow-x-auto px-5 pb-3 md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {featured.map((broker) => (
          <Link
            key={broker.slug}
            href={`/imoveis/corretores/${broker.slug}`}
            aria-label={`Ver perfil de ${broker.name}`}
            className="group min-w-[82vw] snap-start rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-float)] sm:min-w-[320px] md:min-w-0"
          >
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                <Image src={broker.image} alt={broker.name} fill sizes="80px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-foreground">{broker.name}</h3>
                  {broker.verified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Perfil verificado" />}
                </div>
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                  <Star className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
                  {broker.rating.toFixed(1).replace('.', ',')}
                  <span className="font-normal text-muted-foreground">({broker.reviewCount})</span>
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">{broker.specialty}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {broker.region} · {broker.activeListings} imóveis ativos
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
