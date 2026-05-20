"use client"

import Link from "next/link"
import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"

export function SignupChoicePage() {
  return (
    <AuthShell
      title="Comece como corretor"
      subtitle="Nesta fase, o EME está focado em corretores individuais para acelerar criação de anúncios, catálogo inteligente, leads e Assessor EME."
      footer={
        <p className="text-sm text-white/55">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-[#00C853] hover:text-[#00E676]">
            Entrar
          </Link>
        </p>
      }
    >
      <div className="grid gap-4 sm:gap-5">
        <div className="rounded-2xl border border-[#00C853]/20 bg-[#00C853]/[0.06] p-5 shadow-lg shadow-black/10">
          <h3 className="text-xl font-semibold text-white">Corretor individual</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Publique imóveis, use IA, capture leads e opere seu catálogo em poucos minutos.
          </p>
          <Button
            asChild
            className="mt-5 h-11 rounded-xl bg-[#00C853] px-5 font-semibold text-black hover:bg-[#00E676]"
          >
            <Link href="/cadastro/corretor">Criar conta de corretor</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-base font-semibold text-white">Para imobiliárias</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Cadastre seus corretores individualmente e gerencie a operação pelo fluxo do corretor enquanto a área de equipes evolui.
          </p>
        </div>
      </div>
    </AuthShell>
  )
}
