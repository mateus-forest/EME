"use client"

import { MessageCircle, MousePointerClick, Send, UserRoundCheck } from "lucide-react"

export function LeadCaptureSection() {
  const steps = [
    { icon: MousePointerClick, title: "Cliente pesquisa", text: "Busca no catálogo por intenção, bairro ou preço." },
    { icon: UserRoundCheck, title: "Lead organizado", text: "Nome, imóvel e termo buscado chegam com contexto." },
    { icon: Send, title: "Resposta melhor", text: "O corretor continua a conversa com mais informação." },
  ]

  return (
    <section className="px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[#69F0AE]">Conversao</p>
          <h2 className="mb-6 text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Capture leads{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              antes do WhatsApp
            </span>
            .
          </h2>
          <p className="text-lg leading-relaxed text-white/60">
            O interesse não se perde em conversas soltas. O EME registra o lead, o imóvel e a busca
            que levou o cliente até ali.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#00C853]/10">
                <step.icon className="h-6 w-6 text-[#00C853]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 px-4 py-3 text-sm text-white/70">
          <MessageCircle className="h-5 w-5 text-[#25D366]" />
          WhatsApp entra depois do lead salvo, com contexto para vender melhor.
        </div>
      </div>
    </section>
  )
}
