"use client"

import Image from "next/image"
import { useState } from "react"
import { Building2, Eye, MousePointer } from "lucide-react"

export function ManagementSection() {
  const [activePreview, setActivePreview] = useState(0)

  const features = [
    { icon: Building2, text: "Gerencie imóveis" },
    { icon: Eye, text: "Acompanhe visualizações" },
    { icon: MousePointer, text: "Veja contatos do catálogo" },
  ]

  const previews = [
    {
      title: "Portal do corretor",
      description: "Dashboard com imóveis em destaque, métricas operacionais e atalhos de gestão do dia a dia.",
      image: "/images/landing-broker-dashboard.png",
    },
  ]

  return (
    <section className="py-24 md:py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Controle tudo em{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C853] to-[#00E676]">
              um só lugar
            </span>
            .
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00C853]/10 to-transparent rounded-3xl blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#111] to-[#0B0B0B] shadow-2xl">
              <div className="p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Demonstração do produto</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{previews[activePreview].title}</h3>
                    <p className="mt-1 text-sm text-white/55">{previews[activePreview].description}</p>
                  </div>
                  <div className="rounded-full border border-[#00C853]/25 bg-[#00C853]/10 px-3 py-1 text-[11px] font-medium text-[#69F0AE]">
                    Preview real
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
                  <div className="relative aspect-[16/10] sm:aspect-[16/9]">
                    <Image
                      key={previews[activePreview].image}
                      src={previews[activePreview].image}
                      alt={previews[activePreview].title}
                      fill
                      className="object-contain bg-[#050505] transition-opacity duration-500 ease-out"
                      sizes="(min-width: 768px) 50vw, 100vw"
                      priority={activePreview === 0}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2">
                  {previews.map((preview, index) => (
                    <button
                      key={preview.title}
                      type="button"
                      onClick={() => setActivePreview(index)}
                      aria-label={`Mostrar preview ${index + 1}`}
                      aria-pressed={activePreview === index}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        activePreview === index
                          ? "w-8 bg-[#00E676]"
                          : "w-2.5 bg-white/20 hover:bg-white/40"
                      }`}
                    />
                  ))}
                </div>

                <p className="mt-4 text-center text-[11px] text-white/30">
                  Demonstração visual da plataforma EME com telas do produto.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-8">
            <div>
              <p className="text-sm text-white/50 uppercase tracking-wider mb-4">Para corretores</p>
              <div className="space-y-4">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#00C853]/10 flex items-center justify-center">
                      <feature.icon className="w-6 h-6 text-[#00C853]" />
                    </div>
                    <p className="text-lg text-white">{feature.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
