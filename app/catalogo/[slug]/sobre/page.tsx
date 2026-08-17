import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrokerPublicCatalog } from "@/components/broker-public-catalog"
import { PublicCatalogUnavailable } from "@/components/public-catalog-unavailable"
import { getPublicBrokerCatalogPageState } from "@/lib/public-catalog"
import { buildBrokerCatalogMetadata } from "@/lib/public-catalog-metadata"

export const dynamic = "force-dynamic"
export const revalidate = 0

type BrokerAboutPageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ from?: string }>
}

export async function generateMetadata({ params }: BrokerAboutPageProps): Promise<Metadata> {
  const slug = (await params).slug?.trim() ?? ""
  const state = slug ? await getPublicBrokerCatalogPageState(slug) : null
  const metadata = buildBrokerCatalogMetadata(slug, state?.status === "ready" ? state.catalog : null)
  return {
    ...metadata,
    title: state?.status === "ready" ? `Sobre ${state.catalog.displayName} | EME` : metadata.title,
  }
}

export default async function BrokerAboutPage({ params, searchParams }: BrokerAboutPageProps) {
  const slug = (await params).slug?.trim() ?? ""
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const state = await getPublicBrokerCatalogPageState(slug)

  if (state.status === "missing_slug" || state.status === "catalog_not_found") notFound()
  if (state.status !== "ready") {
    return (
      <PublicCatalogUnavailable
        title="Perfil indisponível"
        message={state.message}
        fromPortal={resolvedSearchParams?.from === "portal"}
      />
    )
  }

  return <BrokerPublicCatalog slug={slug} initialCatalog={state.catalog} profileOnly />
}
