// Dados demonstrativos locais da página de resultados do EME Imóveis.
// Preparados para futura substituição por busca real, IA de intenção e catálogos dos corretores.

export type Compatibility = 'muito' | 'boa' | 'considerar'

export type SearchResult = {
  id: string
  slug: string
  title: string
  city: string
  state: string
  price: number
  bedrooms: number
  suites: number
  bathrooms: number
  area: number
  parking: number
  patio: boolean
  furnished: boolean
  isNew: boolean
  image: string
  compatibility: Compatibility
  reasons: string[]
  // Posição relativa (0–100) no mapa demonstrativo de Vacaria.
  map: { x: number; y: number }
}

export type Alternative = {
  slug: string
  title: string
  city: string
  state: string
  price: number
  reason: string
  image: string
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

// Formata valores em Real brasileiro sem centavos (ex.: R$ 720.000).
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export const defaultQuery = 'Casa com pátio em Vacaria, até R$ 750 mil'

export const defaultCriteria: Criterion[] = [
  { key: 'finalidade', label: 'Comprar', icon: 'buy' },
  { key: 'tipo', label: 'Casa', icon: 'home' },
  { key: 'cidade', label: 'Vacaria · RS', icon: 'pin' },
  { key: 'valorMax', label: 'Até R$ 750 mil', icon: 'wallet' },
  { key: 'patio', label: 'Pátio', icon: 'tree' },
]

export const searchResults: SearchResult[] = [
  {
    id: '1842',
    slug: 'casa-terrea-com-patio-amplo-1842',
    title: 'Casa térrea com pátio amplo',
    city: 'Vacaria',
    state: 'RS',
    price: 720000,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    area: 140,
    parking: 2,
    patio: true,
    furnished: false,
    isNew: false,
    image: '/marketplace/images/result-terrea-patio.png',
    compatibility: 'muito',
    reasons: [
      'Tem pátio amplo, como você pediu',
      '3 quartos para acomodar a família',
      'Dentro da sua faixa de até R$ 750 mil',
    ],
    map: { x: 34, y: 40 },
  },
  {
    id: '1843',
    slug: 'casa-com-patio-e-churrasqueira-1843',
    title: 'Casa com pátio e churrasqueira',
    city: 'Vacaria',
    state: 'RS',
    price: 680000,
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    area: 132,
    parking: 2,
    patio: true,
    furnished: false,
    isNew: false,
    image: '/marketplace/images/result-churrasqueira.png',
    compatibility: 'boa',
    reasons: [
      'Pátio com área gourmet e churrasqueira',
      '3 quartos e 2 vagas',
      'Confortavelmente dentro do orçamento',
    ],
    map: { x: 58, y: 30 },
  },
  {
    id: '1844',
    slug: 'casa-moderna-com-patio-gramado-1844',
    title: 'Casa moderna com pátio gramado',
    city: 'Vacaria',
    state: 'RS',
    price: 610000,
    bedrooms: 2,
    suites: 1,
    bathrooms: 1,
    area: 110,
    parking: 1,
    patio: true,
    furnished: false,
    isNew: true,
    image: '/marketplace/images/result-gramado.png',
    compatibility: 'considerar',
    reasons: [
      'Pátio gramado, porém com 2 quartos',
      'Imóvel novo e pronto para morar',
      'Bem abaixo da sua faixa de valor',
    ],
    map: { x: 46, y: 66 },
  },
]

export const alternatives: Alternative[] = [
  {
    slug: 'casa-amplo-terreno-area-gourmet-2010',
    title: 'Casa com amplo terreno e área gourmet',
    city: 'Vacaria',
    state: 'RS',
    price: 820000,
    reason: 'Mais espaço, um pouco acima da faixa',
    image: '/marketplace/images/result-gourmet.png',
  },
  {
    slug: 'casa-proxima-ao-centro-sem-patio-2011',
    title: 'Casa próxima ao centro sem pátio',
    city: 'Vacaria',
    state: 'RS',
    price: 650000,
    reason: 'Sem pátio, mas mais perto do centro',
    image: '/marketplace/images/result-centro.png',
  },
]

// Lista consolidada (resultados + alternativas) usada pela página de detalhe do imóvel.
export type PropertyStub = {
  slug: string
  title: string
  location: string
  priceLabel: string
}

export const searchProperties: PropertyStub[] = [
  ...searchResults.map((p) => ({
    slug: p.slug,
    title: p.title,
    location: `${p.city} · ${p.state}`,
    priceLabel: formatPrice(p.price),
  })),
  ...alternatives.map((p) => ({
    slug: p.slug,
    title: p.title,
    location: `${p.city} · ${p.state}`,
    priceLabel: formatPrice(p.price),
  })),
]

export const sortOptions = [
  { value: 'compatibilidade', label: 'Mais compatíveis' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'area', label: 'Maior área' },
] as const

export type SortValue = (typeof sortOptions)[number]['value']

// Ordem de compatibilidade para ordenação demonstrativa.
export const compatibilityRank: Record<Compatibility, number> = {
  muito: 0,
  boa: 1,
  considerar: 2,
}

export function sortResults(list: SearchResult[], sort: SortValue): SearchResult[] {
  const copy = [...list]
  switch (sort) {
    case 'menor-preco':
      return copy.sort((a, b) => a.price - b.price)
    case 'maior-preco':
      return copy.sort((a, b) => b.price - a.price)
    case 'area':
      return copy.sort((a, b) => b.area - a.area)
    case 'recentes':
      return copy.sort((a, b) => Number(b.isNew) - Number(a.isNew))
    case 'compatibilidade':
    default:
      return copy.sort(
        (a, b) => compatibilityRank[a.compatibility] - compatibilityRank[b.compatibility],
      )
  }
}

// Opções demonstrativas do painel "Mais filtros".
export const moreFilterGroups: { legend: string; options: string[] }[] = [
  { legend: 'Finalidade', options: ['Comprar', 'Alugar'] },
  { legend: 'Tipo do imóvel', options: ['Casa', 'Apartamento', 'Terreno', 'Sobrado'] },
  { legend: 'Quartos', options: ['1+', '2+', '3+', '4+'] },
  { legend: 'Suítes', options: ['1+', '2+', '3+'] },
  { legend: 'Banheiros', options: ['1+', '2+', '3+'] },
  { legend: 'Vagas', options: ['1+', '2+', '3+'] },
  {
    legend: 'Características',
    options: [
      'Pátio',
      'Mobiliado',
      'Aceita financiamento',
      'Imóvel novo',
      'Exclusivo',
      'Publicado recentemente',
    ],
  },
]
