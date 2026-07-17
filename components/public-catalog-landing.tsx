"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bath,
  Bed,
  Building2,
  Car,
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
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type CatalogKind = "broker" | "agency"

type CatalogProperty = {
  id: string
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
}

type LeadDraft = {
  property: CatalogProperty
  name: string
  phone: string
  message: string
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
  "Alto padrao",
  "Casas",
  "Coberturas",
  "Frente mar",
  "Investimento",
  "Ate R$ 1 milhao",
  "Mais filtros",
]

export function PublicCatalogLanding({ kind, slug, catalog }: PublicCatalogLandingProps) {
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
  const properties = useMemo(() => normalizeProperties(catalog), [catalog])
  const searchAnalysis = useMemo(() => analyzeSearch(search), [search])
  const visibleProperties = useMemo(
    () => rankProperties(properties, searchAnalysis, advancedFilters),
    [advancedFilters, properties, searchAnalysis],
  )
  const publicPath =
    kind === "broker" ? `/catalogo/${catalog.slug || slug}` : `/catalogo/imobiliaria/${catalog.slug || slug}`
  const catalogUrl = typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`
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
      message: `Ola, tenho interesse no imovel ${property.title}: ${propertyUrl}`,
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
    const whatsappMessage = `Ola, tenho interesse no imovel ${leadDraft.property.title}: ${propertyUrl}. Meu nome e ${name}.`

    try {
      await createPublicLead({
        propertyId: leadDraft.property.id,
        catalogSlug: catalog.slug || slug,
        catalogType: kind,
        source: "catalog",
        name,
        phone: leadDraft.phone,
        message: leadDraft.message,
        searchTerm: search.trim(),
        intent: searchAnalysis.intent,
      })

      if (!catalog.whatsApp) {
        setLeadFeedback("Interesse registrado. O responsavel pelo catalogo recebera seu contato.")
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
      setLeadFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel registrar seu interesse.")
    } finally {
      setIsSavingLead(false)
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f5f1] px-4 py-6 font-[family-name:var(--font-geist-sans)] text-[#1f2937] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid max-w-[1360px] min-w-0 gap-10 lg:gap-12">
        {showPortalBackButton ? (
          <div className="sticky top-3 z-30 flex justify-start">
            <Button asChild variant="ghost" className="h-10 rounded-full border border-black/[0.06] bg-white/90 px-4 text-sm text-[#4B5563] shadow-sm backdrop-blur-md hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/catalogo">Voltar ao portal</Link>
            </Button>
          </div>
        ) : null}

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
                {kind === "broker" ? "Catalogo do corretor" : "Catalogo da imobiliaria"}
              </p>
              <h1 className="mt-2 text-[2.9rem] font-semibold tracking-[-0.055em] text-[#111111] sm:text-[3.65rem]">
                {catalog.displayName || "Catalogo EME"}
              </h1>
              <p className="mt-3 text-[1.04rem] leading-7 text-[#5f5f5f]">
                {catalog.description || "Corretor especialista em imoveis de alto padrao."}
              </p>
              {creci ? <p className="mt-1.5 text-[0.95rem] text-[#707070]">CRECI {creci}</p> : null}

              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button
                  type="button"
                  onClick={() => {
                    if (!catalog.whatsApp) {
                      showFeedback("Contato indisponivel no momento")
                      return
                    }
                    window.open(createWhatsAppUrl(catalog.whatsApp, `Ola, quero saber mais sobre o catalogo ${catalogUrl}`), "_blank", "noopener,noreferrer")
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
                  onClick={() => void shareUrl(catalogUrl, catalog.displayName, "Veja este catalogo de imoveis")}
                  className="h-11 rounded-full border border-[#e6dfd7] bg-white px-6 text-sm font-medium text-[#2f2f2f] shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:bg-[#faf8f5]"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
                {feedback ? <span className="inline-flex items-center text-sm text-[#009b3a]">{feedback}</span> : null}
              </div>
            </div>

            <div className="grid overflow-hidden rounded-[1.6rem] bg-[#fdfcfa] sm:grid-cols-[1fr_1fr_1.55fr] lg:border-l lg:border-[#f0e9e1]">
              <MetricStat icon={Home} label="Imoveis" value={String(properties.length)} />
              <MetricStat icon={MapPin} label="Cidades" value={cities.length ? String(cities.length) : "A consultar"} />
              <MetricStat icon={CircleDollarSign} label="Faixa de preco" value={priceRange} valueClassName="whitespace-nowrap text-[1.6rem] sm:text-[1.75rem]" />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white px-6 py-8 shadow-[0_18px_46px_rgba(15,23,42,0.05)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="mx-auto max-w-none">
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#111111] sm:text-[2.7rem]">
              Encontre seu proximo imovel
            </h2>
            <p className="mt-3 text-base leading-7 text-[#6b6b6b]">
              Busque por bairro, cidade ou caracteristica.
            </p>

            <div className="mt-9 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#9a9a9a]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSearch()
                  }}
                  placeholder="Ex.: apartamento em Porto Alegre ate 900 mil com 2 quartos e vaga"
                  className="h-[4.4rem] rounded-[1.2rem] border-transparent bg-white pl-14 pr-4 text-base text-[#111111] shadow-[inset_0_0_0_1px_rgba(224,217,208,0.9),0_10px_24px_rgba(15,23,42,0.04)] placeholder:text-[#9a9a9a] focus-visible:ring-1 focus-visible:ring-[#d8d0c8]"
                />
              </div>
              <Button
                type="button"
                onClick={submitSearch}
                className="h-[4.4rem] rounded-[1.2rem] bg-[#17181d] px-7 text-lg font-medium text-white shadow-[0_14px_30px_rgba(23,24,29,0.16)] hover:bg-[#111216]"
              >
                Buscar
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {quickSuggestions.map((suggestion) => (
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
                  className="inline-flex items-center gap-2 rounded-full border border-[#efe8df] bg-white px-5 py-3 text-sm font-medium text-[#2f2f2f] shadow-[0_3px_10px_rgba(15,23,42,0.025)] transition hover:border-[#dad2ca] hover:bg-[#faf8f5]"
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
                <FilterField label="Preco maximo">
                  <Input
                    value={advancedFilters.maxPrice}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, maxPrice: event.target.value }))
                    }
                    placeholder="900 mil"
                    className="h-11 rounded-xl border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9a9a9a]"
                  />
                </FilterField>
                <FilterField label="Dormitorios">
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
                <FilterField label="Caracteristicas">
                  <Input
                    value={advancedFilters.feature}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({ ...current, feature: event.target.value }))
                    }
                    placeholder="sacada, piscina, suite"
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
                {visibleProperties.length} imovel{visibleProperties.length === 1 ? "" : "is"} encontrado{visibleProperties.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </section>

        {visibleProperties.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#111111]">Imoveis em destaque</h2>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="text-base font-medium text-[#202020] transition hover:text-[#009b3a]"
              >
                Ver todos
              </button>
            </div>

            <section className="grid min-w-0 grid-cols-1 gap-7 xl:grid-cols-2">
              {visibleProperties.map(({ property, matchLabel }) => (
                <article
                  key={property.id}
                  id={`imovel-${property.id}`}
                  className="min-w-0 overflow-hidden rounded-[1.8rem] border border-[#ece4db] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.055)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(15,23,42,0.09)]"
                >
                  <button type="button" onClick={() => openProperty(property)} className="block w-full text-left">
                    <div className="relative aspect-[2.16/1] overflow-hidden bg-[#eef2f0]">
                      {property.images[0]?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={property.images[0].trim()} alt={property.title} className="h-full w-full object-cover transition duration-700 hover:scale-[1.03]" />
                      ) : (
                        <CatalogImagePlaceholder />
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/28 via-black/10 to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/90 bg-white/96 px-3.5 py-1.5 text-xs font-medium text-[#2f2f2f] shadow-sm backdrop-blur-sm">
                        {matchLabel}
                      </div>
                      <div className="absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-white/96 text-[#2f2f2f] shadow-[0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                        <Heart className="size-5" />
                      </div>
                    </div>
                  </button>

                  <div className="grid gap-6 p-6 sm:p-7">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-[2rem] font-semibold leading-tight tracking-[-0.05em] text-[#111111]">
                          {property.title}
                        </h3>
                        <p className="mt-2.5 flex items-center gap-2 text-sm text-[#838383]">
                          <MapPin className="size-4 shrink-0 text-[#8a8a8a]" />
                          <span className="truncate">{property.location}</span>
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="break-words whitespace-nowrap text-[2rem] font-semibold tracking-[-0.05em] text-[#2f9c58]">
                          {property.price || "Consulte valor"}
                        </p>
                        <p className="mt-1.5 text-sm text-[#8a8a8a]">{getShortHighlight(property)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-[#545454]">
                      {property.bedrooms > 0 ? <InlineSpec icon={Bed} value={`${property.bedrooms} quartos`} /> : null}
                      {property.parking > 0 ? <InlineSpec icon={Car} value={`${property.parking} vagas`} /> : null}
                      {property.bathrooms > 0 ? <InlineSpec icon={Bath} value={`${property.bathrooms} banheiros`} /> : null}
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex w-fit rounded-full border border-[#ebe3da] bg-[#fbfaf8] px-3.5 py-1.5 text-xs font-medium text-[#636363]">
                        {property.type}
                      </span>
                      <Button
                        type="button"
                        onClick={() => openLeadModal(property)}
                        className="h-11 rounded-full border border-[#dce9df] bg-[#fcfffd] px-6 text-sm font-medium text-[#2f8f4f] shadow-[0_8px_18px_rgba(61,151,81,0.08)] hover:bg-[#f3fbf5]"
                      >
                        <MessageCircle className="size-4" />
                        Tenho interesse
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-[1.9rem] border border-[#ece5dc] bg-white px-6 py-7 shadow-[0_16px_38px_rgba(15,23,42,0.045)] sm:px-8 sm:py-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full border border-[#dceadf] bg-[#f4fbf6] text-[#3e9651] shadow-[0_8px_18px_rgba(61,151,81,0.08)]">
                    <MessageCircle className="size-7" />
                  </div>
                  <div>
                    <h3 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-[#111111]">Ainda nao encontrou o imovel ideal?</h3>
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
                      showFeedback("Contato indisponivel no momento")
                      return
                    }
                    window.open(createWhatsAppUrl(catalog.whatsApp, `Ola, quero receber opcoes exclusivas do catalogo ${catalogUrl}`), "_blank", "noopener,noreferrer")
                  }}
                  className="h-12 rounded-full bg-[#f4fbf6] px-6 text-base font-medium text-[#3e9651] shadow-[0_10px_22px_rgba(61,151,81,0.08)] hover:bg-[#eef9f1] hover:text-[#2f7c40]"
                >
                  Falar no WhatsApp
                </Button>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-black/[0.05] bg-white px-6 py-16 text-center text-sm text-[#6B7280] shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
            Nenhum imovel encontrado para essa busca.
          </div>
        )}
      </div>

      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent showCloseButton className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-black/[0.05] bg-white p-0 text-[#1f2937] shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:max-w-5xl">
          {selectedProperty && (
            <div className="grid max-h-[92vh] min-w-0 overflow-y-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <div className="border-b border-black/[0.06] p-4 lg:border-r lg:border-b-0 lg:p-5">
                <DialogTitle className="sr-only">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do imovel selecionado.</DialogDescription>
                <div className="relative overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[#f4f6f4]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={selectedProperty.title} className="aspect-[1.15/1] max-h-[62vh] w-full object-cover sm:aspect-[1.2/1]" />
                  ) : (
                    <div className="aspect-[1.15/1] w-full sm:aspect-[1.2/1]">
                      <CatalogImagePlaceholder />
                    </div>
                  )}
                  {selectedProperty.images.length > 1 ? (
                    <>
                      <button type="button" onClick={() => setCurrentImageIndex((current) => current === 0 ? selectedProperty.images.length - 1 : current - 1)} className="absolute left-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#050505] shadow-sm backdrop-blur-sm hover:bg-white">
                        <ChevronLeft className="size-5" />
                      </button>
                      <button type="button" onClick={() => setCurrentImageIndex((current) => current === selectedProperty.images.length - 1 ? 0 : current + 1)} className="absolute right-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#050505] shadow-sm backdrop-blur-sm hover:bg-white">
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-col p-5 lg:p-6">
                <p className="break-words text-sm text-[#6B7280]">{selectedProperty.location}</p>
                <h3 className="mt-2 break-words text-2xl font-semibold leading-tight text-[#050505] sm:text-3xl">{selectedProperty.title}</h3>
                <p className="mt-4 break-words text-2xl font-bold text-[#050505] sm:text-3xl">{selectedProperty.price || "Consulte valor"}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {selectedProperty.bedrooms > 0 ? <Feature icon={Bed} label={`${selectedProperty.bedrooms} quartos`} /> : null}
                  {selectedProperty.bathrooms > 0 ? <Feature icon={Bath} label={`${selectedProperty.bathrooms} banheiros`} /> : null}
                  {selectedProperty.parking > 0 ? <Feature icon={Car} label={`${selectedProperty.parking} vagas`} /> : null}
                </div>
                {selectedProperty.description ? (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-[#374151]">Descricao</p>
                    <p className="mt-3 break-words text-sm leading-7 text-[#6B7280]">{selectedProperty.description}</p>
                  </div>
                ) : null}
                <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                  <Button type="button" onClick={() => openLeadModal(selectedProperty)} className="h-11 flex-1 rounded-full bg-[#009b3a] text-base font-semibold text-white hover:bg-[#008633]">
                    <MessageCircle className="size-4" />
                    Tenho interesse
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void shareUrl(`${catalogUrl}#imovel-${selectedProperty.id}`, selectedProperty.title, "Veja este imovel")} className="h-11 rounded-full border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-[#f8faf8] hover:text-[#050505]">
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
        <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-black/[0.05] bg-white text-[#1f2937] shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:max-w-lg">
          {leadDraft ? (
            <>
              <DialogTitle className="text-2xl text-[#050505]">Gostou deste imovel?</DialogTitle>
              <DialogDescription className="text-[#6B7280]">
                Para falar com o corretor, me diga seu nome.
              </DialogDescription>
              <div className="grid gap-4 py-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#374151]">Nome</span>
                  <Input value={leadDraft.name} onChange={(event) => setLeadDraft((current) => current ? { ...current, name: event.target.value } : current)} className="h-11 rounded-xl border-black/[0.08] bg-[#f8faf8] text-[#050505]" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#374151]">Telefone</span>
                  <Input value={leadDraft.phone} onChange={(event) => setLeadDraft((current) => current ? { ...current, phone: event.target.value } : current)} className="h-11 rounded-xl border-black/[0.08] bg-[#f8faf8] text-[#050505]" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#374151]">Mensagem</span>
                  <Textarea value={leadDraft.message} onChange={(event) => setLeadDraft((current) => current ? { ...current, message: event.target.value } : current)} className="min-h-24 rounded-xl border-black/[0.08] bg-[#f8faf8] text-[#050505]" />
                </label>
                {leadFeedback ? <p className="text-sm text-[#009b3a]">{leadFeedback}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" onClick={submitLead} disabled={isSavingLead} className="h-11 w-full rounded-xl bg-[#009b3a] text-base font-semibold text-white hover:bg-[#008633] disabled:opacity-60">
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

function analyzeSearch(rawSearch: string) {
  const query = normalizeText(rawSearch)
  const searchTerms = buildSearchTerms(query)
  const maxPrice = extractPriceValue(query)
  const bedrooms = extractNumericIntent(query, ["quarto", "quartos", "dormitorio", "dormitorios"])
  const parking = extractNumericIntent(query, ["vaga", "vagas", "garagem"])
  const type = query.includes("casa")
    ? "Casa"
    : query.includes("apartamento") || query.includes("apto") || query.includes("cobertura")
      ? "Apartamento"
      : query.includes("comercial") || query.includes("sala") || query.includes("loja")
        ? "Comercial"
        : ""
  const features = [
    "frente mar",
    "alto padrao",
    "investimento",
    "suite",
    "sacada",
    "piscina",
    "churrasqueira",
    "academia",
    "gourmet",
  ].filter((feature) => query.includes(feature))

  return {
    query,
    searchTerms,
    maxPrice,
    bedrooms,
    parking,
    type,
    features,
    intent:
      [type, maxPrice ? `ate ${maxPrice}` : "", bedrooms ? `${bedrooms} quartos` : "", parking ? `${parking} vagas` : "", ...features]
        .filter(Boolean)
        .join(", ") || rawSearch.trim(),
  }
}

function rankProperties(
  properties: CatalogProperty[],
  analysis: ReturnType<typeof analyzeSearch>,
  filters: CatalogAdvancedFilters,
) {
  return properties
    .map((property) => {
      const haystack = normalizeText([
        property.title,
        property.description,
        property.city,
        property.neighborhood,
        property.type,
        property.location,
      ].join(" "))
      const compatible =
        matchesNaturalLanguage(property, analysis, haystack) &&
        matchesAdvancedFilters(property, filters, haystack)
      let score = 0

      if (!analysis.query) score += 2
      for (const term of analysis.searchTerms) {
        if (haystack.includes(term)) score += 2
      }
      if (analysis.type && property.type === analysis.type) score += 8
      if (analysis.maxPrice && property.priceValue <= analysis.maxPrice) score += 7
      for (const feature of analysis.features) {
        if (haystack.includes(feature)) score += 5
      }
      if (compatible && score === 0) score = 1

      return {
        property,
        compatible,
        score,
        matchLabel: score >= 12 ? "Destaque" : score >= 6 ? "Selecionado" : "Boa opcao",
      }
    })
    .filter((item) => item.compatible)
    .sort((first, second) => second.score - first.score || second.property.views - first.property.views)
}

function matchesNaturalLanguage(property: CatalogProperty, analysis: ReturnType<typeof analyzeSearch>, haystack: string) {
  if (!analysis.query.trim()) return true

  const searchableTerms = analysis.searchTerms

  if (searchableTerms.length > 0 && searchableTerms.every((term) => !haystack.includes(term))) {
    return false
  }

  if (analysis.type && property.type !== analysis.type) return false
  if (analysis.maxPrice && property.priceValue > analysis.maxPrice) return false
  if (analysis.bedrooms && property.bedrooms < analysis.bedrooms) return false
  if (analysis.parking && property.parking < analysis.parking) return false
  if (analysis.features.some((feature) => !haystack.includes(feature))) return false

  return true
}

function matchesAdvancedFilters(property: CatalogProperty, filters: CatalogAdvancedFilters, haystack: string) {
  if (filters.type && property.type !== filters.type) return false
  if (filters.city && normalizeText(property.city) !== normalizeText(filters.city)) return false
  if (filters.neighborhood && normalizeText(property.neighborhood) !== normalizeText(filters.neighborhood)) return false

  const bedrooms = Number(filters.bedrooms)
  if (Number.isFinite(bedrooms) && bedrooms > 0 && property.bedrooms < bedrooms) return false

  const parking = Number(filters.parking)
  if (Number.isFinite(parking) && parking > 0 && property.parking < parking) return false

  const maxPrice = extractPriceValue(filters.maxPrice)
  if (maxPrice && property.priceValue > maxPrice) return false

  const featureTerms = normalizeText(filters.feature)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  if (featureTerms.some((feature) => !haystack.includes(feature))) return false

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
    .toLowerCase()
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
    "um",
    "uma",
  ])

  return query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
    .filter((term) => !stopWords.has(term))
    .filter((term) => !/^\d+$/.test(term))
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
  valueClassName = "",
}: {
  icon: typeof Home
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex min-h-[138px] flex-col items-center justify-center gap-3 border-b border-[#eee6de] px-5 py-5 text-center last:border-b-0 sm:border-b-0 sm:border-r last:sm:border-r-0">
      <div className="flex size-10 items-center justify-center rounded-full bg-[#f4faf5] text-[#3e9651]">
        <Icon className="size-5" />
      </div>
      <p className={`text-[1.8rem] font-semibold tracking-[-0.05em] text-[#151515] ${valueClassName}`}>{value}</p>
      <p className="text-[0.95rem] text-[#676767]">{label}</p>
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
    <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-[#f8faf8] px-3 py-1.5 text-sm text-[#5F6B7A]">
      <Icon className="size-4 text-[#009b3a]" />
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
  if (suggestion === "Mais filtros") return <SlidersHorizontal className="size-4 text-[#6a6a6a]" />
  if (suggestion === "Ate R$ 1 milhao") return <CircleDollarSign className="size-4 text-[#6a6a6a]" />
  if (suggestion === "Frente mar") return <Sparkles className="size-4 text-[#6a6a6a]" />
  if (suggestion === "Investimento") return <Building2 className="size-4 text-[#6a6a6a]" />
  return <Home className="size-4 text-[#6a6a6a]" />
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#5f5f5f]">{label}</span>
      {children}
    </label>
  )
}
