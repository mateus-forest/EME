import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrokerPublicCatalog } from "@/components/broker-public-catalog"
import { getPublicBrokerCatalogBySlug } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"
export const revalidate = 0

type CatalogPageProps = {
  params: Promise<{
    slug: string
  }>
}

const catalogDescription =
  "Encontre imóveis disponíveis, busque por bairro, valor ou estilo e fale diretamente com o corretor."

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
  const { slug } = await params
  const catalog = slug ? await getPublicBrokerCatalogBySlug(slug) : null

  if (!catalog) {
    return {
      title: "Catálogo de imóveis | EME",
      description: catalogDescription,
    }
  }

  const title = `Catálogo de imóveis | ${catalog.displayName}`
  const image = new URL(`/api/catalogs/broker/${catalog.slug}/og-image`, getBaseUrl()).toString()

  return {
    title,
    description: catalogDescription,
    openGraph: {
      title,
      description: catalogDescription,
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: catalogDescription,
      images: [image],
    },
  }
}

export default async function PublicCatalogPage({ params }: CatalogPageProps) {
  const { slug } = await params

  if (!slug) {
    notFound()
  }

  const catalog = await getPublicBrokerCatalogBySlug(slug)

  if (!catalog) {
    notFound()
  }

  return <BrokerPublicCatalog slug={slug} initialCatalog={catalog} />
}
