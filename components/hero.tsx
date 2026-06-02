"use client"

import Image from "next/image"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative isolate mb-10 flex min-h-screen items-center justify-center overflow-x-clip overflow-y-visible px-4 pt-24 pb-10 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
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

      <div className="relative z-10 mx-auto w-full max-w-[1760px] overflow-hidden rounded-[40px] border border-white/10 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.54),0_0_70px_rgba(0,200,83,0.16)]">
        <div className="absolute -inset-4 -z-10 bg-[#00C853]/10 blur-3xl" />
        <div className="relative aspect-[2048/897] w-full overflow-hidden rounded-[40px]">
          <Image
            src="/images/eme-landing-hero-banner-2026-06-02.png"
            alt="Assessor EME e Catálogo Inteligente"
            fill
            priority
            sizes="100vw"
            className="rounded-[40px] object-cover"
          />
          <Link
            href="/cadastro/corretor"
            aria-label="Testar agora"
            className="absolute left-[2.45%] top-[58.55%] h-[7.6%] w-[10.75%] rounded-[0.8vw] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E676]"
          />
          <Link
            href="#assessor-eme-landing"
            aria-label="Ver como funciona"
            className="absolute left-[14.2%] top-[58.55%] h-[7.6%] w-[12.4%] rounded-[0.8vw] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E676]"
          />
        </div>
      </div>
    </section>
  )
}
