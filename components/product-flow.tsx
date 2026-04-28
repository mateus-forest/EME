"use client"

import { Camera, Sparkles, CheckCircle2, Smartphone } from "lucide-react"

export function ProductFlow() {
  const steps = [
    {
      icon: Camera,
      title: "Captura",
      description: "foto + áudio",
      step: 1
    },
    {
      icon: Sparkles,
      title: "IA gerando",
      description: "anúncio criado",
      step: 2
    },
    {
      icon: CheckCircle2,
      title: "Publicado",
      description: "pronto para vender",
      step: 3
    }
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

        {/* Steps */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4">
          {steps.map((step, index) => (
            <div key={step.step} className="flex items-center gap-4">
              {/* Phone mockup */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-[#00C853]/20 to-transparent rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-48 h-80 rounded-3xl border-2 border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] p-3 shadow-2xl">
                  {/* Phone notch */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/10" />
                  
                  {/* Screen content */}
                  <div className="w-full h-full rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center gap-4 pt-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00C853]/20 to-[#00C853]/5 flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-[#00C853]" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{step.title}</p>
                      <p className="text-sm text-white/50">{step.description}</p>
                    </div>
                    
                    {/* Step indicator */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#00C853] flex items-center justify-center font-bold text-black text-sm">
                      {step.step}
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow between steps */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex items-center">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-[#00C853]/50 to-transparent" />
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent border-l-[#00C853]/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom text */}
        <div className="text-center mt-16 space-y-2">
          <p className="text-lg text-white/60">Sem voltar para casa.</p>
          <p className="text-lg text-white/60">Sem perder tempo.</p>
          <p className="text-lg text-white/60">Sem complicação.</p>
        </div>

        {/* Additional content with visual hierarchy */}
        <div className="text-center mt-12 max-w-xl mx-auto space-y-6">
          {/* Italic line */}
          <p className="text-base text-white/50 italic">
            Mas se preferir, você também pode criar do jeito tradicional.
          </p>
          
          {/* Normal block - smaller and lighter */}
          <p className="text-sm text-white/40 leading-relaxed">
            Digite, complemente informações ou escolha seu fluxo.<br />
            A IA cria tudo em segundos e publica automaticamente no catálogo.
          </p>
          
          {/* Green highlight line */}
          <p className="text-base font-medium text-[#00C853]">
            Clientes sempre atualizados. Mais chances de vender primeiro.
          </p>
        </div>
      </div>
    </section>
  )
}
