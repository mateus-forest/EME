import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Intent } from '@/lib/marketplace/pages-data'
import { Reveal } from '@/components/marketplace/reveal'
import { buildIntentSearchHref } from '@/lib/marketplace/search-filters'

// Grade de intenções ("Encontre pelo que importa" / "para o seu momento").
// Cartões fotográficos que levam a uma busca já orientada.
export function IntentGrid({
  items,
  purpose,
}: {
  items: Intent[]
  purpose: 'compra' | 'aluguel'
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => (
        <Reveal key={item.slug} delay={i * 70} className={i === 0 ? 'col-span-2 md:col-span-1' : ''}>
          <Link
            href={buildIntentSearchHref(item.slug, purpose)}
            className="group relative flex aspect-[4/5] items-end overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-soft)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Image
              src={item.image || '/marketplace/placeholder.svg'}
              alt={item.label}
              fill
              sizes="(max-width: 768px) 45vw, 18vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="relative flex w-full items-end justify-between gap-2 p-4">
              <h3 className="text-pretty text-sm font-medium leading-tight text-white">
                {item.label}
              </h3>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/0 text-white opacity-0 transition-all duration-500 group-hover:bg-white/15 group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  )
}
