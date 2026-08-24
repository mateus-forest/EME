import { BedDouble, Car, Maximize } from 'lucide-react'
import type { PropertyDetail } from '@/lib/marketplace/property-detail'
import { formatPrice } from '@/lib/marketplace/search-data'
import { formatLocation, formatPositiveArea, formatPositiveCountLabel } from '@/lib/structured-fields'

export function PropertyEssentials({ property }: { property: PropertyDetail }) {
  const specs = [
    { icon: BedDouble, label: formatPositiveCountLabel(property.bedrooms, 'quarto', 'quartos') },
    { icon: Maximize, label: formatPositiveArea(property.area) },
    { icon: Car, label: formatPositiveCountLabel(property.parking, 'vaga', 'vagas') },
  ].filter((spec) => spec.label)
  const location = formatLocation(property.city, property.state, ' · ')
  const secondarySpecs = [
    formatPositiveCountLabel(property.suites, 'suíte', 'suítes'),
    formatPositiveCountLabel(property.bathrooms, 'banheiro', 'banheiros'),
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {property.title}
      </h1>
      {location ? <p className="mt-2 text-muted-foreground">{location}</p> : null}

      <p className="mt-5 text-3xl font-semibold text-foreground md:text-[2rem]">
        {formatPrice(property.price)}
      </p>

      {specs.length ? <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        {specs.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <s.icon className="h-5 w-5 text-primary" aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div> : null}

      {secondarySpecs ? <p className="mt-4 text-sm text-muted-foreground">{secondarySpecs}</p> : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Cód. {property.code}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          {property.updatedLabel}
        </span>
      </div>
    </div>
  )
}
