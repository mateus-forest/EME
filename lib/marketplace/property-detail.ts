// Dados demonstrativos locais da página individual do imóvel do EME Imóveis.
// Preparados para futura substituição pelos catálogos reais dos corretores.

import type { Compatibility } from '@/lib/marketplace/search-data'
import { formatPrice } from '@/lib/marketplace/search-data'

export type EnvironmentPhoto = {
  key: string
  label: string
  image: string
}

export type PropertyDetail = {
  slug: string
  propertyId: string
  code: string
  title: string
  city: string
  state: string
  price: number
  updatedLabel: string
  bedrooms: number
  suites: number
  bathrooms: number
  area: number
  parking: number
  patio: boolean
  photoCount: number
  compatibility: Compatibility
  // Resumo curto usado no painel de compatibilidade.
  compatibilitySummary: string
  // Critérios da busca de origem, exibidos como referência.
  originCriteria: string[]
  summary: string
  highlights: string[]
  confirmedInfo: string[]
  toConfirm: string[]
  routine: { key: string; label: string; time: string; icon: 'center' | 'market' | 'school' }[]
  gallery: string[]
  environments: EnvironmentPhoto[]
  // Corretor(a) responsável — referência ao catálogo de corretores.
  brokerSlug: string
  brokerCreci: string
  // Posição relativa (0–100) no mapa demonstrativo.
  map: { x: number; y: number }
}

export type SimilarProperty = {
  slug: string
  title: string
  city: string
  state: string
  price: number
  bedrooms: number
  area: number
  compatibility: Compatibility
  image: string
}

export const propertyDetail: PropertyDetail = {
  slug: 'casa-terrea-com-patio-amplo-1842',
  propertyId: '1842',
  code: 'EME 1842',
  title: 'Casa térrea com pátio amplo',
  city: 'Vacaria',
  state: 'RS',
  price: 720000,
  updatedLabel: 'Atualizado recentemente',
  bedrooms: 3,
  suites: 1,
  bathrooms: 2,
  area: 140,
  parking: 2,
  patio: true,
  photoCount: 18,
  compatibility: 'muito',
  compatibilitySummary:
    'Tem pátio, 3 quartos, está em Vacaria e dentro da faixa de até R$ 750 mil.',
  originCriteria: ['Vacaria', 'Até R$ 750 mil', 'Pátio', '3 quartos'],
  summary:
    'Uma casa térrea contemporânea, com ambientes integrados, boa iluminação natural e pátio pensado para aproveitar a área externa.',
  highlights: [
    'Área social integrada',
    'Pátio amplo',
    'Boa iluminação natural',
    'Suíte',
  ],
  confirmedInfo: ['Aceita financiamento', 'Imóvel desocupado', 'Documentação disponível'],
  toConfirm: ['Valor do IPTU', 'Posição solar', 'Data disponível para visita'],
  routine: [
    { key: 'centro', label: 'Centro', time: '6 min', icon: 'center' },
    { key: 'mercado', label: 'Mercado', time: '4 min', icon: 'market' },
    { key: 'escola', label: 'Escola', time: '7 min', icon: 'school' },
  ],
  gallery: [
    '/marketplace/images/imovel-1842-fachada.png',
    '/marketplace/images/imovel-1842-sala.png',
    '/marketplace/images/imovel-1842-area-externa.png',
  ],
  environments: [
    { key: 'fachada', label: 'Fachada', image: '/marketplace/images/imovel-1842-fachada.png' },
    { key: 'sala', label: 'Sala', image: '/marketplace/images/imovel-1842-sala.png' },
    { key: 'cozinha', label: 'Cozinha', image: '/marketplace/images/imovel-1842-cozinha.png' },
    { key: 'suite', label: 'Suíte', image: '/marketplace/images/imovel-1842-suite.png' },
    { key: 'area-externa', label: 'Área externa', image: '/marketplace/images/imovel-1842-area-externa.png' },
  ],
  brokerSlug: 'carla-goulart',
  brokerCreci: 'CRECI 00.000-F',
  map: { x: 34, y: 40 },
}

// Imóveis semelhantes exibidos ao final da decisão.
export const similarProperties: SimilarProperty[] = [
  {
    slug: 'casa-amplo-terreno-area-gourmet-2010',
    title: 'Casa com amplo terreno e área gourmet',
    city: 'Vacaria',
    state: 'RS',
    price: 820000,
    bedrooms: 4,
    area: 180,
    compatibility: 'muito',
    image: '/marketplace/images/result-gourmet.png',
  },
  {
    slug: 'casa-proxima-ao-centro-sem-patio-2011',
    title: 'Casa próxima ao centro sem pátio',
    city: 'Vacaria',
    state: 'RS',
    price: 650000,
    bedrooms: 3,
    area: 120,
    compatibility: 'boa',
    image: '/marketplace/images/result-centro.png',
  },
  {
    slug: 'casa-com-suite-e-churrasqueira-1843',
    title: 'Casa com suíte e churrasqueira',
    city: 'Vacaria',
    state: 'RS',
    price: 680000,
    bedrooms: 3,
    area: 132,
    compatibility: 'boa',
    image: '/marketplace/images/result-churrasqueira.png',
  },
]

export const detailPriceLabel = () => formatPrice(propertyDetail.price)
