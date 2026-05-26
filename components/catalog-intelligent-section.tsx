"use client"

import Image from "next/image"
import { MessageCircle, Search, Sparkles } from "lucide-react"

const catalogCards = [
  {
    title: "Busca natural",
    text: "Pesquise por bairro, valor, estilo ou intenção.",
    icon: Search,
  },
  {
    title: "Leads integrados",
    text: "Captação conectada diretamente ao corretor.",
    icon: MessageCircle,
  },
  {
    title: "Catálogo premium",
    text: "Visual elegante pensado para conversão.",
    icon: Sparkles,
  },
]

export function CatalogIntelligentSection() {
  return (
    <section id="catalogo-inteligente" className="relative z-10 px-4 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#69F0AE]">
            Catálogo inteligente
          </div>
          <h2 className="max-w-xl text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Catálogo inteligente, compartilhável e{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              feito para vender.
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
            Seu catálogo online reúne imóveis, busca inteligente e captação de leads em uma experiência pronta para
            compartilhar com clientes e redes sociais.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {catalogCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-[#00C853]/24 hover:bg-[#00C853]/[0.04]"
              >
                <card.icon className="size-5 text-[#69F0AE]" />
                <h3 className="mt-4 text-sm font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{card.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[40rem] lg:mr-0">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#00C853]/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.02] shadow-[0_28px_90px_rgba(0,0,0,0.48),0_0_70px_rgba(0,200,83,0.13)]">
            <Image
              src="/images/eme-catalog-intelligent.png"
              alt="Catálogo inteligente do EME"
              width={809}
              height={727}
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
