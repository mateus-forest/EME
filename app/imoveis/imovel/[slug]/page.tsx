import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/marketplace/header'
import { Footer } from '@/components/marketplace/footer'
import { InterestProvider } from '@/components/marketplace/property/interest-provider'
import { PropertyGallery } from '@/components/marketplace/property/property-gallery'
import { PropertyEssentials } from '@/components/marketplace/property/property-essentials'
import { PropertyCompatibility } from '@/components/marketplace/property/property-compatibility'
import { BrokerPanel } from '@/components/marketplace/property/broker-panel'
import { PropertyEnvironments } from '@/components/marketplace/property/property-environments'
import { BeforeDeciding } from '@/components/marketplace/property/before-deciding'
import { PropertyLocation } from '@/components/marketplace/property/property-location'
import { PropertyCompare } from '@/components/marketplace/property/property-compare'
import { SimilarProperties } from '@/components/marketplace/property/similar-properties'
import { PropertyContact } from '@/components/marketplace/property/property-contact'
import { MobileInterestBar } from '@/components/marketplace/property/mobile-interest-bar'
import { PropertyViewTracker } from '@/components/marketplace/property/property-view-tracker'
import { formatPrice } from '@/lib/marketplace/search-data'
import { getMarketplaceProperties, getMarketplacePropertyDetail } from '@/lib/marketplace/server-data'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const loaded = await getMarketplacePropertyDetail(slug)
  if (!loaded) return { title: 'Imóvel não encontrado — EME Imóveis' }
  const { property } = loaded
  return {
    title: `${property.title} · ${property.city}/${property.state} — EME Imóveis`,
    description: property.summary,
    openGraph: {
      title: `${property.title} — ${formatPrice(property.price)}`,
      description: property.summary,
      images: property.gallery[0] ? [property.gallery[0]] : [],
    },
  }
}

export default async function ImovelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [loaded, allProperties] = await Promise.all([
    getMarketplacePropertyDetail(slug),
    getMarketplaceProperties(),
  ])
  if (!loaded?.broker) notFound()
  const { property, broker, similar } = loaded
  const compareItems = [
    ...allProperties.filter((item) => item.slug === property.slug),
    ...allProperties.filter((item) => item.slug !== property.slug),
  ].slice(0, 3)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <InterestProvider property={property} brokerName={broker.name} brokerPhone={broker.phone}>
        <PropertyViewTracker propertyId={property.propertyId} />
        <main className="flex-1 pb-24 pt-16 md:pt-20 lg:pb-0">
          <section className="mx-auto w-full max-w-6xl px-5 pt-6 md:px-8 md:pt-8">
            <Link href="/imoveis/busca" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar aos resultados
            </Link>
            <div className="mt-5"><PropertyGallery title={property.title} photos={property.gallery} photoCount={property.photoCount} /></div>
          </section>

          <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr_0.95fr] lg:gap-6">
              <PropertyEssentials property={property} />
              <PropertyCompatibility property={property} />
              <BrokerPanel broker={broker} creci={property.brokerCreci} />
            </div>
          </section>

          {property.environments.length ? <section className="bg-surface"><div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20"><PropertyEnvironments environments={property.environments} summary={property.summary} highlights={property.highlights} /></div></section> : null}

          <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <div className="grid grid-cols-1 gap-x-10 gap-y-14 lg:grid-cols-2">
              <BeforeDeciding confirmedInfo={property.confirmedInfo} toConfirm={property.toConfirm} />
              <PropertyLocation city={property.city} state={property.state} neighborhood={property.neighborhood} routine={property.routine} />
            </div>
          </section>

          <section className="bg-surface"><div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 py-14 md:px-8 md:py-20"><PropertyCompare currentSlug={property.slug} items={compareItems} /><SimilarProperties properties={similar} /></div></section>
          <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20"><PropertyContact property={property} broker={broker} creci={property.brokerCreci} /></section>
        </main>
        <MobileInterestBar price={property.price} />
      </InterestProvider>
      <Footer />
    </div>
  )
}
