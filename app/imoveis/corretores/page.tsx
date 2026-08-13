import type { Metadata } from 'next'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PageHero } from '@/components/marketplace/pages/page-hero'
import { BrokersDirectory } from '@/components/marketplace/pages/brokers-directory'
import { HelpCta } from '@/components/marketplace/pages/help-cta'
import { Reveal } from '@/components/marketplace/reveal'
import { FeaturedBrokers } from '@/components/marketplace/pages/featured-brokers'
import { getMarketplaceBrokers } from '@/lib/marketplace/server-data'

export const metadata: Metadata = {
  title: 'Corretores | EME Imóveis',
  description:
    'Conheça os especialistas da rede EME. Profissionais verificados que conhecem cada região e ajudam você a encontrar o imóvel certo.',
}

export const dynamic = 'force-dynamic'

export default async function CorretoresPage() {
  const brokers = await getMarketplaceBrokers()
  const hasFeatured = brokers.some((broker) => broker.featured)
  return (
    <PageShell>
      <PageHero
        eyebrow="Corretores"
        title="Quem conhece a região ao seu lado"
        text="Especialistas verificados da rede EME, prontos para entender o que você procura e acompanhar cada etapa com atendimento humano."
      />

      <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        {hasFeatured ? <Reveal><FeaturedBrokers brokers={brokers} /></Reveal> : null}
        <Reveal className={hasFeatured ? 'mt-14 border-t border-border/70 pt-12 md:mt-16 md:pt-14' : ''}>
          <BrokersDirectory brokers={brokers} />
        </Reveal>
      </section>

      <HelpCta
        title="Não sabe por quem começar?"
        text="Conte o que você procura e conectamos você ao especialista certo para a sua região e o seu momento."
        placeholder="Ex.: procuro uma casa com pátio em Vacaria"
        purpose="compra"
        secondaryLabel="Ver todos os imóveis"
        secondaryHref="/imoveis/busca"
      />
    </PageShell>
  )
}
