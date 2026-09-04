"use client"

import Image from "next/image"
import Link from "next/link"
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Share2,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
} from "lucide-react"

import { AssistantLauncher } from "@/components/marketplace/assistant/assistant-launcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { PublicBrokerCatalogData } from "@/lib/public-catalog"
import { formatPhone } from "@/lib/structured-fields"
import {
  buildBrokerCatalogPath,
  buildBrokerCatalogUrl,
} from "@/lib/public-catalog-url"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import {
  CATALOG_DIALOG_SURFACE_CLASS,
  CATALOG_GLASS_SURFACE_CLASS,
  CATALOG_ICON_SURFACE_CLASS,
  CATALOG_PRIMARY_CTA_CLASS,
  CATALOG_SECONDARY_CTA_CLASS,
} from "@/lib/catalog-visual-system"
import { BrokerSpecialtyChips } from "@/components/broker-specialty-chips"
import { useCatalogTheme } from "@/components/catalog-theme-provider"
import { WhatsappGlyph } from "@/components/marketplace/property/whatsapp-glyph"

const PREMIUM_BANNER_FALLBACK = "/marketplace/images/hero-residence.png"

type CatalogView = "properties" | "listing" | "about"

function creciLabel(catalog: PublicBrokerCatalogData) {
  if (!catalog.creci) return ""
  const creci = catalog.creci.toLocaleUpperCase("pt-BR").startsWith("CRECI")
    ? catalog.creci
    : `CRECI ${catalog.creci}`
  return catalog.creciUf && !creci.toLocaleUpperCase("pt-BR").includes(catalog.creciUf.toLocaleUpperCase("pt-BR"))
    ? `${creci} · ${catalog.creciUf}`
    : creci
}

export function BrokerCatalogHeader({
  catalog,
  view,
  onContact,
  onShare,
}: {
  catalog: PublicBrokerCatalogData
  view: CatalogView
  onContact: () => void
  onShare: () => void
}) {
  const catalogPath = buildBrokerCatalogPath(catalog.slug)
  const { theme, toggleTheme } = useCatalogTheme()
  const isDark = theme === "dark"
  const themeLabel = isDark ? "Ativar tema claro" : "Ativar tema escuro"

  return (
      <header className="sticky top-0 z-50 px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="eme-catalog-header-surface relative mx-auto max-w-[1240px] overflow-hidden rounded-[1.2rem] border border-white/80 bg-white/72 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.96),0_8px_24px_rgba(54,48,39,.08)] backdrop-blur-[24px] backdrop-saturate-[1.2] supports-[backdrop-filter]:bg-white/48 sm:px-6">
          <div className="relative flex h-[66px] items-center gap-2 sm:h-[70px] sm:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={catalogPath}
              className="flex shrink-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#159447]/30"
              aria-label="EME — início do catálogo"
            >
              <Image src="/marketplace/eme-logo-raw.svg" alt="EME" width={44} height={30} className="h-auto w-10 sm:w-11" priority />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="eme-catalog-theme-toggle flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e9e5dd] bg-white/78 text-[#303631] shadow-[0_4px_12px_rgba(43,39,32,.08)] backdrop-blur-[16px] transition hover:-translate-y-0.5 hover:bg-white hover:text-[#0f6f37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#159447]/35 sm:size-10"
              aria-label={themeLabel}
              aria-pressed={isDark}
              title={themeLabel}
            >
              {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
            </button>
          </div>

          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex" aria-label="Navegação do catálogo">
            <CatalogNavLink href={catalogPath} active={view !== "about"}>Imóveis</CatalogNavLink>
            <CatalogNavLink href={`${catalogPath}/sobre`} active={view === "about"}>Sobre o corretor</CatalogNavLink>
            <button type="button" onClick={onContact} className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-[#333a36] transition hover:border-[#e8e4dc] hover:bg-white/65 hover:text-[#0f6f37]">
              Contato
            </button>
          </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <AssistantLauncher
                className="relative !size-9 !shrink-0 !justify-center !gap-0 !rounded-full !border-[#e9e5dd] !bg-white/78 !p-0 !shadow-[0_4px_12px_rgba(43,39,32,.08)] !backdrop-blur-[16px] hover:!bg-white sm:!size-10 [&>*:first-child]:!m-0 [&>span:last-child]:!absolute [&>span:last-child]:!right-0.5 [&>span:last-child]:!top-0.5"
                labelClassName="sr-only"
              />
              {catalog.whatsApp ? <button type="button" onClick={onContact} className="flex size-9 items-center justify-center rounded-full border border-[#0d7137]/10 bg-[#0d7137] text-white shadow-[0_5px_14px_rgba(13,113,55,.18)] transition hover:-translate-y-0.5 hover:bg-[#095f2d] sm:size-10" aria-label="Falar pelo WhatsApp" title="Falar pelo WhatsApp"><WhatsappGlyph className="size-4 sm:size-4.5" /></button> : null}
              <button type="button" onClick={onShare} className="flex size-9 items-center justify-center rounded-full border border-[#e9e5dd] bg-white/78 text-[#303631] shadow-[0_4px_12px_rgba(43,39,32,.08)] backdrop-blur-[16px] transition hover:-translate-y-0.5 hover:bg-white hover:text-[#0f6f37] sm:size-10" aria-label="Compartilhar catálogo" title="Compartilhar catálogo">
                <Share2 className="size-4" />
            </button>
          </div>
        </div>

        <nav className="flex justify-center gap-1 overflow-x-auto border-t border-white/65 py-2 lg:hidden" aria-label="Navegação do catálogo mobile">
          <CatalogNavLink href={catalogPath} active={view !== "about"}>Imóveis</CatalogNavLink>
          <CatalogNavLink href={`${catalogPath}/sobre`} active={view === "about"}>Sobre o corretor</CatalogNavLink>
          <button type="button" onClick={onContact} className="shrink-0 rounded-full border border-transparent px-3 py-2 text-xs font-medium text-[#4c5551] transition hover:border-white/80 hover:bg-white/55">Contato</button>
        </nav>
      </div>
    </header>
  )
}

function CatalogNavLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm",
        active
          ? "border-[#ebe7df] bg-white/72 text-[#111713] shadow-[0_3px_10px_rgba(45,41,34,.06)] backdrop-blur-[14px]"
          : "border-transparent text-[#3f4541] hover:border-[#ebe7df] hover:bg-white/50 hover:text-[#0f6f37]",
      )}
    >
      {children}
      {active ? <span className="absolute inset-x-4 -bottom-[9px] h-0.5 rounded-full bg-[#b38a3b] lg:-bottom-[13px]" /> : null}
    </Link>
  )
}

export function BrokerProfileHero({
  catalog,
  priceRange,
}: {
  catalog: PublicBrokerCatalogData
  priceRange: string
  onShare: () => void
  onWhatsApp: () => void
}) {
  const metrics = [
    catalog.experienceYears && catalog.experienceYears > 0
      ? { icon: CalendarDays, value: `${catalog.experienceYears} ${catalog.experienceYears === 1 ? "ano" : "anos"}`, label: "Tempo de atuação" }
      : null,
    catalog.soldProperties && catalog.soldProperties > 0
      ? { icon: TrendingUp, value: catalog.soldProperties.toLocaleString("pt-BR"), label: "Imóveis vendidos" }
      : null,
    catalog.cities.length
      ? { icon: MapPin, value: `${catalog.cities.length} ${catalog.cities.length === 1 ? "cidade" : "cidades"}`, label: "Cidades atendidas" }
      : null,
    catalog.serviceArea
      ? { icon: Map, value: catalog.serviceArea, label: "Área de atuação" }
      : null,
    priceRange && priceRange !== "Consulte"
      ? { icon: CircleDollarSign, value: priceRange, label: "Faixa de preço", wideMobile: true }
      : null,
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))

  return (
    <section className="relative mx-auto w-full max-w-[1240px] pt-0">
      <div className="eme-catalog-profile-hero relative overflow-hidden rounded-[1.25rem] border border-white/80 bg-[#f5f2ec] shadow-[0_16px_38px_rgba(63,55,44,.09)] lg:min-h-[268px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catalog.bannerUrl || PREMIUM_BANNER_FALLBACK}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="eme-catalog-profile-hero-overlay absolute inset-0 bg-[linear-gradient(90deg,rgba(249,248,245,.97)_0%,rgba(249,248,245,.91)_25%,rgba(249,248,245,.70)_45%,rgba(249,248,245,.30)_64%,rgba(249,248,245,.07)_78%,transparent_88%)]" />

          <div className="relative z-10 grid gap-5 px-5 py-7 text-center sm:px-7 sm:py-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center lg:gap-7 lg:px-8 lg:py-8 lg:text-left">
          <div className="relative z-10 mx-auto size-32 shrink-0 overflow-hidden rounded-full border-[5px] border-white/75 bg-white/45 shadow-[inset_0_2px_3px_rgba(255,255,255,.96),0_10px_26px_rgba(43,38,31,.15),0_0_0_1px_rgba(255,255,255,.55)] before:pointer-events-none before:absolute before:inset-0 before:z-10 before:rounded-full before:shadow-[inset_0_2px_2px_rgba(255,255,255,.92),inset_0_-2px_4px_rgba(56,107,76,.08)] after:pointer-events-none after:absolute after:inset-[3px] after:z-10 after:rounded-full after:bg-[linear-gradient(135deg,rgba(255,255,255,.20),transparent_40%,rgba(255,255,255,.08))] sm:size-40 lg:size-48">
            {catalog.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={catalog.photoUrl} alt={catalog.displayName} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#edf7ef] text-4xl font-semibold text-[#168a40]">
                {getInitials(catalog.displayName)}
              </div>
            )}
          </div>

            <div className="relative z-10 min-w-0 max-w-[38rem] space-y-3 text-center lg:text-left">
              <div className="flex flex-wrap items-start justify-center gap-2.5 lg:justify-start">
                <h1 className="max-w-full text-[2rem] font-normal leading-tight tracking-[-0.045em] text-[#111411] [text-shadow:0_1px_16px_rgba(255,255,255,.75)] sm:text-[2.35rem] lg:text-[2.8rem]">
                  {catalog.displayName}
                </h1>
                {catalog.creciVerified ? (
                  <BadgeCheck className="mt-1.5 size-5 shrink-0 fill-[#17a24c] text-white sm:size-6 lg:mt-2" aria-label="CRECI verificado" />
                ) : null}
              </div>

              <BrokerSpecialtyChips specialties={catalog.specialties} compact hero liquidGlass className="w-full justify-center lg:w-auto lg:justify-start" />
              {creciLabel(catalog) ? (
                <p className="mx-auto inline-flex items-center justify-center rounded-full border border-white/65 bg-white/86 px-2 py-0.5 text-[11px] font-medium italic text-[#334d3f] shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_1px_0_0_rgba(255,255,255,.36),0_5px_12px_rgba(25,57,39,.09)] backdrop-blur-[19px] backdrop-saturate-[1.5] supports-[backdrop-filter]:bg-white/0 supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.50),rgba(255,255,255,.22))] sm:text-xs lg:mx-0 lg:supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.58),rgba(255,255,255,.32))]">
                  {creciLabel(catalog)}
                </p>
              ) : null}

          </div>
        </div>
      </div>

      {metrics.length ? (
        <div className={cn("relative z-10 mx-auto mt-3 grid w-full grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5", metrics.length === 5 && "grid-cols-6")}>
          {metrics.map(({ icon: Icon, value, label, wideMobile }, index) => (
            <div
              key={label}
              className={cn(
                "eme-catalog-metric-card relative grid min-h-[82px] items-center overflow-hidden rounded-[0.85rem] border border-white/80 bg-white/70 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.96),0_6px_16px_rgba(57,50,41,.06)] backdrop-blur-[18px] sm:col-span-1 sm:min-h-[132px] sm:rounded-[1rem] sm:px-3 sm:py-4 sm:shadow-[inset_0_1px_0_rgba(255,255,255,.96),0_8px_20px_rgba(57,50,41,.07)]",
                metrics.length === 5 ? (index < 3 ? "col-span-2" : "col-span-3") : wideMobile ? "col-span-2" : "col-span-1",
                wideMobile && "sm:col-span-2 sm:py-2.5 lg:col-span-1 lg:py-2.5",
              )}
            >
              <div className={cn(
                "flex items-center justify-center text-center",
                "flex-col gap-1 sm:gap-1.5",
              )}>
                <span className="relative flex size-7 items-center justify-center rounded-full border border-[#e6eee8] bg-white/72 text-[#128b41] shadow-[0_3px_8px_rgba(40,75,52,.06)] sm:size-8 sm:shadow-[0_3px_9px_rgba(40,75,52,.07)]">
                  <Icon className="size-3 sm:size-3.5" />
                </span>
                <span className="flex min-w-0 flex-col items-center text-center">
                  <strong className={cn(
                    "text-[11px] font-semibold leading-tight text-[#151b17] sm:text-[15px] sm:leading-snug",
                    wideMobile ? "max-w-full whitespace-nowrap tracking-[-0.02em]" : "line-clamp-2",
                  )}>{value}</strong>
                  <span className="mt-0.5 text-[10px] leading-3 text-[#777b78] sm:mt-1 sm:text-xs sm:leading-4">{label}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function BrokerAboutContent({ catalog, onContact }: { catalog: PublicBrokerCatalogData; onContact: () => void }) {
  const hasBiography = Boolean(catalog.bio)
  const hasArea = Boolean(catalog.serviceArea || catalog.cities.length)
  const hasSpecialties = catalog.specialties.length > 0
  const hasDifferentials = catalog.differentials.length > 0

  return (
    <section className="mx-auto grid max-w-[1240px] gap-5 px-3 pb-14 pt-8 sm:px-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.85fr)] xl:px-0">
      <div className="grid content-start gap-5">
        {hasBiography ? (
          <article className={cn(CATALOG_GLASS_SURFACE_CLASS, "rounded-[1.6rem] p-6 sm:p-8")}>
            <SectionTitle icon={Sparkles}>Sobre o corretor</SectionTitle>
            <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-[#56605a]">{catalog.bio}</div>
          </article>
        ) : null}

        {catalog.videoUrl ? (
          <article className={cn(CATALOG_GLASS_SURFACE_CLASS, "rounded-[1.6rem] p-4 sm:p-6")}>
            <h2 className="px-1 text-lg font-semibold text-[#172019]">Vídeo de apresentação</h2>
            <div className="mt-4 flex min-h-48 items-center justify-center overflow-hidden rounded-[1.1rem] bg-[#101411]">
              <video src={catalog.videoUrl} controls preload="metadata" playsInline className="h-auto max-h-[680px] w-auto max-w-full object-contain" aria-label={`Vídeo de apresentação de ${catalog.displayName}`} />
            </div>
          </article>
        ) : null}

        {hasSpecialties ? (
          <article className={cn(CATALOG_GLASS_SURFACE_CLASS, "rounded-[1.6rem] p-6")}>
            <SectionTitle icon={Star}>Especialidades</SectionTitle>
            <BrokerSpecialtyChips specialties={catalog.specialties} liquidGlass className="mt-4" />
          </article>
        ) : null}
      </div>

      <aside className="grid content-start gap-5">
        {hasArea ? (
          <article className={cn(CATALOG_GLASS_SURFACE_CLASS, "rounded-[1.6rem] p-6")}>
            <SectionTitle icon={MapPin}>Atuação</SectionTitle>
            {catalog.serviceArea ? <p className="mt-4 text-sm leading-6 text-[#66706a]">{catalog.serviceArea}</p> : null}
            {catalog.cities.length ? (
              <ul className="mt-4 grid gap-2.5">
                {catalog.cities.map((city) => <li key={city} className="flex items-center gap-2 text-sm text-[#38423c]"><CheckCircle2 className="size-4 shrink-0 text-[#19a24b]" />{city}</li>)}
              </ul>
            ) : null}
          </article>
        ) : null}

        {hasDifferentials ? (
          <article className={cn(CATALOG_GLASS_SURFACE_CLASS, "rounded-[1.6rem] p-6")}>
            <SectionTitle icon={Star}>Diferenciais</SectionTitle>
            <ul className="mt-4 grid gap-3">
              {catalog.differentials.map((differential) => <li key={differential} className="flex gap-3 text-sm leading-6 text-[#4f5953]"><span className={cn(CATALOG_ICON_SURFACE_CLASS, "mt-0.5 size-7 shrink-0")}><CheckCircle2 className="size-4" /></span><span>{differential}</span></li>)}
            </ul>
          </article>
        ) : null}

        <article id="contato" className={cn(CATALOG_GLASS_SURFACE_CLASS, "scroll-mt-32 rounded-[1.6rem] p-6")}>
          <SectionTitle icon={MessageCircle}>Atendimento</SectionTitle>
          <p className="mt-4 text-sm leading-6 text-[#66706a]">Fale diretamente com {catalog.displayName} pelos canais informados no perfil.</p>
          <ContactRows catalog={catalog} />
          <Button type="button" onClick={onContact} className={cn(CATALOG_PRIMARY_CTA_CLASS, "mt-5 h-11 w-full font-semibold")}>Ver opções de contato</Button>
        </article>
      </aside>
    </section>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Star; children: string }) {
  return <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.025em] text-[#172019]"><Icon className="size-5 text-[#159447]" />{children}</h2>
}

function ContactRows({ catalog }: { catalog: PublicBrokerCatalogData }) {
  return (
    <div className="mt-4 grid gap-2.5 text-sm text-[#3f4943]">
      {catalog.phone ? <a href={`tel:${catalog.phone}`} className="flex items-center gap-2 hover:text-[#12863d]"><Phone className="size-4 text-[#159447]" />{formatPhone(catalog.phone)}</a> : null}
      {catalog.email ? <a href={`mailto:${catalog.email}`} className="flex min-w-0 items-center gap-2 hover:text-[#12863d]"><Mail className="size-4 shrink-0 text-[#159447]" /><span className="truncate">{catalog.email}</span></a> : null}
    </div>
  )
}

export function BrokerContactDialog({ open, onOpenChange, catalog }: { open: boolean; onOpenChange: (open: boolean) => void; catalog: PublicBrokerCatalogData }) {
  const catalogUrl = buildBrokerCatalogUrl(catalog.slug)
  const whatsappUrl = catalog.whatsApp
    ? createWhatsAppUrl(catalog.whatsApp, `Olá, conheci seu catálogo no EME e quero conversar: ${catalogUrl}`)
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("marketplace-shell marketplace-popover max-w-[calc(100%-1.5rem)] rounded-[1.5rem] p-6 sm:max-w-md", CATALOG_DIALOG_SURFACE_CLASS)}>
        <DialogTitle className="text-2xl font-semibold tracking-[-0.04em]">Fale com {catalog.displayName}</DialogTitle>
        <DialogDescription className="text-[#68726c]">Escolha o canal mais conveniente para iniciar o contato.</DialogDescription>
        <ContactRows catalog={catalog} />
        <div className="mt-3 grid gap-2">
          {whatsappUrl ? <Button asChild className={cn(CATALOG_PRIMARY_CTA_CLASS, "h-11 font-semibold")}><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />Falar no WhatsApp</a></Button> : null}
          {catalog.email ? <Button asChild variant="ghost" className={cn(CATALOG_SECONDARY_CTA_CLASS, "h-11")}><a href={`mailto:${catalog.email}`}><Mail className="size-4" />Enviar e-mail</a></Button> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function BrokerCatalogFooterContact({ catalog, onContact }: { catalog: PublicBrokerCatalogData; onContact: () => void }) {
  return (
    <section id="contato" className="eme-catalog-footer-contact relative scroll-mt-32 overflow-hidden rounded-[1.15rem] border border-white/80 bg-white/70 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_8px_22px_rgba(57,50,41,.07)] backdrop-blur-[18px] sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#dce8df] bg-white/72 text-[#0d7137] shadow-[0_4px_11px_rgba(30,85,49,.08)]"><WhatsappGlyph className="size-5" /></span>
          <div><h3 className="font-semibold text-[#172019]">Ainda não encontrou o imóvel ideal?</h3><p className="mt-1 text-sm text-[#717b75]">Receba novas oportunidades diretamente pelo WhatsApp.</p></div>
        </div>
        <Button type="button" onClick={onContact} className="h-11 rounded-full bg-[#153d30] px-5 font-medium text-white shadow-[0_8px_18px_rgba(21,61,48,.16)] hover:bg-[#102f25]">Falar com o corretor <ChevronRight className="size-4 text-[#c99b49]" /></Button>
      </div>
    </section>
  )
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("")
}
