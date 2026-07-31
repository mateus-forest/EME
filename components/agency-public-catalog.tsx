"use client"

import { PublicCatalogLanding } from "@/components/public-catalog-landing"
import type { PublicAgencyCatalogData } from "@/lib/public-catalog"

export function AgencyPublicCatalog({
  slug,
  initialCatalog,
  listingOnly = false,
}: {
  slug: string
  initialCatalog: PublicAgencyCatalogData
  listingOnly?: boolean
}) {
  return <PublicCatalogLanding kind="agency" slug={slug} catalog={initialCatalog} listingOnly={listingOnly} />
}
