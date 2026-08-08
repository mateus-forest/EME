"use client"

import Link from "next/link"
import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"

export function SignupChoicePage() {
  return (
    <AuthShell
      title="Comece como corretor"
      subtitle="Nesta fase, o EME está focado em corretores individuais para acelerar criação de anúncios, catálogo inteligente, leads e COS."
      footer={
        <p className="text-sm text-[#6B7280]">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-[#00C853] hover:text-[#00E676]">
            Entrar
          </Link>
        </p>
      }
    >
      <div className="grid gap-4 sm:gap-5">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_18px_48px_rgba(17,24,39,0.08)]">
          <h3 className="text-xl font-semibold text-[#111111]">Corretor individual</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
            Publique imóveis, use IA, capture leads e opere seu catálogo em poucos minutos.
          </p>
          <Button
            asChild
            className="mt-5 h-11 rounded-xl bg-[#00C853] px-5 font-semibold text-black hover:bg-[#00E676]"
          >
            <Link href="/cadastro/corretor">Criar conta de corretor</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
