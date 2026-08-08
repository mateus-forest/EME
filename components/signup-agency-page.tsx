"use client"

import Link from "next/link"

import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"

export function SignupAgencyPage() {
  return (
    <AuthShell
      title="Área de imobiliárias em evolução"
      subtitle="Nesta fase, o EME está focado no corretor individual para reduzir complexidade e acelerar estabilidade do produto."
      footer={
        <p className="text-sm text-[#6B7280]">
          Para imobiliárias: cadastre seus corretores individualmente e gerencie a operação pelo fluxo do corretor enquanto a área de equipes evolui.
        </p>
      }
    >
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_18px_48px_rgba(17,24,39,0.08)]">
        <h3 className="text-xl font-semibold text-[#111111]">Use o acesso de corretor nesta fase</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          O cadastro de imobiliária está pausado temporariamente. O fluxo de corretor segue ativo com catálogo inteligente, leads, IA e COS.
        </p>
        <Button
          asChild
          className="mt-5 h-11 rounded-xl bg-[#00C853] px-5 font-semibold text-black hover:bg-[#00E676]"
        >
          <Link href="/cadastro/corretor">Cadastrar corretor</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
