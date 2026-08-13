import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Info } from 'lucide-react'
import { formatPrice, type Alternative } from '@/lib/marketplace/search-data'

export function AlternativePropertyCard({ alternative }: { alternative: Alternative }) {
  return (
    <Link
      href={`/imoveis/imovel/${alternative.slug}`}
      className="group flex items-center gap-4 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card p-3 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
    >
      <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-[1.1rem] sm:h-28 sm:w-36">
        <Image
          src={alternative.image || '/marketplace/placeholder.svg'}
          alt={alternative.title}
          fill
          sizes="144px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
        />
      </div>
      <div className="min-w-0 flex-1 py-1 pr-2">
        <h3 className="text-pretty text-sm font-medium leading-snug text-foreground">
          {alternative.title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {alternative.city} · {alternative.state}
        </p>
        <p className="mt-2 text-base font-semibold tracking-tight text-foreground">
          {formatPrice(alternative.price)}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          {alternative.reason}
        </p>
      </div>
      <ArrowUpRight
        className="mr-1 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  )
}
