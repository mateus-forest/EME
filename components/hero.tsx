"use client"

import Link from "next/link"
import { Building2, Clock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-40 pb-20 md:pt-48">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute h-[600px] w-[600px] animate-pulse rounded-full bg-[#00C853]/20 blur-[120px]" />
        <div className="absolute h-[400px] w-[400px] animate-pulse rounded-full bg-[#00E676]/10 blur-[100px] delay-700" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#00C853]/30 bg-[#00C853]/10 px-4 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#00C853]" />
          <span className="text-sm font-medium text-[#00C853]">Plataforma inteligente para corretores e imobiliárias</span>
        </div>

        <h1 className="mb-6 text-4xl leading-tight font-bold tracking-tight text-balance text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Transforme imóveis em{" "}
          <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
            leads com IA
          </span>
          .
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-pretty text-white/60 md:text-xl">
          Crie anúncios, publique catálogos inteligentes, capture leads e prepare atendimentos
          com o Corretor EME no WhatsApp.
        </p>

        <Button
          asChild
          size="lg"
          className="rounded-xl bg-[#00C853] px-10 py-7 text-lg font-bold text-black shadow-2xl shadow-[#00C853]/30 transition-all hover:scale-105 hover:bg-[#00E676] hover:shadow-[#00C853]/50"
        >
          <Link href="/cadastro/corretor">Quero vender mais rápido</Link>
        </Button>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 md:gap-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C853]/10">
              <Building2 className="h-5 w-5 text-[#00C853]" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white">Catálogo</p>
              <p className="text-sm text-white/50">inteligente</p>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-white/10 md:block" />

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C853]/10">
              <Zap className="h-5 w-5 text-[#00C853]" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white">IA</p>
              <p className="text-sm text-white/50">anúncios e busca</p>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-white/10 md:block" />

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00C853]/10">
              <Clock className="h-5 w-5 text-[#00C853]" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white">Leads</p>
              <p className="text-sm text-white/50">antes do WhatsApp</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
