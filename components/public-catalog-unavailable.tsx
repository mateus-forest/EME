import Link from "next/link"

export function PublicCatalogUnavailable({
  title,
  message,
  fromPortal = false,
}: {
  title: string
  message: string
  fromPortal?: boolean
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf8f3_0%,#f4efe6_100%)] px-6 py-10 text-[#111111]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col items-center justify-center gap-8 text-center">
        <div className="inline-flex rounded-full border border-[#00C853]/20 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#009b3a]">
          Catálogo de imóveis
        </div>
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="text-base leading-7 text-[#5F6B7A] sm:text-lg">{message}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={fromPortal ? "/corretor/catalogo" : "/"}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#222222]"
          >
            {fromPortal ? "Voltar ao portal" : "Ir para a EME"}
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 px-5 text-sm font-semibold text-[#111111] transition hover:bg-white"
          >
            Página inicial
          </Link>
        </div>
      </div>
    </main>
  )
}
