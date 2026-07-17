"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, LoaderCircle, Play, Sparkles, Video } from "lucide-react"

const demoFrames = {
  original: "/images/eme-landing-hero.jpeg",
  final: "/images/eme-section-2-results-banner.png",
}

const demoVideoSrc = "/images/studio-ia-demo.mp4"
const demoPoster = "/images/eme-section-2-results-banner.png"

export function LandingStudioMediaDemo() {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <section className="overflow-hidden rounded-[34px] border border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf7_100%)] px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:px-8 sm:py-10 lg:px-10">
      <div className="max-w-[1180px]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-[#f7fbf8] px-4 py-2 text-sm font-medium text-[#16a34a]">
          <Sparkles className="size-4" />
          COMO FUNCIONA NA PRATICA
        </div>

        <h2 className="mt-6 text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.055em] text-[#111111] sm:text-[3.15rem]">
          Do imovel real ao conteudo que vende, em minutos.
        </h2>
        <p className="mt-4 max-w-[46rem] text-[1.02rem] leading-8 text-[#5f6973]">
          A IA transforma fotos e ideias em imagens profissionais e videos prontos para redes sociais e portais.
        </p>

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_70px_minmax(0,1fr)_70px_minmax(0,1fr)_70px_minmax(0,1fr)]">
          <DemoStageCard
            step="1"
            title="Envie a foto"
            subtitle="Do imovel ou da obra."
            status="Foto enviada"
            image={demoFrames.original}
            state="image"
          />
          <StageArrow />
          <DemoStageCard
            step="2"
            title="IA cria o cenario"
            subtitle="Transforma o espaco."
            status="Gerando cenario..."
            image={demoFrames.final}
            state="processing"
          />
          <StageArrow />
          <DemoStageCard
            step="3"
            title="IA gera movimento"
            subtitle="Adiciona vida e profundidade."
            status="Gerando movimento..."
            image={demoFrames.final}
            state="video-processing"
          />
          <StageArrow />
          <DemoVideoCard videoFailed={videoFailed} setVideoFailed={setVideoFailed} />
        </div>

        <div className="mt-8 rounded-[30px] border border-[#dce9df] bg-[linear-gradient(180deg,#f8fbf8_0%,#ffffff_100%)] px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)] sm:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef8f1] text-[#16a34a]">
                <Sparkles className="size-6" />
              </span>
              <div>
                <p className="text-[1.7rem] font-semibold tracking-[-0.04em] text-[#111111]">
                  Seu proximo anuncio pode ser o melhor de todos.
                </p>
                <p className="mt-2 text-sm text-[#667085]">
                  Teste gratis • Sem compromisso • Cancelar quando quiser
                </p>
              </div>
            </div>
            <Link
              href="/cadastro/corretor"
              className="inline-flex h-[58px] items-center justify-center gap-2 rounded-[18px] bg-[#16a34a] px-7 text-[15px] font-medium text-white shadow-[0_16px_32px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d]"
            >
              Experimentar o Studio IA agora
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function DemoStageCard({
  step,
  title,
  subtitle,
  status,
  image,
  state,
}: {
  step: string
  title: string
  subtitle: string
  status: string
  image: string
  state: "image" | "processing" | "video-processing"
}) {
  return (
    <article className="rounded-[24px] border border-black/[0.055] bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.045)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f1] text-base font-semibold text-[#16a34a]">
          {step}
        </span>
        <div>
          <p className="text-[1.02rem] font-semibold text-[#111111]">{title}</p>
          <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
        </div>
      </div>

      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[20px] border border-black/[0.05] bg-[#f1f4f0]">
        <Image src={image} alt={title} fill className="object-cover" sizes="(min-width: 1280px) 18vw, 100vw" />
        {state !== "image" ? <div className="absolute inset-0 bg-[rgba(17,24,39,0.18)]" /> : null}
        {state !== "image" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-white/92 text-[#16a34a] shadow-[0_12px_24px_rgba(15,23,42,0.16)]">
              {state === "processing" ? <LoaderCircle className="size-7 animate-spin" /> : <Play className="size-7" />}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-[-1.35rem] px-2">
        <div className="inline-flex items-center gap-2 rounded-[14px] border border-black/[0.05] bg-white px-4 py-2 text-sm text-[#334155] shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
          {state === "image" ? (
            <CheckCircle2 className="size-4 text-[#16a34a]" />
          ) : (
            <LoaderCircle className={`size-4 text-[#16a34a] ${state === "processing" ? "animate-spin" : ""}`} />
          )}
          {status}
        </div>
      </div>
    </article>
  )
}

function DemoVideoCard({
  videoFailed,
  setVideoFailed,
}: {
  videoFailed: boolean
  setVideoFailed: (value: boolean) => void
}) {
  return (
    <article className="rounded-[24px] border border-black/[0.055] bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.045)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f1] text-base font-semibold text-[#16a34a]">
          4
        </span>
        <div>
          <p className="text-[1.02rem] font-semibold text-[#111111]">Video pronto</p>
          <p className="mt-1 text-sm text-[#667085]">Pronto para postar e vender.</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[20px] border border-black/[0.05] bg-[#f1f4f0]">
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[#111111]">
            <span className="inline-flex size-2.5 rounded-full bg-[#16a34a]" />
            Video final
          </div>
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <span className="rounded-full bg-white px-2.5 py-1">Muted</span>
            <span className="rounded-full bg-white px-2.5 py-1">Loop</span>
            <span className="rounded-full bg-white px-2.5 py-1">Inline</span>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-[#edf2ee]">
          {videoFailed ? (
            <Image
              src={demoPoster}
              alt="Fallback visual da demonstracao de video do Studio IA"
              fill
              className="object-cover"
              sizes="(min-width: 1280px) 18vw, 100vw"
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
        </div>
      </div>

      <div className="mt-[-1.35rem] px-2">
        <div className="inline-flex items-center gap-2 rounded-[14px] border border-black/[0.05] bg-white px-4 py-2 text-sm text-[#334155] shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
          <CheckCircle2 className="size-4 text-[#16a34a]" />
          Video concluido!
        </div>
      </div>
    </article>
  )
}

function StageArrow() {
  return (
    <div className="hidden items-center justify-center xl:flex">
      <span className="inline-flex size-12 items-center justify-center rounded-full border border-[#dce9df] bg-white text-[#16a34a] shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
        <ArrowRight className="size-5" />
      </span>
    </div>
  )
}
