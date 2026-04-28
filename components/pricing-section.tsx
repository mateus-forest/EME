"use client"

import Link from "next/link"
import { Building2, Check, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PricingSection() {
  return (
    <section id="planos" className="px-4 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Simples.{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              Sem complicação
            </span>
            .
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <div className="group relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#00C853]/30 to-transparent blur-xl opacity-50 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full rounded-2xl border-2 border-[#00C853]/50 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#00C853] px-4 py-1 text-sm font-semibold text-black">
                Mais Acessado
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00C853]/20">
                  <Sparkles className="h-6 w-6 text-[#00C853]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Plano Corretor</h3>
                  <p className="text-sm text-white/50">Para profissionais autônomos</p>
                </div>
              </div>

              <p className="mb-6 text-sm font-medium text-[#00C853]">
                Comece com até 3 imóveis grátis
              </p>

              <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#00C853]/30 bg-[#00C853]/10 px-3 py-1">
                  <Clock className="h-3.5 w-3.5 animate-pulse text-[#00C853]" />
                  <span className="text-xs font-medium text-[#00C853]">Tempo limitado</span>
                </div>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-sm text-white/30 line-through">R$ 89,90</span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-white/50">R$</span>
                  <span className="text-5xl font-bold text-white">49</span>
                  <span className="text-2xl font-bold text-white">,90</span>
                  <span className="ml-1 text-white/50">/ mês</span>
                </div>
              </div>

              <div className="mb-8 space-y-4">
                {[
                  "Anúncios ilimitados no plano pago",
                  "IA integrada",
                  "Catálogo online",
                  "Link personalizado",
                  "Métricas de visualizações",
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00C853]/20">
                      <Check className="h-3 w-3 text-[#00C853]" />
                    </div>
                    <span className="text-white/80">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="w-full bg-[#00C853] py-6 font-semibold text-black shadow-lg shadow-[#00C853]/20 hover:bg-[#00E676]"
              >
                <Link href="/cadastro/corretor">Quero vender mais rápido</Link>
              </Button>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#00C853]/20 to-transparent blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00C853]/10">
                  <Building2 className="h-6 w-6 text-[#00C853]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Plano Imobiliária</h3>
                  <p className="text-sm text-white/50">Para equipes e empresas</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#00C853]/30 bg-[#00C853]/10 px-3 py-1">
                  <Clock className="h-3.5 w-3.5 animate-pulse text-[#00C853]" />
                  <span className="text-xs font-medium text-[#00C853]">Tempo limitado</span>
                </div>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-sm text-white/30 line-through">R$ 279,90</span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-white/50">R$</span>
                  <span className="text-5xl font-bold text-white">109</span>
                  <span className="text-2xl font-bold text-white">,90</span>
                  <span className="ml-1 text-white/50">/ mês</span>
                </div>
                <p className="mt-2 text-sm text-white/50">Gestão de corretores incluída</p>
              </div>

              <div className="mb-8 space-y-4">
                {[
                  "Gestão de equipe",
                  "Múltiplos corretores",
                  "Controle completo",
                  "Dashboard operacional",
                  "Tudo do plano Corretor",
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00C853]/20">
                      <Check className="h-3 w-3 text-[#00C853]" />
                    </div>
                    <span className="text-white/80">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                className="w-full bg-[#00C853] py-6 font-semibold text-black shadow-lg shadow-[#00C853]/20 hover:bg-[#00E676]"
              >
                <Link href="/cadastro/imobiliaria">Escalar minha operação</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
