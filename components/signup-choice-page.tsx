"use client"

import Link from "next/link"
import { AuthShell } from "@/components/auth-shell"
import { Button } from "@/components/ui/button"

const options = [
  {
    title: "Corretor",
    description: "Para quem quer captar, anunciar e vender com mais velocidade.",
    href: "/cadastro/corretor",
    action: "Quero vender mais rápido",
  },
  {
    title: "Imobiliária",
    description: "Para equipes que precisam escalar a operação com mais controle.",
    href: "/cadastro/imobiliaria",
    action: "Escalar minha operação",
  },
]

export function SignupChoicePage() {
  return (
    <AuthShell
      title="Como você deseja começar?"
      subtitle="Escolha o fluxo ideal para entrar na EME com a estrutura certa desde o início."
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
        {options.map((option) => (
          <div
            key={option.href}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/10 transition-colors hover:border-[#00C853]/30"
          >
            <h3 className="text-xl font-semibold text-white">{option.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{option.description}</p>
            <Button
              asChild
              className="mt-5 h-11 rounded-xl bg-[#00C853] px-5 font-semibold text-black hover:bg-[#00E676]"
            >
              <Link href={option.href}>{option.action}</Link>
            </Button>
          </div>
        ))}
      </div>
    </AuthShell>
  )
}
