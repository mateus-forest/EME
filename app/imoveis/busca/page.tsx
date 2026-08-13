import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Header } from '@/components/marketplace/header'
import { Footer } from '@/components/marketplace/footer'
import { SearchResults } from '@/components/marketplace/search/search-results'

export const metadata: Metadata = {
  title: 'Resultados da busca | EME Imóveis',
  description:
    'Imóveis que combinam com o que importa para você. Compare, entenda cada escolha e fale com quem conhece a região.',
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  const params = await searchParams
  const estado = params.estado === 'erro' || params.estado === 'vazio' ? params.estado : undefined

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <main id="conteudo" className="flex-1">
        <Suspense fallback={null}>
          <SearchResults initialQuery={params.q} estado={estado} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
