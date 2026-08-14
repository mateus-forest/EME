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
import { PropertyCard } from '@/components/marketplace/property-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { buyTypes, buyIntents } from '@/lib/marketplace/pages-data'
import { getMarketplaceProperties, getMarketplacePropertyCards, getMarketplaceRegions } from '@/lib/marketplace/server-data'

export const metadata: Metadata = {
  title: 'Comprar imóveis | EME Imóveis',
  description:
    'Encontre um imóvel para chamar de seu. Descreva o que procura ou explore possibilidades para comprar na sua região.',
}

const quickFilters = [
  { label: 'Vacaria', value: 'vacaria', param: 'cidade' },
  { label: 'Serra Gaúcha', value: 'serra-gaucha', param: 'cidade' },
  { label: 'Casas', value: 'casa', param: 'tipo' },
  { label: 'Apartamentos', value: 'apartamento', param: 'tipo' },
  { label: 'Até R$ 500 mil', value: '0-500000', param: 'valor' },
  { label: 'R$ 500 a 800 mil', value: '500000-800000', param: 'valor' },
  { label: '3+ quartos', value: '3', param: 'quartos' },
]

export const dynamic = 'force-dynamic'

export default async function ComprarPage() {
  const [buyProperties, searchResults, regions] = await Promise.all([getMarketplacePropertyCards(5, 'SALE'), getMarketplaceProperties(), getMarketplaceRegions()])
  const [featured, ...rest] = buyProperties
  const buyResults = searchResults.filter((property) => property.purpose === 'compra')
  const realBuyTypes = buyTypes.map((type) => ({ ...type, count: buyResults.filter((property) => property.propertyType === type.slug).length }))

  return (
    <PageShell>
      <PageHero
        eyebrow="Comprar"
        title="Encontre um imóvel para chamar de seu."
        text="Descreva o que procura ou explore possibilidades para comprar na sua região."
        action={
          <ConversationalSearch
            placeholder="Procuro uma casa para comprar com 3 quartos e pátio"
            purpose="compra"
            size="lg"
          />
        }
      />

      {/* Explore por tipo */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <SectionHeading
            title="Explore por tipo"
            support="Comece pelo formato de imóvel que faz sentido para você."
          />
        </Reveal>
        <div className="mt-8">
          <TypeExplorer items={realBuyTypes} purpose="compra" />
        </div>
      </section>

      {/* Imóveis para comprar */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title="Imóveis para comprar"
              support="Imóveis reais publicados para começar a comparar com calma."
              className="sm:flex-1"
            />
            <Link
              href="/imoveis/busca?finalidade=compra"
              className="inline-flex w-fit items-center gap-2 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-eme-600"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-6">
          <QuickFilters groups={quickFilters} purpose="compra" />
        </div>

        {featured ? <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Reveal className="lg:col-span-2 lg:row-span-2">
            <div className="h-full">
              <PropertyCard property={featured} featured />
            </div>
          </Reveal>
          {rest.slice(0, 4).map((property, i) => (
            <Reveal key={property.slug} delay={(i + 1) * 80} className="lg:col-span-1">
              <div className="h-full">
                <PropertyCard property={property} />
              </div>
            </Reveal>
          ))}
        </div> : <p className="mt-8 rounded-3xl border border-border/70 bg-card px-6 py-10 text-center text-sm text-muted-foreground">Ainda não há imóveis para comprar publicados no Marketplace.</p>}
      </section>

      {/* Encontre pelo que importa */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <SectionHeading
            title="Encontre pelo que importa"
            support="Escolha o que mais pesa na sua decisão e veja imóveis alinhados a isso."
          />
        </Reveal>
        <div className="mt-8">
          <IntentGrid items={buyIntents} purpose="compra" />
        </div>
      </section>

      {/* Regiões em destaque */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title="Regiões em destaque"
              support="Descubra onde comprar dentro da serra e dos campos."
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
          <RegionHighlights metric="forSale" regions={regions} />
        </div>
      </section>

      <HelpCta
        title="Não encontrou o que procura?"
        text="Conte o que você precisa e conecte-se a um profissional que conhece a região para ajudar na sua compra."
        placeholder="Procuro uma casa com pátio até R$ 700 mil"
        purpose="compra"
      />
    </PageShell>
  )
}
