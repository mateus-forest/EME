"use client"

import { Grid3X3, Instagram, Link2, MessageCircle } from "lucide-react"

export function DistributionSection() {
  return (
    <section className="py-24 md:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="relative flex justify-center order-2 md:order-1">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00C853]/10 to-transparent rounded-full blur-3xl opacity-50" />
            <div className="relative w-72 rounded-2xl border border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-6 shadow-2xl">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center text-2xl font-bold text-black">
                  E
                </div>
                <div>
                  <p className="font-bold text-white">catálogo inteligente</p>
                  <p className="text-sm text-white/50">Joao Silva</p>
                </div>
              </div>

              <div className="mb-5 grid gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <Link2 className="h-4 w-4 text-[#00C853]" />
                  <span className="text-sm text-white/75">eme.app/joao</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/55">
                  <div className="rounded-xl bg-white/[0.04] px-2 py-3">
                    <Grid3X3 className="mx-auto mb-1 h-4 w-4 text-[#00C853]" />
                    Imóveis
                  </div>
                  <div className="rounded-xl bg-white/[0.04] px-2 py-3">
                    <Instagram className="mx-auto mb-1 h-4 w-4 text-[#00C853]" />
                    Redes
                  </div>
                  <div className="rounded-xl bg-white/[0.04] px-2 py-3">
                    <MessageCircle className="mx-auto mb-1 h-4 w-4 text-[#25D366]" />
                    WhatsApp
                  </div>
                </div>
              </div>

              <a
                href="/cadastro/corretor"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#00C853] text-black font-semibold text-sm justify-center hover:bg-[#00E676] transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Compartilhar catálogo
              </a>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
              Seu catálogo vira um{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C853] to-[#00E676]">
                motor de vendas
              </span>
              .
            </h2>
            <p className="text-lg text-white/60 leading-relaxed">
              Publique uma vez e distribua melhor: clientes, redes sociais e WhatsApp acessam
              uma experiência organizada para buscar, escolher e enviar interesse.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
