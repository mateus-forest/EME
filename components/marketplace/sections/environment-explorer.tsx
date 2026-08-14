'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { environments } from '@/lib/marketplace/data'
import { Reveal } from '@/components/marketplace/reveal'
import { cn } from '@/lib/utils'

export function EnvironmentExplorer() {
  const [index, setIndex] = useState(0)
  const active = environments[index]

  const go = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + environments.length) % environments.length)

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[0.62fr_1.38fr] lg:gap-12">
        <Reveal>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Explore cada detalhe
          </h2>
          <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            Veja fotos reais, explore cada ambiente e imagine-se no seu próximo lar.
          </p>

          {/* Navegação por ambientes em desktop */}
          <div className="mt-6 hidden flex-wrap gap-2 lg:flex">
            {environments.map((env, i) => (
              <button
                key={env.label}
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={active.label === env.label}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                  active.label === env.label
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.3)]'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {env.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-[2rem] shadow-[var(--shadow-glass)]">
            <div className="relative aspect-[16/11] sm:aspect-[16/9]">
              <Image
                key={active.image}
                src={active.image}
                alt={`Ambiente ilustrativo: ${active.label}`}
                fill
                sizes="(max-width: 1024px) 100vw, 64vw"
                className="animate-in fade-in object-cover duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
            </div>

            {/* Chips de ambiente sobre a imagem (mobile/tablet) */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 lg:hidden">
              {environments.map((env, i) => (
                <button
                  key={env.label}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-pressed={active.label === env.label}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-xl transition-colors',
                    active.label === env.label
                      ? 'border-white/60 bg-white text-foreground'
                      : 'border-white/40 bg-white/25 text-white hover:bg-white/40',
                  )}
                >
                  {env.label}
                </button>
              ))}
            </div>

            {/* Nome do ambiente ativo + setas delicadas (desktop) */}
            <div className="absolute bottom-5 left-5 hidden items-center gap-3 lg:flex">
              <span className="glass-strong rounded-full px-4 py-1.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)]">
                {active.label}
              </span>
            </div>
            <div className="absolute bottom-5 right-5 hidden items-center gap-2 lg:flex">
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

            {/* Card: o que se destaca */}
            <div className="glass-strong absolute right-4 top-4 hidden w-56 rounded-2xl p-4 shadow-[var(--shadow-glass)] sm:block">
              <p className="text-sm font-semibold text-foreground">O que se destaca</p>
              <ul className="mt-3 space-y-2.5">
                {active.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-xs leading-snug text-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Destaques em mobile */}
          <ul className="mt-4 flex flex-wrap gap-2 sm:hidden">
            {active.highlights.map((highlight) => (
              <li
                key={highlight}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-foreground"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
