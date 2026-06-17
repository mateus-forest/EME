"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, BarChart3, Bot, CheckCircle2, Users, WalletCards } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

type ModuleInfo = {
  title: string
  text: string
  icon: typeof Users
  modalTitle: string
  description: string
  bullets: string[]
}

const modules: ModuleInfo[] = [
  {
    title: "Leads",
    text: "Captação, qualificação e acompanhamento.",
    icon: Users,
    modalTitle: "Gestão inteligente de leads",
    description: "Organize contatos, acompanhe atendimentos e visualize oportunidades em tempo real.",
    bullets: ["Histórico completo", "Pipeline visual", "Follow-up inteligente", "Integração com catálogo"],
  },
  {
    title: "Financeiro",
    text: "Controle de receitas, despesas e comissões.",
    icon: WalletCards,
    modalTitle: "Controle financeiro integrado",
    description: "Acompanhe entradas, comissões, despesas e indicadores financeiros da operação.",
    bullets: ["Fluxo de caixa", "Controle de comissão", "Relatórios financeiros", "Visão operacional"],
  },
  {
    title: "Analytics",
    text: "Métricas inteligentes para tomada de decisão.",
    icon: BarChart3,
    modalTitle: "Analytics em tempo real",
    description: "Visualize métricas importantes da operação comercial e acompanhe performance do catálogo.",
    bullets: ["Leads recebidos", "Conversões", "Cliques no catálogo", "Performance de anúncios"],
  },
  {
    title: "Corretor EME",
    text: "IA comercial para atendimento e conversão.",
    icon: Bot,
    modalTitle: "Seu corretor com IA",
    description: "O Corretor EME ajuda no atendimento, qualificação e operação comercial da imobiliária.",
    bullets: ["Atendimento inteligente", "Qualificação automática", "Sugestão de imóveis", "Apoio operacional"],
  },
]

export function EmeModulesSection() {
  const [selectedModule, setSelectedModule] = useState<ModuleInfo | null>(null)

  return (
    <section id="modulos-eme" className="relative z-10 px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#00A844]">
            Módulos inteligentes
          </div>
          <h2 className="text-3xl font-bold text-balance text-[#111111] sm:text-4xl md:text-5xl">
            Tudo conectado em uma{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              única operação.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#6B7280] sm:text-lg sm:leading-8">
            Leads, financeiro, analytics e inteligência comercial integrados em um único sistema para o corretor.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <button
              key={module.title}
              type="button"
              onClick={() => setSelectedModule(module)}
              className="group min-h-[13rem] rounded-[1.5rem] border border-[#E5E7EB] bg-white p-5 text-left shadow-[0_18px_48px_rgba(17,24,39,0.08)] transition-all duration-300 hover:border-[#00C853]/15 hover:bg-white hover:shadow-[0_18px_48px_rgba(17,24,39,0.08),0_0_42px_rgba(0,200,83,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C853]/70"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#00A844] transition-colors duration-300 group-hover:border-[#00C853]/35 group-hover:bg-[#00C853]/15">
                <module.icon className="size-5" />
              </span>
              <span className="mt-7 block text-xl font-semibold text-[#111111]">{module.title}</span>
              <span className="mt-3 block text-sm leading-6 text-[#6B7280]">{module.text}</span>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#00A844]">
                Explorar módulo
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(selectedModule)} onOpenChange={(open) => !open && setSelectedModule(null)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[1.75rem] border-[#E5E7EB] bg-white p-0 text-[#111111] shadow-[0_32px_100px_rgba(17,24,39,0.16),0_0_80px_rgba(0,200,83,0.07)] sm:max-w-xl">
          {selectedModule ? (
            <div className="relative overflow-hidden rounded-[1.75rem]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,200,83,0.09),transparent_38%),linear-gradient(180deg,rgba(248,250,249,0.88),transparent)]" />
              <div className="relative p-6 sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/22 bg-[#00C853]/12 text-[#00A844]">
                  <selectedModule.icon className="size-5" />
                </div>
                <DialogTitle className="mt-6 text-2xl font-bold leading-tight text-[#111111]">
                  {selectedModule.modalTitle}
                </DialogTitle>
                <DialogDescription className="mt-3 text-base leading-7 text-[#6B7280]">
                  {selectedModule.description}
                </DialogDescription>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {selectedModule.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-medium text-[#111111]"
                    >
                      <CheckCircle2 className="size-4 shrink-0 text-[#00A844]" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/cadastro/corretor"
                  className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#00C853] px-6 text-sm font-bold text-black shadow-[0_0_30px_rgba(0,200,83,0.12)] transition-all duration-300 hover:bg-[#00E676] hover:shadow-[0_0_40px_rgba(0,200,83,0.18)]"
                >
                  Explorar módulo
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
