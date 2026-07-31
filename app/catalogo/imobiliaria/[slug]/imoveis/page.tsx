import { notFound } from "next/navigation"

import { AgencyPublicCatalog } from "@/components/agency-public-catalog"
import { getPublicAgencyCatalogBySlug } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AgencyCatalogListingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!slug) {
    notFound()
  }

  const catalog = await getPublicAgencyCatalogBySlug(slug)

  if (!catalog) {
    notFound()
  }

  return <AgencyPublicCatalog slug={slug} initialCatalog={catalog} listingOnly />
}
