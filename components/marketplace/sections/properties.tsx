import { properties } from '@/lib/marketplace/data'
import { PropertyCard } from '@/components/marketplace/property-card'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'

export function PropertiesSection() {
  const [featured, ...rest] = properties

  return (
    <section id="imoveis" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <SectionHeading
          title="Imóveis em destaque"
          support="Uma seleção de imóveis para começar a descobrir."
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 lg:grid-cols-3">
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
      </div>
    </section>
  )
}
