import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, MapPin } from 'lucide-react'
import type { MarketplaceRegion } from '@/lib/marketplace/pages-data'
import { Reveal } from '@/components/marketplace/reveal'

export function RegionHighlights({ metric = 'total', regions }: { metric?: 'total' | 'forSale' | 'forRent'; regions: MarketplaceRegion[] }) {
  if (!regions.length) return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Ainda não há regiões com inventário publicado.</p>
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-3">{regions.slice(0, 3).map((region, index) => {
    const count = metric === 'forSale' ? region.forSale : metric === 'forRent' ? region.forRent : region.properties
    const suffix = metric === 'forRent' ? 'para alugar' : metric === 'forSale' ? 'à venda' : 'imóveis'
    return <Reveal key={region.slug} delay={index * 90}><Link href={`/imoveis/regioes/${region.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-soft)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-float)]">{region.image ? <><Image src={region.image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" /></> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(35,120,55,.22),transparent_38%),linear-gradient(145deg,#1f2d25,#102018)] transition-transform duration-700 group-hover:scale-105" />}<div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" /><span className="glass absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-medium text-foreground">{count} {suffix}</span><div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-5"><p className="flex items-center gap-1.5 text-lg font-medium text-white"><MapPin className="h-4 w-4" />{region.name}</p><ArrowUpRight className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" /></div></Link></Reveal>
  })}</div>
}
