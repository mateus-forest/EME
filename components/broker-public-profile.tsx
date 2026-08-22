"use client"

import Image from "next/image"
import Link from "next/link"
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react"

import { AssistantLauncher } from "@/components/marketplace/assistant/assistant-launcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { PublicBrokerCatalogData } from "@/lib/public-catalog"
import {
  buildBrokerCatalogPath,
  buildBrokerCatalogUrl,
} from "@/lib/public-catalog-url"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import { BrokerSpecialtyChips } from "@/components/broker-specialty-chips"
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

  return (
      <header className="sticky top-0 z-50 px-2 pt-2 sm:px-5 sm:pt-5">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[1.4rem] border border-white/70 bg-white/88 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_0_-1px_0_rgba(255,255,255,.16),0_12px_32px_rgba(28,55,39,.11)] backdrop-blur-[22px] backdrop-saturate-[1.4] before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/85 before:to-transparent supports-[backdrop-filter]:bg-white/52 sm:px-5 lg:supports-[backdrop-filter]:bg-white/62">
          <div className="relative flex h-[64px] items-center gap-1.5 sm:h-[68px] sm:gap-3">
          <Link
            href={catalogPath}
            className="flex shrink-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#159447]/30"
            aria-label="EME — início do catálogo"
          >
            <Image src="/marketplace/eme-logo-raw.svg" alt="EME" width={38} height={38} className="size-8 sm:size-9" priority />
          </Link>

          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex" aria-label="Navegação do catálogo">
            <CatalogNavLink href={catalogPath} active={view !== "about"}>Imóveis</CatalogNavLink>
            <CatalogNavLink href={`${catalogPath}/sobre`} active={view === "about"}>Sobre o corretor</CatalogNavLink>
            <button type="button" onClick={onContact} className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-[#4c5551] transition hover:border-white/80 hover:bg-white/58 hover:text-[#11863d] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_7px_18px_rgba(36,58,45,.08)]">
              Contato
            </button>
          </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <AssistantLauncher
                className="relative !size-9 !shrink-0 !gap-0 !rounded-full !border-white/70 !bg-white/86 !p-0 !shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_0_-1px_0_rgba(255,255,255,.16),0_7px_16px_rgba(24,54,37,.11)] !backdrop-blur-[16px] !backdrop-saturate-[1.4] supports-[backdrop-filter]:!bg-white/52 hover:!border-white hover:!shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_8px_18px_rgba(24,54,37,.13)] sm:!size-10 lg:supports-[backdrop-filter]:!bg-white/62 [&>span:last-child]:!absolute [&>span:last-child]:!right-0.5 [&>span:last-child]:!top-0.5"
                labelClassName="sr-only"
              />
              {catalog.whatsApp ? <button type="button" onClick={onContact} className="flex size-9 items-center justify-center rounded-full border border-white/65 bg-[#159447]/88 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.42),inset_0_-1px_0_rgba(0,84,36,.12),0_8px_18px_rgba(13,119,53,.18)] backdrop-blur-[16px] backdrop-saturate-[1.4] transition hover:-translate-y-0.5 hover:bg-[#107c39]/88 supports-[backdrop-filter]:bg-[#159447]/76 sm:size-10 lg:supports-[backdrop-filter]:bg-[#159447]/82" aria-label="Falar pelo WhatsApp" title="Falar pelo WhatsApp"><WhatsappGlyph className="size-4 sm:size-4.5" /></button> : null}
              <button type="button" onClick={onShare} className="flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/86 text-[#334039] shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_0_-1px_0_rgba(255,255,255,.16),0_7px_16px_rgba(24,54,37,.11)] backdrop-blur-[16px] backdrop-saturate-[1.4] transition hover:-translate-y-0.5 hover:border-white hover:text-[#11863d] hover:shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_8px_18px_rgba(24,54,37,.13)] supports-[backdrop-filter]:bg-white/52 sm:size-10 lg:supports-[backdrop-filter]:bg-white/62" aria-label="Compartilhar catálogo" title="Compartilhar catálogo">
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
          ? "border-white/70 bg-white/84 text-[#111713] shadow-[inset_0_1px_0_rgba(255,255,255,.9),inset_0_-1px_0_rgba(255,255,255,.14),0_6px_14px_rgba(28,57,40,.09)] backdrop-blur-[15px] backdrop-saturate-[1.35] supports-[backdrop-filter]:bg-white/50 lg:supports-[backdrop-filter]:bg-white/60"
          : "border-transparent text-[#4c5551] hover:border-white/70 hover:bg-white/45 hover:text-[#11863d]",
      )}
    >
      {children}
      {active ? <span className="absolute inset-x-4 -bottom-[9px] h-0.5 rounded-full bg-[#159447] lg:-bottom-[13px]" /> : null}
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
    catalog.serviceArea
      ? { icon: Map, value: catalog.serviceArea, label: "Área de atuação" }
      : null,
    catalog.cities.length
      ? { icon: MapPin, value: `${catalog.cities.length} ${catalog.cities.length === 1 ? "cidade" : "cidades"}`, label: "Cidades atendidas" }
      : null,
    priceRange && priceRange !== "Consulte"
      ? { icon: CircleDollarSign, value: priceRange, label: "Faixa de preço", wideMobile: true }
      : null,
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))

  return (
    <section className="relative mx-auto w-full max-w-[1440px] px-3 pt-4 sm:px-4 lg:px-6">
      <div className="relative overflow-hidden rounded-[1.3rem] border border-white/70 bg-[#f6fbf6] px-0 py-0 shadow-[0_24px_62px_rgba(47,68,57,.12)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catalog.bannerUrl || PREMIUM_BANNER_FALLBACK}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(250,252,249,.86)_0%,rgba(250,252,249,.74)_46%,rgba(250,252,249,.48)_70%,rgba(250,252,249,.20)_88%,rgba(250,252,249,.05)_97%,transparent_100%)]" />

          <div className="relative z-10 grid gap-5 px-4 pb-5 pt-7 text-center sm:px-6 sm:pb-7 sm:pt-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-5 lg:pb-9 lg:pt-10 lg:text-left">
          <div className="relative z-10 mx-auto size-32 shrink-0 overflow-hidden rounded-full border-4 border-white/80 bg-white/60 shadow-[inset_0_2px_3px_rgba(255,255,255,.92),inset_0_-2px_5px_rgba(45,91,65,.10),0_10px_28px_rgba(27,47,36,.15),0_0_18px_rgba(104,194,151,.16)] ring-1 ring-white/55 before:pointer-events-none before:absolute before:inset-0 before:z-10 before:rounded-full before:shadow-[inset_0_2px_2px_rgba(255,255,255,.88),inset_0_-2px_4px_rgba(56,107,76,.10)] sm:size-36 lg:size-44 xl:size-52">
            {catalog.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={catalog.photoUrl} alt={catalog.displayName} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#edf7ef] text-4xl font-semibold text-[#168a40]">
                {getInitials(catalog.displayName)}
              </div>
            )}
          </div>

            <div className="relative z-10 min-w-0 max-w-[38rem] space-y-3 pb-2 text-center lg:pt-4 lg:text-left lg:pb-0">
              <div className="flex flex-wrap items-start justify-center gap-2.5 lg:justify-start">
                <h1 className="max-w-full text-[2rem] font-light leading-tight tracking-[-0.04em] text-[#08110b] [text-shadow:0_1px_18px_rgba(255,255,255,.7)] sm:text-[2.35rem] lg:text-[3.2rem]">
                  {catalog.displayName}
                </h1>
                {catalog.creciVerified ? (
                  <BadgeCheck className="mt-1.5 size-5 shrink-0 fill-[#17a24c] text-white sm:size-6 lg:mt-2" aria-label="CRECI verificado" />
                ) : null}
              </div>

              <BrokerSpecialtyChips specialties={catalog.specialties} compact hero liquidGlass className="w-full justify-center lg:w-auto lg:justify-start" />
              {creciLabel(catalog) ? (
                <p className="mx-auto inline-flex items-center justify-center rounded-full border border-white/70 bg-white/86 px-2 py-0.5 text-[11px] font-medium italic text-[#334d3f] shadow-[inset_0_1px_0_rgba(255,255,255,.9),inset_0_-1px_0_rgba(255,255,255,.14),0_6px_14px_rgba(25,57,39,.09)] backdrop-blur-[16px] backdrop-saturate-[1.35] supports-[backdrop-filter]:bg-white/50 sm:text-xs lg:mx-0 lg:supports-[backdrop-filter]:bg-white/60">
                  {creciLabel(catalog)}
                </p>
              ) : null}

          </div>
        </div>
      </div>

      {metrics.length ? (
        <div className="relative z-10 mx-auto mt-3 grid w-full max-w-[1440px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {metrics.map(({ icon: Icon, value, label, wideMobile }) => (
            <div
              key={label}
              className={cn(
                "relative grid items-center overflow-hidden rounded-[1.2rem] border border-white/70 bg-white/84 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_0_-1px_0_rgba(255,255,255,.14),0_10px_24px_rgba(26,57,39,.10)] backdrop-blur-[18px] backdrop-saturate-[1.4] before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent supports-[backdrop-filter]:bg-white/52 lg:supports-[backdrop-filter]:bg-white/62",
                wideMobile && "col-span-2 py-2.5 sm:col-span-2 lg:col-span-1 lg:py-2.5",
              )}
            >
              <div className={cn(
                "flex items-center justify-center text-center",
                wideMobile ? "flex-col gap-1" : "flex-col gap-1.5",
              )}>
                <span className="relative flex size-7 items-center justify-center rounded-full border border-white/70 bg-white/76 text-[#128b41] shadow-[inset_0_1px_0_rgba(255,255,255,.9),inset_0_-1px_0_rgba(255,255,255,.12),0_5px_12px_rgba(23,92,49,.09)] backdrop-blur-[12px] backdrop-saturate-[1.3] supports-[backdrop-filter]:bg-white/50">
                  <Icon className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-col items-center text-center">
                  <strong className={cn(
                    "text-sm font-semibold leading-snug text-[#151b17] sm:text-base",
                    wideMobile ? "max-w-full whitespace-nowrap tracking-[-0.02em]" : "line-clamp-2",
                  )}>{value}</strong>
                  <span className={cn("text-xs leading-4 text-[#7a837e]", wideMobile && "mt-0.5")}>{label}</span>
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
    <section className="mx-auto grid max-w-[1280px] gap-5 px-3 pb-14 pt-8 sm:px-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.85fr)]">
      <div className="grid content-start gap-5">
        {hasBiography ? (
          <article className="rounded-[1.6rem] border border-[#e8eee9] bg-white p-6 shadow-[0_16px_42px_rgba(43,61,52,.055)] sm:p-8">
            <SectionTitle icon={Sparkles}>Sobre o corretor</SectionTitle>
            <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-[#56605a]">{catalog.bio}</div>
          </article>
        ) : null}

        {catalog.videoUrl ? (
          <article className="rounded-[1.6rem] border border-[#e8eee9] bg-white p-4 shadow-[0_16px_42px_rgba(43,61,52,.055)] sm:p-6">
            <h2 className="px-1 text-lg font-semibold text-[#172019]">Vídeo de apresentação</h2>
            <div className="mt-4 flex min-h-48 items-center justify-center overflow-hidden rounded-[1.1rem] bg-[#101411]">
              <video src={catalog.videoUrl} controls preload="metadata" playsInline className="h-auto max-h-[680px] w-auto max-w-full object-contain" aria-label={`Vídeo de apresentação de ${catalog.displayName}`} />
            </div>
          </article>
        ) : null}

        {hasSpecialties ? (
          <article className="rounded-[1.6rem] border border-[#e8eee9] bg-white p-6 shadow-[0_16px_42px_rgba(43,61,52,.055)]">
            <SectionTitle icon={Star}>Especialidades</SectionTitle>
            <BrokerSpecialtyChips specialties={catalog.specialties} liquidGlass className="mt-4" />
          </article>
        ) : null}
      </div>

      <aside className="grid content-start gap-5">
        {hasArea ? (
          <article className="rounded-[1.6rem] border border-[#e8eee9] bg-white p-6 shadow-[0_16px_42px_rgba(43,61,52,.055)]">
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
          <article className="rounded-[1.6rem] border border-[#e8eee9] bg-white p-6 shadow-[0_16px_42px_rgba(43,61,52,.055)]">
            <SectionTitle icon={Star}>Diferenciais</SectionTitle>
            <ul className="mt-4 grid gap-3">
              {catalog.differentials.map((differential) => <li key={differential} className="flex gap-3 text-sm leading-6 text-[#4f5953]"><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef9f1] text-[#159447]"><CheckCircle2 className="size-4" /></span><span>{differential}</span></li>)}
            </ul>
          </article>
        ) : null}

        <article id="contato" className="scroll-mt-32 rounded-[1.6rem] border border-[#e8eee9] bg-white p-6 shadow-[0_16px_42px_rgba(43,61,52,.055)]">
          <SectionTitle icon={MessageCircle}>Atendimento</SectionTitle>
          <p className="mt-4 text-sm leading-6 text-[#66706a]">Fale diretamente com {catalog.displayName} pelos canais informados no perfil.</p>
          <ContactRows catalog={catalog} />
          <Button type="button" onClick={onContact} className="mt-5 h-11 w-full rounded-xl bg-[#159447] font-semibold text-white hover:bg-[#107c39]">Ver opções de contato</Button>
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
      {catalog.phone ? <a href={`tel:${catalog.phone}`} className="flex items-center gap-2 hover:text-[#12863d]"><Phone className="size-4 text-[#159447]" />{catalog.phone}</a> : null}
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
      <DialogContent className="marketplace-shell marketplace-popover max-w-[calc(100%-1.5rem)] rounded-[1.5rem] border-[#e4ebe5] bg-white p-6 text-[#19211c] shadow-[0_28px_75px_rgba(32,48,39,.18)] sm:max-w-md">
        <DialogTitle className="text-2xl font-semibold tracking-[-0.04em]">Fale com {catalog.displayName}</DialogTitle>
        <DialogDescription className="text-[#68726c]">Escolha o canal mais conveniente para iniciar o contato.</DialogDescription>
        <ContactRows catalog={catalog} />
        <div className="mt-3 grid gap-2">
          {whatsappUrl ? <Button asChild className="h-11 rounded-xl bg-[#159447] font-semibold text-white hover:bg-[#107c39]"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />Falar no WhatsApp</a></Button> : null}
          {catalog.email ? <Button asChild variant="ghost" className="h-11 rounded-xl border border-[#e3eae4] text-[#344038] hover:bg-[#f5f8f5]"><a href={`mailto:${catalog.email}`}><Mail className="size-4" />Enviar e-mail</a></Button> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function BrokerCatalogFooterContact({ catalog, onContact }: { catalog: PublicBrokerCatalogData; onContact: () => void }) {
  return (
    <section id="contato" className="scroll-mt-32 rounded-[1.5rem] border border-[#e5ebe6] bg-white px-5 py-5 shadow-[0_14px_36px_rgba(43,61,52,.05)] sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#edf9f1] text-[#159447]"><MessageCircle className="size-5" /></span>
          <div><h3 className="font-semibold text-[#172019]">Ainda não encontrou o imóvel ideal?</h3><p className="mt-1 text-sm text-[#717b75]">Receba novas oportunidades diretamente pelo WhatsApp.</p></div>
        </div>
        <Button type="button" onClick={onContact} variant="ghost" className="h-11 rounded-full border border-[#bfe0c8] px-5 font-semibold text-[#178b42] hover:bg-[#f1faf4]">Falar com o corretor</Button>
      </div>
    </section>
  )
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("")
}
