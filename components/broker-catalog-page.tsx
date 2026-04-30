"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bath,
  Bed,
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

export function BrokerCatalogPage() {
  const { profile } = useBrokerProfile()
  const { settings, saveSettings } = useBrokerCatalogSettings()
  const { properties: brokerProperties } = useBrokerProperties()
  const [draftSettings, setDraftSettings] = useState(settings)
  const [saveFeedback, setSaveFeedback] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraftSettings(settings)
  }, [settings])

  const catalogUrl = useMemo(() => {
    if (!draftSettings.slug) return ""
    const origin = typeof window === "undefined" ? "" : window.location.origin
    return `${origin}/catalogo/${draftSettings.slug}`
  }, [draftSettings.slug])
  const catalogInternalUrl = useMemo(() => `/catalogo/${draftSettings.slug}`, [draftSettings.slug])
  const currentImage = selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0]
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

  function openCatalogLink() {
    if (!draftSettings.slug) return
    window.open(catalogInternalUrl, "_blank", "noopener,noreferrer")
  }

  function triggerPhotoPicker() {
    fileInputRef.current?.click()
  }

  async function handleProfilePhotoChange(file: File | null) {
    if (!file) return
    const photoUrl = await readFileAsDataUrl(file)
    setDraftSettings((current) => ({ ...current, photoUrl }))
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
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Gestão do catálogo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 pt-0">
              <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex flex-col items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleProfilePhotoChange(event.target.files?.[0] ?? null)}
                  />
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-2xl">
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
                    className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-white/75 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Camera className="size-4" />
                    Trocar foto
                  </Button>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-white/70">Nome do corretor</span>
                      <Input
                        value={draftSettings.displayName}
                        onChange={(event) =>
                          setDraftSettings((current) => ({ ...current, displayName: event.target.value }))
                        }
                        className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-white/70">Link do catálogo</span>
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 items-stretch gap-2">
                          <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/45">
                            <Link2 className="size-4 text-white/40" />
                            <span>/catalogo/</span>
                          </div>
                          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3">
                            <input
                              value={draftSettings.slug}
                              onChange={(event) =>
                                setDraftSettings((current) => ({ ...current, slug: sanitizeSlug(event.target.value) }))
                              }
                              className="h-10 min-w-0 flex-1 truncate bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                              placeholder="slug-do-corretor"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="ghost" onClick={copyCatalogLink} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                            <Copy className="size-4" />
                            {copyFeedback ? "Link copiado" : "Copiar link"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={openCatalogLink} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                            <PencilLine className="size-4" />
                            Abrir link
                          </Button>
                        </div>
                      </div>
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-white/70">Descrição (opcional)</span>
                    <Textarea
                      value={draftSettings.description}
                      onChange={(event) =>
                        setDraftSettings((current) => ({ ...current, description: event.target.value }))
                      }
                      className="min-h-24 rounded-[1rem] border-white/[0.08] bg-white/[0.04] text-white"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleSaveCatalog}
                      disabled={isSaving}
                      className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                    >
                      {isSaving ? "Salvando..." : "Salvar alterações"}
                    </Button>
                    {saveFeedback && <p className="text-sm text-[#69F0AE]">{saveFeedback}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">URL pública</p>
                <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                  <Link2 className="size-4 shrink-0 text-white/35" />
                  <p className="min-w-0 truncate text-base font-medium text-white">{catalogUrl}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={copyCatalogLink} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                    <Copy className="size-4" />
                    {copyFeedback ? "Link copiado" : "Copiar link"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={openCatalogLink} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                    <PencilLine className="size-4" />
                    Abrir link
                  </Button>
                  <Button asChild className="h-9 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white hover:bg-[#2fe06f]">
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

            <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
                  <CheckCircle2 className="size-4" />
                  Catálogo ativo
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white/65">
                  <RefreshCw className="size-4" />
                  Exibindo apenas dados reais
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-xl">
                {draftSettings.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draftSettings.photoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                ) : (
                  getInitials(draftSettings.displayName) || "MC"
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{draftSettings.displayName}</p>
                <p className="text-sm text-white/50">CRECI {profile.creci}</p>
              </div>
            </div>

            <Button asChild className="h-10 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:bg-[#2fe06f]">
              <a href={propertyWhatsAppUrl} target="_blank" rel="noreferrer">
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          <div className="mt-5 max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar imóvel"
                className="h-11 rounded-full border-white/10 bg-white/5 pl-11 text-sm text-white placeholder:text-white/35"
              />
            </div>
          </div>
        </section>

        {normalizedSearch && (
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Filtrando resultados...
          </div>
        )}

        {filteredCatalogProperties.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                      <Flame className="h-3 w-3 text-orange-400" />
                      <span className="text-[10px] text-white">Publicado</span>
                    </div>
                  </>
                }
                imageActions={
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                    <Heart className="h-4 w-4 text-white" />
                  </div>
                }
                footer={
                  <Button
                    asChild
                    onClick={(event) => event.stopPropagation()}
                    className="h-10 w-full rounded-full bg-[#25D366] text-sm font-semibold text-white hover:bg-[#2fe06f]"
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
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] px-6 py-12 text-center text-sm text-white/65">
            Nenhum imóvel encontrado
          </div>
        )}
      </div>

      <Dialog open={!!selectedProperty} onOpenChange={closeProperty}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-5xl"
        >
          {selectedProperty && (
            <div className="grid max-h-[92vh] overflow-y-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="border-b border-white/[0.08] p-4 lg:border-r lg:border-b-0 lg:p-5">
                <DialogTitle className="sr-only">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="sr-only">
                  Visualização completa do imóvel com imagens, descrição e contato do corretor.
                </DialogDescription>

                <div className="relative overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImage}
                    alt={selectedProperty.title}
                    className="aspect-[1.15/1] w-full object-cover sm:aspect-[1.2/1]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60">
                      <Heart className="size-4" />
                    </button>
                    <button className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60">
                      <Share2 className="size-4" />
                    </button>
                  </div>

                  <div className="absolute right-4 bottom-4 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur-sm">
                    {currentImageIndex + 1}/{selectedProperty.images.length}
                  </div>

                  {selectedProperty.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={showPrevImage}
                        className="absolute top-1/2 left-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <button
                        type="button"
                        onClick={showNextImage}
                        className="absolute top-1/2 right-4 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
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
                          ? "border-[#00C853]/30 ring-2 ring-[#00C853]/20"
                          : "border-white/[0.08] opacity-75 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt={`Imagem ${index + 1}`} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col p-5 lg:p-6">
                <div className="flex-1">
                  <p className="text-sm text-white/45">{selectedProperty.location}</p>
                  <h3 className="mt-2 text-3xl font-semibold leading-tight text-white">
                    {selectedProperty.title}
                  </h3>
                  <p className="mt-4 text-3xl font-bold text-white">{selectedProperty.price}</p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Feature icon={Bed} label={`${selectedProperty.bedrooms} quartos`} />
                    <Feature icon={Bath} label={`${selectedProperty.bathrooms} banheiros`} />
                    <Feature icon={Car} label={`${selectedProperty.parking} vagas`} />
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-medium text-white/70">Descrição</p>
                    <p className="mt-3 text-sm leading-7 text-white/62">
                      {expandedDescription || !needsMore
                        ? selectedProperty.description
                        : `${shortDescription}...`}
                    </p>
                    {needsMore && (
                      <button
                        type="button"
                        onClick={() => setExpandedDescription((current) => !current)}
                        className="mt-3 text-sm font-medium text-[#69F0AE] transition-opacity hover:opacity-80"
                      >
                        {expandedDescription ? "Ver menos" : "Ver mais"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-lg">
                      {draftSettings.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draftSettings.photoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(draftSettings.displayName) || "MC"
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{draftSettings.displayName}</p>
                      <p className="text-sm text-white/45">CRECI {profile.creci}</p>
                    </div>
                  </div>
                  <Button asChild className="mt-4 h-11 w-full rounded-full bg-[#25D366] text-base font-semibold text-white hover:bg-[#2fe06f]">
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
    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/72">
      <Icon className="size-4 text-[#69F0AE]" />
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."))

    reader.readAsDataURL(file)
  })
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
