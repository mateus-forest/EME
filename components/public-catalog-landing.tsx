"use client"
import { analyzeSearch, rankProperties, hasActiveAdvancedFilters, EMPTY_CATALOG_FILTERS, type CatalogAdvancedFilters } from "@/lib/catalog-search"
import { trackJourney } from "@/lib/journey/browser"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Bath,
  ArrowUpRight,
  Maximize2,
  X,
  Bed,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  SlidersHorizontal,
} from "lucide-react"

import type {
  PublicAgencyCatalogData,
  PublicBrokerCatalogData,
} from "@/lib/public-catalog"
import { createPublicLead } from "@/lib/lead-client"
import {
  buildAgencyCatalogPath,
  buildAgencyCatalogUrl,
  buildBrokerCatalogPath,
  buildBrokerCatalogUrl,
} from "@/lib/public-catalog-url"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { formatPositiveCountLabel, normalizePhone } from "@/lib/structured-fields"
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
import { useCatalogTheme } from "@/components/catalog-theme-provider"
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
  area?: number
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
  property: CatalogProperty | null
  name: string
  phone: string
  message: string
}

function FinancingField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="eme-catalog-financing-field grid min-w-0 gap-1 text-[11px] font-medium text-[#667085]"><span>{label}</span>{children}</label>
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

export function PublicCatalogLanding({
  kind,
  slug,
  catalog,
  listingOnly = false,
  profileOnly = false,
}: PublicCatalogLandingProps) {
  const { theme } = useCatalogTheme()
  const [search, setSearch] = useState("")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortOrder, setSortOrder] = useState("relevance")
  const propertyHistoryRef = useRef(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<CatalogAdvancedFilters>(EMPTY_CATALOG_FILTERS)
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
    () => {
      const ranked = rankProperties(properties, searchAnalysis, advancedFilters)
        .filter(({ property }) => !favoritesOnly || favoriteIds.has(property.id))
      if (sortOrder === "price-asc" || sortOrder === "price-desc") ranked.sort((a, b) => {
        if (!a.property.priceValue) return b.property.priceValue ? 1 : 0
        if (!b.property.priceValue) return -1
        return (a.property.priceValue - b.property.priceValue) * (sortOrder === "price-asc" ? 1 : -1)
      })
      return ranked
    },
    [advancedFilters, properties, searchAnalysis, favoritesOnly, favoriteIds, sortOrder],
  )
  const publicPath =
    kind === "broker" ? buildBrokerCatalogPath(catalog.slug || slug) : buildAgencyCatalogPath(catalog.slug || slug)
  const catalogUrl =
    kind === "broker" ? buildBrokerCatalogUrl(catalog.slug || slug) : buildAgencyCatalogUrl(catalog.slug || slug)
  const image = (selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0] ?? "").trim()
  const cities = useMemo(
    () => Array.from(new Set(properties.map((property) => property.city).filter(Boolean))),
    [properties],
  )
  const neighborhoods = useMemo(
    () => Array.from(new Set(properties.filter((property) => !advancedFilters.city || property.city === advancedFilters.city).map((property) => property.neighborhood).filter(Boolean))).sort(),
    [properties, advancedFilters.city],
  )
  const propertyTypes = useMemo(() => [...new Set(properties.map((property) => property.type))].sort((a, b) => a.localeCompare(b, "pt-BR")), [properties])
  const quickSuggestions = propertyTypes.slice(0, 4)
  const hasFilters = Boolean(search.trim() || hasActiveAdvancedFilters(advancedFilters) || favoritesOnly)

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
    if (kind !== "broker") return
    document.documentElement.dataset.emeCatalogTheme = theme

    return () => {
      delete document.documentElement.dataset.emeCatalogTheme
    }
  }, [kind, theme])

  useEffect(() => {
    const restoreProperty = () => {
      const hash = window.location.hash
      const id = hash.startsWith("#imovel-") ? hash.slice(8) : ""
      setSelectedProperty(properties.find((property) => property.id === id) ?? null)
      setCurrentImageIndex(0)
    }
    restoreProperty()
    window.addEventListener("popstate", restoreProperty)
    window.addEventListener("hashchange", restoreProperty)
    return () => {
      window.removeEventListener("popstate", restoreProperty)
      window.removeEventListener("hashchange", restoreProperty)
    }
  }, [properties])

  const openProperty = useCallback((property: CatalogProperty) => {
    const hash = "#imovel-" + property.id
    if (window.location.hash !== hash) {
      window.history.pushState({ ...window.history.state, emeCatalogProperty: true }, "", hash)
      propertyHistoryRef.current = true
    }
    setSelectedProperty(property)
    setCurrentImageIndex(0)
    void trackCatalogEvent({ eventType: "property_view", catalogSlug: catalog.slug || slug, catalogType: kind, propertyId: property.id })
  }, [catalog.slug, slug, kind])

  function closeProperty() {
    setSelectedProperty(null)
    if (propertyHistoryRef.current && window.history.state?.emeCatalogProperty) {
      window.history.back()
    } else if (window.location.hash.startsWith("#imovel-")) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search)
    }
  }

  function clearFilters() {
    setSearch("")
    setAdvancedFilters(EMPTY_CATALOG_FILTERS)
    setFavoritesOnly(false)
  }

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
      openProperty(property)
    }

    window.addEventListener("eme:catalog-open-property", openAssistantProperty)
    const openAssistantContact = () => setContactOpen(true)
    window.addEventListener("eme:catalog-open-contact", openAssistantContact)
    return () => {
      window.removeEventListener("eme:catalog-open-property", openAssistantProperty)
      window.removeEventListener("eme:catalog-open-contact", openAssistantContact)
    }
  }, [kind, properties, openProperty])

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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      try {
        await navigator.clipboard.writeText(url)
        showFeedback("Link copiado")
      } catch {
        showFeedback("Não foi possível copiar. Tente compartilhar novamente.")
      }
    }
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

  function contactProperty(property: CatalogProperty) {
    if (!catalog.whatsApp) { openLeadModal(property); return }
    window.open(createWhatsAppUrl(catalog.whatsApp, "Olá, tenho interesse no imóvel " + property.title + ": " + catalogUrl + "#imovel-" + property.id), "_blank", "noopener,noreferrer")
    void trackCatalogEvent({ eventType: "whatsapp_click", catalogSlug: catalog.slug || slug, catalogType: kind, propertyId: property.id })
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

  function openCatalogLeadModal() {
    setLeadFeedback("")
    setLeadDraft({
      property: null,
      name: "",
      phone: "",
      message: `Olá, conheci seu catálogo no EME e quero falar com o corretor: ${catalogUrl}`,
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

    if (normalizePhone(leadDraft.phone).length < 10) {
      setLeadFeedback("Informe seu telefone com DDD para receber o retorno.")
      return
    }

    setIsSavingLead(true)
    setLeadFeedback("")

    try {
      await createPublicLead({
        propertyId: leadDraft.property?.id,
        catalogSlug: catalog.slug || slug,
        catalogType: kind,
        source: "catalog",
        name,
        phone: normalizePhone(leadDraft.phone),
        message: leadDraft.message,
        searchTerm: search.trim(),
        intent: searchAnalysis.intent,
      })

      setLeadDraft(null)
      showFeedback("Solicitação enviada. O corretor recebeu seus dados para retornar.")
    } catch (caughtError) {
      setLeadFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível registrar seu interesse.")
    } finally {
      setIsSavingLead(false)
    }
  }

  return (
    <main
      data-catalog-theme={kind === "broker" ? theme : undefined}
      className={kind === "broker" ? cn(CATALOG_PAGE_BACKGROUND_CLASS, "catalog-refined") : "min-h-screen overflow-x-hidden bg-[#f6f1e9] px-0 py-0 font-[family-name:var(--font-geist-sans)] text-[#1f2937] sm:bg-[#f8f5f1] sm:px-6 sm:py-6 lg:px-8 lg:py-8"}
    >
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

      <div className={kind === "broker" ? cn("catalog-content", listingOnly && "pt-6") : "mx-auto grid max-w-[1360px] min-w-0 gap-6 px-4 py-4 sm:gap-10 sm:px-0 sm:py-0 lg:gap-12"}>
        {showPortalBackButton ? (
          <div className="sticky top-3 z-30 flex justify-start">
            <Button asChild variant="ghost" className="h-10 rounded-full border border-black/[0.06] bg-white/90 px-4 text-sm text-[#4B5563] shadow-sm backdrop-blur-md hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/catalogo">Voltar ao portal</Link>
            </Button>
          </div>
        ) : null}

        {brokerCatalog && !listingOnly ? (
          <BrokerProfileHero
            compact={!profileOnly}
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

        {!profileOnly ? (
        <section className="catalog-search" aria-label="Buscar imóveis">
          <div>
            <div className="catalog-search-heading"><h2>Encontre seu próximo endereço.</h2><p>Imóveis selecionados para você.</p></div>
            <form className="catalog-search-form" onSubmit={(event) => { event.preventDefault(); submitSearch(); document.getElementById("imoveis")?.scrollIntoView({ block: "start", behavior: "auto" }) }}>
              <Search size={19} aria-hidden="true" />
              <input aria-label="Buscar imóveis" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cidade, bairro ou o que você procura" />
              {search ? <button type="button" className="catalog-icon" aria-label="Limpar busca" onClick={() => setSearch("")}><X size={16} /></button> : null}
              <button type="submit" className="catalog-search-submit" aria-label="Buscar"><Search size={19} /><span>Buscar</span></button>
            </form>
            <div className="catalog-filter-bar">
              <button type="button" className="catalog-filter-toggle" aria-expanded={showAdvancedFilters} aria-controls="catalog-filters" onClick={() => setShowAdvancedFilters((current) => !current)}><SlidersHorizontal size={15} /> Filtros {hasActiveAdvancedFilters(advancedFilters) ? <span className="catalog-filter-dot" /> : null}</button>
              {quickSuggestions.map((type) => <button key={type} type="button" aria-pressed={advancedFilters.type === type} onClick={() => setAdvancedFilters((current) => ({ ...current, type: current.type === type ? "" : type }))}>{type}</button>)}
              <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((current) => !current)}><Heart size={15} /> Salvos{favoriteIds.size ? " (" + favoriteIds.size + ")" : ""}</button>
            </div>
            {showAdvancedFilters ? (
              <div id="catalog-filters" className="eme-catalog-filter-panel mt-5 grid gap-4 rounded-[1.4rem] border border-[#ece5dc] bg-[#fcfbf8] p-5 lg:grid-cols-4">
                <FilterField label="Finalidade">
                  <select aria-label="Finalidade" value={advancedFilters.purpose} onChange={(event) => setAdvancedFilters((current) => ({ ...current, purpose: event.target.value }))} className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[#111111]">
                    <option value="">Comprar ou alugar</option><option value="Venda">Comprar</option><option value="Locação">Alugar</option>
                  </select>
                </FilterField>
                <FilterField label="Tipo">
                  <select
                    aria-label="Tipo do imóvel"
                    value={advancedFilters.type}
                    onChange={(event) => setAdvancedFilters((current) => ({ ...current, type: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111111] outline-none"
                  >
                    <option value="">Todos</option>
                    {propertyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Cidade">
                  <select
                    aria-label="Cidade"
                    value={advancedFilters.city}
                    onChange={(event) => setAdvancedFilters((current) => ({ ...current, city: event.target.value, neighborhood: "" }))}
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
                    aria-label="Bairro"
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
                    aria-label="Preço máximo"
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
                    aria-label="Dormitórios"
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
                    aria-label="Vagas"
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
                    aria-label="Características"
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
                    onClick={() => { submitSearch(); setShowAdvancedFilters(false) }}
                    className="h-11 rounded-xl bg-[#3d9751] px-5 text-sm font-medium text-white hover:bg-[#347f46]"
                  >
                    Aplicar filtros
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearFilters}
                    className="h-11 rounded-xl border border-[#e6dfd7] bg-white px-5 text-sm font-medium text-[#2f2f2f] hover:bg-[#faf8f5]"
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            ) : null}

            {hasFilters ? <div className="catalog-active-filters" aria-live="polite">
              {searchAnalysis.maxPrice ? <span>Até {formatCurrencyFromCents(searchAnalysis.maxPrice)}</span> : null}
              {searchAnalysis.bedrooms ? <span>{searchAnalysis.bedrooms}+ quartos</span> : null}
              {Object.entries(advancedFilters).filter(([, value]) => value).map(([key, value]) => <button type="button" key={key} onClick={() => setAdvancedFilters((current) => ({ ...current, [key]: "" }))} aria-label={"Remover filtro " + value}>{value}<X size={12} /></button>)}
              <button type="button" onClick={clearFilters}>Limpar tudo</button>
            </div> : null}
          </div>
        </section>
        ) : null}

        {!profileOnly ? <div className="catalog-results-heading">
          <h2 aria-live="polite">{visibleProperties.length} {visibleProperties.length === 1 ? "imóvel" : "imóveis"}{favoritesOnly ? " salvo" + (visibleProperties.length === 1 ? "" : "s") : visibleProperties.length === 1 ? " disponível" : " disponíveis"}</h2>
          <label><span className="sr-only">Ordenar imóveis</span><select aria-label="Ordenar imóveis" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="relevance">Relevância</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select></label>
        </div> : null}
        {!profileOnly ? (visibleProperties.length > 0 ? (
          <>
            <section id="imoveis" className={kind === "broker" ? "catalog-grid grid min-w-0 scroll-mt-24 auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" : "grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-2"}>
              {visibleProperties.map(({ property }, index) => (
                <article
                  key={property.id}
                  id={`imovel-${property.id}`}
                  className={kind === "broker" ? "eme-catalog-property-card catalog-property-card" : "min-w-0 overflow-hidden rounded-[1.8rem] border border-[#ece4db] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.055)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(15,23,42,0.09)]"}
                >
                  <div className="relative">
                  <button type="button" onClick={() => openProperty(property)} className="block w-full text-left">
                    <div className={kind === "broker" ? "catalog-property-photo relative aspect-[4/3] overflow-hidden bg-[#eef2f0]" : "relative aspect-[2.16/1] overflow-hidden bg-[#eef2f0]"}>
                      {property.images[0]?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={property.images[0].trim()} alt={property.title} loading={index === 0 ? "eager" : "lazy"} decoding="async" onError={(event) => { event.currentTarget.style.display = "none" }} className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none" />
                      ) : (
                        <CatalogImagePlaceholder />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/28 via-black/10 to-transparent" />
                      <div className="eme-catalog-card-badge absolute left-4 top-4 rounded-full border border-white/70 bg-white/82 px-3.5 py-1.5 text-xs font-medium text-[#2f2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_4px_10px_rgba(15,23,42,.07)] backdrop-blur-[14px] backdrop-saturate-[1.35] supports-[backdrop-filter]:bg-white/58">
                        {property.purpose || "Imóvel"}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(property.id)}
                    aria-label={favoriteIds.has(property.id) ? `Remover ${property.title} dos favoritos` : `Favoritar ${property.title}`}
                    aria-pressed={favoriteIds.has(property.id)}
                    className={kind === "broker" ? "eme-catalog-card-action absolute right-3 top-3 flex size-11 items-center justify-center rounded-full border border-white/65 bg-white/82 text-[#2f2f2f] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_5px_12px_rgba(15,23,42,.10)] backdrop-blur-[14px] backdrop-saturate-[1.35] supports-[backdrop-filter]:bg-white/58" : "absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-white/96 text-[#2f2f2f] shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm"}
                  >
                    <Heart className={cn(kind === "broker" ? "size-4" : "size-5", favoriteIds.has(property.id) && "fill-[#159447] text-[#159447]")} />
                  </button>
                  </div>

                  <div className={kind === "broker" ? "flex flex-1 flex-col gap-4 p-4" : "grid gap-6 p-6 sm:p-7"}>
                    <div className={kind === "broker" ? "catalog-card-summary grid gap-2" : "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"}>
                      <div className="min-w-0">
                        <h3 className={kind === "broker" ? "line-clamp-2 text-[17px] font-medium leading-snug tracking-[-0.02em] text-[#111111]" : "line-clamp-2 text-[2rem] font-semibold leading-tight tracking-[-0.05em] text-[#111111]"}>
                          <button type="button" className="text-left" onClick={() => openProperty(property)}>{property.title}</button>
                        </h3>
                        <p className="mt-2.5 flex items-center gap-2 text-sm text-[#838383]">
                          <MapPin className="size-4 shrink-0 text-[#8a8a8a]" />
                          <span className="truncate">{property.location}</span>
                        </p>
                      </div>

                      <div className={kind === "broker" ? "" : "sm:text-right"}>
                        <p className={kind === "broker" ? "break-words text-[23px] font-semibold tracking-tight text-[#172019]" : "break-words whitespace-nowrap text-[2rem] font-semibold tracking-[-0.05em] text-[#2f9c58]"}>
                          {property.price || "Consulte valor"}
                        </p>
                        {kind !== "broker" ? <p className="mt-1.5 text-sm text-[#8a8a8a]">{getShortHighlight(property)}</p> : null}
                      </div>
                    </div>

                    <div className={kind === "broker" ? "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#626b66]" : "flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-[#545454]"}>
                      {property.area && property.area > 0 ? <InlineSpec icon={Maximize2} value={property.area + " m²"} /> : null}
                      {property.bedrooms > 0 ? <InlineSpec icon={Bed} value={formatPositiveCountLabel(property.bedrooms, "quarto", "quartos")} /> : null}
                      {property.parking > 0 ? <InlineSpec icon={Car} value={formatPositiveCountLabel(property.parking, "vaga", "vagas")} /> : null}
                      {property.bathrooms > 0 ? <InlineSpec icon={Bath} value={formatPositiveCountLabel(property.bathrooms, "banheiro", "banheiros")} /> : null}
                    </div>

                    <div className={kind === "broker" ? "mt-auto flex items-center justify-between gap-3" : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"}>
                      <span className="eme-catalog-card-chip inline-flex w-fit rounded-full border border-white/60 bg-white/78 px-3.5 py-1.5 text-xs font-medium text-[#636363] shadow-[inset_0_1px_0_rgba(255,255,255,.86)] backdrop-blur-[12px] supports-[backdrop-filter]:bg-white/55">
                        {property.type === "Bolsao" ? "Bolsão" : property.type}
                      </span>
                      <Button
                        type="button"
                        onClick={() => openProperty(property)}
                        className="eme-catalog-card-interest h-11 rounded-full border border-[#dfe7e1] bg-white/70 px-4 text-xs font-medium text-[#176f3b] shadow-[0_3px_9px_rgba(32,91,53,.06)] hover:bg-white"
                      >
                        <ArrowUpRight className="size-4" />
                        Ver imóvel
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {!listingOnly ? (brokerCatalog ? (
              <div><BrokerCatalogFooterContact catalog={brokerCatalog} onContact={openCatalogLeadModal} /></div>
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
            <Search className="mx-auto mb-4 size-6" />
            <h3 className="text-lg font-semibold text-[#172019]">{favoritesOnly ? "Sua seleção começa aqui" : "Nenhum imóvel com esses filtros"}</h3>
            <p className="mt-2">{favoritesOnly ? "Toque no coração de um imóvel para encontrá-lo aqui depois." : "Tente ampliar o valor ou remover um filtro para ver mais opções."}</p>
            <Button type="button" onClick={clearFilters} className={cn(CATALOG_PRIMARY_CTA_CLASS, "mt-5 h-11")}>Ver todos os imóveis</Button>
          </div>
        )) : null}
      </div>

      {brokerCatalog ? <BrokerContactDialog open={contactOpen} onOpenChange={setContactOpen} catalog={brokerCatalog} /> : null}

      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && closeProperty()}>
        <DialogContent showCloseButton className={cn("catalog-property-modal eme-catalog-property-dialog box-border max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[1.5rem] p-0 sm:rounded-[1.9rem] lg:w-full lg:max-w-6xl [&_[data-slot=dialog-close]]:fixed [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-[max(1rem,env(safe-area-inset-top))] [&_[data-slot=dialog-close]]:z-[90] [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/80 [&_[data-slot=dialog-close]]:bg-white/90 [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:shadow-lg [&_[data-slot=dialog-close]]:backdrop-blur-xl lg:[&_[data-slot=dialog-close]]:absolute lg:[&_[data-slot=dialog-close]]:right-4 lg:[&_[data-slot=dialog-close]]:top-4", CATALOG_DIALOG_SURFACE_CLASS)}>
          {selectedProperty && (
            <>
            <div className="eme-catalog-property-dialog-layout block max-h-[94dvh] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1.14fr)_minmax(370px,0.86fr)]">
              <div className="eme-catalog-property-media-pane min-w-0 max-w-full overflow-x-hidden border-b border-white/70 bg-white/34 p-3 backdrop-blur-[12px] sm:p-4 lg:border-r lg:border-b-0 lg:p-5">
                <DialogTitle className="sr-only">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do imóvel selecionado.</DialogDescription>
                  <div className="eme-catalog-property-media-frame relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.25rem] border border-white/80 bg-[#ecebe7]/70 shadow-[inset_0_1px_0_rgba(255,255,255,.92),0_16px_42px_rgba(22,36,28,.08)] sm:rounded-[1.5rem]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={selectedProperty.title} loading="eager" fetchPriority="high" decoding="async" onError={(event) => { event.currentTarget.style.display = "none" }} className="aspect-[4/3] max-h-[78dvh] w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/3] w-full">
                      <CatalogImagePlaceholder />
                    </div>
                  )}
                  {selectedProperty.images.length > 1 ? (
                    <>
                      <button type="button" aria-label="Imagem anterior" onClick={() => setCurrentImageIndex((current) => current === 0 ? selectedProperty.images.length - 1 : current - 1)} className={cn(CATALOG_ICON_SURFACE_CLASS, "absolute left-4 top-1/2 size-10 -translate-y-1/2 text-[#050505] hover:bg-white")}>
                        <ChevronLeft className="size-5" />
                      </button>
                      <button type="button" aria-label="Próxima imagem" onClick={() => setCurrentImageIndex((current) => current === selectedProperty.images.length - 1 ? 0 : current + 1)} className={cn(CATALOG_ICON_SURFACE_CLASS, "absolute right-4 top-1/2 size-10 -translate-y-1/2 text-[#050505] hover:bg-white")}>
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                    ) : null}
                  </div>
                  {selectedProperty.images.length > 1 ? (
                    <div
                      className="eme-catalog-property-gallery mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                            "eme-catalog-property-thumbnail relative aspect-[4/3] w-[76px] shrink-0 overflow-hidden rounded-xl border-2 bg-[#eef2ef] transition sm:w-[92px]",
                            currentImageIndex === index
                              ? "border-[#b38a3b] shadow-[0_5px_14px_rgba(179,138,59,.16)]"
                              : "border-white opacity-75 hover:opacity-100",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={propertyImage} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none" }} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              <div className="eme-catalog-property-info-pane flex w-full min-w-0 max-w-full flex-col overflow-x-clip p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 lg:p-6">
                <p className="eme-catalog-property-location break-words text-sm text-[#6B7280]">{selectedProperty.location}</p>
                <h3 className="eme-catalog-property-title mt-1.5 break-words text-2xl font-semibold leading-tight tracking-[-0.035em] text-[#050505] sm:text-[1.8rem]">{selectedProperty.title}</h3>
                <p className="eme-catalog-property-price mt-3 break-words text-2xl font-bold tracking-[-0.03em] text-[#118a3d] sm:text-[1.75rem]">{selectedProperty.price || "Consulte valor"}</p>
                <div className="eme-catalog-property-features mt-4 flex flex-wrap gap-2">
                  {selectedProperty.area && selectedProperty.area > 0 ? <Feature icon={Maximize2} label={selectedProperty.area + " m²"} /> : null}
                  {selectedProperty.bedrooms > 0 ? <Feature icon={Bed} label={formatPositiveCountLabel(selectedProperty.bedrooms, "quarto", "quartos")} /> : null}
                  {selectedProperty.bathrooms > 0 ? <Feature icon={Bath} label={formatPositiveCountLabel(selectedProperty.bathrooms, "banheiro", "banheiros")} /> : null}
                  {selectedProperty.parking > 0 ? <Feature icon={Car} label={formatPositiveCountLabel(selectedProperty.parking, "vaga", "vagas")} /> : null}
                </div>
                {selectedProperty.description ? (
                  <div className="eme-catalog-property-description mt-5">
                    <p className="text-sm font-medium text-[#374151]">Descrição</p>
                    <p className="mt-2 break-words text-sm leading-6 text-[#6B7280]">{selectedProperty.description}</p>
                  </div>
                ) : null}
                <section className={cn(CATALOG_GLASS_SURFACE_CLASS, "eme-catalog-financing mt-5 w-full min-w-0 max-w-full shrink-0 rounded-2xl p-2.5 lg:p-3")}>
                  <button type="button" onClick={() => setFinancingOpen((current) => !current)} aria-expanded={financingOpen} aria-controls="catalog-financing-simulator" className="eme-catalog-financing-trigger flex w-full items-center gap-2 text-left">
                    <span className={cn(CATALOG_ICON_SURFACE_CLASS, "eme-catalog-financing-icon size-8")}><CircleDollarSign className="size-4" /></span>
                    <h4 className="text-sm font-semibold text-[#1f2b23]">Simule seu financiamento</h4>
                    <ChevronDown className={cn("eme-catalog-financing-chevron ml-auto size-4 text-[#6f7a73] transition-transform duration-300", financingOpen && "rotate-180")} />
                  </button>
                  <div id="catalog-financing-simulator" className={cn("eme-catalog-financing-body grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out", financingOpen ? "mt-2.5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="eme-catalog-financing-grid grid min-w-0 grid-cols-1 gap-1.5 lg:grid-cols-2 lg:gap-2">
                        <FinancingField label="Valor do imóvel"><Input aria-label="Valor do imóvel" readOnly value={formatCurrencyFromCents(propertyValue)} className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs font-medium text-[#344054]")} /></FinancingField>
                        <FinancingField label="Entrada"><StructuredInput kind="currency" value={financingEntry} onValueChange={setFinancingEntry} placeholder="R$ 0,00" aria-label="Valor da entrada" className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs text-[#344054]")} /></FinancingField>
                        <FinancingField label="Valor financiado"><Input aria-label="Valor financiado" readOnly value={formatCurrencyFromCents(financedValue)} className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 bg-white/48 px-2.5 text-xs font-medium text-[#344054]")} /></FinancingField>
                        <FinancingField label="Parcelas"><StructuredInput kind="quantity" value={financingInstallments} onValueChange={(value) => setFinancingInstallments(value.replace(/\D/g, ""))} aria-label="Quantidade de parcelas" className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs text-[#344054]")} /></FinancingField>
                        <FinancingField label="Juros mensais"><StructuredInput kind="percent" value={financingInterest} onValueChange={setFinancingInterest} placeholder="0,89% a.m." aria-label="Juros mensais" className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 px-2.5 text-xs text-[#344054]")} /></FinancingField>
                        <FinancingField label="Parcela estimada"><Input aria-label="Parcela estimada" readOnly value={formatCurrencyFromCents(estimatedInstallment)} className={cn(CATALOG_INPUT_CLASS, "h-[34px] w-full min-w-0 bg-white/48 px-2.5 text-xs font-semibold text-[#0d7137]")} /></FinancingField>
                      </div>
                      <p className="eme-catalog-financing-note mt-2 text-[10px] leading-4 text-[#818a84]">Simulação informativa. Taxas e condições finais dependem da instituição financeira.</p>
                    </div>
                  </div>
                </section>

              </div>
            </div>
                <div className="eme-catalog-property-actions catalog-property-contact-bar">
                  <Button type="button" onClick={() => contactProperty(selectedProperty)} className={cn(CATALOG_PRIMARY_CTA_CLASS, "eme-catalog-property-action-primary h-11 flex-1 text-base font-semibold")}>
                    <MessageCircle className="size-4" />
                    {catalog.whatsApp ? "Falar no WhatsApp" : "Solicitar contato"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => openLeadModal(selectedProperty)} className={cn(CATALOG_SECONDARY_CTA_CLASS, "h-11 catalog-callback")}>Solicitar retorno</Button>
                  <Button type="button" variant="ghost" onClick={() => void shareUrl(`${catalogUrl}#imovel-${selectedProperty.id}`, selectedProperty.title, "Veja este imóvel")} className={cn(CATALOG_SECONDARY_CTA_CLASS, "eme-catalog-property-action-secondary h-11 px-5 text-[#4B5563]")}>
                    <Share2 className="size-4" />
                    <span className="sr-only sm:not-sr-only">Compartilhar imóvel</span>
                  </Button>
                </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadDraft} onOpenChange={(open) => !open && setLeadDraft(null)}>
        <DialogContent className={cn("max-w-[calc(100%-1.5rem)] rounded-[1.75rem] sm:max-w-lg", CATALOG_DIALOG_SURFACE_CLASS)}>
          {leadDraft ? (
            <>
              <DialogTitle className="text-2xl text-[#050505]">
                {leadDraft.property ? "Gostou deste imóvel?" : `Fale com ${catalog.displayName}`}
              </DialogTitle>
              <DialogDescription className="text-[#6B7280]">
                {leadDraft.property
                  ? "Deixe seu nome e telefone para o corretor retornar sobre este imóvel."
                  : "Preencha seus dados para solicitar o retorno do corretor."}
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
                  {isSavingLead ? "Enviando..." : "Solicitar retorno"}
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
    if (eventType === "catalog_view" || eventType === "property_view") trackJourney(eventType === "catalog_view" ? "catalog_view" : "catalog_property_opened", { catalogId: catalogSlug, propertyId, module: "catalog", outcome: "viewed", metadata: { legacySource: "CatalogEvent" }, dedupeKey: `${eventType}:${catalogSlug}:${propertyId ?? ""}` })
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
    <div className="eme-catalog-property-feature inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/58 px-3 py-1.5 text-sm text-[#5F6B7A] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_3px_10px_rgba(37,43,37,.04)] backdrop-blur-[12px]">
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

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#5f5f5f]">{label}</span>
      {children}
    </label>
  )
}
