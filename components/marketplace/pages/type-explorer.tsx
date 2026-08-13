import Link from 'next/link'
import { ArrowUpRight, Home, Building2, Trees, Store, Sofa } from 'lucide-react'
import type { PropertyType, TypeEntry } from '@/lib/marketplace/pages-data'
import { Reveal } from '@/components/marketplace/reveal'

const icons: Record<PropertyType, React.ElementType> = {
  casa: Home,
  apartamento: Building2,
  terreno: Trees,
  comercial: Store,
  mobiliado: Sofa,
}

// Grade "Explore por tipo": cartões enxutos com ícone, contagem e link para a busca.
export function TypeExplorer({
  items,
  purpose,
}: {
  items: TypeEntry[]
  purpose: 'compra' | 'aluguel'
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item, i) => {
        const Icon = icons[item.slug]
        return (
          <Reveal key={item.slug} delay={i * 70}>
            <Link
              href={`/imoveis/busca?tipo=${item.slug}&finalidade=${purpose}`}
              className="group flex h-full flex-col justify-between gap-8 rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-float)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-eme-50 text-primary transition-colors group-hover:bg-eme-100">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-pretty text-base font-medium leading-tight text-foreground">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.count} imóveis</p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-hover:border-primary group-hover:bg-eme-50 group-hover:text-primary">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </Reveal>
        )
      })}
    </div>
  )
}
