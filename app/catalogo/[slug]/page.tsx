import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrokerPublicCatalog } from "@/components/broker-public-catalog"
import { buildBrokerCatalogMetadata } from "@/lib/public-catalog-metadata"
import { getPublicBrokerCatalogBySlug } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"
export const revalidate = 0

type CatalogPageProps = {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
  const { slug } = await params
  const catalog = slug ? await getPublicBrokerCatalogBySlug(slug) : null
  return buildBrokerCatalogMetadata(slug, catalog)
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
