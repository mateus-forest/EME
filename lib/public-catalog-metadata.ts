import type { Metadata } from "next"
import { createHash } from "node:crypto"

import type { PublicBrokerCatalogData } from "@/lib/public-catalog"
import { buildBrokerCatalogUrl, toPublicWebUrl } from "@/lib/public-catalog-url"

const DEFAULT_CATALOG_DESCRIPTION =
  "Encontre imóveis disponíveis, busque por bairro, valor ou estilo e fale diretamente com o corretor."

export const PREMIUM_FALLBACK_IMAGE_PATH = "/images/catalogo-eme.png"
export const CATALOG_OG_IMAGE_WIDTH = 1200
export const CATALOG_OG_IMAGE_HEIGHT = 630
export const CATALOG_OG_IMAGE_TYPE = "image/png"

// Increment this whenever the generated composition changes so social crawlers
// cannot keep serving bytes from an older renderer under the same image URL.
const CATALOG_OG_IMAGE_RENDER_VERSION = "3"

export function getAppBaseUrl() {
  return "https://www.meueme.com"
}

export function toAbsoluteCatalogUrl(pathname: string) {
  return toPublicWebUrl(pathname)
}

function cleanSpecialty(value: string) {
  return value
    .replace(/^[\s\u2705\u2713\u2714\u2022\-]+/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncateDescription(value: string, maxLength = 155) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

type CatalogSocialProfile = Pick<PublicBrokerCatalogData, "displayName" | "description" | "specialties">

export function getBrokerCatalogSpecialty(
  catalog?: Pick<CatalogSocialProfile, "description" | "specialties"> | null,
) {
  const headline = catalog?.description
    ?.split(/[|\n]/, 1)[0]
    ?.replace(/\s+/g, " ")
    .trim()

  if (headline) return headline

  const specialty = catalog?.specialties
    ?.map(cleanSpecialty)
    .find(Boolean)

  return specialty
    ? `Especialista em ${specialty.toLocaleLowerCase("pt-BR")}`
    : "Atendimento imobiliário personalizado"
}

export function getCatalogDescription(catalog?: CatalogSocialProfile | null) {
  if (!catalog) return DEFAULT_CATALOG_DESCRIPTION

  return truncateDescription(
    `${getBrokerCatalogSpecialty(catalog)}. Conheça o catálogo de ${catalog.displayName} e fale diretamente com o corretor.`,
  )
}

export function getBrokerCatalogTitle(catalog?: Pick<CatalogSocialProfile, "displayName"> | null) {
  return catalog?.displayName?.trim()
    ? `Catálogo de imóveis de ${catalog.displayName.trim()} | EME`
    : "Catálogo de imóveis | EME"
}

export function getBrokerCatalogCanonicalUrl(slug: string) {
  return buildBrokerCatalogUrl(slug)
}

function buildOgImageVersion(catalog?: PublicBrokerCatalogData | null) {
  const source = JSON.stringify({
    renderer: CATALOG_OG_IMAGE_RENDER_VERSION,
    photoUrl: catalog?.photoUrl?.trim() || "fallback",
    title: getBrokerCatalogTitle(catalog),
    description: getCatalogDescription(catalog),
    specialties: catalog?.specialties ?? [],
  })

  return createHash("sha1").update(source).digest("hex").slice(0, 12)
}

export function getBrokerCatalogOgImageUrl(slug: string, catalog?: PublicBrokerCatalogData | null) {
  const version = buildOgImageVersion(catalog)
  return toAbsoluteCatalogUrl(`/api/catalogs/broker/${slug}/og-image?v=${version}`)
}

export function normalizeImageSource(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return ""

  if (trimmed.startsWith("data:image/")) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("/")) return toAbsoluteCatalogUrl(trimmed)

  return ""
}

export function getBrokerCatalogShareImageCandidates(catalog?: PublicBrokerCatalogData | null) {
  return [
    normalizeImageSource(catalog?.bannerUrl),
    normalizeImageSource(catalog?.photoUrl),
    normalizeImageSource(PREMIUM_FALLBACK_IMAGE_PATH),
  ].filter(Boolean)
}

export function getBrokerCatalogPreferredVisualSource(catalog?: PublicBrokerCatalogData | null) {
  return normalizeImageSource(catalog?.photoUrl)
}

export function buildBrokerCatalogMetadata(slug: string, catalog?: PublicBrokerCatalogData | null): Metadata {
  const title = getBrokerCatalogTitle(catalog)
  const description = getCatalogDescription(catalog)
  const canonicalUrl = getBrokerCatalogCanonicalUrl(slug)
  const imageUrl = getBrokerCatalogOgImageUrl(slug, catalog)

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      locale: "pt_BR",
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: CATALOG_OG_IMAGE_WIDTH,
          height: CATALOG_OG_IMAGE_HEIGHT,
          type: CATALOG_OG_IMAGE_TYPE,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: CATALOG_OG_IMAGE_WIDTH,
          height: CATALOG_OG_IMAGE_HEIGHT,
          type: CATALOG_OG_IMAGE_TYPE,
          alt: title,
        },
      ],
    },
  }
}
