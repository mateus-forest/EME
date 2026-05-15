"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTASection() {
  return (
    <section className="px-4 py-24 md:py-32">
      <div className="relative mx-auto max-w-4xl text-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[300px] w-[500px] rounded-full bg-[#00C853]/10 blur-[100px]" />
        </div>

        <div className="relative z-10">
          <h2 className="mb-6 text-3xl font-bold text-balance text-white sm:text-4xl md:text-5xl">
            Anuncie, organize e converta<br />
            <span className="bg-gradient-to-r from-[#00C853] to-[#00E676] bg-clip-text text-transparent">
              melhor com IA
            </span>
            .
          </h2>

          <Button
            asChild
            size="lg"
            className="gap-2 rounded-xl bg-[#00C853] px-10 py-7 text-lg font-bold text-black shadow-2xl shadow-[#00C853]/30 transition-all hover:scale-105 hover:bg-[#00E676] hover:shadow-[#00C853]/50"
          >
            <Link href="/cadastro/corretor">
              Criar meu primeiro anúncio
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
