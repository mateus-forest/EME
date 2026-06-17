"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 py-4 sm:px-4">
      <div className="mx-auto max-w-7xl">
        <nav className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white/86 px-4 py-3 shadow-[0_18px_48px_rgba(17,24,39,0.08)] backdrop-blur-xl sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/eme-logo.png"
              alt="EME"
              width={140}
              height={56}
              className="h-10 w-auto sm:h-14"
              priority
            />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="#produto" className="text-sm text-[#6B7280] transition-colors hover:text-[#111111]">
              Produto
            </Link>
            <Link
              href="#como-funciona"
              className="text-sm text-[#6B7280] transition-colors hover:text-[#111111]"
            >
              Como funciona
            </Link>
            <Link href="#busca-inteligente" className="text-sm text-[#6B7280] transition-colors hover:text-[#111111]">
              Busca inteligente
            </Link>
            <Link href="#corretor-eme" className="text-sm text-[#6B7280] transition-colors hover:text-[#111111]">
              Canais EME
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              className="inline-flex h-8 border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] shadow-sm hover:bg-[#F8FAF9] hover:text-[#111111] sm:h-9 sm:px-4"
            >
              <Link href="/login">Entrar</Link>
            </Button>
            <Button
              asChild
              className="h-8 bg-[#00C853] px-3 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/10 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/15 sm:h-9 sm:px-5"
            >
              <Link href="/cadastro">Testar agora</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  )
}
