import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Bath, BedDouble, CarFront, Check, MapPin, Ruler, Sparkles } from 'lucide-react'
import { formatPrice, type SearchResult } from '@/lib/marketplace/search-data'
import {
  comparisonInsights,
  comparisonRecommendations,
  pricePerSquareMeter,
  withOptionLabels,
} from '@/lib/marketplace/comparison-analysis'

export function ComparisonExperience({ results }: { results: SearchResult[] }) {
  const compared = withOptionLabels(results)
  const insights = comparisonInsights(results)
  const recommendations = comparisonRecommendations(results)
  const maxArea = Math.max(...compared.map((property) => property.area))
  const minPrice = Math.min(...compared.map((property) => property.price))
  const maxBedrooms = Math.max(...compared.map((property) => property.bedrooms))
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <Link
        href="/imoveis"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar ao Marketplace
      </Link>

      <header className="mt-8 max-w-2xl">
        <span className="inline-flex rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-eme-700">
          Comparação inteligente
        </span>
        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Compare o que realmente muda sua escolha.
        </h1>
        <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
          Três opções demonstrativas lado a lado, usando apenas os dados disponíveis neste protótipo.
        </p>
      </header>

      <div className="no-scrollbar -mx-5 mt-9 overflow-x-auto px-5 pb-4 md:-mx-8 md:px-8">
        <div
          className="grid min-w-[680px] gap-4"
          style={{ gridTemplateColumns: `repeat(${compared.length}, minmax(280px, 1fr))` }}
        >
          {compared.map((property) => (
            <article
              key={property.slug}
              className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[var(--shadow-soft)]"
            >
              <div className="relative aspect-[16/10]">
                <Image src={property.image} alt={property.title} fill sizes="360px" className="object-cover" />
              </div>
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
                  {property.optionLabel}
                </p>
                <h2 className="mt-2 text-lg font-semibold leading-tight text-foreground">{property.title}</h2>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                  {property.city} · {property.state}
                </p>
                <p className="mt-4 text-xl font-semibold text-foreground">{formatPrice(property.price)}</p>

                <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  {[
                    { icon: Ruler, label: `${property.area} m²` },
                    { icon: BedDouble, label: `${property.bedrooms} quartos` },
                    { icon: Bath, label: `${property.bathrooms} banheiros` },
                    { icon: CarFront, label: `${property.parking} vagas` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-foreground">
                      <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      <dd>{item.label}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">
                  {formatPrice(pricePerSquareMeter(property))}/m² · {property.suites} {property.suites === 1 ? 'suíte' : 'suítes'}
                </p>

                <div className="mt-5 border-t border-border/70 pt-5">
                  <p className="text-sm font-medium text-foreground">Pontos fortes</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {property.area === maxArea && <Highlight>Mais espaço entre as opções</Highlight>}
                    {property.price === minPrice && <Highlight>Menor preço da comparação</Highlight>}
                    {property.bedrooms === maxBedrooms && <Highlight>Maior número de quartos</Highlight>}
                    {property.isNew && <Highlight>Imóvel novo e pronto para morar</Highlight>}
                    {property.patio && <Highlight>Pátio disponível</Highlight>}
                  </ul>
                </div>

                <Link
                  href={`/imoveis/imovel/${property.slug}`}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-primary/25 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-eme-50"
                >
                  Ver imóvel
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      <section className="mt-12 rounded-[2rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-eme-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Leitura objetiva dos dados
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Análise da comparação</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Diferenças calculadas a partir dos imóveis selecionados, sem definir um vencedor absoluto.
          </p>
        </div>
        <ol className="mt-7 grid gap-3 md:grid-cols-2">
          {insights.map((insight, index) => (
            <li key={insight} className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed text-foreground">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-eme-50 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              {insight}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-[2rem] border border-border/70 bg-surface p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Qual faz mais sentido para você?</h2>
        <p className="mt-2 text-sm text-muted-foreground">A resposta muda conforme a sua prioridade.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recommendations.map((recommendation) => (
            <div key={recommendation.priority} className="rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary">{recommendation.priority}</p>
              <p className="mt-3 font-semibold text-foreground">{recommendation.property.optionLabel}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{recommendation.property.title}</p>
              <p className="mt-3 text-xs text-muted-foreground">{recommendation.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Comparação demonstrativa. Disponibilidade, condições e localização exata dependem da futura integração com os catálogos.
      </p>
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-eme-50 text-primary">
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
      {children}
    </li>
  )
}
