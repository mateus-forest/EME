import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PageHero } from '@/components/marketplace/pages/page-hero'
import { RegionsDirectory } from '@/components/marketplace/pages/regions-directory'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { getMarketplaceBrokers, getMarketplaceRegions } from '@/lib/marketplace/server-data'

export const metadata: Metadata = { title: 'Regiões | EME Imóveis', description: 'Explore somente localidades que possuem imóveis publicados no Marketplace EME.' }
export const dynamic = 'force-dynamic'

export default async function RegioesPage() {
  const [brokers, regions] = await Promise.all([getMarketplaceBrokers(), getMarketplaceRegions()])
  const popular = [...regions].sort((a, b) => b.searchVolume - a.searchVolume || b.properties - a.properties).slice(0, 8)
  return <PageShell>
    <PageHero eyebrow="Regiões" title="Descubra onde sua próxima história pode acontecer." text="Localidades e bairros apresentados a partir do inventário realmente publicado." align="center" />
    <section className="mx-auto w-full max-w-6xl px-5 pb-4 md:px-8"><RegionsDirectory regions={regions} /></section>
    {popular.length ? <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16"><Reveal><SectionHeading title={popular.some((region) => region.searchVolume > 0) ? 'Mais procuradas' : 'Regiões disponíveis'} support={popular.some((region) => region.searchVolume > 0) ? 'Popularidade calculada com buscas reais do Marketplace.' : 'Ainda não há volume de busca suficiente; mostramos o inventário disponível.'} /></Reveal><div className="mt-8 flex flex-wrap gap-3">{popular.map((region) => <Link key={region.slug} href={`/imoveis/busca?cidade=${region.slug}`} className="rounded-full border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40 hover:text-foreground">{region.name} · {region.properties}</Link>)}</div></section> : null}
    {brokers.length ? <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16"><Reveal><SectionHeading title="Quem conhece cada região" support="Profissionais com imóveis publicados nessas localidades." /></Reveal><div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">{brokers.slice(0, 3).map((broker, index) => <Reveal key={broker.slug} delay={index * 80}><BrokerCard broker={broker} /></Reveal>)}</div></section> : null}
  </PageShell>
}
