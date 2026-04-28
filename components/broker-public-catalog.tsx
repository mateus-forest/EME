"use client"

import { useMemo, useState } from "react"
import {
  Bath,
  Bed,
  Car,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  MessageCircle,
  Search,
  Share2,
  Zap,
} from "lucide-react"

import { PropertyCard } from "@/components/property-card"
import { type PublicBrokerCatalogData } from "@/lib/public-catalog"
import { recordPublicLead } from "@/lib/lead-client"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type BrokerPublicCatalogProps = {
  slug: string
  initialCatalog: PublicBrokerCatalogData
}

type PublicProperty = PublicBrokerCatalogData["properties"][number]

export function BrokerPublicCatalog({ slug, initialCatalog }: BrokerPublicCatalogProps) {
  const [search, setSearch] = useState("")
  const [selectedProperty, setSelectedProperty] = useState<PublicProperty | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [favorites, setFavorites] = useState<string[]>([])
  const catalog = initialCatalog
  const currentImage = selectedProperty?.images[currentImageIndex] ?? selectedProperty?.images[0]

  const normalizedSearch = search.trim().toLowerCase()
  const publicProperties = useMemo(
    () =>
      catalog.properties.filter((property) =>
        normalizedSearch
          ? property.title.toLowerCase().includes(normalizedSearch) ||
            property.location.toLowerCase().includes(normalizedSearch)
          : true,
      ),
    [catalog, normalizedSearch],
  )

  const catalogWhatsAppUrl = createWhatsAppUrl(
    catalog.whatsApp,
    `Olá, tenho interesse no catálogo eme.app/${catalog.slug || slug}`,
  )
  const propertyWhatsAppUrl = createWhatsAppUrl(catalog.whatsApp, "Olá, tenho interesse neste imóvel")

  function recordCatalogLead() {
    recordPublicLead({
      catalogSlug: catalog.slug || slug,
      catalogType: "broker",
      source: "broker_catalog_whatsapp",
      message: `Interesse no catálogo ${catalog.slug || slug}`,
    })
  }

  function recordPropertyLead(property: PublicProperty) {
    recordPublicLead({
      propertyId: property.id,
      catalogSlug: catalog.slug || slug,
      catalogType: "broker",
      source: "broker_property_whatsapp",
      message: `Interesse no imóvel ${property.title}`,
    })
  }

  function openProperty(property: PublicProperty) {
    setSelectedProperty(property)
    setCurrentImageIndex(0)
  }

  function closeProperty(open: boolean) {
    if (!open) {
      setSelectedProperty(null)
      setCurrentImageIndex(0)
    }
  }

  function showPrevImage() {
    if (!selectedProperty) return
    setCurrentImageIndex((current) => (current === 0 ? selectedProperty.images.length - 1 : current - 1))
  }

  function showNextImage() {
    if (!selectedProperty) return
    setCurrentImageIndex((current) =>
      current === selectedProperty.images.length - 1 ? 0 : current + 1,
    )
  }

  function toggleFavorite(propertyId: string) {
    setFavorites((current) =>
      current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId],
    )
  }

  return (
    <main className="min-h-screen bg-[#0B0B0B] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border border-white/10">
                <AvatarImage src={catalog.photoUrl} alt={catalog.displayName} />
                <AvatarFallback className="bg-gradient-to-br from-amber-200 to-amber-400 text-base text-black">
                  {getInitials(catalog.displayName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold text-white">{catalog.displayName}</p>
                <p className="text-sm text-white/50">CRECI {catalog.creci}</p>
              </div>
            </div>

            <Button
              asChild
              className="h-10 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:bg-[#2fe06f]"
            >
              <a href={catalogWhatsAppUrl} target="_blank" rel="noreferrer" onClick={recordCatalogLead}>
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">{catalog.description}</p>

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

        {publicProperties.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {publicProperties.map((property) => (
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
                      <span className="text-[10px] text-white">Visto por {property.views} pessoas</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                      <Zap className="h-3 w-3 text-yellow-400" />
                      <span className="text-[10px] text-white">{property.interested} interessados</span>
                    </div>
                  </>
                }
                imageActions={
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleFavorite(property.id)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/55"
                  >
                    <Heart
                      className={`h-4 w-4 ${favorites.includes(property.id) ? "fill-[#69F0AE] text-[#69F0AE]" : "text-white"}`}
                    />
                  </button>
                }
                footer={
                  <Button
                    asChild
                    onClick={(event) => event.stopPropagation()}
                    className="h-10 w-full rounded-full bg-[#25D366] text-sm font-semibold text-white hover:bg-[#2fe06f]"
                  >
                    <a href={propertyWhatsAppUrl} target="_blank" rel="noreferrer" onClick={() => recordPropertyLead(property)}>
                      Falar no WhatsApp
                    </a>
                  </Button>
                }
              />
            ))}
          </section>
        ) : (
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] px-6 py-12 text-center text-sm text-white/65">
            Nenhum imóvel publicado no catálogo ainda.
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
                  <img src={currentImage} alt={selectedProperty.title} className="aspect-[1.15/1] w-full object-cover sm:aspect-[1.2/1]" />

                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(selectedProperty.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                    >
                      <Heart className={`size-4 ${favorites.includes(selectedProperty.id) ? "fill-[#69F0AE] text-[#69F0AE]" : ""}`} />
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
                      key={`${image}-${index}`}
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
                  <h3 className="mt-2 text-3xl font-semibold leading-tight text-white">{selectedProperty.title}</h3>
                  <p className="mt-4 text-3xl font-bold text-white">{selectedProperty.price}</p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Feature icon={Bed} label={`${selectedProperty.bedrooms} quartos`} />
                    <Feature icon={Bath} label={`${selectedProperty.bathrooms} banheiros`} />
                    <Feature icon={Car} label={`${selectedProperty.parking} vagas`} />
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-medium text-white/70">Descrição</p>
                    <p className="mt-3 text-sm leading-7 text-white/62">{selectedProperty.description}</p>
                  </div>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-white/10">
                      <AvatarImage src={catalog.photoUrl} alt={catalog.displayName} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-200 to-amber-400 text-sm text-black">
                        {getInitials(catalog.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{catalog.displayName}</p>
                      <p className="text-sm text-white/45">CRECI {catalog.creci}</p>
                    </div>
                  </div>
                  <Button asChild className="mt-4 h-11 w-full rounded-full bg-[#25D366] text-base font-semibold text-white hover:bg-[#2fe06f]">
                    <a href={propertyWhatsAppUrl} target="_blank" rel="noreferrer" onClick={() => recordPropertyLead(selectedProperty)}>
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
    </main>
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
