import type { Metadata } from 'next'
import Link from 'next/link'
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
import { propertyDetail } from '@/lib/marketplace/property-detail'
import { searchProperties, formatPrice } from '@/lib/marketplace/search-data'
import { brokerProfiles } from '@/lib/marketplace/pages-data'

export function generateStaticParams() {
  return searchProperties.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (slug === propertyDetail.slug) {
    return {
      title: `${propertyDetail.title} · ${propertyDetail.city}/${propertyDetail.state} — EME Imóveis`,
      description: propertyDetail.summary,
      openGraph: {
        title: `${propertyDetail.title} — ${formatPrice(propertyDetail.price)}`,
        description: propertyDetail.summary,
        images: [propertyDetail.gallery[0]],
      },
    }
  }
  const stub = searchProperties.find((p) => p.slug === slug)
  return {
    title: stub ? `${stub.title} — EME Imóveis` : 'Imóvel — EME Imóveis',
  }
}

export default async function ImovelPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Nesta etapa demonstrativa, apenas o imóvel destaque tem página completa.
  if (slug !== propertyDetail.slug) {
    const stub = searchProperties.find((p) => p.slug === slug)
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <Header />
        <main className="flex-1 pt-16 md:pt-20">
          <section className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8 md:py-28">
            <Link
              href="/imoveis/busca"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar aos resultados
            </Link>
            <div className="mt-10 rounded-[2rem] border border-border/70 bg-card p-8 shadow-[var(--shadow-soft)] md:p-12">
              <h1 className="text-balance text-3xl font-semibold leading-tight text-foreground md:text-4xl">
                {stub ? stub.title : 'Imóvel'}
              </h1>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                {stub
                  ? `${stub.location} · ${stub.priceLabel}. A página completa deste imóvel entra aqui quando os dados reais forem conectados.`
                  : 'Não encontramos este imóvel na demonstração.'}
              </p>
              <Link
                href="/imoveis/imovel/casa-terrea-com-patio-amplo-1842"
                className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Ver imóvel em destaque
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  const property = propertyDetail
  const broker = brokerProfiles.find((b) => b.slug === property.brokerSlug) ?? brokerProfiles[0]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />

      <InterestProvider property={property} brokerName={broker.name}>
        <main className="flex-1 pb-24 pt-16 md:pt-20 lg:pb-0">
          {/* Abertura imersiva */}
          <section className="mx-auto w-full max-w-6xl px-5 pt-6 md:px-8 md:pt-8">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/imoveis/busca"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar aos resultados
              </Link>
            </div>

            <div className="mt-5">
              <PropertyGallery
                title={property.title}
                photos={property.gallery}
                photoCount={property.photoCount}
              />
            </div>
          </section>

          {/* Informações essenciais + compatibilidade + corretora */}
          <section className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr_0.95fr] lg:gap-6">
              <PropertyEssentials property={property} />
              <PropertyCompatibility property={property} />
              <BrokerPanel broker={broker} creci={property.brokerCreci} />
            </div>
          </section>

          {/* Explore cada ambiente + resumo */}
          <section className="bg-surface">
            <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
              <PropertyEnvironments
                environments={property.environments}
                summary={property.summary}
                highlights={property.highlights}
              />
            </div>
          </section>

          {/* Antes de decidir + Localização */}
          <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <div className="grid grid-cols-1 gap-x-10 gap-y-14 lg:grid-cols-2">
              <BeforeDeciding confirmedInfo={property.confirmedInfo} toConfirm={property.toConfirm} />
              <PropertyLocation city={property.city} state={property.state} routine={property.routine} />
            </div>
          </section>

          {/* Decisão: comparação + semelhantes */}
          <section className="bg-surface">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 py-14 md:px-8 md:py-20">
              <PropertyCompare currentSlug={property.slug} />
              <SimilarProperties />
            </div>
          </section>

          {/* Contato */}
          <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
            <PropertyContact property={property} broker={broker} creci={property.brokerCreci} />
          </section>
        </main>

        <MobileInterestBar price={property.price} />
      </InterestProvider>

      <Footer />
    </div>
  )
}
