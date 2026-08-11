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
const CATALOG_OG_IMAGE_RENDER_VERSION = "2"

export function getAppBaseUrl() {
  return "https://www.meueme.com"
}

export function toAbsoluteCatalogUrl(pathname: string) {
  return toPublicWebUrl(pathname)
}

export function getCatalogDescription(catalog?: PublicBrokerCatalogData | null) {
  return catalog?.description?.trim() || DEFAULT_CATALOG_DESCRIPTION
}

export function getBrokerCatalogTitle(catalog?: PublicBrokerCatalogData | null) {
  return catalog?.displayName?.trim() ? `Catálogo de imóveis | ${catalog.displayName.trim()}` : "Catálogo de imóveis | EME"
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
