import type { Metadata } from 'next'
import { ComparisonExperience } from '@/components/marketplace/comparison-experience'
import { PageShell } from '@/components/marketplace/pages/page-shell'

export const metadata: Metadata = {
  title: 'Comparar imóveis | EME Imóveis',
  description: 'Compare imóveis demonstrativos lado a lado no Marketplace EME.',
}

export default function ComparePropertiesPage() {
  return (
    <PageShell>
      <ComparisonExperience />
    </PageShell>
  )
}
