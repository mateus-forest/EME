"use client"

import Link from "next/link"
import { Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AgencyPausedPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
            <Building2 className="size-6" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">
            Área de imobiliárias em evolução
          </h1>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Use o acesso de corretor nesta fase. Para imobiliárias, cadastre seus corretores individualmente e gerencie a operação pelo fluxo do corretor enquanto a área de equipes evolui.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 rounded-xl bg-[#00C853] px-5 font-semibold text-black shadow-lg shadow-[#00C853]/20 hover:bg-[#00E676]"
            >
              <Link href="/corretor">Ir para portal do corretor</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-white/75 hover:bg-white/[0.08] hover:text-white"
            >
              <Link href="/cadastro/corretor">Cadastrar corretor</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
