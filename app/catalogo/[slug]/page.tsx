import type { Metadata } from "next"

import { BrokerPublicCatalog } from "@/components/broker-public-catalog"
import { PublicCatalogUnavailable } from "@/components/public-catalog-unavailable"
import { buildBrokerCatalogMetadata } from "@/lib/public-catalog-metadata"
import { getPublicBrokerCatalogPageState } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"
export const revalidate = 0

type CatalogPageProps = {
  params: Promise<{
    slug: string
  }>
  searchParams?: Promise<{
    from?: string
  }>
}

export async function generateMetadata({ params }: CatalogPageProps): Promise<Metadata> {
  const { slug } = await params
  const state = slug ? await getPublicBrokerCatalogPageState(slug) : null
  return buildBrokerCatalogMetadata(slug, state?.status === "ready" ? state.catalog : null)
}

export default async function PublicCatalogPage({ params, searchParams }: CatalogPageProps) {
  const { slug } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const fromPortal = resolvedSearchParams?.from === "portal"
  const state = await getPublicBrokerCatalogPageState(slug ?? "")

  if (state.status !== "ready") {
    return (
      <PublicCatalogUnavailable
        title="Catálogo indisponível"
        message={state.message}
        fromPortal={fromPortal}
      />
    )
  }

  return <BrokerPublicCatalog slug={slug} initialCatalog={state.catalog} />
}
