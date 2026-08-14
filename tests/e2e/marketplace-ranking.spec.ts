import { expect, test } from '@playwright/test'

import type { SearchResult } from '@/lib/marketplace/search-data'
import {
  emptyMarketplaceFilters,
  filterSearchResults,
  inferMarketplaceFilters,
  replaceInferredMarketplaceFilters,
} from '@/lib/marketplace/search-filters'

function property(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'property-base',
    slug: 'property-base',
    title: 'Apartamento publicado',
    city: 'Cidade',
    state: 'RS',
    price: 500_000,
    purpose: 'compra',
    propertyType: 'apartamento',
    bedrooms: 2,
    suites: 0,
    bathrooms: 1,
    area: 70,
    parking: 1,
    patio: false,
    furnished: false,
    isNew: false,
    neighborhood: 'Bairro residencial',
    region: 'Região urbana',
    brokerSlug: 'corretor',
    intentTags: [],
    searchableText: 'apartamento publicado bairro residencial cidade regiao urbana',
    image: '/marketplace/placeholder.svg',
    compatibility: 'boa',
    reasons: ['Imóvel publicado'],
    map: { x: 40, y: 40 },
    ...overrides,
  }
}

test.describe('Marketplace — matching e ranking por intenção', () => {
  const results = [
    property({
      id: 'compact-invest',
      slug: 'compact-invest',
      title: 'Apartamento compacto no Centro',
      bedrooms: 1,
      area: 48,
      neighborhood: 'Centro',
      searchableText: 'apartamento compacto centro condominio portaria seguranca academia lavanderia elevador',
    }),
    property({
      id: 'family-patio',
      slug: 'family-patio',
      title: 'Casa ampla com pátio',
      propertyType: 'casa',
      bedrooms: 4,
      bathrooms: 3,
      area: 190,
      patio: true,
      price: 890_000,
      searchableText: 'casa ampla quatro quartos patio quintal bairro residencial',
    }),
    property({
      id: 'commercial',
      slug: 'commercial',
      title: 'Sala comercial',
      purpose: 'aluguel',
      propertyType: 'comercial',
      bedrooms: 0,
      area: 58,
      price: 2_900,
      searchableText: 'sala comercial centro regiao central pronta para uso',
    }),
  ]

  test('interpreta pátio amplo com critério real e explicação', () => {
    const query = 'Quero pátio amplo e 3 quartos'
    const filters = inferMarketplaceFilters(query, results)
    const ranked = filterSearchResults(results, filters, query)

    expect(filters.features).toContain('patio')
    expect(filters.intentions).toContain('mais-espaco')
    expect(filters.bedrooms).toBe(3)
    expect(ranked.map((item) => item.slug)).toEqual(['family-patio'])
    expect(ranked[0].reasons.join(' ')).toContain('190 m²')
  })

  test('prioriza investimento compacto com infraestrutura publicada', () => {
    const filters = { ...emptyMarketplaceFilters, features: [], intentions: ['para-investir'] }
    const ranked = filterSearchResults(results, filters)

    expect(ranked[0].slug).toBe('compact-invest')
    expect(ranked[0].relevanceScore).toBeGreaterThan(ranked.at(-1)?.relevanceScore ?? 0)
    expect(ranked[0].reasons.join(' ')).toContain('Estrutura')
  })

  test('aplica uso comercial e localização central aos cards editoriais', () => {
    const business = filterSearchResults(results, {
      ...emptyMarketplaceFilters,
      purpose: 'aluguel',
      features: [],
      intentions: ['para-o-negocio'],
    })
    const central = filterSearchResults(results, {
      ...emptyMarketplaceFilters,
      features: [],
      intentions: ['perto-do-centro'],
    })

    expect(business.map((item) => item.slug)).toEqual(['commercial'])
    expect(central.map((item) => item.slug)).toEqual(['compact-invest', 'commercial'])
  })

  test('troca a intenção inferida sem acumular a busca anterior', () => {
    const previousQuery = 'casa com pátio amplo'
    const current = inferMarketplaceFilters(previousQuery, results)
    const next = replaceInferredMarketplaceFilters(current, previousQuery, 'apartamento para investir', results)

    expect(next.features).not.toContain('patio')
    expect(next.intentions).not.toContain('mais-espaco')
    expect(next.intentions).toContain('para-investir')
    expect(next.propertyType).toBe('apartamento')
  })

  test('não inventa uma faixa de preço quando o usuário não informa valor', () => {
    const query = 'Quero algo na minha faixa'
    const filters = inferMarketplaceFilters(query, results)
    const ranked = filterSearchResults(results, filters, query)

    expect(filters.priceMin).toBeUndefined()
    expect(filters.priceMax).toBeUndefined()
    expect(ranked).toHaveLength(results.length)
  })
})
