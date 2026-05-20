"use client"

import { Bot, CheckCheck, MessageCircle, Sparkles, UserRound } from "lucide-react"

export function CorretorEmeSection() {
  const messages = [
    { from: "Corretor", text: "Crie um anuncio para esse imovel." },
    { from: "EME", text: "Montei titulo, descricao e diferenciais. Quer revisar agora?" },
    { from: "Corretor", text: "Cadastre esse lead e me traga imoveis ate 900 mil." },
    { from: "EME", text: "Lead salvo. Separei opcoes com melhor aderencia ao perfil." },
  ]
  const channels = [
    {
      icon: UserRound,
      title: "Corretor EME",
      description: "Integre seu WhatsApp para receber, pre-atender e qualificar leads automaticamente.",
      bullets: [
        "Atendimento inicial de leads",
        "Qualificacao automatica",
        "Registro no CRM",
        "Apoio ao funil de vendas",
      ],
    },
    {
      icon: Bot,
      title: "Assessor EME",
      description: "Converse com a IA do EME para executar tarefas do dia a dia pelo WhatsApp oficial do sistema.",
      bullets: [
        "Cadastrar imoveis",
        "Criar anuncios",
        "Buscar imoveis no catalogo",
        "Cadastrar e resumir leads",
        "Pedir apoio operacional",
      ],
    },
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
                    <p className="text-sm font-semibold text-white">Assessor EME</p>
                    <p className="text-xs text-[#25D366]">canal oficial do sistema</p>
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
          <p className="mb-4 text-sm uppercase tracking-[0.28em] text-[#69F0AE]">Corretor EME + Assessor EME</p>
          <h2 className="mb-6 text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Dois canais inteligentes{" "}
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              para o corretor
            </span>
            .
          </h2>
          <p className="text-lg leading-relaxed text-white/60">
            O Corretor EME conecta o WhatsApp do corretor aos seus clientes e leads. O Assessor EME
            funciona como o canal oficial do sistema para pedir tarefas, operar a rotina e conversar com a IA.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-white/60">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#00C853]" />
              Assessor EME para anuncios, catalogo, leads, resumos e apoio operacional.
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              Corretor EME para pre-atendimento e qualificacao no WhatsApp do proprio corretor.
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-6xl">
        <div className="mb-8 text-center">
          <h3 className="text-2xl font-semibold text-white sm:text-3xl">Dois canais inteligentes para o corretor</h3>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {channels.map((channel) => (
            <div key={channel.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                  <channel.icon className="size-5" />
                </div>
                <h4 className="text-xl font-semibold text-white">{channel.title}</h4>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/60">{channel.description}</p>
              <div className="mt-5 grid gap-3">
                {channel.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-center gap-3 text-sm text-white/68">
                    <CheckCheck className="size-4 text-[#69F0AE]" />
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
