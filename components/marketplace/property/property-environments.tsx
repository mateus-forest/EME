'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BadgeCheck, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import type { EnvironmentPhoto } from '@/lib/marketplace/property-detail'
import { cn } from '@/lib/utils'

export function PropertyEnvironments({
  environments,
  summary,
  highlights,
}: {
  environments: EnvironmentPhoto[]
  summary: string
  highlights: string[]
}) {
  const [index, setIndex] = useState(0)
  const active = environments[index]
  const go = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + environments.length) % environments.length)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
      {/* Explorador de ambientes */}
      <div>
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
          Explore cada ambiente
        </h2>

        <div className="relative mt-5 overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-glass)]">
          <div className="relative aspect-[16/11] sm:aspect-[16/10]">
            <Image
              src={active.image || '/marketplace/placeholder.svg'}
              alt={`Ambiente: ${active.label}`}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </div>

          {/* Chips sobre a imagem */}
          <div className="no-scrollbar absolute inset-x-3 bottom-3 flex gap-2 overflow-x-auto">
            {environments.map((env, i) => (
              <button
                key={env.key}
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={active.key === env.key}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-xl transition-colors',
                  active.key === env.key
                    ? 'border-white/60 bg-white text-foreground'
                    : 'border-white/40 bg-white/25 text-white hover:bg-white/40',
                )}
              >
                {env.label}
              </button>
            ))}
          </div>

          {/* Setas */}
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Ambiente anterior"
              className="glass-strong flex h-9 w-9 items-center justify-center rounded-full text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próximo ambiente"
              className="glass-strong flex h-9 w-9 items-center justify-center rounded-full text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Miniaturas */}
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto">
          {environments.map((env, i) => (
            <button
              key={env.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver ${env.label}`}
              aria-pressed={active.key === env.key}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2 transition-all',
                active.key === env.key ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100',
              )}
            >
              <Image src={env.image || '/marketplace/placeholder.svg'} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Resumo do imóvel */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            O imóvel em poucos minutos
          </h3>
        </div>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{summary}</p>

        <div className="mt-6 rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm font-semibold text-foreground">O que se destaca</p>
          <ul className="mt-4 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-snug text-foreground">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
