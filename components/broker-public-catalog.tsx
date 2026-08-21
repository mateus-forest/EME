"use client"

import { AssistantProvider, type AssistantBroker } from "@/components/marketplace/assistant/assistant-provider"
import { PublicCatalogLanding } from "@/components/public-catalog-landing"
import type { PublicBrokerCatalogData } from "@/lib/public-catalog"
import { buildBrokerCatalogPath } from "@/lib/public-catalog-url"
import type { SearchProperty } from "@/lib/marketplace/search-data"

type BrokerPublicCatalogProps = {
  slug: string
  initialCatalog: PublicBrokerCatalogData
  listingOnly?: boolean
  profileOnly?: boolean
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function assistantPropertyType(type: string): SearchProperty["propertyType"] {
  const normalized = normalize(type)
  if (normalized.includes("casa")) return "casa"
  if (normalized.includes("terreno")) return "terreno"
  if (normalized.includes("sobrado")) return "sobrado"
  if (normalized.includes("apart") || normalized.includes("cobertura")) return "apartamento"
  return "comercial"
}

function assistantIntentTags(property: PublicBrokerCatalogData["properties"][number], text: string) {
  const tags: string[] = []
  if (property.area >= 130 || /ampl|espac|terreno|patio/.test(text)) tags.push("mais-espaco", "espaco-familia")
  if (/centro|central/.test(text)) tags.push("perto-do-centro", "perto-de-tudo", "perto-do-trabalho")
  if (/invest|renda|liquidez|condominio|academia|lavanderia/.test(text) || (property.bedrooms > 0 && property.bedrooms <= 2 && property.area > 0 && property.area <= 90)) tags.push("para-investir")
  if (/novo|pronto|mobiliad|reformad|acabamento|chaves/.test(text)) tags.push("pronto-para-morar", "pronto-para-entrar")
  if (/campo|rural|sitio|chacara/.test(text)) tags.push("vida-no-campo", "natureza-e-lazer")
  if (property.bedrooms <= 2 && property.area > 0 && property.area <= 75) tags.push("morar-sozinho")
  if (normalize(property.purpose).includes("venda") && property.priceValue <= 60_000_000) tags.push("primeiro-imovel")
  if (assistantPropertyType(property.type) === "comercial") tags.push("para-o-negocio")
  return [...new Set(tags)]
}

function assistantProperties(catalog: PublicBrokerCatalogData): SearchProperty[] {
  return catalog.properties.map((property) => {
    const text = normalize([
      property.title,
      property.description,
      property.type,
      property.purpose,
      property.neighborhood,
      property.city,
      catalog.serviceArea,
      ...catalog.specialties,
    ].filter(Boolean).join(" "))

    return {
      id: property.id,
      slug: property.id,
      title: property.title,
      city: property.city,
      state: property.state,
      price: Math.round(property.priceValue / 100),
      purpose: normalize(property.purpose).includes("loca") ? "aluguel" : "compra",
      propertyType: assistantPropertyType(property.type),
      bedrooms: property.bedrooms,
      suites: /suite/.test(text) ? 1 : 0,
      bathrooms: property.bathrooms,
      area: property.area,
      parking: property.parking,
      patio: /patio|quintal|area externa|terreno amplo/.test(text),
      furnished: /mobiliad|moveis planejados/.test(text),
      isNew: /novo|lancamento|recem construido/.test(text),
      neighborhood: property.neighborhood,
      region: catalog.serviceArea,
      brokerSlug: catalog.slug,
      intentTags: assistantIntentTags(property, text),
      searchableText: text,
      image: property.images[0] || "/marketplace/placeholder.svg",
      compatibility: "boa",
      reasons: [
        property.neighborhood ? `Localizado em ${property.neighborhood}` : `Imóvel em ${property.city}`,
        property.bedrooms > 0 ? `${property.bedrooms} ${property.bedrooms === 1 ? "quarto" : "quartos"}` : "",
        property.area > 0 ? `${property.area} m² de área cadastrada` : "",
      ].filter(Boolean),
    }
  })
}

export function BrokerPublicCatalog({
  slug,
  initialCatalog,
  listingOnly = false,
  profileOnly = false,
}: BrokerPublicCatalogProps) {
  const currentCatalogPath = buildBrokerCatalogPath(initialCatalog.slug || slug)
  const broker: AssistantBroker = {
    slug: initialCatalog.slug,
    name: initialCatalog.displayName,
    image: initialCatalog.photoUrl || "/marketplace/placeholder-user.jpg",
    specialties: initialCatalog.specialties.length
      ? initialCatalog.specialties
      : [initialCatalog.description || "Atendimento imobiliário"],
    verified: initialCatalog.creciVerified,
  }

  return (
    <div className="marketplace-shell">
      <AssistantProvider
        properties={assistantProperties(initialCatalog)}
        brokers={[broker]}
        initialMessage="Olá. Conte o que procura e eu vou analisar somente os imóveis publicados neste catálogo."
        propertyHref={(property) => `${currentCatalogPath}#imovel-${property.id}`}
        brokerHref={() => `${currentCatalogPath}#contato`}
        confirmedVerificationOnly
        hideUnavailablePropertyFacts
        onPropertySelect={(property) => {
          window.dispatchEvent(new CustomEvent("eme:catalog-open-property", { detail: property.id }))
        }}
        onBrokerSelect={() => {
          window.dispatchEvent(new Event("eme:catalog-open-contact"))
        }}
      >
        <PublicCatalogLanding
          kind="broker"
          slug={slug}
          catalog={initialCatalog}
          listingOnly={listingOnly}
          profileOnly={profileOnly}
        />
      </AssistantProvider>
    </div>
  )
}
