import Image from 'next/image'
import { Check, TreePine, BedDouble, Wallet } from 'lucide-react'
import { HeroSearchPanel } from '@/components/marketplace/hero-search-panel'
import { OrganicLines } from '@/components/marketplace/organic-lines'

const chips = [
  { icon: TreePine, label: 'Pátio amplo' },
  { icon: BedDouble, label: '3 quartos' },
  { icon: Wallet, label: 'Na sua faixa' },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32 md:pt-36">
      <OrganicLines className="opacity-70" count={7} />

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-12 md:grid-cols-[1fr_1.05fr] md:gap-8 md:px-8 md:pb-20 lg:gap-12 lg:pb-24">
        {/* Coluna de texto */}
        <div className="animate-rise">
          <h1 className="text-pretty text-[2.1rem] font-semibold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
            Seu próximo imóvel começa pelo que importa para você.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Descreva o que procura e descubra imóveis que realmente combinam com você.
          </p>

          <div className="mt-8 max-w-xl">
            <HeroSearchPanel />
          </div>
        </div>

        {/* Coluna de imagem com recorte orgânico assimétrico */}
        <div className="relative animate-rise [animation-delay:120ms]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2.5rem] rounded-tl-[8rem] rounded-br-[8rem] shadow-[var(--shadow-glass)] sm:aspect-[6/5] md:aspect-[5/6] lg:aspect-[6/5]">
            <Image
              src="/marketplace/images/hero-residence.png"
              alt="Residência contemporânea ao entardecer com amplas janelas de vidro e jardim"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 52vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
          </div>

          {/* Card flutuante: compatibilidade */}
          <div className="glass animate-float absolute -left-2 top-8 max-w-[16rem] rounded-2xl p-4 shadow-[var(--shadow-glass)] sm:-left-6 sm:top-10">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(35,120,55,0.4)]">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Muito compatível</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Este imóvel combina com o que você procura.
                </p>
              </div>
            </div>
          </div>

          {/* Painel de características unificado */}
          <div className="glass animate-float absolute -bottom-4 left-1/2 flex w-[min(92%,22rem)] -translate-x-1/2 items-center rounded-2xl px-1.5 py-1 shadow-[var(--shadow-glass)] [animation-delay:1.5s]">
            {chips.map((chip, i) => (
              <div key={chip.label} className="flex flex-1 items-center">
                <span className="flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-foreground">
                  <chip.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{chip.label}</span>
                </span>
                {i < chips.length - 1 && (
                  <span className="h-6 w-px bg-border/70" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
