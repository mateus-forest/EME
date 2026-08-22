import Link from 'next/link'
import { buildQuickSearchHref } from '@/lib/marketplace/search-filters'
import { CATALOG_SECONDARY_CTA_CLASS } from '@/lib/catalog-visual-system'
import { cn } from '@/lib/utils'

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
          className={cn(CATALOG_SECONDARY_CTA_CLASS, 'marketplace-chip inline-flex h-9 shrink-0 items-center px-3.5 text-xs text-muted-foreground hover:-translate-y-0.5 hover:text-foreground')}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  )
}
