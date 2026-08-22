import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PropertyCard } from '@/components/marketplace/property-card'
import type { SimilarProperty } from '@/lib/marketplace/property-detail'

export function SimilarProperties({ properties }: { properties: SimilarProperty[] }) {
  if (!properties.length) return null
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
          Imóveis semelhantes
        </h2>
        <Link
          href="/imoveis/busca"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-eme-700"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        {properties.map((property) => <PropertyCard key={property.slug} property={property} />)}
      </div>
    </div>
  )
}
