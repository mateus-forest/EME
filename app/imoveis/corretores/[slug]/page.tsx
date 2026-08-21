import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck, Building2, MapPin, Star } from 'lucide-react'
import { getMarketplaceBroker, getMarketplaceBrokerPropertyCards } from '@/lib/marketplace/server-data'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { PropertyCard } from '@/components/marketplace/property-card'
import { BrokerContactForm } from '@/components/marketplace/pages/broker-contact-form'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { BrokerProfileTracker } from '@/components/marketplace/broker-profile-tracker'
import { BrokerReviews } from '@/components/marketplace/pages/broker-reviews'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const broker = await getMarketplaceBroker(slug)
  if (!broker) return { title: 'Corretor | EME Imóveis' }
  return {
    title: `${broker.name} | Corretores EME`,
    description: `${broker.name} — ${broker.specialties.join(', ')} em ${broker.region}. Fale com um especialista verificado da rede EME.`,
  }
}

const transactionLabel: Record<string, string> = {
  compra: 'Compra',
  aluguel: 'Locação',
  ambos: 'Compra e locação',
}

export default async function BrokerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const broker = await getMarketplaceBroker(slug)
  if (!broker) notFound()

  // Carteira ativa publicada pelo corretor no Marketplace.
  const brokerListings = await getMarketplaceBrokerPropertyCards(broker.id, 3)

  const stats = [
    { icon: Building2, label: 'Imóveis ativos', value: String(broker.activeListings) },
    { icon: Star, label: broker.reviewCount ? `${broker.reviewCount} avaliações` : 'Avaliações', value: broker.rating ? broker.rating.toFixed(1).replace('.', ',') : '—' },
    { icon: MapPin, label: 'Atua em', value: broker.region },
  ]

  return (
    <PageShell>
      <BrokerProfileTracker catalogSlug={broker.slug} />
      <main className="flex-1 pb-20 pt-16 md:pt-20">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          {/* Voltar */}
          <div className="pt-6 md:pt-8">
            <Link
              href="/imoveis/corretores"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-eme-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar aos corretores
            </Link>
          </div>

          {/* Cabeçalho do perfil */}
          <section className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl sm:h-32 sm:w-32">
                  <Image
                    src={broker.image || '/marketplace/placeholder-user.jpg'}
                    alt={broker.name}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {broker.name}
                    </h1>
                    <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label="Perfil verificado" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{broker.creci}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{broker.specialties.map((specialty) => <span key={specialty} className="rounded-full border border-primary/15 bg-eme-50 px-2.5 py-1 text-xs font-medium text-primary">{specialty}</span>)}</div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-primary">
                      {transactionLabel[broker.transaction]}
                    </span>
                    {broker.featured && (
                      <span className="rounded-full border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
                        Corretor em destaque
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border/60 bg-surface p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-eme-50 text-primary">
                      <stat.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-pretty text-base font-semibold leading-tight text-foreground">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Sobre */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-foreground">Sobre o atendimento</h2>
                <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
                  {broker.about || `${broker.name.split(' ')[0]} atua em ${broker.region} com foco em ${broker.specialties.join(', ').toLowerCase()}. Acompanha cada etapa de perto, entende o que importa para você e indica caminhos com transparência — do primeiro contato à assinatura.`}
                </p>
              </div>
            </div>

            {/* Contato */}
            <aside id="contato-corretor" className="scroll-mt-28 lg:sticky lg:top-24 lg:self-start">
              <BrokerContactForm brokerName={broker.name} brokerSlug={broker.slug} brokerPhone={broker.phone} />
            </aside>
          </section>

          <BrokerReviews broker={broker} />

          {/* Imóveis do corretor */}
          <section className="mt-16">
            <Reveal>
              <SectionHeading
                title={`Imóveis com ${broker.name.split(' ')[0]}`}
                support="Uma seleção da carteira ativa deste especialista."
              />
            </Reveal>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              {brokerListings.map((property, i) => (
                <Reveal key={property.slug} delay={i * 90}>
                  <PropertyCard property={property} />
                </Reveal>
              ))}
            </div>
          </section>
        </div>
      </main>
    </PageShell>
  )
}
