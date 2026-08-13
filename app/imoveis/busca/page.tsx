import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Header } from '@/components/marketplace/header'
import { Footer } from '@/components/marketplace/footer'
import { SearchResults } from '@/components/marketplace/search/search-results'
import { filtersFromSearchParams } from '@/lib/marketplace/search-filters'
import { getMarketplaceBrokers, getMarketplaceProperties } from '@/lib/marketplace/server-data'

export const metadata: Metadata = {
  title: 'Resultados da busca | EME Imóveis',
  description:
    'Imóveis que combinam com o que importa para você. Compare, entenda cada escolha e fale com quem conhece a região.',
}

export const dynamic = 'force-dynamic'

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const [results, brokers] = await Promise.all([getMarketplaceProperties(), getMarketplaceBrokers()])
  const estado = params.estado === 'erro' || params.estado === 'vazio' ? params.estado : undefined

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main id="conteudo" className="flex-1">
        <Suspense fallback={null}>
          <SearchResults
            initialQuery={Array.isArray(params.q) ? params.q[0] : params.q}
            initialFilters={filtersFromSearchParams(params)}
            estado={estado}
            results={results}
            brokers={brokers}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
