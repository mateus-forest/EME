"use client"

import { useState } from "react"
import { BarChart3, Bot, Check, DollarSign, Users, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ModuleItem = {
  title: string
  text: string
  icon: LucideIcon
  modalTitle: string
  modalDescription: string
  bullets: string[]
}

const modules: ModuleItem[] = [
  {
    title: "Leads",
    text: "Captação, qualificação e acompanhamento.",
    icon: Users,
    modalTitle: "Gestão inteligente de leads",
    modalDescription: "Organize contatos, acompanhe atendimentos e visualize oportunidades em tempo real.",
    bullets: ["Histórico completo", "Pipeline visual", "Follow-up inteligente", "Integração com catálogo"],
  },
  {
    title: "Financeiro",
    text: "Controle de receitas, despesas e comissões.",
    icon: DollarSign,
    modalTitle: "Controle financeiro integrado",
    modalDescription: "Acompanhe entradas, comissões, despesas e indicadores financeiros da operação.",
    bullets: ["Fluxo de caixa", "Controle de comissão", "Relatórios financeiros", "Visão operacional"],
  },
  {
    title: "Analytics",
    text: "Métricas inteligentes para tomada de decisão.",
    icon: BarChart3,
    modalTitle: "Analytics em tempo real",
    modalDescription: "Visualize métricas importantes da operação comercial e acompanhe performance do catálogo.",
    bullets: ["Leads recebidos", "Conversões", "Cliques no catálogo", "Performance de anúncios"],
  },
  {
    title: "Corretor EME",
    text: "IA comercial para atendimento e conversão.",
    icon: Bot,
    modalTitle: "Seu corretor com IA",
    modalDescription: "O Corretor EME ajuda no atendimento, qualificação e operação comercial da imobiliária.",
    bullets: ["Atendimento inteligente", "Qualificação automática", "Sugestão de imóveis", "Apoio operacional"],
  },
]

export function ModulesSection() {
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null)

  return (
    <section id="modulos-eme" className="relative z-10 px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#69F0AE]">
            Módulos inteligentes
          </div>
          <h2 className="text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Tudo conectado em uma{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              única operação.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
            Leads, financeiro, analytics e inteligência comercial integrados em um único sistema para o corretor.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <button
              key={module.title}
              type="button"
              onClick={() => setSelectedModule(module)}
              className="group rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 text-left shadow-[0_18px_40px_rgba(0,0,0,0.14)] transition-colors hover:border-[#00C853]/24 hover:bg-[#00C853]/[0.045] hover:shadow-[0_0_32px_rgba(0,200,83,0.10)]"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE] transition-colors group-hover:border-[#00C853]/32 group-hover:bg-[#00C853]/14">
                <module.icon className="size-5" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/55">{module.text}</p>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(selectedModule)} onOpenChange={(open) => !open && setSelectedModule(null)}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(8,12,9,0.98))] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.56),0_0_70px_rgba(0,200,83,0.12)] backdrop-blur-xl sm:max-w-xl">
          {selectedModule ? (
            <>
              <DialogHeader className="gap-4 text-left">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                  <selectedModule.icon className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-semibold text-white sm:text-3xl">
                    {selectedModule.modalTitle}
                  </DialogTitle>
                  <DialogDescription className="mt-3 text-base leading-7 text-white/58">
                    {selectedModule.modalDescription}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="mt-2 grid gap-3">
                {selectedModule.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#00C853]/12 text-[#69F0AE]">
                      <Check className="size-4" />
                    </span>
                    <span className="text-sm text-white/78">{bullet}</span>
                  </div>
                ))}
              </div>

              <Button className="mt-2 h-11 w-full rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30 sm:w-fit">
                Explorar módulo
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
