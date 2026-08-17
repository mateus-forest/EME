// Contratos e utilitários compartilhados da busca pública do EME Imóveis.

export type Compatibility = 'muito' | 'boa' | 'considerar'

export type SearchProperty = {
  id: string
  slug: string
  title: string
  city: string
  state: string
  price: number
  purpose: 'compra' | 'aluguel'
  propertyType: 'casa' | 'apartamento' | 'terreno' | 'sobrado' | 'comercial'
  bedrooms: number
  suites: number
  bathrooms: number
  area: number
  parking: number
  patio: boolean
  furnished: boolean
  isNew: boolean
  neighborhood: string
  region: string
  brokerSlug: string
  intentTags: string[]
  searchableText: string
  image: string
  compatibility: Compatibility
  relevanceScore?: number
  reasons: string[]
}

export type SearchResult = SearchProperty & {
  map: { x: number; y: number }
}

export type Alternative = Pick<SearchResult, 'slug' | 'title' | 'city' | 'state' | 'price' | 'image'> & {
  reason: string
}

export type CriteriaKey =
  | 'finalidade'
  | 'tipo'
  | 'cidade'
  | 'valorMin'
  | 'valorMax'
  | 'quartos'
  | 'banheiros'
  | 'vagas'
  | 'areaMin'
  | 'patio'
  | 'mobiliado'
  | 'novo'
  | `intencao:${string}`

export type Criterion = {
  key: CriteriaKey
  label: string
  icon: 'buy' | 'home' | 'pin' | 'wallet' | 'tree' | 'bed' | 'bath' | 'car' | 'ruler'
}

export const compatibilityLabel: Record<Compatibility, string> = {
  muito: 'Muito compatível',
  boa: 'Boa opção',
  considerar: 'Vale considerar',
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export const sortOptions = [
  { value: 'compatibilidade', label: 'Mais compatíveis' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'area', label: 'Maior área' },
] as const

export type SortValue = (typeof sortOptions)[number]['value']

export const compatibilityRank: Record<Compatibility, number> = {
  muito: 0,
  boa: 1,
  considerar: 2,
}

export function sortResults(list: SearchResult[], sort: SortValue): SearchResult[] {
  const copy = [...list]
  switch (sort) {
    case 'menor-preco': return copy.sort((a, b) => a.price - b.price)
    case 'maior-preco': return copy.sort((a, b) => b.price - a.price)
    case 'area': return copy.sort((a, b) => b.area - a.area)
    case 'recentes': return copy.sort((a, b) => Number(b.isNew) - Number(a.isNew))
    default: return copy.sort((a, b) =>
      (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
      || compatibilityRank[a.compatibility] - compatibilityRank[b.compatibility]
      || Number(b.isNew) - Number(a.isNew)
    )
  }
}
