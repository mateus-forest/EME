"use client"

import { PublicCatalogLanding } from "@/components/public-catalog-landing"
import type { PublicBrokerCatalogData } from "@/lib/public-catalog"

type BrokerPublicCatalogProps = {
  slug: string
  initialCatalog: PublicBrokerCatalogData
}

export function BrokerPublicCatalog({ slug, initialCatalog }: BrokerPublicCatalogProps) {
  return <PublicCatalogLanding kind="broker" slug={slug} catalog={initialCatalog} />
}
