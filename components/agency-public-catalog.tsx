"use client"

import { useMemo, useState } from "react"
import { Flame, Heart, MessageCircle, Search, Users } from "lucide-react"

import { PropertyCard } from "@/components/property-card"
import { type PublicAgencyCatalogData } from "@/lib/public-catalog"
import { recordPublicLead } from "@/lib/lead-client"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AgencyPublicCatalog({
  slug,
  initialCatalog,
}: {
  slug: string
  initialCatalog: PublicAgencyCatalogData
}) {
  const [search, setSearch] = useState("")
  const [favorites, setFavorites] = useState<string[]>([])
  const catalog = initialCatalog

  function toggleFavorite(propertyId: string) {
    setFavorites((current) =>
      current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId],
    )
  }

  const visibleProperties = useMemo(
    () =>
      catalog.properties.filter((property) => {
        if (property.status !== "Publicado") return false
        const q = search.trim().toLowerCase()
        return !q || property.title.toLowerCase().includes(q) || property.location.toLowerCase().includes(q)
      }),
    [catalog, search],
  )

  const whatsAppUrl = createWhatsAppUrl(
    catalog.whatsApp,
    `Olá, tenho interesse no catálogo ${catalog.slug || slug}`,
  )

  function recordCatalogLead() {
    recordPublicLead({
      catalogSlug: catalog.slug || slug,
      catalogType: "agency",
      source: "agency_catalog_whatsapp",
      message: `Interesse no catálogo ${catalog.slug || slug}`,
    })
  }

  function recordPropertyLead(property: PublicAgencyCatalogData["properties"][number]) {
    recordPublicLead({
      propertyId: property.id,
      catalogSlug: catalog.slug || slug,
      catalogType: "agency",
      source: "agency_property_whatsapp",
      message: `Interesse no imóvel ${property.title}`,
    })
  }

  return (
    <main className="min-h-screen bg-[#0B0B0B] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#00C853]/15 text-lg font-semibold text-[#69F0AE]">
                {catalog.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={catalog.logoUrl} alt={catalog.displayName} className="h-full w-full object-cover" />
                ) : (
                  "EP"
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{catalog.displayName}</p>
                <p className="mt-1 max-w-2xl text-sm text-white/50">{catalog.description}</p>
              </div>
            </div>
            <Button asChild className="h-10 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:bg-[#2fe06f]">
              <a href={whatsAppUrl} target="_blank" rel="noreferrer" onClick={recordCatalogLead}>
                <MessageCircle className="size-4" />
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

        {visibleProperties.length > 0 ? (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {visibleProperties.map((property) => (
              <PropertyCard
                key={property.id}
                title={property.title}
                location={property.location}
                price={property.price}
                bedrooms={property.bedrooms}
                bathrooms={property.bathrooms}
                parking={property.parking}
                image={property.image}
                imageSeed={property.id}
                status={property.status}
                statusTone="published"
                badges={
                  <>
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                      <Flame className="h-3 w-3 text-orange-400" />
                      <span className="text-[10px] text-white">Visto por {property.views} pessoas</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                      <Users className="h-3 w-3 text-[#69F0AE]" />
                      <span className="text-[10px] text-white">{property.leads} interessados</span>
                    </div>
                  </>
                }
                imageActions={
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
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
                  <Button asChild className="h-10 w-full rounded-full bg-[#25D366] text-sm font-semibold text-white hover:bg-[#2fe06f]">
                    <a href={whatsAppUrl} target="_blank" rel="noreferrer" onClick={() => recordPropertyLead(property)}>
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
    </main>
  )
}
