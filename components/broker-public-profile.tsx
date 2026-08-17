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
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="mx-auto max-w-[1280px] rounded-[1.4rem] border border-white/70 bg-white/88 px-3 shadow-[0_18px_55px_rgba(40,58,49,.09)] backdrop-blur-2xl sm:px-5">
        <div className="flex h-[68px] items-center gap-3">
          <Link href={catalogPath} className="flex shrink-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#159447]/30" aria-label="EME — início do catálogo">
            <Image src="/marketplace/eme-logo-raw.svg" alt="EME" width={38} height={38} className="size-8 sm:size-9" priority />
            <span className="text-[1.45rem] font-bold tracking-[-0.06em] text-[#121715]">eme</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Navegação do catálogo">
            <CatalogNavLink href={catalogPath} active={view !== "about"}>Imóveis</CatalogNavLink>
            <CatalogNavLink href={`${catalogPath}/sobre`} active={view === "about"}>Sobre o corretor</CatalogNavLink>
            <button type="button" onClick={onContact} className="rounded-full px-4 py-2 text-sm font-medium text-[#4c5551] transition hover:bg-[#f3f7f3] hover:text-[#11863d]">
              Contato
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <AssistantLauncher labelClassName="hidden sm:inline" />
            <button type="button" onClick={onShare} className="flex size-10 items-center justify-center rounded-full border border-[#e5ebe6] bg-white text-[#3b4540] shadow-sm transition hover:-translate-y-0.5 hover:text-[#11863d] sm:w-auto sm:gap-2 sm:px-4" aria-label="Compartilhar catálogo">
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-[#edf1ed] py-2 lg:hidden" aria-label="Navegação do catálogo mobile">
          <CatalogNavLink href={catalogPath} active={view !== "about"}>Imóveis</CatalogNavLink>
          <CatalogNavLink href={`${catalogPath}/sobre`} active={view === "about"}>Sobre o corretor</CatalogNavLink>
          <button type="button" onClick={onContact} className="shrink-0 rounded-full px-3 py-2 text-xs font-medium text-[#4c5551]">Contato</button>
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
        "relative shrink-0 rounded-full px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm",
        active ? "bg-[#f2f7f3] text-[#111713]" : "text-[#4c5551] hover:bg-[#f7f9f7] hover:text-[#11863d]",
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
  onShare,
  onWhatsApp,
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
      ? { icon: CircleDollarSign, value: priceRange, label: "Faixa de preço" }
      : null,
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))

  return (
    <section className="relative mx-auto w-full max-w-[1440px] px-2 pt-5 sm:px-4 sm:pt-7 lg:px-6">
      <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_78px_rgba(47,68,57,.12)] sm:min-h-[500px] lg:min-h-[560px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={catalog.bannerUrl || PREMIUM_BANNER_FALLBACK} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,246,.96)_0%,rgba(248,250,246,.88)_30%,rgba(248,250,246,.55)_52%,rgba(248,250,246,.16)_70%,rgba(248,250,246,.0)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#f7fbf7] via-[#f7fbf7]/50 to-transparent" />
        <div className="absolute -bottom-16 -left-16 size-72 rounded-full bg-[#bdf3ce]/45 blur-3xl" />

        <div className="relative flex min-h-[440px] flex-col items-center justify-center gap-6 px-5 pb-16 pt-8 text-center sm:min-h-[500px] sm:px-10 lg:flex-row lg:items-start lg:justify-start lg:gap-10 lg:px-12 lg:py-14 lg:text-left">
          <div className="relative size-40 shrink-0 overflow-hidden rounded-full border-4 border-white/95 bg-white shadow-[0_20px_55px_rgba(27,47,36,.16)] sm:size-48 md:size-52 lg:size-60">
            {catalog.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={catalog.photoUrl} alt={catalog.displayName} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#edf7ef] text-4xl font-semibold text-[#168a40]">
                {getInitials(catalog.displayName)}
              </div>
            )}
          </div>

          <div className="min-w-0 max-w-3xl">
            <h1 className="flex flex-wrap items-center justify-center gap-2.5 text-[2.9rem] font-semibold leading-none tracking-[-0.055em] text-[#0f1411] sm:text-[3.9rem] lg:justify-start lg:text-[4.1rem]">
              {catalog.displayName}
              {catalog.creciVerified ? <BadgeCheck className="size-7 fill-[#17a24c] text-white sm:size-8" aria-label="CRECI verificado" /> : null}
            </h1>
            {catalog.description ? <p className="mt-5 text-lg font-medium leading-snug text-[#2f3833] sm:text-2xl">{catalog.description}</p> : null}
            {creciLabel(catalog) ? <p className="mt-3 text-sm font-medium text-[#5f6a64]">{creciLabel(catalog)}</p> : null}
            <div className="mt-8 flex flex-wrap justify-center gap-3.5 lg:justify-start">
              {catalog.whatsApp ? (
                <Button type="button" onClick={onWhatsApp} className="h-11 rounded-full bg-[#159447] px-6 font-semibold text-white shadow-[0_12px_26px_rgba(21,148,71,.24)] hover:bg-[#107c39]">
                  <MessageCircle className="size-4" /> WhatsApp
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={onShare} className="h-11 rounded-full border border-[#dfe7e1] bg-white/92 px-6 font-semibold text-[#26302a] shadow-sm hover:bg-white">
                <Share2 className="size-4" /> Compartilhar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {metrics.length ? (
        <div className="relative z-10 -mt-20 grid grid-cols-2 overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/94 shadow-[0_22px_52px_rgba(43,61,52,.1)] backdrop-blur-xl sm:grid-flow-col sm:auto-cols-fr">
          {metrics.map(({ icon: Icon, value, label }, index) => (
            <div key={label} className={cn(
              "flex min-h-[124px] flex-col items-center justify-center px-4 py-5 text-center sm:min-h-[132px] lg:border-t-0",
              index > 1 && "border-t border-[#edf0ed]",
              index % 2 === 1 && "border-l border-[#edf0ed]",
              index > 0 && "lg:border-l lg:border-[#edf0ed]",
              metrics.length % 2 === 1 && index === metrics.length - 1 && "col-span-2 lg:col-span-1",
            )}>
              <span className="flex size-8 items-center justify-center rounded-full border border-[#dfece2] bg-[#f5fbf6] text-[#159447]"><Icon className="size-4" /></span>
              <strong className="mt-2 line-clamp-2 text-sm font-semibold text-[#151b17] sm:text-base">{value}</strong>
              <span className="mt-1 text-xs text-[#7a837e]">{label}</span>
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
            <div className="mt-4 flex flex-wrap gap-2">
              {catalog.specialties.map((specialty) => <span key={specialty} className="rounded-full border border-[#dceadf] bg-[#f5fbf6] px-4 py-2 text-sm font-medium text-[#287543]">{specialty}</span>)}
            </div>
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
