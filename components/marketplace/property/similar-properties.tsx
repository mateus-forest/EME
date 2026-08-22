import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BedDouble, Maximize } from 'lucide-react'
import { CompatibilityBadge } from '@/components/marketplace/search/compatibility-badge'
import type { SimilarProperty } from '@/lib/marketplace/property-detail'
import { formatPrice } from '@/lib/marketplace/search-data'

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

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((item) => (
          <Link
            key={item.slug}
            href={`/imoveis/imovel/${item.slug}`}
            className="marketplace-card group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-white/80 bg-card shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={item.image || '/marketplace/placeholder.svg'}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <CompatibilityBadge level={item.compatibility} className="absolute left-3 top-3 shadow-[var(--shadow-soft)]" />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="line-clamp-2 min-h-[2.75rem] text-pretty text-base font-semibold leading-snug text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.city} · {item.state}
              </p>
              <p className="mt-3 text-lg font-semibold text-foreground">{formatPrice(item.price)}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4" aria-hidden="true" />
                  {item.bedrooms} quartos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Maximize className="h-4 w-4" aria-hidden="true" />
                  {item.area} m²
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
