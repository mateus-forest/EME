import type { Metadata } from 'next'
import { ComparisonExperience } from '@/components/marketplace/comparison-experience'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { getMarketplaceProperties } from '@/lib/marketplace/server-data'

export const metadata: Metadata = {
  title: 'Comparar imóveis | EME Imóveis',
  description: 'Compare imóveis publicados lado a lado no Marketplace EME.',
}

export const dynamic = 'force-dynamic'

export default async function ComparePropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ imoveis?: string }>
}) {
  const { imoveis } = await searchParams
  const searchResults = await getMarketplaceProperties()
  const selectedSlugs = imoveis?.split(',').filter(Boolean) || []
  const selected = selectedSlugs
    .map((slug) => searchResults.find((property) => property.slug === slug))
    .filter((property): property is (typeof searchResults)[number] => Boolean(property))
  const compared = selected.slice(0, 3)

  return (
    <PageShell>
      <ComparisonExperience results={compared} />
    </PageShell>
  )
}
