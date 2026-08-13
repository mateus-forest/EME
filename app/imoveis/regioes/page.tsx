import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PageHero } from '@/components/marketplace/pages/page-hero'
import { RegionsDirectory } from '@/components/marketplace/pages/regions-directory'
import { IntentGrid } from '@/components/marketplace/pages/intent-grid'
import { HelpCta } from '@/components/marketplace/pages/help-cta'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { brokers } from '@/lib/marketplace/data'
import { popularAreas, regionLifestyles } from '@/lib/marketplace/pages-data'

export const metadata: Metadata = {
  title: 'Regiões | EME Imóveis',
  description:
    'Descubra onde sua próxima história pode acontecer. Explore cidades e regiões, conheça suas características e encontre imóveis disponíveis.',
}

export default function RegioesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Regiões"
        title="Descubra onde sua próxima história pode acontecer."
        text="Explore cidades e regiões, conheça suas características e encontre imóveis disponíveis."
        align="center"
      />

      {/* Regiões principais + busca */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-4 md:px-8">
        <RegionsDirectory />
      </section>

      {/* Regiões mais procuradas */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <SectionHeading
            title="Mais procuradas"
            support="Lugares que as pessoas mais exploram por aqui."
          />
        </Reveal>
        <Reveal>
          <div className="mt-8 flex flex-wrap gap-3">
            {popularAreas.map((area) => (
              <Link
                key={area}
                href={`/imoveis/busca?local=${encodeURIComponent(area)}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
              >
                {area}
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Descubra pelo estilo de vida */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <SectionHeading
            title="Descubra pelo estilo de vida"
            support="Um jeito diferente de escolher onde morar: pelo tipo de rotina que você quer."
          />
        </Reveal>
        <div className="mt-8">
          <IntentGrid items={regionLifestyles} purpose="compra" />
        </div>
      </section>

      {/* Profissionais que atuam em cada região */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title="Quem conhece cada região"
              support="Profissionais verificados que acompanham imóveis nessas localidades."
              className="sm:flex-1"
            />
            <Link
              href="/imoveis/corretores"
              className="inline-flex w-fit items-center gap-2 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-eme-600"
            >
              Ver todos os corretores
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {brokers.map((broker, i) => (
            <Reveal key={broker.slug} delay={i * 80}>
              <BrokerCard broker={broker} />
            </Reveal>
          ))}
        </div>
      </section>

      <HelpCta
        title="Ainda decidindo onde morar?"
        text="Descreva o tipo de lugar que você imagina e receba sugestões de regiões e imóveis que combinam com isso."
        placeholder="Quero um lugar tranquilo, perto da natureza, mas com comércio por perto..."
        purpose="compra"
        secondaryLabel="Falar com um especialista de região"
      />
    </PageShell>
  )
}
