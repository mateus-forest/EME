import Link from 'next/link'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { Reveal } from '@/components/marketplace/reveal'

export function BrokersSection({ brokers }: { brokers: BrokerProfile[] }) {
  const featured = brokers.filter((broker) => broker.featured)
  const visible = (featured.length ? featured : brokers).slice(0, 3)
  return (
    <section id="corretores" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          title={featured.length ? 'Corretores em destaque' : 'Corretores da rede EME'}
          support={featured.length ? 'Profissionais selecionados pela rede EME.' : 'Conheça os profissionais com imóveis publicados no Marketplace.'}
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 md:grid-cols-3">
        {visible.map((broker, i) => (
          <Reveal key={broker.slug} delay={i * 90}>
            <BrokerCard broker={broker} />
          </Reveal>
        ))}
      </div>
      {!visible.length ? <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum corretor possui imóveis publicados no Marketplace neste momento.</p> : null}
      <Reveal className="mt-7 text-center">
        <Link href="/imoveis/corretores" className="text-sm font-medium text-primary transition-colors hover:text-eme-700">
          Ver todos os corretores →
        </Link>
      </Reveal>
    </section>
  )
}
