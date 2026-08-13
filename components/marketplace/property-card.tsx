'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, Car, Heart, Maximize } from 'lucide-react'
import { formatPrice, type Property } from '@/lib/marketplace/data'
import { cn } from '@/lib/utils'

export function PropertyCard({
  property,
  featured = false,
}: {
  property: Property
  featured?: boolean
}) {
  const [favorite, setFavorite] = useState(false)

  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]',
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden',
          featured ? 'aspect-[16/11] lg:aspect-auto lg:min-h-[300px] lg:flex-1' : 'aspect-[16/10]',
        )}
      >
        <Link href={`/imoveis?imovel=${property.slug}#imoveis`} className="absolute inset-0">
          <Image
            src={property.image || '/placeholder.svg'}
            alt={property.title}
            fill
            sizes={featured ? '(max-width: 1024px) 100vw, 60vw' : '(max-width: 1024px) 100vw, 30vw'}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />

        {property.badge && (
          <span className="glass absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground shadow-[var(--shadow-soft)]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {property.badge}
          </span>
        )}

        <button
          type="button"
          onClick={() => setFavorite((v) => !v)}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className="glass absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-110 active:scale-90"
        >
          <Heart
            className={cn('h-4 w-4 transition-colors', favorite && 'fill-primary text-primary')}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className={cn('flex flex-col p-5', featured ? 'flex-none' : 'flex-1')}>
        <div className={cn(featured ? '' : 'flex-1')}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-pretty text-base font-medium text-foreground">
              <Link
                href={`/imoveis?imovel=${property.slug}#imoveis`}
                className="outline-none transition-colors hover:text-primary focus-visible:text-primary"
              >
                {property.title}
              </Link>
            </h3>
            <p className="shrink-0 text-lg font-semibold tracking-tight text-foreground">
              {formatPrice(property.price)}
            </p>
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            {property.city} · {property.state}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {property.bedrooms} quartos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Maximize className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {property.area} m²
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Car className="h-4 w-4 text-primary/70" aria-hidden="true" />
            {property.parking} {property.parking > 1 ? 'vagas' : 'vaga'}
          </span>
        </div>
      </div>
    </article>
  )
}
