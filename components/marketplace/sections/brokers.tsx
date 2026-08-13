import Link from 'next/link'
import { brokerProfiles } from '@/lib/marketplace/pages-data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { Reveal } from '@/components/marketplace/reveal'

export function BrokersSection() {
  return (
    <section id="corretores" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          title="Corretores em destaque"
          support="Profissionais reconhecidos na rede EME por sua atuação e experiência."
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 md:grid-cols-3">
        {brokerProfiles.filter((broker) => broker.featured).slice(0, 3).map((broker, i) => (
          <Reveal key={broker.slug} delay={i * 90}>
            <BrokerCard broker={broker} />
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-7 text-center">
        <Link href="/imoveis/corretores" className="text-sm font-medium text-primary transition-colors hover:text-eme-700">
          Ver todos os corretores →
        </Link>
      </Reveal>
    </section>
  )
}
