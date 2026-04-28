"use client"

import { Link2, Instagram, Grid3X3 } from "lucide-react"

export function DistributionSection() {
  return (
    <section className="py-24 md:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Instagram bio mockup */}
          <div className="relative flex justify-center order-2 md:order-1">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00C853]/10 to-transparent rounded-full blur-3xl opacity-50" />
            <div className="relative w-72 rounded-2xl border border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-6 shadow-2xl">
              {/* Profile section */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center text-2xl font-bold text-black">
                  J
                </div>
                <div>
                  <p className="font-bold text-white">joao.corretor</p>
                  <p className="text-sm text-white/50">João Silva</p>
                </div>
              </div>

              {/* Bio */}
              <div className="mb-4">
                <p className="text-sm text-white/80 leading-relaxed">
                  Corretor de imóveis em SP<br />
                  Atendimento pelo WhatsApp<br />
                  Seu imóvel está aqui
                </p>
              </div>

              {/* Link */}
              <a 
                href="/cadastro/corretor"
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#00C853] text-black font-semibold text-sm justify-center hover:bg-[#00E676] transition-colors"
              >
                <Link2 className="w-4 h-4" />
                eme.app/joao
              </a>

              {/* Stats */}
              <div className="flex items-center justify-around mt-6 pt-4 border-t border-white/10">
                <div className="text-center">
                  <p className="font-bold text-white">127</p>
                  <p className="text-xs text-white/50">publicações</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-white">2.4k</p>
                  <p className="text-xs text-white/50">seguidores</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-white">312</p>
                  <p className="text-xs text-white/50">seguindo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Text content */}
          <div className="order-1 md:order-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
              Um link.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C853] to-[#00E676]">
                Todos os seus imóveis
              </span>
              .
            </h2>
            <p className="text-lg text-white/60 leading-relaxed">
              Seu catálogo vira seu principal canal de vendas.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
