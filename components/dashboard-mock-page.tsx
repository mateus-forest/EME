import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function DashboardMockPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0B0B0B] px-4 py-10">
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-28 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#00C853]/12 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(11,11,11,0.96))] p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
          <Link href="/" className="mb-8 inline-flex">
            <Image
              src="/images/eme-logo.png"
              alt="EME"
              width={160}
              height={64}
              className="h-14 w-auto"
              priority
            />
          </Link>

          <span className="inline-flex rounded-full border border-[#00C853]/30 bg-[#00C853]/10 px-4 py-2 text-sm font-medium text-[#00C853]">
            Fluxo concluído
          </span>

          <h1 className="mt-6 text-4xl font-bold text-white">Tudo pronto para seguir.</h1>
          <p className="mt-4 text-lg leading-relaxed text-white/60">
            Este destino não está conectado às rotas principais do produto.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 rounded-xl bg-[#00C853] px-6 font-semibold text-black hover:bg-[#00E676]"
            >
              <Link href="/corretor">Ir para o portal do corretor</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl border-white/10 bg-white/5 px-6 text-white hover:bg-white/10"
            >
              <Link href="/">Voltar para a landing</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
