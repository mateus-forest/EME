"use client"

import { Spinner } from "@/components/ui/spinner"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Play, Sparkles, Video } from "lucide-react"

const demoFrames = {
  original: "/images/eme-landing-hero.jpeg",
  final: "/images/eme-section-2-results-banner.png",
}

const demoVideoSrc: string | null = null
const demoPoster = "/images/eme-section-2-results-banner.png"

export function LandingStudioMediaDemo() {
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <section className="overflow-hidden rounded-[32px] border border-black/[0.045] bg-[linear-gradient(180deg,#ffffff_0%,#f7faf7_100%)] px-5 py-7 shadow-[0_18px_48px_rgba(15,23,42,0.05)] sm:px-7 sm:py-8 lg:px-8">
      <div className="max-w-[1180px]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-[#f7fbf8] px-4 py-2 text-sm font-medium text-[#16a34a]">
          <Sparkles className="size-4" />
          COMO FUNCIONA NA PRÁTICA
        </div>

        <h2 className="mt-5 text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.055em] text-[#111111] sm:text-[2.85rem]">
          Do imóvel real ao conteúdo que vende, em minutos.
        </h2>
        <p className="mt-3 max-w-[42rem] text-[0.98rem] leading-7 text-[#5f6973]">
          A IA transforma fotos e ideias em imagens profissionais e vídeos prontos para redes sociais e portais.
        </p>

        <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1fr)_62px_minmax(0,1fr)_62px_minmax(0,1fr)_62px_minmax(0,1fr)]">
          <DemoStageCard
            step="1"
            title="Envie a foto"
            subtitle="Do imóvel ou da obra."
            status="Foto enviada"
            image={demoFrames.original}
            state="image"
          />
          <StageArrow />
          <DemoStageCard
            step="2"
            title="IA cria o cenário"
            subtitle="Transforma o espaço."
            status="Gerando cenário..."
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

        <div className="mt-7 rounded-[28px] border border-[#dce9df] bg-[linear-gradient(180deg,#f8fbf8_0%,#ffffff_100%)] px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.035)] sm:px-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef8f1] text-[#16a34a]">
                <Sparkles className="size-6" />
              </span>
              <div>
                <p className="text-[1.45rem] font-semibold tracking-[-0.04em] text-[#111111]">
                  Seu próximo anúncio pode ser o melhor de todos.
                </p>
                <p className="mt-1.5 text-[13px] text-[#667085]">
                  Teste grátis • Sem compromisso • Cancelar quando quiser
                </p>
              </div>
            </div>
            <Link
              href="/cadastro/corretor"
              className="landing-hover-button inline-flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#16a34a] px-6 text-[14px] font-medium text-white shadow-[0_14px_26px_rgba(22,163,74,0.18)] transition-all hover:bg-[#14803d]"
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
    <article className="landing-hover-card rounded-[22px] border border-black/[0.05] bg-white p-3.5 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef8f1] text-sm font-semibold text-[#16a34a]">
          {step}
        </span>
        <div>
          <p className="text-[0.96rem] font-semibold text-[#111111]">{title}</p>
          <p className="mt-1 text-[13px] text-[#667085]">{subtitle}</p>
        </div>
      </div>

      <div className="landing-render-frame relative mt-3.5 aspect-[4/3] overflow-hidden rounded-[18px] border border-black/[0.045] bg-[#f1f4f0] shadow-[0_16px_24px_rgba(15,23,42,0.08)]">
        <Image src={image} alt={title} fill className="object-cover" sizes="(min-width: 1280px) 18vw, 100vw" />
        {state !== "image" ? <div className="absolute inset-0 bg-[rgba(17,24,39,0.18)]" /> : null}
        {state !== "image" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/92 text-[#16a34a] shadow-[0_12px_24px_rgba(15,23,42,0.16)]">
              {state === "processing" ? <Spinner className="size-7" /> : <Play className="size-7" />}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-[-1.15rem] px-2">
        <div className="inline-flex items-center gap-2 rounded-[12px] border border-black/[0.045] bg-white px-3.5 py-1.5 text-[13px] text-[#334155] shadow-[0_10px_18px_rgba(15,23,42,0.07)]">
          {state === "image" ? (
            <CheckCircle2 className="size-4 text-[#16a34a]" />
          ) : state === "processing" ? (
            <Spinner className="size-4 text-[#16a34a]" />
          ) : (
            <Play className="size-4 text-[#16a34a]" />
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
    <article className="landing-hover-card rounded-[22px] border border-black/[0.05] bg-white p-3.5 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eef8f1] text-sm font-semibold text-[#16a34a]">
          4
        </span>
        <div>
          <p className="text-[0.96rem] font-semibold text-[#111111]">Vídeo pronto</p>
          <p className="mt-1 text-[13px] text-[#667085]">Pronto para postar e vender.</p>
        </div>
      </div>

      <div className="landing-render-frame mt-3.5 overflow-hidden rounded-[18px] border border-black/[0.045] bg-[#f1f4f0] shadow-[0_16px_24px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-4 py-2.5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#111111]">
            <span className="inline-flex size-2.5 rounded-full bg-[#16a34a]" />
            Vídeo final
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#667085]">
            <span className="rounded-full bg-white px-2.5 py-1">Muted</span>
            <span className="rounded-full bg-white px-2.5 py-1">Loop</span>
            <span className="rounded-full bg-white px-2.5 py-1">Inline</span>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-[#edf2ee]">
          {!demoVideoSrc || videoFailed ? (
            <Image
              src={demoPoster}
              alt="Fallback visual da demonstração de vídeo do Studio IA"
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

      <div className="mt-[-1.15rem] px-2">
        <div className="inline-flex items-center gap-2 rounded-[12px] border border-black/[0.045] bg-white px-3.5 py-1.5 text-[13px] text-[#334155] shadow-[0_10px_18px_rgba(15,23,42,0.07)]">
          <CheckCircle2 className="size-4 text-[#16a34a]" />
          Vídeo concluído!
        </div>
      </div>
    </article>
  )
}

function StageArrow() {
  return (
    <div className="hidden items-center justify-center xl:flex">
      <span className="landing-hover-card inline-flex size-10 items-center justify-center rounded-full border border-[#dce9df] bg-white text-[#16a34a] shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
        <ArrowRight className="size-5" />
      </span>
    </div>
  )
}
