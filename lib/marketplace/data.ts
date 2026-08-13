// Dados demonstrativos locais do EME Imóveis.
// Substituir futuramente pelos catálogos reais dos corretores do ecossistema EME.

export type Property = {
  slug: string
  title: string
  city: string
  state: string
  price: number
  bedrooms: number
  area: number
  parking: number
  image: string
  badge?: string
  featured?: boolean
}

export type Region = {
  slug: string
  name: string
  properties: number
  image: string
}

export type Lifestyle = {
  slug: string
  title: string
  icon: 'space' | 'nearby' | 'invest' | 'ready'
  image: string
}

export type Feature = {
  title: string
  description: string
  icon: 'search' | 'sparkles' | 'compare' | 'phone'
}

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)

export const lifestyles: Lifestyle[] = [
  { slug: 'mais-espaco', title: 'Mais espaço para viver', icon: 'space', image: '/marketplace/images/lifestyle-space.png' },
  { slug: 'perto-de-tudo', title: 'Perto de tudo', icon: 'nearby', image: '/marketplace/images/lifestyle-nearby.png' },
  { slug: 'para-investir', title: 'Para investir', icon: 'invest', image: '/marketplace/images/lifestyle-invest.png' },
  { slug: 'pronto-para-morar', title: 'Pronto para morar', icon: 'ready', image: '/marketplace/images/lifestyle-ready.png' },
]

export const properties: Property[] = [
  {
    slug: 'casa-condominio-fechado-vacaria',
    title: 'Casa em condomínio fechado',
    city: 'Vacaria',
    state: 'RS',
    price: 720000,
    bedrooms: 3,
    area: 140,
    parking: 2,
    image: '/marketplace/images/property-1.png',
    badge: 'Destaque',
    featured: true,
  },
  {
    slug: 'casa-terrea-com-patio-vacaria',
    title: 'Casa térrea com pátio',
    city: 'Vacaria',
    state: 'RS',
    price: 610000,
    bedrooms: 2,
    area: 110,
    parking: 1,
    image: '/marketplace/images/property-2.png',
  },
  {
    slug: 'apartamento-novo-vacaria',
    title: 'Apartamento novo',
    city: 'Vacaria',
    state: 'RS',
    price: 490000,
    bedrooms: 2,
    area: 80,
    parking: 1,
    image: '/marketplace/images/property-3.png',
  },
]

export const regions: Region[] = [
  { slug: 'vacaria', name: 'Vacaria', properties: 124, image: '/marketplace/images/region-vacaria.png' },
  { slug: 'serra-gaucha', name: 'Serra Gaúcha', properties: 86, image: '/marketplace/images/region-serra.png' },
  { slug: 'campos-de-cima-da-serra', name: 'Campos de Cima da Serra', properties: 53, image: '/marketplace/images/region-campos.png' },
]

export const features: Feature[] = [
  {
    title: 'Busca por intenção',
    description: 'Você descreve o que busca em linguagem natural.',
    icon: 'search',
  },
  {
    title: 'Compatibilidade explicada',
    description: 'Entenda por que cada imóvel combina com você.',
    icon: 'sparkles',
  },
  {
    title: 'Comparação inteligente',
    description: 'Compare imóveis de forma simples e visual.',
    icon: 'compare',
  },
  {
    title: 'Contato direto',
    description: 'Fale com corretores locais, sem intermediários.',
    icon: 'phone',
  },
]

// Imóveis usados na demonstração de comparação inteligente.
export const comparison = {
  a: { title: 'Imóvel A', price: 720000, city: 'Vacaria · RS', image: '/marketplace/images/property-1.png' },
  b: { title: 'Imóvel B', price: 610000, city: 'Vacaria · RS', image: '/marketplace/images/property-2.png' },
  highlights: [
    { title: 'Mais espaço', description: 'O Imóvel A tem 30 m² a mais.', icon: 'space' as const },
    { title: 'Melhor localização', description: 'O Imóvel B fica mais perto do centro.', icon: 'location' as const },
    { title: 'Dentro da sua faixa', description: 'Ambos estão no seu orçamento.', icon: 'check' as const },
  ],
}

// Ambientes navegáveis na seção "Explore cada detalhe".
export const environments = ['Sala', 'Cozinha', 'Suíte', 'Área externa'] as const

export const environmentHighlights = [
  { title: 'Área social integrada', verified: true },
  { title: 'Boa iluminação natural', verified: true },
  { title: 'Pátio amplo', verified: true },
]
