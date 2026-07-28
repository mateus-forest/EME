"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bath,
  Bed,
  Building2,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flame,
  Heart,
  Link2,
  MessageCircle,
  PencilLine,
  RefreshCw,
  Search,
  Share2,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { PropertyCard } from "@/components/property-card"
import { useBrokerCatalogSettings } from "@/components/use-broker-catalog-settings"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { compressImageToDataUrl } from "@/lib/client-image"
import { getPropertyImages } from "@/lib/property-media"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Property = {
  id: string
  title: string
  location: string
  price: string
  bedrooms: number
  bathrooms: number
  parking: number
  description: string
  images: string[]
}

const quickCatalogFilters = ["Casas", "Apartamentos", "Até 300 mil", "Até 600 mil", "2 quartos", "3 quartos", "Vacaria", "Centro"]

export function BrokerCatalogPage() {
  const { profile } = useBrokerProfile()
  const { settings, saveSettings } = useBrokerCatalogSettings()
  const { properties: brokerProperties, isLoading: isLoadingProperties } = useBrokerProperties()
  const [draftSettings, setDraftSettings] = useState(settings)
  const [saveFeedback, setSaveFeedback] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraftSettings(settings)
  }, [settings])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("eme_broker_catalog_favorites")
      if (stored) setFavorites(JSON.parse(stored))
    } catch {
      setFavorites([])
    }
  }, [])

  const catalogUrl = useMemo(() => {
    if (!draftSettings.slug) return ""
    const origin = typeof window === "undefined" ? "" : window.location.origin
    return `${origin}/catalogo/${draftSettings.slug}`
  }, [draftSettings.slug])
  const catalogInternalUrl = useMemo(() => `/catalogo/${draftSettings.slug}?from=portal`, [draftSettings.slug])
  const currentImage = (selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0] ?? "").trim()
  const needsMore = (selectedProperty?.description.length ?? 0) > 180
  const shortDescription = selectedProperty?.description.slice(0, 180)
  const normalizedSearch = search.trim().toLowerCase()

  const catalogProperties = useMemo(
    () =>
      brokerProperties
        .filter((property) => property.status === "Publicado")
        .map((property) => ({
          id: property.id,
          title: property.title,
          location: property.location,
          price: property.price,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          parking: property.parking,
          description: property.description,
          images: getPropertyImages(property.images, property.id),
        })),
    [brokerProperties],
  )

  const filteredCatalogProperties = useMemo(
    () =>
      catalogProperties.filter((property) =>
        normalizedSearch
          ? property.title.toLowerCase().includes(normalizedSearch) ||
            property.location.toLowerCase().includes(normalizedSearch)
          : true,
      ),
    [catalogProperties, normalizedSearch],
  )

  const propertyWhatsAppUrl = createWhatsAppUrl(
    profile.whatsApp,
    "Olá, tenho interesse neste imóvel",
  )
  const catalogWhatsAppUrl = createWhatsAppUrl(
    profile.whatsApp,
    `Olá, quero ver seu catálogo: ${catalogUrl}`,
  )

  function openProperty(property: Property) {
    setSelectedProperty(property)
    setCurrentImageIndex(0)
    setExpandedDescription(false)
  }

  function closeProperty(open: boolean) {
    if (!open) {
      setSelectedProperty(null)
      setCurrentImageIndex(0)
      setExpandedDescription(false)
    }
  }

  function showPrevImage() {
    if (!selectedProperty) return
    setCurrentImageIndex((current) =>
      current === 0 ? selectedProperty.images.length - 1 : current - 1,
    )
  }

  function showNextImage() {
    if (!selectedProperty) return
    setCurrentImageIndex((current) =>
      current === selectedProperty.images.length - 1 ? 0 : current + 1,
    )
  }

  async function copyCatalogLink() {
    if (!catalogUrl) return

    try {
      await navigator.clipboard.writeText(catalogUrl)
      setCopyFeedback(true)
      window.setTimeout(() => setCopyFeedback(false), 1800)
    } catch {
      setCopyFeedback(false)
    }
  }

  function toggleFavorite(propertyId: string) {
    setFavorites((current) => {
      const next = current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId]
      window.localStorage.setItem("eme_broker_catalog_favorites", JSON.stringify(next))
      return next
    })
  }

  async function shareProperty(property: Property) {
    const url = `${catalogUrl}#imovel-${property.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: property.title, text: "Veja este imóvel", url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopyFeedback(true)
      window.setTimeout(() => setCopyFeedback(false), 1800)
    } catch {
      await navigator.clipboard.writeText(url).catch(() => null)
    }
  }

  function openCatalogLink() {
    if (!draftSettings.slug) return
    window.open(catalogInternalUrl, "_blank", "noopener,noreferrer")
  }

  function triggerPhotoPicker() {
    fileInputRef.current?.click()
  }

  async function handleProfilePhotoChange(file: File | null) {
    if (!file) return
    try {
      const photoUrl = await compressImageToDataUrl(file)
      setDraftSettings((current) => ({ ...current, photoUrl }))
      setSaveFeedback("")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível preparar a foto.")
    }
  }

  async function handleSaveCatalog() {
    try {
      setIsSaving(true)
      const savedSettings = await saveSettings(draftSettings)
      setDraftSettings(savedSettings)
      setSaveFeedback("Catálogo atualizado.")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o catálogo.")
    } finally {
      setIsSaving(false)
      window.setTimeout(() => setSaveFeedback(""), 2200)
    }
  }

  return (
    <BrokerPageShell title="Catálogo">
      <div className="grid max-w-full gap-4 overflow-hidden px-3 py-3 sm:gap-5 sm:px-0 sm:py-0">
        <section className="grid max-w-full gap-6 overflow-hidden xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="max-w-full overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-4 py-5 sm:px-6">
              <CardTitle className="text-xl text-[#050505]">Gestão do catálogo</CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-5 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid min-w-0 gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex w-full min-w-0 flex-col items-center gap-3 md:w-auto">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleProfilePhotoChange(event.target.files?.[0] ?? null)}
                  />
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#009b3a]/20 bg-[radial-gradient(circle_at_50%_35%,rgba(105,240,174,0.22),rgba(0,200,83,0.10)_45%,rgba(255,255,255,0.04))] text-2xl font-semibold text-[#009b3a]">
                    {draftSettings.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draftSettings.photoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(draftSettings.displayName) || "MC"
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={triggerPhotoPicker}
                    className="h-9 max-w-full rounded-full border border-black/[0.06] bg-white/80 px-3 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                  >
                    <Camera className="size-4" />
                    Trocar foto
                  </Button>
                </div>

                <div className="grid min-w-0 gap-4">
                  <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-[#5F6B7A]">Nome do corretor</span>
                      <Input
                        value={draftSettings.displayName}
                        onChange={(event) =>
                          setDraftSettings((current) => ({ ...current, displayName: event.target.value }))
                        }
                        className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-[#5F6B7A]">Link do catálogo</span>
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row">
                          <div className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-sm text-[#7B8491] sm:w-auto sm:shrink-0">
                            <Link2 className="size-4 text-[#7B8491]" />
                            <span>/catalogo/</span>
                          </div>
                          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-black/[0.06] bg-white/80 px-3">
                            <input
                              value={draftSettings.slug}
                              onChange={(event) =>
                                setDraftSettings((current) => ({ ...current, slug: sanitizeSlug(event.target.value) }))
                              }
                              className="h-10 min-w-0 flex-1 truncate bg-transparent text-sm text-[#050505] outline-none placeholder:text-[#9CA3AF]"
                              placeholder="slug-do-corretor"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2 sm:flex sm:flex-row sm:flex-wrap">
                          <Button type="button" variant="ghost" onClick={copyCatalogLink} className="h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] sm:w-auto sm:rounded-full">
                            <Copy className="size-4" />
                            {copyFeedback ? "Link copiado" : "Copiar link"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={openCatalogLink} className="h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] sm:w-auto sm:rounded-full">
                            <PencilLine className="size-4" />
                            Abrir link
                          </Button>
                        </div>
                      </div>
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-[#5F6B7A]">Descrição (opcional)</span>
                    <Textarea
                      value={draftSettings.description}
                      onChange={(event) =>
                        setDraftSettings((current) => ({ ...current, description: event.target.value }))
                      }
                      className="min-h-24 rounded-[1rem] border-black/[0.06] bg-white/80 text-[#050505]"
                    />
                  </label>
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      type="button"
                      onClick={handleSaveCatalog}
                      disabled={isSaving}
                      className="h-10 w-full rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 sm:w-auto"
                    >
                      {isSaving ? "Salvando..." : "Salvar alterações"}
                    </Button>
                    {saveFeedback && <p className="text-sm text-[#009b3a]">{saveFeedback}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">URL pública</p>
                <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5">
                  <Link2 className="size-4 shrink-0 text-[#8B95A1]" />
                  <p className="min-w-0 break-all text-sm font-medium text-[#050505] sm:truncate sm:text-base">{catalogUrl}</p>
                </div>
                <div className="mt-4 grid gap-2 sm:flex sm:flex-row sm:flex-wrap">
                  <Button type="button" variant="ghost" onClick={copyCatalogLink} className="h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] sm:w-auto sm:rounded-full">
                    <Copy className="size-4" />
                    {copyFeedback ? "Link copiado" : "Copiar link"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={openCatalogLink} className="h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] sm:w-auto sm:rounded-full">
                    <PencilLine className="size-4" />
                    Abrir link
                  </Button>
                  <Button asChild className="h-9 w-full rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-[#050505] hover:bg-[#2fe06f] sm:w-auto sm:rounded-full">
                    <a href={catalogWhatsAppUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" />
                      Enviar no WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">

            <Card className="rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1.5 text-sm text-[#009b3a]">
                  <CheckCircle2 className="size-4" />
                  Catálogo ativo
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 px-3 py-1.5 text-sm text-[#5F6B7A]">
                  <RefreshCw className="size-4" />
                  Catálogo sincronizado
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[#009b3a]/20 bg-[radial-gradient(circle_at_50%_35%,rgba(105,240,174,0.22),rgba(0,200,83,0.10)_45%,rgba(255,255,255,0.04))] text-xl font-semibold text-[#009b3a]">
                {draftSettings.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draftSettings.photoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                ) : (
                  getInitials(draftSettings.displayName) || "MC"
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[#050505]">{draftSettings.displayName}</p>
                <p className="text-sm text-[#6B7280]">CRECI {profile.creci}</p>
              </div>
            </div>

            <Button asChild className="h-10 w-full rounded-full bg-[#25D366] px-5 text-sm font-semibold text-[#050505] hover:bg-[#2fe06f] lg:w-auto">
              <a href={propertyWhatsAppUrl} target="_blank" rel="noreferrer">
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          <div className="mt-5 max-w-full sm:max-w-2xl">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#7B8491]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar imóvel"
                  className="h-11 rounded-full border-black/[0.06] bg-white/80 pl-11 text-sm text-[#050505] placeholder:text-[#8B95A1]"
                />
              </div>
              <Button
                type="button"
                onClick={() => setSearch(search.trim())}
                className="h-11 w-full rounded-full bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all duration-200 hover:bg-[#008633] hover:shadow-[#009b3a]/30 sm:w-auto"
              >
                <Search className="size-4" />
                Buscar
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickCatalogFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSearch(filter)}
                  className="rounded-full border border-black/[0.06] bg-white/80 px-3 py-1.5 text-xs text-[#5F6B7A] transition-colors hover:bg-white hover:text-[#050505]"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </section>

        {normalizedSearch && (
          <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
            {filteredCatalogProperties.length} imóvel{filteredCatalogProperties.length === 1 ? "" : "is"} encontrado{filteredCatalogProperties.length === 1 ? "" : "s"}
          </div>
        )}

        {isLoadingProperties ? (
          <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <CatalogSkeletonCard key={index} />
            ))}
          </section>
        ) : filteredCatalogProperties.length > 0 ? (
          <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
            {filteredCatalogProperties.map((property) => (
              <PropertyCard
                key={property.id}
                onClick={() => openProperty(property)}
                title={property.title}
                location={property.location}
                price={property.price}
                bedrooms={property.bedrooms}
                bathrooms={property.bathrooms}
                parking={property.parking}
                image={property.images[0]}
                imageSeed={property.id}
                status="Publicado"
                statusTone="published"
                badges={
                  <>
                    <div className="flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 backdrop-blur-sm">
                      <Flame className="h-3 w-3 text-orange-400" />
                      <span className="text-[10px] text-[#050505]">Publicado</span>
                    </div>
                  </>
                }
                imageActions={
                  <button type="button" onClick={(event) => {
                    event.stopPropagation()
                    toggleFavorite(property.id)
                  }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm">
                    <Heart className={`h-4 w-4 ${favorites.includes(property.id) ? "fill-[#009b3a] text-[#009b3a]" : "text-[#050505]"}`} />
                  </button>
                }
                footer={
                  <Button
                    asChild
                    onClick={(event) => event.stopPropagation()}
                    className="h-10 w-full rounded-full bg-[#25D366] text-sm font-semibold text-[#050505] hover:bg-[#2fe06f]"
                  >
                    <a href={propertyWhatsAppUrl} target="_blank" rel="noreferrer">
                      Falar no WhatsApp
                    </a>
                  </Button>
                }
              />
            ))}
          </section>
        ) : (
          <div className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 px-6 py-12 text-center text-sm text-[#5F6B7A]">
            Nenhum imóvel encontrado.
          </div>
        )}
      </div>

      <Dialog open={!!selectedProperty} onOpenChange={closeProperty}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 p-0 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-5xl"
        >
          {selectedProperty && (
            <div className="grid max-h-[92vh] min-w-0 overflow-y-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="border-b border-black/[0.06] p-4 lg:border-r lg:border-b-0 lg:p-5">
                <DialogTitle className="sr-only">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  Visualização completa do imóvel com imagens, descrição e contato do corretor.
                </DialogDescription>

                <div className="relative overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8]">
                  {currentImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentImage}
                      alt={selectedProperty.title}
                      className="aspect-[1.15/1] max-h-[62vh] w-full object-cover sm:aspect-[1.2/1]"
                    />
                  ) : (
                    <div className="aspect-[1.15/1] w-full sm:aspect-[1.2/1]">
                      <CatalogImagePlaceholder />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button type="button" onClick={() => toggleFavorite(selectedProperty.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#050505] backdrop-blur-sm transition-colors hover:bg-white/85">
                      <Heart className={`size-4 ${favorites.includes(selectedProperty.id) ? "fill-[#009b3a] text-[#009b3a]" : ""}`} />
                    </button>
                    <button type="button" onClick={() => void shareProperty(selectedProperty)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#050505] backdrop-blur-sm transition-colors hover:bg-white/85">
                      <Share2 className="size-4" />
                    </button>
                  </div>

                  {selectedProperty.images.length > 0 ? (
                    <div className="absolute right-4 bottom-4 rounded-full bg-white/85 px-3 py-1 text-xs text-[#050505] backdrop-blur-sm">
                      {currentImageIndex + 1}/{selectedProperty.images.length}
                    </div>
                  ) : null}

                  {selectedProperty.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={showPrevImage}
                        className="absolute top-1/2 left-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#050505] backdrop-blur-sm transition-colors hover:bg-white/85"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={showNextImage}
                        className="absolute top-1/2 right-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#050505] backdrop-blur-sm transition-colors hover:bg-white/85"
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {selectedProperty.images.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setCurrentImageIndex(index)}
                      className={`overflow-hidden rounded-[1rem] border transition-all ${
                        currentImageIndex === index
                          ? "border-[#009b3a]/30 ring-2 ring-[#009b3a]/20"
                          : "border-black/[0.06] opacity-75 hover:opacity-100"
                      }`}
                    >
                      {image.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image.trim()} alt={`Imagem ${index + 1}`} className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-[#fbfbf8]">
                          <Camera className="size-5 text-[#8B95A1]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-w-0 flex-col p-5 lg:p-6">
                <div className="flex-1">
                  <p className="break-words text-sm text-[#7B8491]">{selectedProperty.location}</p>
                  <h3 className="mt-2 break-words text-2xl font-semibold leading-tight text-[#050505] sm:text-3xl">
                    {selectedProperty.title}
                  </h3>
                  <p className="mt-4 break-words text-2xl font-bold text-[#050505] sm:text-3xl">{selectedProperty.price}</p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Feature icon={Bed} label={`${selectedProperty.bedrooms} quartos`} />
                    <Feature icon={Bath} label={`${selectedProperty.bathrooms} banheiros`} />
                    <Feature icon={Car} label={`${selectedProperty.parking} vagas`} />
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-medium text-[#5F6B7A]">Descrição</p>
                    <p className="mt-3 break-words text-sm leading-7 text-[#050505]/62">
                      {expandedDescription || !needsMore
                        ? selectedProperty.description
                        : `${shortDescription}...`}
                    </p>
                    {needsMore && (
                      <button
                        type="button"
                        onClick={() => setExpandedDescription((current) => !current)}
                        className="mt-3 text-sm font-medium text-[#009b3a] transition-opacity hover:opacity-80"
                      >
                        {expandedDescription ? "Ver menos" : "Ver mais"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#009b3a]/20 bg-[radial-gradient(circle_at_50%_35%,rgba(105,240,174,0.22),rgba(0,200,83,0.10)_45%,rgba(255,255,255,0.04))] text-lg font-semibold text-[#009b3a]">
                      {draftSettings.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draftSettings.photoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(draftSettings.displayName) || "MC"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#050505]">{draftSettings.displayName}</p>
                      <p className="text-sm text-[#7B8491]">CRECI {profile.creci}</p>
                    </div>
                  </div>
                  <Button asChild className="mt-4 h-11 w-full rounded-full bg-[#25D366] text-base font-semibold text-[#050505] hover:bg-[#2fe06f]">
                    <a href={propertyWhatsAppUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" />
                      Falar no WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  )
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: typeof Bed
  label: string
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1.5 text-sm text-[#050505]/72">
      <Icon className="size-4 text-[#009b3a]" />
      <span>{label}</span>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function sanitizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function CatalogImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#fbfbf8] px-4 text-center">
      <Building2 className="size-9 text-[#8B95A1]" />
      <p className="mt-3 text-sm font-medium text-[#5F6B7A]">Sem imagem cadastrada</p>
    </div>
  )
}

function CatalogSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8]">
      <div className="eme-shimmer aspect-[4/3] bg-[#f6f7f4]" />
      <div className="grid gap-3 p-4">
        <div className="eme-shimmer h-4 w-2/3 rounded-full bg-white" />
        <div className="eme-shimmer h-3 w-1/2 rounded-full bg-[#f6f7f4]" />
        <div className="eme-shimmer h-9 w-full rounded-full bg-[#f6f7f4]" />
      </div>
    </div>
  )
}
