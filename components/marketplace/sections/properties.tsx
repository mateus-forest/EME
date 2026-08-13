import type { Property } from '@/lib/marketplace/data'
import { PropertyCard } from '@/components/marketplace/property-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'

export function PropertiesSection({ properties }: { properties: Property[] }) {
  const [featured, ...rest] = properties

  return (
    <section id="imoveis" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          title="Imóveis recém-publicados"
          support="As publicações mais recentes dos corretores da rede EME."
        />
      </Reveal>

      {featured ? <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 lg:grid-cols-3">
        <Reveal className="lg:col-span-2 lg:row-span-2">
          <div className="h-full">
            <PropertyCard property={featured} featured />
          </div>
        </Reveal>
        {rest.map((property, i) => (
          <Reveal key={property.slug} delay={(i + 1) * 90} className="lg:col-span-1">
            <div className="h-full">
              <PropertyCard property={property} />
            </div>
          </Reveal>
        ))}
      </div> : <p className="mt-8 rounded-3xl border border-border/70 bg-card px-6 py-10 text-center text-sm text-muted-foreground">Novos imóveis serão publicados aqui em breve.</p>}
    </section>
  )
}
