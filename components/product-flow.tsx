"use client"

import { Camera, CheckCircle2, Sparkles } from "lucide-react"

export function ProductFlow() {
  const steps = [
    {
      icon: Camera,
      title: "Importe",
      description: "XML, print ou link",
      step: 1,
    },
    {
      icon: Sparkles,
      title: "IA organiza",
      description: "dados e copy",
      step: 2,
    },
    {
      icon: CheckCircle2,
      title: "Publique",
      description: "catálogo e leads",
      step: 3,
    },
  ]

  return (
    <section id="como-funciona" className="py-24 md:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Simples{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C853] to-[#00E676]">
              assim
            </span>
            .
          </h2>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4">
          {steps.map((step, index) => (
            <div key={step.step} className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-[#00C853]/20 to-transparent rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-48 h-80 rounded-3xl border-2 border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-3 shadow-2xl">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/10" />
                  <div className="w-full h-full rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center gap-4 pt-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00C853]/20 to-[#00C853]/5 flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-[#00C853]" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{step.title}</p>
                      <p className="text-sm text-white/50">{step.description}</p>
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#00C853] flex items-center justify-center font-bold text-black text-sm">
                      {step.step}
                    </div>
                  </div>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden md:flex items-center">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-[#00C853]/50 to-transparent" />
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent border-l-[#00C853]/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-16 space-y-2">
          <p className="text-lg text-white/60">Sem redigitar anúncio antigo.</p>
          <p className="text-lg text-white/60">Sem perder informação no caminho.</p>
          <p className="text-lg text-white/60">Sem publicar sem revisar.</p>
        </div>

        <div className="text-center mt-12 max-w-xl mx-auto space-y-6">
          <p className="text-base text-white/50 italic">
            Você também pode criar manualmente quando quiser controle total.
          </p>

          <p className="text-sm text-white/40 leading-relaxed">
            Use fotos, áudio, texto, XML, print ou link.<br />
            O EME organiza os dados e prepara o anúncio para revisão.
          </p>

          <p className="text-base font-medium text-[#00C853]">
            Menos cadastro repetitivo. Mais tempo para converter clientes.
          </p>
        </div>
      </div>
    </section>
  )
}
