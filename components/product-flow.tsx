"use client"

import { FileText, Keyboard, Sparkles, type LucideIcon } from "lucide-react"

const creationCards = [
  {
    icon: Sparkles,
    title: "Criar com IA",
    description: "Descreva o imóvel e o EME monta o anúncio.",
    delay: "0s",
  },
  {
    icon: Keyboard,
    title: "Criar manualmente",
    description: "Preencha tudo do seu jeito.",
    delay: "1.15s",
  },
  {
    icon: FileText,
    title: "Importar imóveis",
    description: "Importe anúncios, XML ou planilhas.",
    delay: "2.3s",
  },
]

export function ProductFlow() {
  return (
    <section id="como-funciona" className="relative z-10 px-4 pt-20 pb-24 md:pt-24 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl md:mb-12">
          <div className="mb-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#69F0AE]">
            Criação inteligente
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Crie anúncios do seu jeito.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/58">
            Use IA, preenchimento manual ou importação para publicar imóveis em poucos minutos.
          </p>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
        {creationCards.map((card) => (
          <CreationCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  )
}

function CreationCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: LucideIcon
  title: string
  description: string
  delay: string
}) {
  return (
    <article
      style={{ animationDelay: delay }}
      className="landing-creation-card rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-6 text-left shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-7 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-4 max-w-sm text-sm leading-6 text-white/55">{description}</p>

      <style jsx>{`
        .landing-creation-card {
          animation: landing-card-glow 3.45s ease-in-out infinite;
        }

        @keyframes landing-card-glow {
          0%,
          78%,
          100% {
            border-color: rgba(255, 255, 255, 0.08);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0), 0 18px 40px rgba(0, 0, 0, 0.14);
          }
          18%,
          38% {
            border-color: rgba(0, 200, 83, 0.28);
            box-shadow: inset 0 0 24px rgba(0, 200, 83, 0.055), 0 18px 42px rgba(0, 0, 0, 0.16),
              0 0 32px rgba(0, 200, 83, 0.12);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-creation-card {
            animation: none;
          }
        }
      `}</style>
    </article>
  )
}
