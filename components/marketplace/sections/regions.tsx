import Link from 'next/link'
import { ArrowUpRight, MapPin } from 'lucide-react'
import type { MarketplaceRegion } from '@/lib/marketplace/pages-data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'

export function RegionsSection({ regions }: { regions: MarketplaceRegion[] }) {
  if (!regions.length) return null
  return (
    <section id="regioes" className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal><SectionHeading title="Regiões para descobrir" support="As localidades com mais imóveis publicados agora." /></Reveal>
      <div className="mt-8 grid grid-cols-1 gap-5 md:mt-10 md:grid-cols-3">
        {regions.slice(0, 3).map((region, index) => (
          <Reveal key={region.slug} delay={index * 90}>
            <Link href={`/imoveis/regioes/${region.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-soft)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:aspect-[4/5] lg:aspect-[4/3]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(35,120,55,.22),transparent_38%),linear-gradient(145deg,#1f2d25,#102018)] transition-transform duration-700 ease-out group-hover:scale-105" />
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
              <span className="glass absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium text-foreground">{region.properties} imóveis</span>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-5"><p className="flex items-center gap-1.5 text-lg font-medium text-white"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{region.name}</p><span className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white opacity-0 transition-all duration-500 group-hover:bg-white/15 group-hover:opacity-100"><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span></div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
