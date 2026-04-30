import { notFound } from "next/navigation"

import { BrokerPublicCatalog } from "@/components/broker-public-catalog"
import { getPublicBrokerCatalogBySlug } from "@/lib/public-catalog"

export const dynamic = "force-dynamic"

type CatalogPageProps = {
  params: Promise<{
    slug: string
  }>
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
