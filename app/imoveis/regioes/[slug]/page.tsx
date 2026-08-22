import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PropertyCard } from '@/components/marketplace/property-card'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { getMarketplaceBrokers, getMarketplaceProperties, getMarketplaceRegions } from '@/lib/marketplace/server-data'

export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const region = (await getMarketplaceRegions()).find((item) => item.slug === slug)
  return region ? { title: `${region.name} | Regiões · EME Imóveis`, description: region.description } : { title: 'Região | EME Imóveis' }
}

export default async function RegiaoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [regions, properties, brokers] = await Promise.all([getMarketplaceRegions(), getMarketplaceProperties(), getMarketplaceBrokers()])
  const region = regions.find((item) => item.slug === slug)
  if (!region) notFound()
  const normalizedName = region.name.toLocaleLowerCase('pt-BR')
  const regionProperties = properties.filter((property) => (
    property.city.toLocaleLowerCase('pt-BR') === normalizedName &&
    (!region.state || !property.state || property.state.toLocaleUpperCase('pt-BR') === region.state)
  ))
  const brokerSlugs = new Set(regionProperties.map((property) => property.brokerSlug))
  const regionBrokers = brokers.filter((broker) => brokerSlugs.has(broker.slug) || broker.regionSlug === slug)
  return <PageShell>
    <section className="mx-auto w-full max-w-6xl px-5 pt-10 md:px-8 md:pt-16">
      <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_80%_15%,rgba(77,173,96,.28),transparent_32%),linear-gradient(145deg,#1f2d25,#102018)] px-6 py-12 text-white md:px-12 md:py-16">{region.image ? <><Image src={region.image} alt="" fill priority sizes="(max-width: 1200px) 100vw, 1152px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" /></> : <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:36px_36px]" />}<div className="relative"><Link href="/imoveis/regioes" className="inline-flex items-center gap-2 text-sm text-white/75 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar para regiões</Link><h1 className="mt-8 flex items-center gap-3 text-3xl font-semibold md:text-5xl"><MapPin className="h-8 w-8" />{region.name}</h1><p className="mt-4 max-w-2xl text-white/75">{region.description}</p><div className="mt-7 flex flex-wrap gap-3"><span className="rounded-full bg-white/10 px-4 py-2 text-sm">{region.forSale} para comprar</span><span className="rounded-full bg-white/10 px-4 py-2 text-sm">{region.forRent} para alugar</span></div></div></div>
    </section>
    <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bairros disponíveis</p><div className="mt-3 flex flex-wrap gap-2">{region.areas.length ? region.areas.map((area) => <Link key={area} href={`/imoveis/busca?cidade=${region.slug}&local=${encodeURIComponent(area)}`} className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:border-primary/40">{area}</Link>) : <span className="text-sm text-muted-foreground">O inventário atual ainda não detalha bairros.</span>}</div></section>
    <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8"><div className="flex items-end justify-between gap-4"><SectionHeading title={`Imóveis em ${region.name}`} support={`${region.properties} ${region.properties === 1 ? 'imóvel publicado' : 'imóveis publicados'} agora.`} /><Link href={`/imoveis/busca?cidade=${region.slug}`} className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary">Ver todos<ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">{regionProperties.slice(0, 6).map((property) => <PropertyCard key={property.slug} property={property} />)}</div></section>
    {regionBrokers.length ? <section className="mx-auto w-full max-w-6xl px-5 py-10 pb-20 md:px-8"><SectionHeading title="Quem atua nesta região" support="Corretores vinculados ao inventário publicado." /><div className="mt-8 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">{regionBrokers.slice(0, 3).map((broker) => <BrokerCard key={broker.slug} broker={broker} />)}</div></section> : null}
  </PageShell>
}
