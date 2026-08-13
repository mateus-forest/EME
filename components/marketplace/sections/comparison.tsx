import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MapPin, Maximize, Wallet } from 'lucide-react'
import { comparison, formatPrice } from '@/lib/marketplace/data'
import { Reveal } from '@/components/marketplace/reveal'

const highlightIcons = {
  space: Maximize,
  location: MapPin,
  check: Wallet,
} as const

export function ComparisonSection() {
  const { a, b, highlights } = comparison

  return (
    <section className="bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Comparação inteligente
            </span>
            <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Entenda antes de escolher
            </h2>
            <p className="mt-4 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Compare imóveis lado a lado e veja qual faz mais sentido para o que você busca.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative pb-10 sm:pb-0">
              <div className="grid grid-cols-2 gap-4 sm:gap-24">
                {[a, b].map((item, i) => (
                  <div
                    key={item.title}
                    className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-[var(--shadow-soft)]"
                  >
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={item.image || '/marketplace/placeholder.svg'}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 45vw, 26vw"
                        className="object-cover"
                      />
                    </div>
                    <div className={`p-4 ${i === 1 ? 'sm:text-right' : ''}`}>
                      <p className="text-xs text-muted-foreground">{item.title}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatPrice(item.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.city}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card translúcido central de resumo */}
              <div className="glass-strong relative z-10 mx-auto -mt-4 w-[92%] rounded-[1.5rem] p-5 shadow-[var(--shadow-glass)] sm:absolute sm:left-1/2 sm:top-1/2 sm:mt-0 sm:w-72 sm:-translate-x-1/2 sm:-translate-y-1/2">
                <p className="text-sm font-semibold text-foreground">Resumo da comparação</p>
                <ul className="mt-4 space-y-3.5">
                  {highlights.map((h) => {
                    const Icon = highlightIcons[h.icon]
                    return (
                      <li key={h.title} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-eme-50 text-primary">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-foreground">{h.title}</span>
                          <span className="block text-xs leading-snug text-muted-foreground">
                            {h.description}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <Link
                  href="/imoveis/comparar"
                  className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-eme-700"
                >
                  Ver comparação completa
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
