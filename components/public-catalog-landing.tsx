"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bath,
  Bed,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  MessageCircle,
  Search,
  Share2,
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

const quickSuggestions = [
  "Alto padrao",
  "Frente mar",
  "Casas",
  "Apartamentos",
  "Investimento",
  "Ate R$ 1 milhao",
]

export function PublicCatalogLanding({ kind, slug, catalog }: PublicCatalogLandingProps) {
  const [search, setSearch] = useState("")
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
    () => rankProperties(properties, searchAnalysis),
    [properties, searchAnalysis],
  )
  const publicPath =
    kind === "broker" ? `/catalogo/${catalog.slug || slug}` : `/catalogo/imobiliaria/${catalog.slug || slug}`
  const catalogUrl = typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`
  const image = (selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0] ?? "").trim()
  const cities = useMemo(
    () => Array.from(new Set(properties.map((property) => property.city).filter(Boolean))),
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
    if (!query) return

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
    <main className="min-h-screen overflow-x-hidden bg-[#f5f7f4] px-4 py-6 text-[#1f2937] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl min-w-0 gap-8">
        {showPortalBackButton ? (
          <div className="sticky top-3 z-30 flex justify-start">
            <Button asChild variant="ghost" className="h-10 rounded-full border border-black/[0.06] bg-white/90 px-4 text-sm text-[#4B5563] shadow-sm backdrop-blur-md hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/catalogo">Voltar ao portal</Link>
            </Button>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[1.9rem] border border-black/[0.05] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-10">
            <div className="min-w-0">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar className="size-20 border border-black/[0.06] sm:size-24">
                  <AvatarImage src={avatarUrl} alt={catalog.displayName} className="size-full object-cover object-center" />
                  <AvatarFallback className="bg-[#eef9f1] text-xl font-semibold text-[#009b3a]">
                    {getInitials(catalog.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#009b3a]">
                    {kind === "broker" ? "Catalogo do corretor" : "Catalogo da imobiliaria"}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#050505] sm:text-4xl">
                    {catalog.displayName || "Catalogo EME"}
                  </h1>
                  {creci ? <p className="mt-2 text-sm text-[#6B7280]">CRECI {creci}</p> : null}
                </div>
              </div>

              <p className="mt-8 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[#050505] sm:text-5xl">
                Um catalogo imobiliario premium, claro e direto para inspirar confianca.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6B7280] sm:text-base">
                {catalog.description || "Veja imoveis selecionados e fale com o responsavel pelo atendimento."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
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
                  className="h-11 rounded-full bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void shareUrl(catalogUrl, catalog.displayName, "Veja este catalogo de imoveis")}
                  className="h-11 rounded-full border border-black/[0.06] bg-white px-5 text-sm text-[#4B5563] hover:bg-[#f8faf8] hover:text-[#050505]"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
                {feedback ? <span className="inline-flex items-center text-sm text-[#009b3a]">{feedback}</span> : null}
              </div>
            </div>

            <div className="grid content-start gap-3">
              <QuickMetric icon={Home} label="Imoveis" value={String(properties.length)} />
              <QuickMetric icon={MapPin} label="Cidades atendidas" value={cities.length ? String(cities.length) : "A consultar"} />
              <QuickMetric icon={Building2} label="Faixa de preco" value={priceRange} />
            </div>
          </div>
        </section>

        <section className="rounded-[1.9rem] border border-black/[0.05] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/15 bg-[#eef9f1] px-3 py-1.5 text-sm text-[#009b3a]">
              <Sparkles className="size-4" />
              Busca inteligente
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505] sm:text-4xl">Encontre o imovel certo mais rapido</h2>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSearch()
                  }}
                  placeholder="Busque por bairro, tipo, cidade, faixa de preco ou caracteristicas"
                  className="h-16 rounded-2xl border-black/[0.08] bg-[#f8faf8] pl-12 pr-4 text-base text-[#050505] placeholder:text-[#9CA3AF]"
                />
              </div>
              <Button
                type="button"
                onClick={submitSearch}
                className="h-16 w-full rounded-2xl bg-[#009b3a] px-7 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(0,155,58,0.16)] transition-all duration-200 hover:bg-[#008633] sm:w-auto"
              >
                <Search className="size-4" />
                Buscar
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {quickSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setSearch(suggestion)}
                  className="rounded-full border border-black/[0.06] bg-[#f8faf8] px-3.5 py-2 text-sm text-[#5F6B7A] transition hover:border-[#009b3a]/16 hover:bg-[#eef9f1] hover:text-[#009b3a]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {search.trim() ? (
              <p className="mt-4 text-sm text-[#6B7280]">
                {visibleProperties.length} imovel{visibleProperties.length === 1 ? "" : "is"} encontrado{visibleProperties.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </section>

        {visibleProperties.length > 0 ? (
          <section className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {visibleProperties.map(({ property, matchLabel }) => (
              <article
                key={property.id}
                id={`imovel-${property.id}`}
                className="min-w-0 overflow-hidden rounded-[1.6rem] border border-black/[0.05] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.1)]"
              >
                <button type="button" onClick={() => openProperty(property)} className="block w-full text-left">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f0]">
                    {property.images[0]?.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={property.images[0].trim()} alt={property.title} className="h-full w-full object-cover" />
                    ) : (
                      <CatalogImagePlaceholder />
                    )}
                    <div className="absolute left-4 top-4 rounded-full border border-white/80 bg-white/92 px-3 py-1 text-xs text-[#009b3a] shadow-sm backdrop-blur">
                      {matchLabel}
                    </div>
                  </div>
                </button>

                <div className="grid gap-4 p-5">
                  <div>
                    <h3 className="line-clamp-2 text-xl font-semibold tracking-tight text-[#050505]">{property.title}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[#6B7280]">
                      <MapPin className="size-4 shrink-0 text-[#009b3a]" />
                      <span className="truncate">{property.location}</span>
                    </p>
                  </div>
                  <p className="break-words text-2xl font-semibold tracking-tight text-[#050505]">{property.price || "Consulte valor"}</p>
                  <div className="flex flex-wrap gap-2.5 text-sm text-[#5F6B7A]">
                    {property.bedrooms > 0 ? <Spec icon={Bed} value={property.bedrooms} /> : null}
                    {property.bathrooms > 0 ? <Spec icon={Bath} value={property.bathrooms} /> : null}
                    {property.parking > 0 ? <Spec icon={Car} value={property.parking} /> : null}
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-[#6B7280]">
                    {getShortHighlight(property)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => openLeadModal(property)}
                      className="h-11 flex-1 rounded-full bg-[#009b3a] text-sm font-semibold text-white hover:bg-[#008633]"
                    >
                      Tenho interesse
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void shareUrl(`${catalogUrl}#imovel-${property.id}`, property.title, "Veja este imovel")}
                      className="h-11 w-11 rounded-full border border-black/[0.06] bg-white p-0 text-[#4B5563] hover:bg-[#f8faf8] hover:text-[#050505]"
                    >
                      <Share2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
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
  const maxPriceMatch = query.match(/ate\s*(\d+)\s*(mil|mi|milhao|milhoes)?/)
  let maxPrice: number | null = null

  if (maxPriceMatch) {
    const amount = Number(maxPriceMatch[1])
    if (Number.isFinite(amount)) {
      maxPrice = amount * (maxPriceMatch[2]?.startsWith("mi") ? 1_000_000_00 : 1_000_00)
    }
  }

  const type = query.includes("casa")
    ? "Casa"
    : query.includes("apartamento") || query.includes("apto")
      ? "Apartamento"
      : query.includes("comercial")
        ? "Comercial"
        : ""

  const features = ["frente mar", "investimento", "alto padrao", "casas", "apartamentos"].filter((feature) =>
    query.includes(feature),
  )

  return {
    query,
    maxPrice,
    type,
    features,
    intent: [type, maxPrice ? `ate ${maxPrice}` : "", ...features].filter(Boolean).join(", ") || rawSearch.trim(),
  }
}

function rankProperties(properties: CatalogProperty[], analysis: ReturnType<typeof analyzeSearch>) {
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
      let score = 0

      if (!analysis.query) score += 2
      for (const term of analysis.query.split(/\s+/).filter((term) => term.length > 2)) {
        if (haystack.includes(term)) score += 2
      }
      if (analysis.type && property.type === analysis.type) score += 8
      if (analysis.maxPrice && property.priceValue <= analysis.maxPrice) score += 7
      for (const feature of analysis.features) {
        if (haystack.includes(feature)) score += 5
      }

      return {
        property,
        score,
        matchLabel: score >= 12 ? "Match alto" : score >= 6 ? "Boa opcao" : "Proximo do que voce procura",
      }
    })
    .filter((item) => !analysis.query || item.score > 0)
    .sort((first, second) => second.score - first.score || second.property.views - first.property.views)
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getPriceRangeLabel(properties: CatalogProperty[]) {
  const prices = properties.map((property) => property.priceValue).filter((price) => price > 0)
  if (!prices.length) return "Consulte"
  return `${formatCompactPrice(Math.min(...prices))} a ${formatCompactPrice(Math.max(...prices))}`
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

function QuickMetric({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-black/[0.06] bg-[#f8faf8] p-5">
      <div className="flex items-center gap-2 text-[#6B7280]">
        <Icon className="size-4 text-[#009b3a]" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#050505]">{value}</p>
    </div>
  )
}

function Spec({ icon: Icon, value }: { icon: typeof Bed; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-[#f8faf8] px-3 py-1.5">
      <Icon className="size-4 text-[#009b3a]" />
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
