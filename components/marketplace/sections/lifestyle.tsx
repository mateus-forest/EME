import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, LayoutGrid, MapPin, TrendingUp, Search } from 'lucide-react'
import { lifestyles, type Lifestyle } from '@/lib/marketplace/data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { cn } from '@/lib/utils'
import { buildIntentSearchHref } from '@/lib/marketplace/search-filters'

const icons: Record<Lifestyle['icon'], React.ElementType> = {
  space: LayoutGrid,
  nearby: MapPin,
  invest: TrendingUp,
  ready: Search,
}

export function LifestyleSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-14 pt-6 md:px-8 md:pb-20 md:pt-8">
      <Reveal>
        <SectionHeading
          title="Descubra do seu jeito"
          support="Escolha como quer encontrar o seu próximo imóvel. Caminhos diferentes para o que faz sentido para você."
        />
      </Reveal>

      <div className="mt-8 grid grid-cols-2 gap-4 md:mt-10 lg:grid-cols-4">
        {lifestyles.map((item, i) => {
          const Icon = icons[item.icon]
          // Leve variação editorial de proporção entre os cards.
          const tall = i === 1 || i === 2
          return (
            <Reveal key={item.slug} delay={i * 80}>
              <Link
                href={buildIntentSearchHref(item.slug)}
                className={cn(
                  'group relative block overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-soft)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  tall ? 'aspect-[3/4] lg:aspect-[3/4.4]' : 'aspect-[3/4] lg:aspect-[3/3.8]',
                )}
              >
                <Image
                  src={item.image || '/marketplace/placeholder.svg'}
                  alt={item.title}
                  fill
                  sizes="(max-width: 1024px) 45vw, 22vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/5" />
                <div className="absolute inset-0 flex flex-col justify-between p-4">
                  <span className="glass flex h-10 w-10 items-center justify-center rounded-xl text-primary shadow-[var(--shadow-soft)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="flex items-end justify-between gap-2 transition-transform duration-500 group-hover:-translate-y-0.5">
                    <h3 className="text-pretty text-lg font-medium leading-tight text-white">
                      {item.title}
                    </h3>
                    <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/0 text-white opacity-0 transition-all duration-500 group-hover:bg-white/15 group-hover:opacity-100">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
