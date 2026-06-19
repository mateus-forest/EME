import Image from "next/image"
import Link from "next/link"

const navLinks = [
  { label: "Produto", href: "#produto" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Catálogo inteligente", href: "#busca-inteligente" },
  { label: "Canais EME", href: "#corretor-eme" },
] as const

const heroHotspots = [
  {
    label: "Começar grátis",
    href: "/cadastro/corretor",
    left: "12.45%",
    top: "73.4%",
    width: "14.6%",
    height: "8.0%",
  },
] as const

const finalCtaHotspot = {
  label: "Criar meu primeiro anuncio",
  href: "/cadastro/corretor",
  left: "36.0%",
  top: "56.0%",
  width: "28.5%",
  height: "11.5%",
} as const

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fbfbf8] text-[#050505]">
      <header className="relative z-20 px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between rounded-[24px] border border-black/[0.06] bg-white/82 px-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-7">
          <Link href="/" aria-label="EME" className="flex items-center">
            <Image
              src="/images/eme-logo-official.png"
              alt="EME"
              width={1563}
              height={1563}
              priority
              sizes="(max-width: 640px) 64px, 80px"
              className="h-16 w-16 object-contain sm:h-20 sm:w-20"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#5F6B7A] md:flex lg:gap-11">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-[#050505]">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-semibold text-[#050505] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-colors hover:bg-[#f6f7f4] sm:px-5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(0,155,58,0.16)] transition-colors hover:bg-[#008633] sm:px-5"
            >
              Testar agora
            </Link>
          </div>
        </div>
      </header>

      <section id="produto" className="px-4 pb-14 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[28px] bg-white">
            <img
              src="/images/eme-hero-v2-banner.png"
              alt="O corretor que vende mais"
              width={1831}
              height={859}
              className="block h-auto w-full select-none"
              draggable={false}
            />

            {heroHotspots.map((hotspot) => (
              <Link
                key={hotspot.label}
                href={hotspot.href}
                aria-label={hotspot.label}
                className="absolute z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009b3a]"
                style={{
                  left: hotspot.left,
                  top: hotspot.top,
                  width: hotspot.width,
                  height: hotspot.height,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-white">
          <img
            src="/images/eme-section-2-results-banner.png"
            alt="Veja o resultado"
            width={1774}
            height={887}
            className="block h-auto w-full select-none"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
      </section>

      <section id="como-funciona" className="px-4 pb-14 sm:px-6 lg:px-8">
        <div id="corretor-eme" className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-white">
          <img
            src="/images/assistente-eme.png"
            alt="Seu assistente. Nao seu sistema."
            width={1913}
            height={822}
            className="block h-auto w-full select-none"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
      </section>

      <section id="busca-inteligente" className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-white">
          <img
            src="/images/catalogo-eme.png"
            alt="Seu catalogo trabalhando para voce"
            width={2057}
            height={765}
            className="block h-auto w-full select-none"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-white">
          <img
            src="/images/cta-final-eme.png"
            alt="Menos trabalho. Mais vendas."
            width={1983}
            height={793}
            className="block h-auto w-full select-none"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          <Link
            href={finalCtaHotspot.href}
            aria-label={finalCtaHotspot.label}
            className="absolute z-10 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009b3a]"
            style={{
              left: finalCtaHotspot.left,
              top: finalCtaHotspot.top,
              width: finalCtaHotspot.width,
              height: finalCtaHotspot.height,
            }}
          />
        </div>
      </section>
    </main>
  )
}
