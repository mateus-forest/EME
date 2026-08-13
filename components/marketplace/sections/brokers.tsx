import { brokers } from '@/lib/marketplace/data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { Reveal } from '@/components/marketplace/reveal'

export function BrokersSection() {
  return (
    <section id="corretores" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          title="Profissionais da rede EME"
          support="Corretores preparados para ajudar você a encontrar o imóvel certo."
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 md:grid-cols-3">
        {brokers.map((broker, i) => (
          <Reveal key={broker.slug} delay={i * 90}>
            <BrokerCard broker={broker} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}
