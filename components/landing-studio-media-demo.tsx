"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock3, ImageUp, LoaderCircle, Play, Video } from "lucide-react"

const generationSteps = [
  "Enviando imagem",
  "Gerando cenario",
  "Criando movimento",
  "Video concluido",
] as const

const demoFrames = [
  {
    title: "Imagem original",
    subtitle: "Foto enviada para o Studio IA",
    image: "/images/eme-landing-hero.jpeg",
  },
  {
    title: "Imagem final",
    subtitle: "Cena pronta para divulgacao",
    image: "/images/eme-section-2-results-banner.png",
  },
] as const

const demoVideoSrc = "/images/studio-ia-demo.mp4"
const demoPoster = "/images/eme-section-2-results-banner.png"

export function LandingStudioMediaDemo() {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <section className="overflow-hidden rounded-[34px] border border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf7_100%)] px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:px-8 sm:py-10 lg:px-10">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(320px,0.36fr)_minmax(0,0.64fr)]">
        <div className="max-w-[28rem]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-[#f7fbf8] px-3 py-2 text-sm font-medium text-[#5f6973]">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#eef8f1] text-[#16a34a]">
              <Video className="size-4" />
            </span>
            Geracao de imagem e video
          </div>

          <h2 className="mt-6 text-[2.55rem] font-semibold leading-[1.04] tracking-[-0.055em] text-[#111111] sm:text-[3.4rem]">
            Transforme uma foto em conteudo que vende.
          </h2>
          <p className="mt-5 text-[1.05rem] leading-8 text-[#5f6973]">
            O Studio IA cria imagens profissionais e videos prontos para apresentar seus imoveis nas redes sociais.
          </p>

          <div className="mt-7 grid gap-3">
            {generationSteps.map((step, index) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-[20px] border border-black/[0.05] bg-white/88 px-4 py-3.5 shadow-[0_10px_20px_rgba(15,23,42,0.035)]"
              >
                <span
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${
                    index === generationSteps.length - 1 ? "bg-[#16a34a] text-white" : "bg-[#eef8f1] text-[#16a34a]"
                  }`}
                >
                  {index === generationSteps.length - 1 ? (
                    <CheckCircle2 className="size-4.5" />
                  ) : index === 1 ? (
                    <LoaderCircle className="size-4.5 animate-spin" />
                  ) : (
                    <Clock3 className="size-4.5" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{step}</p>
                  <p className="mt-1 text-sm text-[#667085]">
                    {index === 0
                      ? "O arquivo entra no fluxo com validacao pronta para processar."
                      : index === 1
                        ? "A IA reconstrui a cena para apresentar o imovel com mais impacto."
                        : index === 2
                          ? "O movimento finaliza o video com ritmo de apresentacao comercial."
                          : "Material salvo para reproduzir, baixar e usar quando quiser."}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/cadastro/corretor"
            className="mt-8 inline-flex h-[56px] items-center justify-center gap-2 rounded-[18px] bg-[#16a34a] px-6 text-[15px] font-medium text-white shadow-[0_16px_32px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d]"
          >
            Conhecer o Studio IA
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.48fr)_minmax(0,0.52fr)]">
          <div className="grid gap-4">
            <DemoImageCard
              title={demoFrames[0].title}
              subtitle={demoFrames[0].subtitle}
              image={demoFrames[0].image}
              icon={<ImageUp className="size-4" />}
            />
            <ProgressPanel />
            <DemoImageCard
              title={demoFrames[1].title}
              subtitle={demoFrames[1].subtitle}
              image={demoFrames[1].image}
              icon={<CheckCircle2 className="size-4" />}
            />
          </div>

          <div className="rounded-[28px] border border-black/[0.055] bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#16a34a]">Studio IA video</p>
                <p className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-[#111111]">
                  Video final reproduzindo
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-[#f7fbf8] px-3 py-1.5 text-xs font-medium text-[#5f6973]">
                <Play className="size-3.5 text-[#16a34a]" />
                MP4 demonstrativo
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-black/[0.05] bg-[#f6f9f7]">
              <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[#111111]">
                  <span className="inline-flex size-2.5 rounded-full bg-[#16a34a]" />
                  Reproducao automatica
                </div>
                <div className="flex items-center gap-2 text-xs text-[#667085]">
                  <span className="rounded-full bg-white px-2.5 py-1">Muted</span>
                  <span className="rounded-full bg-white px-2.5 py-1">Loop</span>
                  <span className="rounded-full bg-white px-2.5 py-1">Inline</span>
                </div>
              </div>

              <div className="relative aspect-[9/14] w-full bg-[#edf2ee]">
                {videoFailed ? (
                  <Image
                    src={demoPoster}
                    alt="Fallback visual da demonstracao de video do Studio IA"
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 28vw, (min-width: 1024px) 40vw, 100vw"
                  />
                ) : (
                  <video
                    className="h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    poster={demoPoster}
                    onError={() => setVideoFailed(true)}
                  >
                    <source src={demoVideoSrc} type="video/mp4" />
                  </video>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(17,24,39,0)_0%,rgba(17,24,39,0.64)_100%)] px-4 py-4 text-white">
                  <div className="flex flex-wrap gap-2">
                    {generationSteps.map((step, index) => (
                      <span
                        key={step}
                        className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                          index === generationSteps.length - 1 ? "bg-white text-[#111111]" : "bg-white/15"
                        }`}
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#667085]">
              O player tenta reproduzir o MP4 automaticamente com fallback visual caso o arquivo demonstrativo nao
              carregue neste ambiente.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function DemoImageCard({
  title,
  subtitle,
  image,
  icon,
}: {
  title: string
  subtitle: string
  image: string
  icon: ReactNode
}) {
  return (
    <article className="rounded-[24px] border border-black/[0.055] bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.045)]">
      <div className="flex items-center gap-2 text-sm font-medium text-[#5f6973]">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#eef8f1] text-[#16a34a]">
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-2 text-sm text-[#667085]">{subtitle}</p>
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[20px] border border-black/[0.05] bg-[#f1f4f0]">
        <Image src={image} alt={title} fill className="object-cover" sizes="(min-width: 1280px) 18vw, 100vw" />
      </div>
    </article>
  )
}

function ProgressPanel() {
  return (
    <article className="rounded-[24px] border border-[#dce9df] bg-[linear-gradient(180deg,#f8fbf8_0%,#ffffff_100%)] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.045)]">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#16a34a]">Processamento</p>
      <p className="mt-3 text-[1.12rem] font-semibold tracking-[-0.03em] text-[#111111]">
        Gerando cenario e movimento
      </p>
      <div className="mt-4 grid gap-3">
        {generationSteps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-[18px] border border-black/[0.05] bg-white/88 px-3 py-3">
            <span
              className={`inline-flex size-8 items-center justify-center rounded-full ${
                index === 1 || index === 2 ? "bg-[#eef8f1] text-[#16a34a]" : "bg-[#f4f6f4] text-[#7b8694]"
              }`}
            >
              {index === 1 ? <LoaderCircle className="size-4 animate-spin" /> : <Clock3 className="size-4" />}
            </span>
            <span className="text-sm font-medium text-[#334155]">{step}</span>
          </div>
        ))}
      </div>
    </article>
  )
}
