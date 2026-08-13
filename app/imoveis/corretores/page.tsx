import type { Metadata } from 'next'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PageHero } from '@/components/marketplace/pages/page-hero'
import { BrokersDirectory } from '@/components/marketplace/pages/brokers-directory'
import { HelpCta } from '@/components/marketplace/pages/help-cta'
import { Reveal } from '@/components/marketplace/reveal'

export const metadata: Metadata = {
  title: 'Corretores | EME Imóveis',
  description:
    'Conheça os especialistas da rede EME. Profissionais verificados que conhecem cada região e ajudam você a encontrar o imóvel certo.',
}

export default function CorretoresPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Corretores"
        title="Quem conhece a região ao seu lado"
        text="Especialistas verificados da rede EME, prontos para entender o que você procura e acompanhar cada etapa com atendimento humano."
      />

      <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <Reveal>
          <BrokersDirectory />
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
