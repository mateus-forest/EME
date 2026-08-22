import Link from "next/link"
import {
  CATALOG_GLASS_SURFACE_CLASS,
  CATALOG_PAGE_BACKGROUND_CLASS,
  CATALOG_PRIMARY_CTA_CLASS,
  CATALOG_SECONDARY_CTA_CLASS,
} from "@/lib/catalog-visual-system"
import { cn } from "@/lib/utils"

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
    <main className={cn(CATALOG_PAGE_BACKGROUND_CLASS, "px-6 py-10")}>
      <div className={cn(CATALOG_GLASS_SURFACE_CLASS, "mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col items-center justify-center gap-8 rounded-[1.75rem] px-6 text-center sm:px-12")}>
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
            className={cn(CATALOG_PRIMARY_CTA_CLASS, "inline-flex h-11 items-center justify-center px-5 text-sm font-semibold")}
          >
            {fromPortal ? "Voltar ao portal" : "Ir para a EME"}
          </Link>
          <Link
            href="/"
            className={cn(CATALOG_SECONDARY_CTA_CLASS, "inline-flex h-11 items-center justify-center px-5 text-sm font-semibold")}
          >
            Página inicial
          </Link>
        </div>
      </div>
    </main>
  )
}
