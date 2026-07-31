"use client"

import { PublicCatalogLanding } from "@/components/public-catalog-landing"
import type { PublicBrokerCatalogData } from "@/lib/public-catalog"

type BrokerPublicCatalogProps = {
  slug: string
  initialCatalog: PublicBrokerCatalogData
  listingOnly?: boolean
}

export function BrokerPublicCatalog({ slug, initialCatalog, listingOnly = false }: BrokerPublicCatalogProps) {
  return <PublicCatalogLanding kind="broker" slug={slug} catalog={initialCatalog} listingOnly={listingOnly} />
}
