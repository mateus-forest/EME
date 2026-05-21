"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bath,
  Bed,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  Copy,
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
  "Casas com pátio",
  "Alto padrão",
  "Até 500 mil",
  "Imóveis para investir",
  "Condomínio fechado",
]

export function PublicCatalogLanding({ kind, slug, catalog }: PublicCatalogLandingProps) {
  const [search, setSearch] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<CatalogProperty | null>(null)
  const [leadDraft, setLeadDraft] = useState<LeadDraft | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [leadFeedback, setLeadFeedback] = useState("")
  const [isSavingLead, setIsSavingLead] = useState(false)
  const properties = useMemo(() => normalizeProperties(catalog), [catalog])
  const searchAnalysis = useMemo(() => analyzeSearch(search), [search])
  const visibleProperties = useMemo(
    () => rankProperties(properties, searchAnalysis),
    [properties, searchAnalysis],
  )
  const publicPath =
    kind === "broker" ? `/catalogo/${catalog.slug || slug}` : `/catalogo/imobiliaria/${catalog.slug || slug}`
  const catalogUrl = typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`
  const image = selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0] ?? ""
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
        phone: leadDraft.phone,
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
    <main className="min-h-screen bg-[#0B0B0B] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.94))] shadow-[0_24px_60px_rgba(0,0,0,0.26)]">
          <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] lg:p-9">
            <div className="min-w-0">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar className="size-20 border border-white/10 sm:size-24">
                  <AvatarImage src={avatarUrl} alt={catalog.displayName} className="size-full object-cover object-center" />
                  <AvatarFallback className="bg-[#00C853]/15 text-xl font-semibold text-[#69F0AE]">
                    {getInitials(catalog.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-[0.24em] text-[#69F0AE]">
                    {kind === "broker" ? "Catálogo do corretor" : "Catálogo da imobiliária"}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {catalog.displayName || "Catálogo EME"}
                  </h1>
                  {creci ? <p className="mt-2 text-sm text-white/50">CRECI {creci}</p> : null}
                </div>
              </div>

              <p className="mt-7 max-w-3xl text-2xl font-medium leading-snug tracking-tight text-white sm:text-4xl">
                Encontre o imóvel ideal com busca inteligente.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 sm:text-base">
                {catalog.description || "Veja imóveis selecionados e fale com o responsável pelo atendimento."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
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
                  className="h-11 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:bg-[#2fe06f]"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void shareUrl(catalogUrl, catalog.displayName, "Veja este catálogo de imóveis")}
                  className="h-11 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
                {feedback ? <span className="inline-flex items-center text-sm text-[#69F0AE]">{feedback}</span> : null}
              </div>
            </div>

            <div className="grid content-start gap-3">
              <QuickMetric icon={Home} label="Imóveis" value={String(properties.length)} />
              <QuickMetric icon={MapPin} label="Cidades atendidas" value={cities.length ? String(cities.length) : "A consultar"} />
              <QuickMetric icon={Building2} label="Faixa de preço" value={priceRange} />
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:p-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
              <Sparkles className="size-4" />
              Busca inteligente
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">O que você procura?</h2>
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/38" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Apartamento moderno até 700 mil em Porto Alegre..."
                className="h-14 rounded-2xl border-white/10 bg-white/[0.05] pl-12 pr-4 text-base text-white placeholder:text-white/35"
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {quickSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setSearch(suggestion)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-sm text-white/70 transition hover:border-[#00C853]/20 hover:bg-[#00C853]/10 hover:text-[#69F0AE]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </section>

        {visibleProperties.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {visibleProperties.map(({ property, matchLabel }) => (
              <article
                key={property.id}
                id={`imovel-${property.id}`}
                className="overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(14,14,14,0.94))] shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
              >
                <button type="button" onClick={() => openProperty(property)} className="block w-full text-left">
                  <div className="relative aspect-video overflow-hidden bg-white/[0.03]">
                    {property.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={property.images[0]} alt={property.title} className="h-full w-full object-cover" />
                    ) : (
                      <CatalogImagePlaceholder />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-[#00C853]/20 bg-black/60 px-3 py-1 text-xs text-[#69F0AE] backdrop-blur">
                      {matchLabel}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-2xl font-semibold tracking-tight text-white">{property.price || "Consulte valor"}</p>
                    </div>
                  </div>
                </button>

                <div className="grid gap-4 p-4">
                  <div>
                    <h3 className="line-clamp-2 text-lg font-semibold text-white">{property.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm text-white/50">
                      <MapPin className="size-4 shrink-0 text-[#69F0AE]" />
                      <span className="truncate">{property.location}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5 text-sm text-white/65">
                    {property.bedrooms > 0 ? <Spec icon={Bed} value={property.bedrooms} /> : null}
                    {property.bathrooms > 0 ? <Spec icon={Bath} value={property.bathrooms} /> : null}
                    {property.parking > 0 ? <Spec icon={Car} value={property.parking} /> : null}
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-white/58">
                    {getShortHighlight(property)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => openLeadModal(property)}
                      className="h-10 flex-1 rounded-full bg-[#25D366] text-sm font-semibold text-white hover:bg-[#2fe06f]"
                    >
                      Tenho interesse
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void shareUrl(`${catalogUrl}#imovel-${property.id}`, property.title, "Veja este imóvel")}
                      className="h-10 w-10 rounded-full border border-white/[0.08] bg-white/[0.04] p-0 text-white/70 hover:bg-white/[0.08] hover:text-white"
                    >
                      <Share2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] px-6 py-12 text-center text-sm text-white/65">
            Nenhum imóvel encontrado para essa busca.
          </div>
        )}
      </div>

      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent showCloseButton className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-5xl">
          {selectedProperty && (
            <div className="grid max-h-[92vh] overflow-y-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <div className="border-b border-white/[0.08] p-4 lg:border-b-0 lg:border-r lg:p-5">
                <DialogTitle className="sr-only">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="sr-only">Detalhes do imóvel selecionado.</DialogDescription>
                <div className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={selectedProperty.title} className="aspect-[1.15/1] w-full object-cover sm:aspect-[1.2/1]" />
                  ) : (
                    <div className="aspect-[1.15/1] w-full sm:aspect-[1.2/1]">
                      <CatalogImagePlaceholder />
                    </div>
                  )}
                  {selectedProperty.images.length > 1 ? (
                    <>
                      <button type="button" onClick={() => setCurrentImageIndex((current) => current === 0 ? selectedProperty.images.length - 1 : current - 1)} className="absolute left-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60">
                        <ChevronLeft className="size-5" />
                      </button>
                      <button type="button" onClick={() => setCurrentImageIndex((current) => current === selectedProperty.images.length - 1 ? 0 : current + 1)} className="absolute right-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60">
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col p-5 lg:p-6">
                <p className="text-sm text-white/45">{selectedProperty.location}</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight text-white">{selectedProperty.title}</h3>
                <p className="mt-4 text-3xl font-bold text-white">{selectedProperty.price || "Consulte valor"}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {selectedProperty.bedrooms > 0 ? <Feature icon={Bed} label={`${selectedProperty.bedrooms} quartos`} /> : null}
                  {selectedProperty.bathrooms > 0 ? <Feature icon={Bath} label={`${selectedProperty.bathrooms} banheiros`} /> : null}
                  {selectedProperty.parking > 0 ? <Feature icon={Car} label={`${selectedProperty.parking} vagas`} /> : null}
                </div>
                {selectedProperty.description ? (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-white/70">Descrição</p>
                    <p className="mt-3 text-sm leading-7 text-white/62">{selectedProperty.description}</p>
                  </div>
                ) : null}
                <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                  <Button type="button" onClick={() => openLeadModal(selectedProperty)} className="h-11 flex-1 rounded-full bg-[#25D366] text-base font-semibold text-white hover:bg-[#2fe06f]">
                    <MessageCircle className="size-4" />
                    Tenho interesse
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void shareUrl(`${catalogUrl}#imovel-${selectedProperty.id}`, selectedProperty.title, "Veja este imóvel")} className="h-11 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 text-white/75 hover:bg-white/[0.08] hover:text-white">
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
        <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-lg">
          {leadDraft ? (
            <>
              <DialogTitle className="text-2xl text-white">Gostou deste imóvel?</DialogTitle>
              <DialogDescription className="text-white/58">
                Para falar com o corretor, me diga seu nome 👇
              </DialogDescription>
              <div className="grid gap-4 py-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-white/70">Nome</span>
                  <Input value={leadDraft.name} onChange={(event) => setLeadDraft((current) => current ? { ...current, name: event.target.value } : current)} className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-white/70">Telefone</span>
                  <Input value={leadDraft.phone} onChange={(event) => setLeadDraft((current) => current ? { ...current, phone: event.target.value } : current)} className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-white/70">Mensagem</span>
                  <Textarea value={leadDraft.message} onChange={(event) => setLeadDraft((current) => current ? { ...current, message: event.target.value } : current)} className="min-h-24 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                </label>
                {leadFeedback ? <p className="text-sm text-[#69F0AE]">{leadFeedback}</p> : null}
              </div>
              <DialogFooter>
                <Button type="button" onClick={submitLead} disabled={isSavingLead} className="h-11 w-full rounded-xl bg-[#25D366] text-base font-semibold text-white hover:bg-[#2fe06f] disabled:opacity-60">
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
}: {
  eventType: "catalog_view" | "property_view" | "whatsapp_click"
  catalogSlug: string
  catalogType: CatalogKind
  propertyId?: string
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

  const features = ["patio", "churrasqueira", "condominio", "investir", "alto padrao"].filter((feature) =>
    query.includes(feature),
  )

  return {
    query,
    maxPrice,
    type,
    features,
    intent: [type, maxPrice ? `até ${maxPrice}` : "", ...features].filter(Boolean).join(", ") || rawSearch.trim(),
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
        matchLabel: score >= 12 ? "Match alto" : score >= 6 ? "Boa opção" : "Próximo do que você procura",
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
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="size-4 text-[#69F0AE]" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

function Spec({ icon: Icon, value }: { icon: typeof Bed; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
      <Icon className="size-4 text-[#69F0AE]" />
      <span>{value}</span>
    </span>
  )
}

function Feature({ icon: Icon, label }: { icon: typeof Bed; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/72">
      <Icon className="size-4 text-[#69F0AE]" />
      <span>{label}</span>
    </div>
  )
}

function CatalogImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white/[0.03] px-4 text-center">
      <Building2 className="size-9 text-white/30" />
      <p className="mt-3 text-sm font-medium text-white/65">Sem imagem cadastrada</p>
    </div>
  )
}
