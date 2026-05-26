"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative isolate mb-10 flex min-h-screen items-center justify-center overflow-x-clip overflow-y-visible px-4 pt-44 pb-32 sm:px-6 sm:pt-48 sm:pb-36 lg:px-8 lg:pt-52 lg:pb-40">
      <div className="pointer-events-none absolute inset-0 -z-20 flex items-center justify-center">
        <div className="absolute h-[600px] w-[600px] animate-pulse rounded-full bg-[#00C853]/20 blur-[120px]" />
        <div className="absolute h-[420px] w-[420px] animate-pulse rounded-full bg-[#00E676]/10 blur-[100px] delay-700" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_22%,rgba(0,200,83,0.14),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_44%,rgba(0,0,0,0.10))]" />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="pointer-events-none absolute inset-x-[-18%] top-12 -z-10 h-[520px] opacity-80">
        <div className="absolute left-0 top-28 h-px w-full rotate-[-4deg] bg-gradient-to-r from-transparent via-[#00C853]/45 to-transparent blur-[1px]" />
        <div className="absolute left-[10%] top-7 h-72 w-[88%] rounded-[100%] border-t border-[#00C853]/25" />
        <div className="absolute left-[20%] top-20 h-56 w-[64%] rounded-[100%] border-t border-[#00E676]/18 blur-[0.5px]" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-10 xl:gap-14">
        <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00C853]/30 bg-[#00C853]/10 px-4 py-2 shadow-[0_0_28px_rgba(0,200,83,0.12)]">
            <span className="h-2 w-2 rounded-full bg-[#00E676] shadow-[0_0_16px_rgba(0,230,118,0.85)]" />
            <span className="text-sm font-medium text-[#9DFFBF]">IA para corretores</span>
          </div>

          <h1 className="text-4xl leading-[1.08] font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            Um assessor para corretores.
            <span className="mt-2 block bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              Um catálogo que capta leads.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-pretty text-white/62 sm:text-lg sm:leading-8 lg:mx-0">
            O EME reúne IA, catálogo imobiliário, leads, agenda, documentos e analytics em uma plataforma feita para o
            corretor vender mais com menos esforço.
          </p>

          <div className="mt-8 flex justify-center lg:justify-start">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-xl bg-[#00C853] px-9 text-base font-bold text-black shadow-[0_0_34px_rgba(0,200,83,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#00E676] hover:shadow-[0_0_42px_rgba(0,200,83,0.48)]"
            >
              <Link href="/cadastro/corretor">Começar agora</Link>
            </Button>
          </div>

          <div className="mt-9 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <HeroSignal label="Assessor EME" value="WhatsApp integrado" />
            <HeroSignal label="Catálogo online" value="Captura leads" />
            <HeroSignal label="Operação" value="Agenda e propostas" />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-3xl lg:max-w-none">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#00C853]/10 blur-3xl" />
          <div className="relative overflow-visible">
            <Image
              src="/images/eme-landing-hero-mockup.png"
              alt="Dashboard do EME com Assessor EME no WhatsApp"
              width={4956}
              height={3100}
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="h-auto w-full rounded-[1.35rem] object-contain shadow-[0_28px_90px_rgba(0,0,0,0.54),0_0_70px_rgba(0,200,83,0.16)] lg:scale-[1.1] xl:scale-[1.12]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 backdrop-blur-sm">
      <p className="text-xs text-white/42">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
