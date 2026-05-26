"use client"

import Image from "next/image"
import { CalendarDays, FileText, MessageSquareText } from "lucide-react"

const assessorCards = [
  {
    title: "Agenda integrada",
    text: "Compromissos e visitas organizados automaticamente.",
    icon: CalendarDays,
  },
  {
    title: "Propostas rápidas",
    text: "Geração de propostas direto pela conversa.",
    icon: FileText,
  },
  {
    title: "Atendimento operacional",
    text: "Leads, imóveis e informações em segundos.",
    icon: MessageSquareText,
  },
]

export function AssessorEmeSection() {
  return (
    <section id="assessor-eme-landing" className="relative z-10 px-4 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="relative mx-auto w-full max-w-[28rem] lg:mx-0">
          <div className="absolute -inset-8 -z-10 rounded-full bg-[#00C853]/10 blur-3xl" />
          <div className="relative drop-shadow-[0_30px_80px_rgba(0,0,0,0.52)]">
            <Image
              src="/images/eme-assessor-whatsapp.png"
              alt="Assessor EME no WhatsApp"
              width={1563}
              height={1563}
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="h-auto w-full object-contain"
            />
          </div>
        </div>

        <div>
          <div className="mb-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#69F0AE]">
            WhatsApp inteligente
          </div>
          <h2 className="max-w-xl text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Um assessor que{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              trabalha com você.
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
            O Assessor EME organiza visitas, cria propostas, cadastra leads, consulta agenda e ajuda na operação do
            corretor diretamente pelo WhatsApp.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {assessorCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-[#00C853]/24 hover:bg-[#00C853]/[0.04]"
              >
                <card.icon className="size-5 text-[#69F0AE]" />
                <h3 className="mt-4 text-sm font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
