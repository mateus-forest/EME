import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PropertyCard } from '@/components/marketplace/property-card'
import { BrokerCard } from '@/components/marketplace/broker-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { OrganicLines } from '@/components/marketplace/organic-lines'
import { brokerProfiles, regionDetails, buyProperties } from '@/lib/marketplace/pages-data'

export function generateStaticParams() {
  return regionDetails.map((region) => ({ slug: region.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const region = regionDetails.find((r) => r.slug === slug)
  if (!region) return { title: 'Região | EME Imóveis' }
  return {
    title: `${region.name} | Regiões · EME Imóveis`,
    description: region.description,
  }
}

export default async function RegiaoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const region = regionDetails.find((r) => r.slug === slug)
  if (!region) notFound()

  // Seleção demonstrativa de imóveis e profissionais para a região.
  const regionProperties = buyProperties.slice(0, 3)
  const regionBrokers = brokerProfiles.filter((broker) => broker.regionSlug === slug || broker.featured).slice(0, 3)

  return (
    <PageShell>
      {/* Capa da região */}
      <section className="relative">
        <div className="relative h-[42vh] min-h-[300px] w-full overflow-hidden md:h-[52vh]">
          <Image
            src={region.image || '/marketplace/placeholder.svg'}
            alt={`Região de ${region.name}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto w-full max-w-6xl px-5 pb-8 md:px-8 md:pb-10">
              <div className="flex flex-wrap gap-2">
                {region.tags.map((tag) => (
                  <span
                    key={tag}
                    className="glass rounded-full px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="mt-4 flex items-center gap-2 text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl">
                <MapPin className="h-7 w-7 shrink-0" aria-hidden="true" />
                {region.name}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* Introdução + disponibilidade */}
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <Link
          href="/imoveis/regioes"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-eme-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar para regiões
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground lg:col-span-2">
            {region.description}
          </p>
          <div className="flex gap-3">
            <Link
              href={`/imoveis/busca?regiao=${region.slug}&finalidade=compra`}
              className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
            >
              <span className="text-2xl font-semibold text-foreground">{region.forSale}</span>
              <span className="text-xs text-muted-foreground">para comprar</span>
            </Link>
            <Link
              href={`/imoveis/busca?regiao=${region.slug}&finalidade=aluguel`}
              className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
            >
              <span className="text-2xl font-semibold text-foreground">{region.forRent}</span>
              <span className="text-xs text-muted-foreground">para alugar</span>
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bairros e cidades
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {region.areas.map((area) => (
              <span
                key={area}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Imóveis na região */}
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title={`Imóveis em ${region.name}`}
              support="Uma amostra do que está disponível nesta região agora."
              className="sm:flex-1"
            />
            <Link
              href={`/imoveis/busca?regiao=${region.slug}`}
              className="inline-flex w-fit items-center gap-2 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-eme-600"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {regionProperties.map((property, i) => (
            <Reveal key={property.slug} delay={i * 80}>
              <div className="h-full">
                <PropertyCard property={property} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Profissionais da região */}
      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <Reveal>
          <SectionHeading
            title="Quem conhece esta região"
            support="Fale com profissionais verificados que acompanham imóveis por aqui."
          />
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {regionBrokers.map((broker, i) => (
            <Reveal key={broker.slug} delay={i * 80}>
              <BrokerCard broker={broker} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Encerramento */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8 md:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-eme-50 via-card to-card p-8 text-center shadow-[var(--shadow-soft)] md:p-12">
            <OrganicLines className="opacity-70" />
            <div className="relative mx-auto max-w-xl">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Quer morar em {region.name}?
              </h2>
              <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
                Comece uma busca por esta região ou fale com quem conhece cada bairro de perto.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`/imoveis/busca?regiao=${region.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-all duration-200 hover:scale-[1.02] hover:bg-eme-600 active:scale-95"
                >
                  Ver imóveis na região
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/imoveis/corretores"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
                >
                  Falar com um especialista
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </PageShell>
  )
}
