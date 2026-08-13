import type { Metadata } from 'next'
import { ComparisonExperience } from '@/components/marketplace/comparison-experience'
import { PageShell } from '@/components/marketplace/pages/page-shell'
import { searchResults } from '@/lib/marketplace/search-data'

export const metadata: Metadata = {
  title: 'Comparar imóveis | EME Imóveis',
  description: 'Compare imóveis demonstrativos lado a lado no Marketplace EME.',
}

export default async function ComparePropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ imoveis?: string }>
}) {
  const { imoveis } = await searchParams
  const selectedSlugs = imoveis?.split(',').filter(Boolean) || []
  const selected = selectedSlugs
    .map((slug) => searchResults.find((property) => property.slug === slug))
    .filter((property): property is (typeof searchResults)[number] => Boolean(property))
  const compared = selected.length >= 2 ? selected.slice(0, 3) : searchResults.slice(0, 3)

  return (
    <PageShell>
      <ComparisonExperience results={compared} />
    </PageShell>
  )
}
