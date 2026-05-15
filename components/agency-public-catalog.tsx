"use client"

import { PublicCatalogLanding } from "@/components/public-catalog-landing"
import type { PublicAgencyCatalogData } from "@/lib/public-catalog"

export function AgencyPublicCatalog({
  slug,
  initialCatalog,
}: {
  slug: string
  initialCatalog: PublicAgencyCatalogData
}) {
  return <PublicCatalogLanding kind="agency" slug={slug} catalog={initialCatalog} />
}
