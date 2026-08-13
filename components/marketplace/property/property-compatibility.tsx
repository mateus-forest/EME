import Link from 'next/link'
import { ArrowLeftRight, Sparkles } from 'lucide-react'
import type { PropertyDetail } from '@/lib/marketplace/property-detail'

export function PropertyCompatibility({ property }: { property: PropertyDetail }) {
  return (
    <div className="flex h-full flex-col rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-pretty text-base font-semibold leading-snug text-foreground">
          Muito compatível com a sua busca
        </h2>
      </div>

      <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
        {property.compatibilitySummary}
      </p>

      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-xs font-medium text-muted-foreground">Sua busca original</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {property.originCriteria.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <Link
        href="/imoveis/busca"
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-eme-700"
      >
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
        Comparar
      </Link>
    </div>
  )
}
