import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PageHero } from '@/components/marketplace/pages/page-hero'
import { TypeExplorer } from '@/components/marketplace/pages/type-explorer'
import { IntentGrid } from '@/components/marketplace/pages/intent-grid'
import { RegionHighlights } from '@/components/marketplace/pages/region-highlights'
import { QuickFilters } from '@/components/marketplace/pages/quick-filters'
import { HelpCta } from '@/components/marketplace/pages/help-cta'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { RentalCard } from '@/components/marketplace/rental-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { rentTypes, rentIntents } from '@/lib/marketplace/pages-data'
import { getMarketplaceProperties, getMarketplaceRegions, getMarketplaceRentals } from '@/lib/marketplace/server-data'

export const metadata: Metadata = {
  title: 'Alugar imóveis | EME Imóveis',
  description:
    'Um novo lugar, no seu momento. Encontre imóveis para alugar de forma simples, visual e direta.',
}

const quickFilters = [
  { label: 'Vacaria', value: 'vacaria', param: 'cidade' },
  { label: 'Perto do centro', value: 'centro', param: 'regiao' },
  { label: 'Apartamentos', value: 'apartamento', param: 'tipo' },
  { label: 'Mobiliados', value: 'mobiliado', param: 'tipo' },
  { label: 'Até R$ 2 mil/mês', value: '0-2000', param: 'valor' },
  { label: 'R$ 2 a 3 mil/mês', value: '2000-3000', param: 'valor' },
  { label: '2+ quartos', value: '2', param: 'quartos' },
]

export const dynamic = 'force-dynamic'

export default async function AlugarPage() {
  const [rentals, searchResults, regions] = await Promise.all([getMarketplaceRentals(5), getMarketplaceProperties(), getMarketplaceRegions()])
  const [featured, ...rest] = rentals
  const rentResults = searchResults.filter((property) => property.purpose === 'aluguel')
  const realRentTypes = rentTypes.map((type) => ({ ...type, count: type.slug === 'mobiliado' ? rentResults.filter((property) => property.furnished).length : rentResults.filter((property) => property.propertyType === type.slug).length }))

  return (
    <PageShell>
      <PageHero
        eyebrow="Alugar"
        title="Um novo lugar, no seu momento."
        text="Encontre imóveis para alugar de forma simples, visual e direta."
        action={
          <ConversationalSearch
            placeholder="Procuro um apartamento para alugar perto do centro"
            purpose="aluguel"
            size="lg"
          />
        }
      />

      {/* Explore por tipo */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <SectionHeading
            title="Explore por tipo"
            support="Do apartamento pronto para entrar ao espaço para o seu negócio."
          />
        </Reveal>
        <div className="mt-8">
          <TypeExplorer items={realRentTypes} purpose="aluguel" />
        </div>
      </section>

      {/* Imóveis para alugar */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title="Imóveis para alugar"
              support="Valores mensais e condomínio à vista para você decidir sem surpresas."
              className="sm:flex-1"
            />
            <Link
              href="/imoveis/busca?finalidade=aluguel"
              className="inline-flex w-fit items-center gap-2 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-eme-600"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-6">
          <QuickFilters groups={quickFilters} purpose="aluguel" />
        </div>

        {featured ? <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Reveal className="lg:col-span-2 lg:row-span-2">
            <div className="h-full">
              <RentalCard rental={featured} featured />
            </div>
          </Reveal>
          {rest.slice(0, 4).map((rental, i) => (
            <Reveal key={rental.slug} delay={(i + 1) * 80} className="lg:col-span-1">
              <div className="h-full">
                <RentalCard rental={rental} />
              </div>
            </Reveal>
          ))}
        </div> : <p className="mt-8 rounded-3xl border border-border/70 bg-card px-6 py-10 text-center text-sm text-muted-foreground">Ainda não há imóveis para alugar publicados no Marketplace.</p>}
      </section>

      {/* Encontre para o seu momento */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <SectionHeading
            title="Encontre para o seu momento"
            support="Cada fase pede um lugar diferente. Comece pelo que você vive agora."
          />
        </Reveal>
        <div className="mt-8">
          <IntentGrid items={rentIntents} purpose="aluguel" />
        </div>
      </section>

      {/* Regiões com imóveis para alugar */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title="Regiões com imóveis para alugar"
              support="Veja onde há mais opções de locação disponíveis agora."
              className="sm:flex-1"
            />
            <Link
              href="/imoveis/regioes"
              className="inline-flex w-fit items-center gap-2 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-eme-600"
            >
              Ver todas as regiões
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-8">
          <RegionHighlights metric="forRent" regions={regions} />
        </div>
      </section>

      <HelpCta
        title="Não encontrou o que procura?"
        text="Descreva o imóvel que você precisa alugar e fale com um profissional da região para agilizar a busca."
        placeholder="Procuro um apartamento mobiliado perto do trabalho, até R$ 2.500..."
        purpose="aluguel"
      />
    </PageShell>
  )
}
