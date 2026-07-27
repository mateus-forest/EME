import Link from "next/link"

export default function PublicCatalogNotFound() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf8f3_0%,#f4efe6_100%)] px-6 py-10 text-[#111111]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col items-center justify-center gap-8 text-center">
        <div className="inline-flex rounded-full border border-[#00C853]/20 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#009b3a]">
          Catálogo de imóveis
        </div>
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Catálogo não encontrado</h1>
          <p className="text-base leading-7 text-[#5F6B7A] sm:text-lg">
            Este link não está mais disponível ou nunca existiu. Confira o endereço e peça um novo acesso ao corretor.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#222222]"
          >
            Ir para a EME
          </Link>
        </div>
      </div>
    </main>
  )
}
