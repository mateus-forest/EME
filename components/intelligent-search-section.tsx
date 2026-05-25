"use client"

import { Search, SlidersHorizontal, Sparkles } from "lucide-react"

export function IntelligentSearchSection() {
  const suggestions = ["Apartamento até 700 mil com sacada", "Casa em condomínio com piscina", "Imóvel para investir"]

  return (
    <section id="busca-inteligente" className="px-4 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[#69F0AE]">Busca inteligente</p>
          <h2 className="mb-6 text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            O cliente escreve do jeito dele.{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              O EME encontra.
            </span>
          </h2>
          <p className="text-lg leading-relaxed text-white/60">
            Em vez de filtros frios, o catálogo entende linguagem natural: preço, bairro, tipo,
            diferenciais e intenção de compra aparecem no mesmo fluxo.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#00C853]/10 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-5 shadow-2xl">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-4">
              <Search className="h-5 w-5 shrink-0 text-[#00C853]" />
              <p className="min-w-0 flex-1 text-sm text-white/85 sm:text-base">
                Apartamento até 700 mil com sacada
              </p>
              <SlidersHorizontal className="h-5 w-5 shrink-0 text-white/40" />
            </div>

            <div className="mt-5 grid gap-3">
              {suggestions.map((suggestion, index) => (
                <div key={suggestion} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{suggestion}</span>
                    <span className="rounded-full bg-[#00C853]/15 px-3 py-1 text-xs font-medium text-[#69F0AE]">
                      {index === 0 ? "Match alto" : index === 1 ? "Boa opção" : "Intenção clara"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/45">
                    <Sparkles className="h-3.5 w-3.5 text-[#00C853]" />
                    Busca por contexto, preço e diferenciais do imóvel.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
