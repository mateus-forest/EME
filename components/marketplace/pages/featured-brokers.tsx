import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { BrokerCard } from '@/components/marketplace/broker-card'

export function FeaturedBrokers({ brokers }: { brokers: BrokerProfile[] }) {
  const featured = brokers.filter((broker) => broker.featured).slice(0, 3)
  if (!featured.length) return null
  return (
    <section aria-labelledby="featured-brokers-title">
      <div className="max-w-2xl">
        <h2 id="featured-brokers-title" className="text-2xl font-semibold tracking-tight text-foreground">Corretores em destaque</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Profissionais selecionados pela rede EME entre os perfis com imóveis publicados.
        </p>
      </div>
      <div className="mt-7 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        {featured.map((broker) => <BrokerCard key={broker.slug} broker={broker} />)}
      </div>
    </section>
  )
}
