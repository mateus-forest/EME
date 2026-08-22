"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bath,
  Bed,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"

import type {
  PublicAgencyCatalogData,
  PublicBrokerCatalogData,
} from "@/lib/public-catalog"
import { createPublicLead } from "@/lib/lead-client"
import {
  buildAgencyCatalogListingPath,
  buildAgencyCatalogPath,
  buildAgencyCatalogUrl,
  buildBrokerCatalogListingPath,
  buildBrokerCatalogPath,
  buildBrokerCatalogUrl,
} from "@/lib/public-catalog-url"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { normalizePhone } from "@/lib/structured-fields"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  CATALOG_DIALOG_SURFACE_CLASS,
  CATALOG_GLASS_SURFACE_CLASS,
  CATALOG_ICON_SURFACE_CLASS,
  CATALOG_INPUT_CLASS,
  CATALOG_PAGE_BACKGROUND_CLASS,
  CATALOG_PRIMARY_CTA_CLASS,
  CATALOG_SECONDARY_CTA_CLASS,
} from "@/lib/catalog-visual-system"
import { WhatsappGlyph } from "@/components/marketplace/property/whatsapp-glyph"
import {
  BrokerAboutContent,
  BrokerCatalogFooterContact,
  BrokerCatalogHeader,
  BrokerContactDialog,
  BrokerProfileHero,
} from "@/components/broker-public-profile"

type CatalogKind = "broker" | "agency"

type CatalogProperty = {
  id: string
  publicCode?: number | null
  title: string
  location: string
  city: string
  neighborhood: string
  price: string
  priceValue: number
  bedrooms: number
  bathrooms: number
  parking: number
  type: string
  purpose: string
  description: string
  images: string[]
  views: number
  leads: number
  brokerId: string
  agencyId: string | null
  brokerName?: string
}

type PublicCatalogLandingProps = {
  kind: CatalogKind
  slug: string
  catalog: PublicBrokerCatalogData | PublicAgencyCatalogData
  listingOnly?: boolean
  profileOnly?: boolean
}

type LeadDraft = {
  property: CatalogProperty
  name: string
  phone: string
  message: string
}

function FinancingField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1 text-[11px] font-medium text-[#667085]"><span>{label}</span>{children}</label>
}

function parseCurrencyInputToCents(value: string) {
  const digits = value.replace(/\D/g, "")
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function parseDecimalInput(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function calculateFixedInstallment(principalInCents: number, installments: number, monthlyRate: number) {
  if (principalInCents <= 0 || installments <= 0) return 0
  if (monthlyRate === 0) return Math.round(principalInCents / installments)

  const factor = Math.pow(1 + monthlyRate, installments)
  return Math.round(principalInCents * ((monthlyRate * factor) / (factor - 1)))
}

function formatCurrencyFromCents(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

type CatalogAdvancedFilters = {
  type: string
  city: string
  neighborhood: string
  bedrooms: string
  parking: string
  maxPrice: string
  feature: string
}

const quickSuggestions = [
  "Alto padrão",
  "Até R$ 1 milhão",
  "Coberturas",
  "Frente mar",
  "Investimento",
  "Casas",
  "Mais filtros",
]

export function PublicCatalogLanding({
  kind,
  slug,
  catalog,
  listingOnly = false,
  profileOnly = false,
}: PublicCatalogLandingProps) {
  const [search, setSearch] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<CatalogAdvancedFilters>({
    type: "",
    city: "",
    neighborhood: "",
    bedrooms: "",
    parking: "",
    maxPrice: "",
    feature: "",
  })
  const [selectedProperty, setSelectedProperty] = useState<CatalogProperty | null>(null)
  const [leadDraft, setLeadDraft] = useState<LeadDraft | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [leadFeedback, setLeadFeedback] = useState("")
  const [isSavingLead, setIsSavingLead] = useState(false)
  const [showPortalBackButton, setShowPortalBackButton] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [financingEntry, setFinancingEntry] = useState("")
  const [financingInstallments, setFinancingInstallments] = useState("360")
  const [financingInterest, setFinancingInterest] = useState("0,89")
  const [financingOpen, setFinancingOpen] = useState(false)
  const properties = useMemo(() => normalizeProperties(catalog), [catalog])
  const searchAnalysis = useMemo(() => analyzeSearch(search), [search])
  const visibleProperties = useMemo(
    () => rankProperties(properties, searchAnalysis, advancedFilters),
    [advancedFilters, properties, searchAnalysis],
  )
  const publicPath =
    kind === "broker" ? buildBrokerCatalogPath(catalog.slug || slug) : buildAgencyCatalogPath(catalog.slug || slug)
  const listingPath =
    kind === "broker"
      ? buildBrokerCatalogListingPath(catalog.slug || slug)
      : buildAgencyCatalogListingPath(catalog.slug || slug)
  const catalogUrl =
    kind === "broker" ? buildBrokerCatalogUrl(catalog.slug || slug) : buildAgencyCatalogUrl(catalog.slug || slug)
  const image = (selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0] ?? "").trim()
  const cities = useMemo(
    () => Array.from(new Set(properties.map((property) => property.city).filter(Boolean))),
    [properties],
  )
  const neighborhoods = useMemo(
    () => Array.from(new Set(properties.map((property) => property.neighborhood).filter(Boolean))).sort(),
    [properties],
  )
  const priceRange = getPriceRangeLabel(properties)
  const avatarUrl = kind === "broker" ? (catalog as PublicBrokerCatalogData).photoUrl : (catalog as PublicAgencyCatalogData).logoUrl
  const creci = kind === "broker" ? (catalog as PublicBrokerCatalogData).creci : ""
  const brokerCatalog = kind === "broker" ? catalog as PublicBrokerCatalogData : null
  const propertyValue = selectedProperty?.priceValue ?? 0
  const entryValue = Math.min(propertyValue, parseCurrencyInputToCents(financingEntry))
  const financedValue = Math.max(0, propertyValue - entryValue)
  const installmentCount = Math.min(600, Math.max(1, Number.parseInt(financingInstallments, 10) || 1))
  const monthlyInterest = Math.max(0, parseDecimalInput(financingInterest)) / 100
  const estimatedInstallment = calculateFixedInstallment(financedValue, installmentCount, monthlyInterest)

  useEffect(() => {
    if (!selectedProperty) return
    setFinancingEntry("")
    setFinancingInstallments("360")
    setFinancingInterest("0,89")
    setFinancingOpen(false)
  }, [selectedProperty])

  useEffect(() => {
    void trackCatalogEvent({
      eventType: "catalog_view",
      catalogSlug: catalog.slug || slug,
      catalogType: kind,
    })
  }, [catalog.slug, kind, slug])

  useEffect(() => {
    setShowPortalBackButton(new URLSearchParams(window.location.search).get("from") === "portal")
  }, [])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`eme-catalog-favorites:${catalog.slug || slug}`)
      const ids = stored ? JSON.parse(stored) : []
      if (Array.isArray(ids)) setFavoriteIds(new Set(ids.filter((id): id is string => typeof id === "string")))
    } catch {
      setFavoriteIds(new Set())
    }
  }, [catalog.slug, slug])

  useEffect(() => {
    if (kind !== "broker") return

    function openAssistantProperty(event: Event) {
      const propertyId = (event as CustomEvent<unknown>).detail
      if (typeof propertyId !== "string") return
      const property = properties.find((item) => item.id === propertyId)
      if (!property) return
      setSelectedProperty(property)
      setCurrentImageIndex(0)
      void trackCatalogEvent({
        eventType: "property_view",
        catalogSlug: catalog.slug || slug,
        catalogType: kind,
        propertyId: property.id,
      })
    }

    window.addEventListener("eme:catalog-open-property", openAssistantProperty)
    const openAssistantContact = () => setContactOpen(true)
    window.addEventListener("eme:catalog-open-contact", openAssistantContact)
    return () => {
      window.removeEventListener("eme:catalog-open-property", openAssistantProperty)
      window.removeEventListener("eme:catalog-open-contact", openAssistantContact)
    }
  }, [catalog.slug, kind, properties, slug])

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(""), 1800)
  }

  async function shareUrl(url: string, title: string, text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }

      await navigator.clipboard.writeText(url)
      showFeedback("Link copiado")
    } catch {
      await navigator.clipboard.writeText(url).catch(() => null)
      showFeedback("Link copiado")
    }
  }

  function openProperty(property: CatalogProperty) {
    setSelectedProperty(property)
    setCurrentImageIndex(0)
    void trackCatalogEvent({
      eventType: "property_view",
      catalogSlug: catalog.slug || slug,
      catalogType: kind,
      propertyId: property.id,
    })
  }

  function submitSearch() {
    const query = search.trim()
    if (!query && !hasActiveAdvancedFilters(advancedFilters)) return

    void trackCatalogEvent({
      eventType: "catalog_search",
      catalogSlug: catalog.slug || slug,
      catalogType: kind,
      query,
      resultCount: visibleProperties.length,
    })
  }

  function openLeadModal(property: CatalogProperty) {
    const propertyUrl = `${catalogUrl}#imovel-${property.id}`
    setLeadFeedback("")
    setLeadDraft({
      property,
      name: "",
      phone: "",
      message: `Olá, tenho interesse no imóvel ${property.title}: ${propertyUrl}`,
    })
  }

  function openCatalogWhatsApp() {
    if (!catalog.whatsApp) {
      showFeedback("Contato indisponível no momento")
      return
    }
    window.open(
      createWhatsAppUrl(catalog.whatsApp, `Olá, quero saber mais sobre o catálogo ${catalogUrl}`),
      "_blank",
      "noopener,noreferrer",
    )
    void trackCatalogEvent({
      eventType: "whatsapp_click",
      catalogSlug: catalog.slug || slug,
      catalogType: kind,
    })
  }

  function toggleFavorite(propertyId: string) {
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      try {
        window.localStorage.setItem(`eme-catalog-favorites:${catalog.slug || slug}`, JSON.stringify([...next]))
      } catch {
        // Favoritar continua funcionando durante a sessão quando o armazenamento não está disponível.
      }
      return next
    })
  }

  async function submitLead() {
    if (!leadDraft) return
    const name = leadDraft.name.trim()

    if (!name) {
      setLeadFeedback("Informe seu nome para continuar.")
      return
    }

    setIsSavingLead(true)
    setLeadFeedback("")

    const propertyUrl = `${catalogUrl}#imovel-${leadDraft.property.id}`
    const whatsappMessage = `Olá, tenho interesse no imóvel ${leadDraft.property.title}: ${propertyUrl}. Meu nome é ${name}.`

    try {
      await createPublicLead({
        propertyId: leadDraft.property.id,
        catalogSlug: catalog.slug || slug,
        catalogType: kind,
        source: "catalog",
        name,
        phone: normalizePhone(leadDraft.phone),
        message: leadDraft.message,
        searchTerm: search.trim(),
        intent: searchAnalysis.intent,
      })

      if (!catalog.whatsApp) {
        setLeadFeedback("Interesse registrado. O responsável pelo catálogo receberá seu contato.")
        setLeadDraft(null)
        return
      }

      window.open(createWhatsAppUrl(catalog.whatsApp, whatsappMessage), "_blank", "noopener,noreferrer")
      void trackCatalogEvent({
        eventType: "whatsapp_click",
        catalogSlug: catalog.slug || slug,
        catalogType: kind,
        propertyId: leadDraft.property.id,
      })
      setLeadDraft(null)
    } catch (caughtError) {
      setLeadFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível registrar seu interesse.")
    } finally {
      setIsSavingLead(false)
    }
  }

  return (
    <main className={kind === "broker" ? CATALOG_PAGE_BACKGROUND_CLASS : "min-h-screen overflow-x-hidden bg-[#f6f1e9] px-0 py-0 font-[family-name:var(--font-geist-sans)] text-[#1f2937] sm:bg-[#f8f5f1] sm:px-6 sm:py-6 lg:px-8 lg:py-8"}>
      {brokerCatalog ? (
        <BrokerCatalogHeader
          catalog={brokerCatalog}
          view={profileOnly ? "about" : listingOnly ? "listing" : "properties"}
          onContact={() => setContactOpen(true)}
          onShare={() => void shareUrl(catalogUrl, catalog.displayName, "Veja este catálogo de imóveis")}
        />
      ) : null}
      {brokerCatalog && feedback ? (
        <div role="status" className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-[#172019] px-4 py-2 text-sm font-medium text-white shadow-xl">
          {feedback}
        </div>
      ) : null}

      <div className={kind === "broker" ? cn("mx-auto grid max-w-[1240px] min-w-0 gap-5 px-3 pb-8 pt-4 sm:gap-6 sm:px-5 xl:px-0", listingOnly && "pt-6") : "mx-auto grid max-w-[1360px] min-w-0 gap-6 px-4 py-4 sm:gap-10 sm:px-0 sm:py-0 lg:gap-12"}>
        {showPortalBackButton ? (
          <div className="sticky top-3 z-30 flex justify-start">
            <Button asChild variant="ghost" className="h-10 rounded-full border border-black/[0.06] bg-white/90 px-4 text-sm text-[#4B5563] shadow-sm backdrop-blur-md hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/catalogo">Voltar ao portal</Link>
            </Button>
          </div>
        ) : null}

        {brokerCatalog && !listingOnly ? (
          <BrokerProfileHero
            catalog={brokerCatalog}
            priceRange={brokerCatalog.priceRange || priceRange}
            onShare={() => void shareUrl(catalogUrl, catalog.displayName, "Veja este catálogo de imóveis")}
            onWhatsApp={openCatalogWhatsApp}
          />
        ) : null}

        {!listingOnly && kind !== "broker" ? (
        <section className="overflow-hidden rounded-[2rem] border border-[#ece5dc] bg-white px-6 py-6 shadow-[0_20px_54px_rgba(15,23,42,0.05)] sm:px-8 sm:py-7 lg:px-10 lg:py-8">
          <div className="grid gap-6 lg:grid-cols-[170px_minmax(0,1fr)_520px] lg:items-center lg:gap-8">
            <div className="flex justify-center lg:justify-start">
              <Avatar className="size-28 border border-[#ece6de] shadow-[0_10px_28px_rgba(15,23,42,0.08)] sm:size-32">
                <AvatarImage src={avatarUrl} alt={catalog.displayName} className="size-full object-cover object-center" />
                <AvatarFallback className="bg-[#eef9f1] text-2xl font-semibold text-[#009b3a]">
                  {getInitials(catalog.displayName)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="min-w-0 text-center lg:text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-[#6a6a6a]">
                Catálogo da imobiliária
              </p>
              <h1 className="mt-2 text-[2.9rem] font-semibold tracking-[-0.055em] text-[#111111] sm:text-[3.65rem]">
                {catalog.displayName || "Catálogo EME"}
              </h1>
              <p className="mt-3 text-[1.04rem] leading-7 text-[#5f5f5f]">
                {catalog.description || "Corretor especialista em imóveis de alto padrão."}
              </p>
              {creci ? <p className="mt-1.5 text-[0.95rem] text-[#707070]">CRECI {creci}</p> : null}

              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button
                  type="button"
                  onClick={() => {
                    if (!catalog.whatsApp) {
                      showFeedback("Contato indisponível no momento")
                      return
                    }
                    window.open(createWhatsAppUrl(catalog.whatsApp, `Olá, quero saber mais sobre o catálogo ${catalogUrl}`), "_blank", "noopener,noreferrer")
                    void trackCatalogEvent({
                      eventType: "whatsapp_click",
                      catalogSlug: catalog.slug || slug,
                      catalogType: kind,
                    })
                  }}
                  className="h-11 rounded-full bg-[#3d9751] px-6 text-sm font-medium text-white shadow-[0_10px_24px_rgba(61,151,81,0.18)] hover:bg-[#347f46]"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void shareUrl(catalogUrl, catalog.displayName, "Veja este catálogo de imóveis")}
                  className="h-11 rounded-full border border-[#e6dfd7] bg-white px-6 text-sm font-medium text-[#2f2f2f] shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:bg-[#faf8f5]"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
                {feedback ? <span className="inline-flex items-center text-sm text-[#009b3a]">{feedback}</span> : null}
              </div>
            </div>

            <div className="grid overflow-hidden rounded-[1.6rem] bg-[#fdfcfa] grid-cols-2 sm:grid-cols-2 lg:border-l lg:border-[#f0e9e1] lg:grid-cols-2">
              <MetricStat icon={Home} label="Imóveis" value={String(properties.length)} />
              <MetricStat icon={MapPin} label="Cidades" value={cities.length ? String(cities.length) : "A consultar"} />
              <MetricStat
                icon={CircleDollarSign}
                label="Faixa de preço"
                value={priceRange}
                fullWidthOnMobile
                fullWidthOnDesktop
                valueClassName="whitespace-nowrap text-[1.45rem] sm:text-[1.7rem]"
              />
            </div>
          </div>
        </section>
        ) : null}

        {brokerCatalog && profileOnly ? (
          <BrokerAboutContent catalog={brokerCatalog} onContact={() => setContactOpen(true)} />
        ) : null}

        {!profileOnly && !listingOnly ? (
        <section className={kind === "broker" ? "relative overflow-hidden rounded-[1.15rem] border border-white/80 bg-white/70 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,.96),0_10px_26px_rgba(57,50,41,.07)] backdrop-blur-[18px] sm:px-8 sm:py-8 lg:px-10" : "rounded-[2rem] bg-white px-4 py-4 shadow-[0_18px_46px_rgba(15,23,42,0.05)] sm:px-7 sm:py-8 lg:px-12 lg:py-10"}>
          <div className="mx-auto max-w-none">
            <h2 className="text-[1.3rem] font-semibold tracking-[-0.045em] text-[#111111] sm:text-[2rem]">
              Encontre seu próximo imóvel
            </h2>
            <p className="mt-1.5 text-[13px] leading-5 text-[#6b6b6b] sm:mt-2 sm:text-[0.98rem] sm:leading-7">
              Busque por bairro, cidade ou característica.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#9a9a9a] sm:left-5 sm:size-5" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSearch()
                  }}
                  placeholder="Ex.: apartamento em Porto Alegre até 900 mil com 2 quartos e vaga"
                  className="h-[3rem] rounded-[0.85rem] border-[#e7e3dc] bg-white/78 pl-11 pr-4 text-[13px] text-[#111111] shadow-[0_6px_15px_rgba(55,49,41,.07)] placeholder:text-[#7f817f] focus-visible:ring-1 focus-visible:ring-[#d9d2c6] sm:h-[3.55rem] sm:pl-12 sm:text-[15px]"
                />
              </div>
              <Button
                type="button"
                onClick={submitSearch}
                className="h-[3rem] rounded-[0.85rem] bg-[#153d30] px-5 text-sm font-medium text-white shadow-[0_10px_22px_rgba(21,61,48,.16)] hover:bg-[#102f25] sm:h-[3.55rem] sm:px-6 sm:text-[15px]"
              >
                Buscar
                <ChevronRight className="size-4 text-[#c99b49]" />
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-1.5 sm:flex sm:flex-wrap">
              {quickSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    if (suggestion === "Mais filtros") {
                      setShowAdvancedFilters((current) => !current)
                      return
                    }

                    setSearch(suggestion)
                  }}
                  className={cn(
                      "inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#e6e2db] bg-white/64 px-2 text-[10px] font-medium text-[#303330] shadow-[0_3px_9px_rgba(53,47,39,.05)] transition hover:border-[#d8d1c7] hover:bg-white/82 sm:h-8 sm:px-3 sm:text-xs",
                    index < 4 ? "col-span-3" : "col-span-2",
                  )}
                >
                  {getSuggestionIcon(suggestion)}
                  {suggestion}
                </button>
              ))}
            </div>

            {showAdvancedFilters ? (
              <div className="mt-5 grid gap-4 rounded-[1.4rem] border border-[#ece5dc] bg-[#fcfbf8] p-5 lg:grid-cols-4">
                <FilterField label="Tipo">
                  <select
                    value={advancedFilters.type}
                    onChange={(event) => setAdvancedFilters((current) => ({ ...current, type: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111111] outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="Apartamento">Apartamento</option>
                    <option value="Casa">Casa</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </FilterField>
                <FilterField label="Cidade">
                  <select
                    value={advancedFilters.city}
                    onChange={(event) => setAdvancedFilters((current) => ({ ...current, city: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111111] outline-none"
                  >
                    <option value="">Todas</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Bairro">
                  <select
                    value={advancedFilters.neighborhood}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, neighborhood: event.target.value }))
                    }
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111111] outline-none"
                  >
                    <option value="">Todos</option>
                    {neighborhoods.map((neighborhood) => (
                      <option key={neighborhood} value={neighborhood}>
                        {neighborhood}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Preço máximo">
                  <Input
                    value={advancedFilters.maxPrice}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, maxPrice: event.target.value }))
                    }
                    placeholder="900 mil"
                    className="h-11 rounded-xl border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9a9a9a]"
                  />
                </FilterField>
                <FilterField label="Dormitórios">
                  <Input
                    value={advancedFilters.bedrooms}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, bedrooms: event.target.value }))
                    }
                    placeholder="2"
                    className="h-11 rounded-xl border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9a9a9a]"
                  />
                </FilterField>
                <FilterField label="Vagas">
                  <Input
                    value={advancedFilters.parking}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, parking: event.target.value }))
                    }
                    placeholder="1"
                    className="h-11 rounded-xl border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9a9a9a]"
                  />
                </FilterField>
                <FilterField label="Características">
                  <Input
                    value={advancedFilters.feature}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, feature: event.target.value }))
                    }
                    placeholder="sacada, piscina, suíte"
                    className="h-11 rounded-xl border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9a9a9a]"
                  />
                </FilterField>
                <div className="flex items-end gap-3">
                  <Button
                    type="button"
                    onClick={submitSearch}
                    className="h-11 rounded-xl bg-[#3d9751] px-5 text-sm font-medium text-white hover:bg-[#347f46]"
                  >
                    Aplicar filtros
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setAdvancedFilters({
                        type: "",
                        city: "",
                        neighborhood: "",
                        bedrooms: "",
                        parking: "",
                        maxPrice: "",
                        feature: "",
                      })
                    }
                    className="h-11 rounded-xl border border-[#e6dfd7] bg-white px-5 text-sm font-medium text-[#2f2f2f] hover:bg-[#faf8f5]"
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            ) : null}

            {search.trim() || hasActiveAdvancedFilters(advancedFilters) ? (
              <p className="mt-4 text-sm text-[#6B7280]">
                {visibleProperties.length} imóvel{visibleProperties.length === 1 ? "" : "is"} encontrado{visibleProperties.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </section>
        ) : null}

        {!profileOnly ? (visibleProperties.length > 0 ? (
          <>
            <div className={kind === "broker" ? "flex items-center justify-between gap-4 px-4" : "flex items-center justify-between gap-4"}>
              <h2 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-[#111111] sm:text-[2rem]">
                {listingOnly ? "Todos os imóveis" : "Imóveis em destaque"}
              </h2>
              {!listingOnly ? (
                <Link
                  href={listingPath}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#343632] transition hover:text-[#0d7137] sm:text-[15px]"
                >
                  {kind === "broker" ? "Ver todos os imóveis" : "Ver todos"}
                  {kind === "broker" ? <ChevronRight className="size-4 text-[#b38a3b]" /> : null}
                </Link>
              ) : null}
            </div>

            <section id="imoveis" className={kind === "broker" ? "grid min-w-0 scroll-mt-32 auto-rows-fr grid-cols-1 gap-5 px-4 md:grid-cols-2 lg:grid-cols-3" : "grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-2"}>
              {visibleProperties.map(({ property, matchLabel }) => (
                <article
                  key={property.id}
                  id={`imovel-${property.id}`}
                  className={kind === "broker" ? "flex h-full min-w-0 flex-col overflow-hidden rounded-[1rem] border border-[#e9e5dd] bg-white/76 shadow-[0_8px_22px_rgba(57,50,41,.07)] backdrop-blur-[12px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_13px_28px_rgba(57,50,41,.10)]" : "min-w-0 overflow-hidden rounded-[1.8rem] border border-[#ece4db] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.055)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(15,23,42,0.09)]"}
                >
                  <div className="relative">
                  <button type="button" onClick={() => openProperty(property)} className="block w-full text-left">
                    <div className={kind === "broker" ? "relative aspect-[2.2/1] overflow-hidden bg-[#eef2f0]" : "relative aspect-[2.16/1] overflow-hidden bg-[#eef2f0]"}>
                      {property.images[0]?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={property.images[0].trim()} alt={property.title} className="h-full w-full object-cover transition duration-700 hover:scale-[1.03]" />
                      ) : (
                        <CatalogImagePlaceholder />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/28 via-black/10 to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/82 px-3.5 py-1.5 text-xs font-medium text-[#2f2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_4px_10px_rgba(15,23,42,.07)] backdrop-blur-[14px] backdrop-saturate-[1.35] supports-[backdrop-filter]:bg-white/58">
                        {matchLabel}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(property.id)}
                    aria-label={favoriteIds.has(property.id) ? `Remover ${property.title} dos favoritos` : `Favoritar ${property.title}`}
                    aria-pressed={favoriteIds.has(property.id)}
                    className={kind === "broker" ? "absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/65 bg-white/82 text-[#2f2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_5px_12px_rgba(15,23,42,.10)] backdrop-blur-[14px] backdrop-saturate-[1.35] supports-[backdrop-filter]:bg-white/58" : "absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-white/96 text-[#2f2f2f] shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm"}
                  >
                    <Heart className={cn(kind === "broker" ? "size-4" : "size-5", favoriteIds.has(property.id) && "fill-[#159447] text-[#159447]")} />
                  </button>
                  </div>

                  <div className={kind === "broker" ? "flex flex-1 flex-col gap-4 p-4" : "grid gap-6 p-6 sm:p-7"}>
                    <div className={kind === "broker" ? "grid gap-2" : "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"}>
                      <div className="min-w-0">
                        <h3 className={kind === "broker" ? "line-clamp-2 text-base font-semibold leading-snug tracking-[-0.02em] text-[#111111]" : "line-clamp-2 text-[2rem] font-semibold leading-tight tracking-[-0.05em] text-[#111111]"}>
                          {property.title}
                        </h3>
                        <p className="mt-2.5 flex items-center gap-2 text-sm text-[#838383]">
                          <MapPin className="size-4 shrink-0 text-[#8a8a8a]" />
                          <span className="truncate">{property.location}</span>
                        </p>
                      </div>

                      <div className={kind === "broker" ? "" : "sm:text-right"}>
                        <p className={kind === "broker" ? "break-words text-base font-semibold text-[#199148]" : "break-words whitespace-nowrap text-[2rem] font-semibold tracking-[-0.05em] text-[#2f9c58]"}>
                          {property.price || "Consulte valor"}
                        </p>
                        {kind !== "broker" ? <p className="mt-1.5 text-sm text-[#8a8a8a]">{getShortHighlight(property)}</p> : null}
                      </div>
                    </div>

                    <div className={kind === "broker" ? "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#626b66]" : "flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-[#545454]"}>
                      {property.bedrooms > 0 ? <InlineSpec icon={Bed} value={`${property.bedrooms} quartos`} /> : null}
                      {property.parking > 0 ? <InlineSpec icon={Car} value={`${property.parking} vagas`} /> : null}
                      {property.bathrooms > 0 ? <InlineSpec icon={Bath} value={`${property.bathrooms} banheiros`} /> : null}
                    </div>

                    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", kind === "broker" && "mt-auto")}>
                      <span className="inline-flex w-fit rounded-full border border-white/60 bg-white/78 px-3.5 py-1.5 text-xs font-medium text-[#636363] shadow-[inset_0_1px_0_rgba(255,255,255,.86)] backdrop-blur-[12px] supports-[backdrop-filter]:bg-white/55">
                        {property.type === "Bolsao" ? "Bolsão" : property.type}
                      </span>
                      <Button
                        type="button"
                        onClick={() => openLeadModal(property)}
                        className="h-9 rounded-full border border-[#dfe7e1] bg-white/70 px-4 text-xs font-medium text-[#176f3b] shadow-[0_3px_9px_rgba(32,91,53,.06)] hover:bg-white"
                      >
                        <WhatsappGlyph className="size-4" />
                        Tenho interesse
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {!listingOnly ? (brokerCatalog ? (
              <div><BrokerCatalogFooterContact catalog={brokerCatalog} onContact={() => setContactOpen(true)} /></div>
            ) : (
            <section className="rounded-[1.9rem] border border-[#ece5dc] bg-white px-6 py-7 shadow-[0_16px_38px_rgba(15,23,42,0.045)] sm:px-8 sm:py-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full border border-[#dceadf] bg-[#f4fbf6] text-[#3e9651] shadow-[0_8px_18px_rgba(61,151,81,0.08)]">
                    <MessageCircle className="size-7" />
                  </div>
                  <div>
                    <h3 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-[#111111]">Ainda não encontrou o imóvel ideal?</h3>
                    <p className="mt-1.5 text-base leading-7 text-[#6b6b6b]">
                      Receba novas oportunidades diretamente pelo WhatsApp.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!catalog.whatsApp) {
                      showFeedback("Contato indisponível no momento")
                      return
                    }
                    window.open(createWhatsAppUrl(catalog.whatsApp, `Olá, quero receber opções exclusivas do catálogo ${catalogUrl}`), "_blank", "noopener,noreferrer")
                  }}
                  className="h-12 rounded-full bg-[#f4fbf6] px-6 text-base font-medium text-[#3e9651] shadow-[0_10px_22px_rgba(61,151,81,0.08)] hover:bg-[#eef9f1] hover:text-[#2f7c40]"
                >
                  Falar no WhatsApp
                </Button>
              </div>
            </section>
            )) : null}
          </>
        ) : (
          <div className={cn(CATALOG_GLASS_SURFACE_CLASS, "rounded-[1.75rem] px-6 py-16 text-center text-sm text-[#6B7280]")}>
            Nenhum imóvel encontrado para essa busca.
          </div>
        )) : null}
      </div>

      {brokerCatalog ? <BrokerContactDialog open={contactOpen} onOpenChange={setContactOpen} catalog={brokerCatalog} /> : null}

      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent showCloseButton className={cn("box-border max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[1.5rem] p-0 sm:rounded-[1.9rem] lg:w-full lg:max-w-6xl [&_[data-slot=dialog-close]]:fixed [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-[max(1rem,env(safe-area-inset-top))] [&_[data-slot=dialog-close]]:z-[90] [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/80 [&_[data-slot=dialog-close]]:bg-white/90 [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:shadow-lg [&_[data-slot=dialog-close]]:backdrop-blur-xl lg:[&_[data-slot=dialog-close]]:absolute lg:[&_[data-slot=dialog-close]]:right-4 lg:[&_[data-slot=dialog-close]]:top-4", CATALOG_DIALOG_SURFACE_CLASS)}>
          {selectedProperty && (
            <div className="grid max-h-[94dvh] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1.14fr)_minmax(370px,0.86fr)]">
              <div className="min-w-0 max-w-full overflow-x-hidden border-b border-white/70 bg-white/34 p-3 backdrop-blur-[12px] sm:p-4 lg:border-r lg:border-b-0 lg:p-5">
                <DialogTitle className="sr-only">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do imóvel selecionado.</DialogDescription>
                  <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.25rem] border border-white/80 bg-[#ecebe7]/70 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_16px_42px_rgba(22,36,28,.08)] sm:rounded-[1.5rem]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={selectedProperty.title} className="aspect-[4/3] max-h-[78dvh] w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/3] w-full">
                      <CatalogImagePlaceholder />
                    </div>
                  )}
                  {selectedProperty.images.length > 1 ? (
                    <>
                      <button type="button" onClick={() => setCurrentImageIndex((current) => current === 0 ? selectedProperty.images.length - 1 : current - 1)} className={cn(CATALOG_ICON_SURFACE_CLASS, "absolute left-4 top-1/2 size-10 -translate-y-1/2 text-[#050505] hover:bg-white")}>
                        <ChevronLeft className="size-5" />
                      </button>
                      <button type="button" onClick={() => setCurrentImageIndex((current) => current === selectedProperty.images.length - 1 ? 0 : current + 1)} className={cn(CATALOG_ICON_SURFACE_CLASS, "absolute right-4 top-1/2 size-10 -translate-y-1/2 text-[#050505] hover:bg-white")}>
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                    ) : null}
                  </div>
                  {selectedProperty.images.length > 1 ? (
                    <div
                      className="mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      aria-label="Galeria de imagens do imóvel"
                    >
                      {selectedProperty.images.map((propertyImage, index) => (
                        <button
                          key={`${propertyImage}-${index}`}
                          type="button"
                          onClick={() => setCurrentImageIndex(index)}
                          aria-label={`Ver imagem ${index + 1} de ${selectedProperty.images.length}`}
                          aria-current={currentImageIndex === index ? "true" : undefined}
                          className={cn(
                            "relative aspect-[4/3] w-[76px] shrink-0 overflow-hidden rounded-xl border-2 bg-[#eef2ef] transition sm:w-[92px]",
                            currentImageIndex === index
                              ? "border-[#b38a3b] shadow-[0_5px_14px_rgba(179,138,59,.16)]"
                              : "border-white opacity-75 hover:opacity-100",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={propertyImage} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              <div className="flex w-full min-w-0 max-w-full flex-col overflow-x-hidden p-4 sm:p-5 lg:p-6">
                <p className="break-words text-sm text-[#6B7280]">{selectedProperty.location}</p>
                <h3 className="mt-1.5 break-words text-2xl font-semibold leading-tight tracking-[-0.035em] text-[#050505] sm:text-[1.8rem]">{selectedProperty.title}</h3>
                <p className="mt-3 break-words text-2xl font-bold tracking-[-0.03em] text-[#118a3d] sm:text-[1.75rem]">{selectedProperty.price || "Consulte valor"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedProperty.bedrooms > 0 ? <Feature icon={Bed} label={`${selectedProperty.bedrooms} quartos`} /> : null}
                  {selectedProperty.bathrooms > 0 ? <Feature icon={Bath} label={`${selectedProperty.bathrooms} banheiros`} /> : null}
                  {selectedProperty.parking > 0 ? <Feature icon={Car} label={`${selectedProperty.parking} vagas`} /> : null}
                </div>
                {selectedProperty.description ? (
                  <div className="mt-5">
                    <p className="text-sm font-medium text-[#374151]">Descrição</p>
                    <p className="mt-2 break-words text-sm leading-6 text-[#6B7280]">{selectedProperty.description}</p>
                  </div>
                ) : null}
                <section className={cn(CATALOG_GLASS_SURFACE_CLASS, "mt-5 w-full min-w-0 max-w-full rounded-2xl p-2.5 lg:p-3")}>
                  <button type="button" onClick={() => setFinancingOpen((current) => !current)} aria-expanded={financingOpen} aria-controls="catalog-financing-simulator" className="flex w-full items-center gap-2 text-left">
                    <span className={cn(CATALOG_ICON_SURFACE_CLASS, "size-8")}><CircleDollarSign className="size-4" /></span>
                    <h4 className="text-sm font-semibold text-[#1f2b23]">Simule seu financiamento</h4>
                    <ChevronDown className={cn("ml-auto size-4 text-[#6f7a73] transition-transform duration-300", financingOpen && "rotate-180")} />
                  </button>
                  <div id="catalog-financing-simulator" className={cn("grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out", financingOpen ? "mt-2.5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-2 lg:gap-2">
                        <FinancingField label="Valor do imóvel"><Input readOnly value={formatCurrencyFromCents(propertyValue)} className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs font-medium text-[#344054]")} /></FinancingField>
                        <FinancingField label="Entrada"><StructuredInput kind="currency" value={financingEntry} onValueChange={setFinancingEntry} placeholder="R$ 0,00" aria-label="Valor da entrada" className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs text-[#344054]")} /></FinancingField>
                        <FinancingField label="Valor financiado"><Input readOnly value={formatCurrencyFromCents(financedValue)} className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 bg-white/48 px-2.5 text-xs font-medium text-[#344054]")} /></FinancingField>
                        <FinancingField label="Parcelas"><StructuredInput kind="quantity" value={financingInstallments} onValueChange={(value) => setFinancingInstallments(value.replace(/\D/g, ""))} aria-label="Quantidade de parcelas" className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs text-[#344054]")} /></FinancingField>
                        <FinancingField label="Juros mensais"><StructuredInput kind="percent" value={financingInterest} onValueChange={setFinancingInterest} placeholder="0,89% a.m." aria-label="Juros mensais" className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs text-[#344054]")} /></FinancingField>
                        <FinancingField label="Parcela estimada"><Input readOnly value={formatCurrencyFromCents(estimatedInstallment)} className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 bg-white/48 px-2.5 text-xs font-semibold text-[#0d7137]")} /></FinancingField>
                      </div>
                      <p className="mt-2 text-[10px] leading-4 text-[#818a84]">Simulação informativa. Taxas e condições finais dependem da instituição financeira.</p>
                    </div>
                  </div>
                </section>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button type="button" onClick={() => openLeadModal(selectedProperty)} className={cn(CATALOG_PRIMARY_CTA_CLASS, "h-11 flex-1 text-base font-semibold")}>
                    <MessageCircle className="size-4" />
                    Tenho interesse
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void shareUrl(`${catalogUrl}#imovel-${selectedProperty.id}`, selectedProperty.title, "Veja este imóvel")} className={cn(CATALOG_SECONDARY_CTA_CLASS, "h-11 px-5 text-[#4B5563]")}>
                    <Share2 className="size-4" />
                    Compartilhar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadDraft} onOpenChange={(open) => !open && setLeadDraft(null)}>
        <DialogContent className={cn("max-w-[calc(100%-1.5rem)] rounded-[1.75rem] sm:max-w-lg", CATALOG_DIALOG_SURFACE_CLASS)}>
          {leadDraft ? (
            <>
              <DialogTitle className="text-2xl text-[#050505]">Gostou deste imóvel?</DialogTitle>
              <DialogDescription className="text-[#6B7280]">
                Para falar com o corretor, me diga seu nome.
              </DialogDescription>
              <div className="grid gap-4 py-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#374151]">Nome</span>
                  <Input value={leadDraft.name} onChange={(event) => setLeadDraft((current) => current ? { ...current, name: event.target.value } : current)} className={cn(CATALOG_INPUT_CLASS, "h-11 text-[#050505]")} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#374151]">Telefone</span>
                  <StructuredInput kind="phone" value={leadDraft.phone} onValueChange={(value) => setLeadDraft((current) => current ? { ...current, phone: value } : current)} aria-label="Telefone" className={cn(CATALOG_INPUT_CLASS, "h-11 text-[#050505]")} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#374151]">Mensagem</span>
                  <Textarea value={leadDraft.message} onChange={(event) => setLeadDraft((current) => current ? { ...current, message: event.target.value } : current)} className={cn(CATALOG_INPUT_CLASS, "min-h-24 text-[#050505]")} />
                </label>
                {leadFeedback ? <p className="text-sm text-[#009b3a]">{leadFeedback}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" onClick={submitLead} disabled={isSavingLead} className={cn(CATALOG_PRIMARY_CTA_CLASS, "h-11 w-full text-base font-semibold disabled:opacity-60")}>
                  {isSavingLead ? "Salvando..." : "Continuar no WhatsApp"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function normalizeProperties(catalog: PublicBrokerCatalogData | PublicAgencyCatalogData): CatalogProperty[] {
  return catalog.properties.map((property) => ({
    ...property,
    publicCode: property.publicCode,
    images: property.images,
    leads: "leads" in property ? property.leads : property.interested,
    brokerName: "broker" in property ? property.broker.name : undefined,
  }))
}

function getVisitorKey() {
  if (typeof window === "undefined") return ""

  try {
    const storageKey = "eme_catalog_visitor"
    const existing = window.localStorage.getItem(storageKey)
    if (existing) return existing

    const next = crypto.randomUUID()
    window.localStorage.setItem(storageKey, next)
    return next
  } catch {
    return ""
  }
}

async function trackCatalogEvent({
  eventType,
  catalogSlug,
  catalogType,
  propertyId,
  query,
  resultCount,
}: {
  eventType: "catalog_view" | "property_view" | "whatsapp_click" | "catalog_search"
  catalogSlug: string
  catalogType: CatalogKind
  propertyId?: string
  query?: string
  resultCount?: number
}) {
  try {
    await fetch("/api/catalog-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        eventType,
        catalogSlug,
        catalogType,
        propertyId,
        query,
        resultCount,
        visitorKey: getVisitorKey(),
      }),
    })
  } catch {
    // Tracking nao deve bloquear a experiencia publica do catalogo.
  }
}

type SearchFieldName =
  | "title"
  | "type"
  | "purpose"
  | "location"
  | "neighborhood"
  | "city"
  | "description"
  | "code"

type SearchAnalysis = {
  query: string
  tokens: string[]
  expandedTokens: string[]
  maxPrice: number | null
  bedrooms: number | null
  parking: number | null
  type: string
  purpose: string
  features: string[]
  intent: string
}

type PropertySearchIndex = {
  title: string
  type: string
  purpose: string
  location: string
  neighborhood: string
  city: string
  description: string
  code: string
  haystack: string
  tokens: string[]
}

const SEARCH_FIELD_WEIGHTS: Record<SearchFieldName, number> = {
  title: 12,
  type: 11,
  purpose: 8,
  location: 6,
  neighborhood: 9,
  city: 8,
  description: 5,
  code: 7,
}

const FEATURE_KEYWORDS = [
  "frente mar",
  "alto padrao",
  "investimento",
  "suite",
  "sacada",
  "piscina",
  "churrasqueira",
  "academia",
  "gourmet",
  "condominio",
  "jardim",
  "jardins",
] as const

const TOKEN_SYNONYMS: Record<string, string[]> = {
  sala: ["salas", "comercial", "escritorio", "escritorios", "office", "corporativa"],
  comercial: ["sala", "salas", "escritorio", "escritorios", "loja", "corporativa"],
  escritorio: ["escritorios", "sala", "comercial", "office"],
  apartamento: ["apto", "apartamentos"],
  apto: ["apartamento", "apartamentos"],
  cobertura: ["coberturas", "penthouse"],
  casa: ["casas", "residencia", "residencial"],
  terrreno: ["terreno", "lote"],
  jardim: ["jardins"],
  jardins: ["jardim"],
  locacao: ["aluguel", "alugar", "residencial", "comercial"],
  venda: ["comprar", "compra"],
  investimento: ["investidor", "renda"],
}

function buildPropertySearchIndex(property: CatalogProperty): PropertySearchIndex {
  const index = {
    title: normalizeText(property.title),
    type: normalizeText(property.type),
    purpose: normalizeText(property.purpose),
    location: normalizeText(property.location),
    neighborhood: normalizeText(property.neighborhood),
    city: normalizeText(property.city),
    description: normalizeText(property.description),
    code: normalizeText(property.publicCode ? String(property.publicCode) : ""),
  }

  const haystack = normalizeText(
    [
      property.title,
      property.type,
      property.purpose,
      property.location,
      property.neighborhood,
      property.city,
      property.description,
      property.publicCode ? `imovel ${property.publicCode}` : "",
      property.bedrooms ? `${property.bedrooms} quartos` : "",
      property.parking ? `${property.parking} vagas` : "",
      property.price,
    ].join(" "),
  )

  return {
    ...index,
    haystack,
    tokens: buildSearchTerms(haystack),
  }
}

function analyzeSearch(rawSearch: string): SearchAnalysis {
  const query = normalizeText(rawSearch)
  const tokens = buildSearchTerms(query)
  const expandedTokens = Array.from(new Set(tokens.flatMap((token) => [token, ...expandToken(token)])))
  const maxPrice = extractPriceValue(query)
  const bedrooms = extractNumericIntent(query, ["quarto", "quartos", "dormitorio", "dormitorios"])
  const parking = extractNumericIntent(query, ["vaga", "vagas", "garagem", "garagens"])
  const type = inferSearchType(query, expandedTokens)
  const purpose = inferSearchPurpose(query)
  const features = FEATURE_KEYWORDS.filter((feature) => query.includes(feature))

  return {
    query,
    tokens,
    expandedTokens,
    maxPrice,
    bedrooms,
    parking,
    type,
    purpose,
    features,
    intent:
      [
        type,
        purpose,
        maxPrice ? `ate ${maxPrice}` : "",
        bedrooms ? `${bedrooms} quartos` : "",
        parking ? `${parking} vagas` : "",
        ...features,
      ]
        .filter(Boolean)
        .join(", ") || rawSearch.trim(),
  }
}

function rankProperties(
  properties: CatalogProperty[],
  analysis: SearchAnalysis,
  filters: CatalogAdvancedFilters,
) {
  return properties
    .map((property) => {
      const index = buildPropertySearchIndex(property)
      const compatible =
        matchesNaturalLanguage(property, analysis, index) &&
        matchesAdvancedFilters(property, filters, index)
      const score = calculatePropertyScore(property, analysis, index, compatible)

      return {
        property,
        compatible,
        score,
        matchLabel: score >= 28 ? "Destaque" : score >= 16 ? "Selecionado" : "Boa opção",
      }
    })
    .filter((item) => item.compatible)
    .sort((first, second) => second.score - first.score || second.property.views - first.property.views)
}

function calculatePropertyScore(
  property: CatalogProperty,
  analysis: SearchAnalysis,
  index: PropertySearchIndex,
  compatible: boolean,
) {
  let score = compatible ? 1 : 0

  if (!analysis.query) score += 2
  if (analysis.type && normalizeText(property.type) === normalizeText(analysis.type)) score += 18
  if (analysis.purpose && normalizeText(property.purpose) === normalizeText(analysis.purpose)) score += 8
  if (analysis.maxPrice && property.priceValue <= analysis.maxPrice) score += 6
  if (analysis.bedrooms && property.bedrooms >= analysis.bedrooms) score += 5
  if (analysis.parking && property.parking >= analysis.parking) score += 4

  for (const feature of analysis.features) {
    if (index.haystack.includes(feature)) score += 7
  }

  for (const token of analysis.expandedTokens) {
    score += scoreTokenAcrossFields(token, index)
  }

  if (analysis.query && index.title.includes(analysis.query)) score += 14
  if (analysis.query && index.type.includes(analysis.query)) score += 11
  if (analysis.query && index.description.includes(analysis.query)) score += 5

  return score
}

function scoreTokenAcrossFields(token: string, index: PropertySearchIndex) {
  let score = 0

  for (const [field, weight] of Object.entries(SEARCH_FIELD_WEIGHTS) as Array<[SearchFieldName, number]>) {
    const value = index[field]
    if (!value) continue
    if (value === token) {
      score += weight + 3
      continue
    }
    if (value.includes(` ${token} `) || value.startsWith(`${token} `) || value.endsWith(` ${token}`)) {
      score += weight + 1
      continue
    }
    if (value.includes(token)) score += Math.max(2, Math.floor(weight / 2))
  }

  return score
}

function matchesNaturalLanguage(property: CatalogProperty, analysis: SearchAnalysis, index: PropertySearchIndex) {
  if (!analysis.query.trim()) return true
  if (analysis.maxPrice && property.priceValue > analysis.maxPrice) return false
  if (analysis.bedrooms && property.bedrooms < analysis.bedrooms) return false
  if (analysis.parking && property.parking < analysis.parking) return false
  if (analysis.type && normalizeText(property.type) !== normalizeText(analysis.type)) return false
  if (analysis.purpose && normalizeText(property.purpose) !== normalizeText(analysis.purpose)) return false
  if (analysis.features.some((feature) => !index.haystack.includes(feature))) return false

  if (analysis.expandedTokens.length === 0) return true

  const matchedTerms = analysis.tokens.filter((token) =>
    [token, ...expandToken(token)].some((candidate) => index.haystack.includes(candidate)),
  )

  if (matchedTerms.length > 0) return true

  return analysis.expandedTokens.some((token) => hasFuzzyTokenMatch(token, index.tokens))
}

function matchesAdvancedFilters(property: CatalogProperty, filters: CatalogAdvancedFilters, index: PropertySearchIndex) {
  if (filters.type && normalizeText(property.type) !== normalizeText(filters.type)) return false
  if (filters.city && !index.city.includes(normalizeText(filters.city))) return false
  if (filters.neighborhood && !index.neighborhood.includes(normalizeText(filters.neighborhood))) return false

  const bedrooms = Number(filters.bedrooms)
  if (Number.isFinite(bedrooms) && bedrooms > 0 && property.bedrooms < bedrooms) return false

  const parking = Number(filters.parking)
  if (Number.isFinite(parking) && parking > 0 && property.parking < parking) return false

  const maxPrice = extractPriceValue(filters.maxPrice)
  if (maxPrice && property.priceValue > maxPrice) return false

  const featureTerms = buildSearchTerms(normalizeText(filters.feature))
  if (featureTerms.some((feature) => !index.haystack.includes(feature))) return false

  return true
}

function hasActiveAdvancedFilters(filters: CatalogAdvancedFilters) {
  return Object.values(filters).some((value) => value.trim().length > 0)
}

function extractPriceValue(input: string) {
  const match = normalizeText(input).match(/(\d+[.,]?\d*)\s*(milhoes|milhao|mi|mil)?/)
  if (!match) return null

  const amount = Number(match[1].replace(",", "."))
  if (!Number.isFinite(amount)) return null

  const unit = match[2] ?? ""
  if (unit.startsWith("mi") || unit.startsWith("milhao")) return Math.round(amount * 1_000_000 * 100)
  if (unit.startsWith("mil")) return Math.round(amount * 1_000 * 100)
  return Math.round(amount * 100)
}

function extractNumericIntent(query: string, keywords: string[]) {
  const pattern = new RegExp(`(\\d+)\\s*(?:${keywords.join("|")})`)
  const match = query.match(pattern)
  if (!match) return null

  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/.,;:()]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function buildSearchTerms(query: string) {
  const stopWords = new Set([
    "a",
    "as",
    "ate",
    "com",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "mil",
    "milhao",
    "milhoes",
    "mi",
    "no",
    "nos",
    "na",
    "nas",
    "para",
    "por",
    "quarto",
    "quartos",
    "vaga",
    "vagas",
    "imovel",
    "imoveis",
    "um",
    "uma",
  ])

  return query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => normalizeToken(term.trim()))
    .filter((term) => term.length > 2)
    .filter((term) => !stopWords.has(term))
    .filter((term) => !/^\d+$/.test(term))
}

function normalizeToken(term: string) {
  const cleaned = normalizeText(term)
  if (cleaned.endsWith("oes")) return `${cleaned.slice(0, -3)}ao`
  if (cleaned.endsWith("ais")) return `${cleaned.slice(0, -3)}al`
  if (cleaned.endsWith("eis")) return `${cleaned.slice(0, -3)}el`
  if (cleaned.endsWith("res")) return cleaned.slice(0, -1)
  if (cleaned.endsWith("s") && cleaned.length > 4) return cleaned.slice(0, -1)
  return cleaned
}

function expandToken(token: string) {
  const normalized = normalizeToken(token)
  return (TOKEN_SYNONYMS[normalized] ?? []).map(normalizeToken)
}

function inferSearchType(query: string, tokens: string[]) {
  if (query.includes("cobertura") || tokens.includes("cobertura")) return "Cobertura"
  if (tokens.includes("casa")) return "Casa"
  if (tokens.includes("terreno")) return "Terreno"
  if (tokens.includes("loja")) return "Loja"
  if (tokens.includes("sala") || tokens.includes("comercial") || tokens.includes("escritorio")) return "Sala Comercial"
  if (tokens.includes("apartamento") || tokens.includes("apto")) return "Apartamento"
  return ""
}

function inferSearchPurpose(query: string) {
  if (query.includes("locacao") || query.includes("aluguel") || query.includes("alugar")) return "Locacao"
  if (query.includes("venda") || query.includes("comprar") || query.includes("compra")) return "Venda"
  return ""
}

function hasFuzzyTokenMatch(token: string, candidates: string[]) {
  return candidates.some((candidate) => {
    if (candidate === token) return true
    if (candidate.includes(token) || token.includes(candidate)) return true
    return levenshteinDistance(token, candidate) <= 2
  })
}

function levenshteinDistance(source: string, target: string) {
  if (source === target) return 0
  if (!source.length) return target.length
  if (!target.length) return source.length

  const matrix = Array.from({ length: source.length + 1 }, (_, row) =>
    Array.from({ length: target.length + 1 }, (_, column) => {
      if (row === 0) return column
      if (column === 0) return row
      return 0
    }),
  )

  for (let row = 1; row <= source.length; row += 1) {
    for (let column = 1; column <= target.length; column += 1) {
      const cost = source[row - 1] === target[column - 1] ? 0 : 1
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      )
    }
  }

  return matrix[source.length][target.length]
}

function getPriceRangeLabel(properties: CatalogProperty[]) {
  const prices = properties.map((property) => property.priceValue).filter((price) => price > 0)
  if (!prices.length) return "Consulte"
  return `${formatCompactPrice(Math.min(...prices))} - ${formatCompactPrice(Math.max(...prices))}`
}

function formatCompactPrice(value: number) {
  const reais = value / 100
  if (reais >= 1_000_000) return `R$ ${(reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
  return `R$ ${(reais / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`
}

function getShortHighlight(property: CatalogProperty) {
  return property.description || `${property.type} em ${property.location}`
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function MetricStat({
  icon: Icon,
  label,
  value,
  fullWidthOnMobile = false,
  fullWidthOnDesktop = false,
  valueClassName = "",
}: {
  icon: typeof Home
  label: string
  value: string
  fullWidthOnMobile?: boolean
  fullWidthOnDesktop?: boolean
  valueClassName?: string
}) {
  return (
    <div
      className={`flex min-h-[110px] flex-col items-center justify-center gap-2.5 border-b border-[#eee6de] px-4 py-4 text-center last:border-b-0 sm:min-h-[128px] sm:border-b-0 sm:border-r last:sm:border-r-0 lg:min-h-[118px] ${
        fullWidthOnMobile ? "col-span-2" : ""
      } ${
        fullWidthOnDesktop ? "lg:col-span-2 lg:border-r-0" : ""
      }`}
    >
      <div className="flex size-9 items-center justify-center rounded-full bg-[#f4faf5] text-[#3e9651] sm:size-10">
        <Icon className="size-4.5 sm:size-5" />
      </div>
      <p className={`text-[1.45rem] font-semibold tracking-[-0.05em] text-[#151515] sm:text-[1.8rem] ${valueClassName}`}>{value}</p>
      <p className="text-[0.86rem] text-[#676767] sm:text-[0.95rem]">{label}</p>
    </div>
  )
}

function InlineSpec({ icon: Icon, value }: { icon: typeof Bed; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <Icon className="size-4 text-[#767676]" />
      <span>{value}</span>
    </span>
  )
}

function Feature({ icon: Icon, label }: { icon: typeof Bed; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/58 px-3 py-1.5 text-sm text-[#5F6B7A] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_3px_10px_rgba(37,43,37,.04)] backdrop-blur-[12px]">
      <Icon className="size-4 text-[#0d7137]" />
      <span>{label}</span>
    </div>
  )
}

function CatalogImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#eef2f0] px-4 text-center">
      <Building2 className="size-9 text-[#94A3B8]" />
      <p className="mt-3 text-sm font-medium text-[#6B7280]">Sem imagem cadastrada</p>
    </div>
  )
}

function getSuggestionIcon(suggestion: string) {
  const iconClassName = "size-3 text-[#6a6a6a] sm:size-3.5"
  if (suggestion === "Mais filtros") return <SlidersHorizontal className={iconClassName} />
  if (suggestion === "Até R$ 1 milhão") return <CircleDollarSign className={iconClassName} />
  if (suggestion === "Frente mar") return <Sparkles className={iconClassName} />
  if (suggestion === "Investimento") return <Building2 className={iconClassName} />
  return <Home className={iconClassName} />
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#5f5f5f]">{label}</span>
      {children}
    </label>
  )
}
