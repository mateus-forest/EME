import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrokerPublicCatalog } from "@/components/broker-public-catalog"
import { PublicCatalogUnavailable } from "@/components/public-catalog-unavailable"
import { getPublicBrokerCatalogPageState } from "@/lib/public-catalog"
import { buildBrokerCatalogMetadata } from "@/lib/public-catalog-metadata"

export const dynamic = "force-dynamic"
export const revalidate = 0

type CatalogListingPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    from?: string
  }>
}

export async function generateMetadata({ params }: CatalogListingPageProps): Promise<Metadata> {
  const slug = (await params).slug?.trim() ?? ""
  const state = slug ? await getPublicBrokerCatalogPageState(slug) : null

  return buildBrokerCatalogMetadata(slug, state?.status === "ready" ? state.catalog : null)
}

export default async function BrokerCatalogListingPage({ params, searchParams }: CatalogListingPageProps) {
  const slug = (await params).slug?.trim() ?? ""
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const fromPortal = resolvedSearchParams?.from === "portal"
  const state = await getPublicBrokerCatalogPageState(slug)

  if (state.status === "missing_slug" || state.status === "catalog_not_found") {
    notFound()
  }

  if (state.status !== "ready") {
    return (
      <PublicCatalogUnavailable
        title="Catálogo indisponível"
        message={state.message}
        fromPortal={fromPortal}
      />
    )
  }

  return <BrokerPublicCatalog slug={slug} initialCatalog={state.catalog} listingOnly />
}
