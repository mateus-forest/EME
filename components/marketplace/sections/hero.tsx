import Link from 'next/link'
import { ChevronDown, Sparkles, SlidersHorizontal, Zap } from 'lucide-react'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { HeroVideoBackground } from '@/components/marketplace/sections/hero-video-background'

export function Hero() {
  return (
    <section
      data-marketplace-hero
      className="relative flex min-h-[92vh] w-full flex-col overflow-hidden md:h-[80vh] md:min-h-[640px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 95%, rgba(0,0,0,0.92) 97%, rgba(0,0,0,0.58) 99%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 95%, rgba(0,0,0,0.92) 97%, rgba(0,0,0,0.58) 99%, transparent 100%)',
        }}
      >
        <HeroVideoBackground />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25" />
      </div>

      <div className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-32 md:px-8 md:pb-12 md:pt-40">
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

      <div className="absolute bottom-24 right-8 z-10 hidden w-[19rem] rounded-2xl border border-white/15 bg-black/40 p-5 shadow-[var(--shadow-glass)] backdrop-blur-xl lg:block">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-eme-500/25 text-eme-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Muito compatível</p>
            <p className="mt-1 text-xs leading-relaxed text-white/70">
              Encontramos imóveis que combinam com o que você procura.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-8 rounded-full bg-eme-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5 text-white/80">
        <span className="text-xs font-medium tracking-wide">Explore o Marketplace</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-md">
          <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden="true" />
        </span>
      </div>
    </section>
  )
}
