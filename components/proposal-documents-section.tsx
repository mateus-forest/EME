"use client"

import Image from "next/image"
import { FileCheck2, FileText, Sparkles } from "lucide-react"

const documentCards = [
  {
    title: "PDF automático",
    text: "Documento pronto para envio.",
    icon: FileText,
  },
  {
    title: "Dados integrados",
    text: "Cliente e imóvel preenchidos automaticamente.",
    icon: Sparkles,
  },
  {
    title: "Visual profissional",
    text: "Apresentação elegante para venda ou locação.",
    icon: FileCheck2,
  },
]

export function ProposalDocumentsSection() {
  return (
    <section id="propostas-documentos" className="relative z-10 px-4 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium text-[#00A844]">
            Documentos inteligentes
          </div>
          <h2 className="max-w-xl text-3xl font-bold text-balance text-[#111111] sm:text-4xl md:text-5xl">
            Propostas prontas para{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              fechar negócio.
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#6B7280] sm:text-lg sm:leading-8">
            Gere propostas comerciais organizadas, profissionais e prontas para apresentar ao cliente em segundos.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {documentCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[1.25rem] border border-[#E5E7EB] bg-white p-4 shadow-[0_14px_36px_rgba(17,24,39,0.07)] transition-colors hover:border-[#00C853]/12 hover:bg-white"
              >
                <card.icon className="size-5 text-[#00A844]" />
                <h3 className="mt-4 text-sm font-semibold text-[#111111]">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">{card.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] lg:mr-0 xl:max-w-[36rem]">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#00C853]/5 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.35rem] border border-[#E5E7EB] bg-white shadow-[0_28px_90px_rgba(17,24,39,0.14),0_0_70px_rgba(0,200,83,0.065)]">
            <Image
              src="/images/eme-proposal-document.png"
              alt="Proposta comercial gerada pelo EME"
              width={1052}
              height={1488}
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
