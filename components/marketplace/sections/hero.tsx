import Link from 'next/link'
import { ChevronDown, SlidersHorizontal, Zap } from 'lucide-react'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { HeroInsightCard } from '@/components/marketplace/sections/hero-insight-card'
import { HeroVideoBackground } from '@/components/marketplace/sections/hero-video-background'

export function Hero() {
  return (
    <section
      data-marketplace-hero
      className="relative flex min-h-[100svh] w-full flex-col overflow-hidden md:min-h-[760px] md:h-[90vh]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 92%, rgba(0,0,0,0.98) 96%, rgba(0,0,0,0.9) 97.5%, rgba(0,0,0,0.72) 99%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 92%, rgba(0,0,0,0.98) 96%, rgba(0,0,0,0.9) 97.5%, rgba(0,0,0,0.72) 99%, transparent 100%)',
        }}
      >
        <HeroVideoBackground />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/38 to-black/12" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/22" />
        <div
          data-hero-bottom-shade
          className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-b from-transparent via-black/16 to-black/72"
        />
      </div>

      <div className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-36 md:px-8 md:pb-16 md:pt-44">
          <div className="max-w-2xl animate-rise">
            <h1 className="text-balance text-[2.35rem] font-normal leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Seu próximo imóvel começa pelo que importa para{' '}
              <span className="font-medium text-eme-300">você.</span>
            </h1>
            <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-white/80 md:text-lg">
              Encontre o lugar ideal para viver ou investir. Busque como quiser, do seu jeito.
            </p>

            <div className="mt-8 max-w-xl">
              <ConversationalSearch
                size="lg"
                placeholder="Descreva onde e como você gostaria de viver..."
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/imoveis/busca"
                  style={{ borderWidth: '0.5px', borderColor: 'rgba(255,255,255,0.12)' }}
                  className="inline-flex items-center gap-2 rounded-full border-solid bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white outline-none shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all hover:bg-white/[0.12] focus-visible:ring-4 focus-visible:ring-white/20"
                >
                  <Zap className="h-4 w-4 text-eme-300" aria-hidden="true" />
                  Usar busca rápida
                </Link>
                <Link
                  href="/imoveis/busca"
                  style={{ borderWidth: '0.5px', borderColor: 'rgba(255,255,255,0.12)' }}
                  className="inline-flex items-center gap-2 rounded-full border-solid bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white outline-none shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all hover:bg-white/[0.12] focus-visible:ring-4 focus-visible:ring-white/20"
                >
                  <SlidersHorizontal className="h-4 w-4 text-white/80" aria-hidden="true" />
                  Explorar por filtros
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HeroInsightCard />

      <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5 text-white/80">
        <span className="text-xs font-medium tracking-wide">Explore o Marketplace</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md">
          <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden="true" />
        </span>
      </div>
    </section>
  )
}
