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
        <p className="text-sm text-white/55">
          Para imobiliárias: cadastre seus corretores individualmente e gerencie a operação pelo fluxo do corretor enquanto a área de equipes evolui.
        </p>
      }
    >
      <div className="rounded-2xl border border-[#00C853]/20 bg-[#00C853]/[0.06] p-5">
        <h3 className="text-xl font-semibold text-white">Use o acesso de corretor nesta fase</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          O cadastro de imobiliária está pausado temporariamente. O fluxo de corretor segue ativo com catálogo inteligente, leads, IA e Assessor EME.
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
