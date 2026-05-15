"use client"

import { Bot, CheckCheck, MessageCircle, Sparkles } from "lucide-react"

export function CorretorEmeSection() {
  const messages = [
    { from: "Corretor", text: "Crie um anúncio para esse imóvel." },
    { from: "EME", text: "Montei título, descrição e diferenciais. Quer revisar agora?" },
    { from: "Corretor", text: "Cadastre esse lead e me traga imóveis até 900 mil." },
    { from: "EME", text: "Lead salvo. Separei opções com melhor aderência ao perfil." },
  ]

  return (
    <section id="corretor-eme" className="px-4 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16">
        <div className="order-2 md:order-1">
          <div className="relative mx-auto w-full max-w-[330px]">
            <div className="absolute inset-0 rounded-full bg-[#25D366]/20 blur-3xl" />
            <div className="relative rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-[#111] to-[#050505] p-3 shadow-2xl">
              <div className="rounded-[2rem] bg-[#07120C] p-4">
                <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]">
                    <Bot className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Corretor EME</p>
                    <p className="text-xs text-[#25D366]">continuidade inteligente</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {messages.map((message, index) => {
                    const isEme = message.from === "EME"

                    return (
                      <div key={`${message.from}-${index}`} className={`flex ${isEme ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                            isEme ? "bg-white/[0.08] text-white/85" : "bg-[#25D366] text-black"
                          }`}
                        >
                          <p>{message.text}</p>
                          <div className={`mt-1 flex justify-end ${isEme ? "text-white/30" : "text-black/45"}`}>
                            <CheckCheck className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2">
          <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[#69F0AE]">Corretor EME</p>
          <h2 className="mb-6 text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Continuidade inteligente{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              pelo WhatsApp
            </span>
            .
          </h2>
          <p className="text-lg leading-relaxed text-white/60">
            Um assistente preparado para ajudar o corretor a criar anúncios, importar prints,
            organizar leads e encontrar oportunidades sem sair da rotina comercial.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-white/60">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#00C853]" />
              Criação de anúncio, melhoria de copy e sugestões comerciais.
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              Posicionado como continuidade inteligente, sem prometer integração oficial agora.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
