import Link from 'next/link'
import { buildQuickSearchHref } from '@/lib/marketplace/search-filters'

// Filtros rápidos (cidade, tipo, valor, quartos) apresentados como chips que abrem a busca.
export function QuickFilters({
  groups,
  purpose,
}: {
  groups: { label: string; value: string; param: string }[]
  purpose: 'compra' | 'aluguel'
}) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
      {groups.map((chip) => (
        <Link
          key={`${chip.param}-${chip.value}`}
          href={buildQuickSearchHref(purpose, chip.param, chip.value)}
          className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
        >
          {chip.label}
        </Link>
      ))}
    </div>
  )
}
