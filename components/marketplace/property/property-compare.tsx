import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { searchResults, formatPrice } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

const rows: { label: string; get: (r: (typeof searchResults)[number]) => React.ReactNode }[] = [
  { label: 'Valor', get: (r) => formatPrice(r.price) },
  { label: 'Área', get: (r) => `${r.area} m²` },
  { label: 'Quartos', get: (r) => r.bedrooms },
  { label: 'Suíte', get: (r) => r.suites },
  {
    label: 'Pátio',
    get: (r) =>
      r.patio ? (
        <Check className="mx-auto h-4 w-4 text-primary" aria-label="Sim" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
]

export function PropertyCompare({ currentSlug }: { currentSlug: string }) {
  const items = searchResults

  return (
    <div>
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
        Compare com suas opções
      </h2>

      <div className="no-scrollbar mt-5 overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Cabeçalho: miniaturas dos imóveis */}
          <div className="grid grid-cols-[92px_repeat(3,1fr)] gap-3">
            <div />
            {items.map((item) => {
              const current = item.slug === currentSlug
              return (
                <div
                  key={item.slug}
                  className={cn(
                    'rounded-t-2xl p-3 text-center',
                    current && 'bg-eme-50 ring-1 ring-inset ring-primary/20',
                  )}
                >
                  <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-xl">
                    <Image
                      src={item.image || '/marketplace/placeholder.svg'}
                      alt={item.title}
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-2 text-pretty text-xs font-semibold leading-snug text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-primary">{formatPrice(item.price)}</p>
                </div>
              )
            })}
          </div>

          {/* Linhas de atributos */}
          <div className="mt-1">
            {rows.map((row, ri) => (
              <div
                key={row.label}
                className="grid grid-cols-[92px_repeat(3,1fr)] items-center gap-3 border-t border-border/60"
              >
                <span className="py-3 text-xs font-medium text-muted-foreground">{row.label}</span>
                {items.map((item) => {
                  const current = item.slug === currentSlug
                  return (
                    <span
                      key={item.slug + row.label}
                      className={cn(
                        'py-3 text-center text-sm text-foreground',
                        current && 'bg-eme-50/60 font-semibold',
                        ri === rows.length - 1 && current && 'rounded-b-2xl',
                      )}
                    >
                      {row.get(item)}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link
        href="/imoveis/busca"
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-eme-700"
      >
        Abrir comparação completa
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
