// Dados demonstrativos locais das páginas públicas do EME Imóveis.
// Substituir futuramente pelos catálogos e cadastros reais do ecossistema EME.

import type { Property } from '@/lib/marketplace/data'

export type PropertyType = 'casa' | 'apartamento' | 'terreno' | 'comercial' | 'mobiliado'

export type TypeEntry = {
  slug: PropertyType
  label: string
  count: number
}

export type Intent = {
  slug: string
  label: string
  image: string
}

/* ----------------------------- COMPRAR ----------------------------- */

export const buyTypes: TypeEntry[] = [
  { slug: 'casa', label: 'Casas', count: 148 },
  { slug: 'apartamento', label: 'Apartamentos', count: 92 },
  { slug: 'terreno', label: 'Terrenos', count: 37 },
  { slug: 'comercial', label: 'Imóveis comerciais', count: 24 },
]

export const buyProperties: Property[] = [
  {
    slug: 'casa-terrea-com-patio-amplo-1842',
    title: 'Casa térrea com pátio amplo',
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
    slug: 'casa-moderna-com-patio-gramado',
    title: 'Casa moderna com pátio gramado',
    city: 'Vacaria',
    state: 'RS',
    price: 610000,
    bedrooms: 3,
    area: 132,
    parking: 2,
    image: '/marketplace/images/result-gramado.png',
  },
  {
    slug: 'apartamento-novo-centro',
    title: 'Apartamento novo no centro',
    city: 'Vacaria',
    state: 'RS',
    price: 490000,
    bedrooms: 2,
    area: 80,
    parking: 1,
    image: '/marketplace/images/property-3.png',
  },
  {
    slug: 'casa-com-amplo-terreno-area-gourmet',
    title: 'Casa com amplo terreno e área gourmet',
    city: 'Serra Gaúcha',
    state: 'RS',
    price: 820000,
    bedrooms: 4,
    area: 180,
    parking: 3,
    image: '/marketplace/images/result-gourmet.png',
  },
  {
    slug: 'casa-proxima-ao-centro',
    title: 'Casa próxima ao centro',
    city: 'Vacaria',
    state: 'RS',
    price: 650000,
    bedrooms: 3,
    area: 120,
    parking: 2,
    image: '/marketplace/images/result-centro.png',
  },
  {
    slug: 'casa-com-churrasqueira',
    title: 'Casa com pátio e churrasqueira',
    city: 'Campos de Cima da Serra',
    state: 'RS',
    price: 680000,
    bedrooms: 3,
    area: 150,
    parking: 2,
    image: '/marketplace/images/result-churrasqueira.png',
  },
]

export const buyIntents: Intent[] = [
  { slug: 'mais-espaco', label: 'Mais espaço', image: '/marketplace/images/lifestyle-space.png' },
  { slug: 'perto-do-centro', label: 'Perto do centro', image: '/marketplace/images/lifestyle-nearby.png' },
  { slug: 'primeiro-imovel', label: 'Primeiro imóvel', image: '/marketplace/images/lifestyle-ready.png' },
  { slug: 'para-investir', label: 'Para investir', image: '/marketplace/images/lifestyle-invest.png' },
  { slug: 'pronto-para-morar', label: 'Pronto para morar', image: '/marketplace/images/result-gramado.png' },
]

/* ------------------------------ ALUGAR ----------------------------- */

export type Rental = {
  slug: string
  title: string
  city: string
  state: string
  monthly: number
  condo?: number
  bedrooms: number
  area: number
  parking: number
  image: string
  badge?: string
  commercial?: boolean
  featured?: boolean
}

export const rentTypes: TypeEntry[] = [
  { slug: 'casa', label: 'Casas', count: 46 },
  { slug: 'apartamento', label: 'Apartamentos', count: 78 },
  { slug: 'mobiliado', label: 'Imóveis mobiliados', count: 29 },
  { slug: 'comercial', label: 'Imóveis comerciais', count: 18 },
]

export const rentals: Rental[] = [
  {
    slug: 'apartamento-no-centro',
    title: 'Apartamento no centro',
    city: 'Vacaria',
    state: 'RS',
    monthly: 2200,
    condo: 450,
    bedrooms: 2,
    area: 68,
    parking: 1,
    image: '/marketplace/images/rental-apto-centro.png',
    badge: 'Perto do centro',
    featured: true,
  },
  {
    slug: 'casa-para-familia',
    title: 'Casa espaçosa para família',
    city: 'Vacaria',
    state: 'RS',
    monthly: 3500,
    bedrooms: 3,
    area: 160,
    parking: 2,
    image: '/marketplace/images/rental-casa-familia.png',
  },
  {
    slug: 'apartamento-mobiliado',
    title: 'Apartamento mobiliado',
    city: 'Serra Gaúcha',
    state: 'RS',
    monthly: 2800,
    condo: 520,
    bedrooms: 1,
    area: 45,
    parking: 1,
    image: '/marketplace/images/rental-mobiliado.png',
    badge: 'Pronto para entrar',
  },
  {
    slug: 'apartamento-novo-para-alugar',
    title: 'Apartamento novo',
    city: 'Vacaria',
    state: 'RS',
    monthly: 2400,
    condo: 400,
    bedrooms: 2,
    area: 72,
    parking: 1,
    image: '/marketplace/images/rental-apto-novo.png',
  },
  {
    slug: 'sala-comercial-centro',
    title: 'Sala comercial no centro',
    city: 'Vacaria',
    state: 'RS',
    monthly: 1900,
    condo: 300,
    bedrooms: 0,
    area: 55,
    parking: 1,
    image: '/marketplace/images/rental-comercial.png',
    commercial: true,
  },
]

export const rentIntents: Intent[] = [
  { slug: 'morar-sozinho', label: 'Para morar sozinho', image: '/marketplace/images/rental-apto-novo.png' },
  { slug: 'espaco-familia', label: 'Mais espaço para a família', image: '/marketplace/images/rental-casa-familia.png' },
  { slug: 'perto-do-trabalho', label: 'Perto do trabalho', image: '/marketplace/images/rental-apto-centro.png' },
  { slug: 'pronto-para-entrar', label: 'Pronto para entrar', image: '/marketplace/images/rental-mobiliado.png' },
  { slug: 'para-o-negocio', label: 'Para o seu negócio', image: '/marketplace/images/rental-comercial.png' },
]

/* ------------------------------ REGIÕES ---------------------------- */

export type RegionDetail = {
  slug: string
  name: string
  description: string
  image: string
  properties: number
  forSale: number
  forRent: number
  areas: string[]
  tags: string[]
}

export const regionDetails: RegionDetail[] = [
  {
    slug: 'vacaria',
    name: 'Vacaria',
    description:
      'Cidade tranquila dos Campos de Cima da Serra, com clima ameno, boa infraestrutura e forte ligação com o campo. Ideal para quem busca qualidade de vida perto de tudo.',
    image: '/marketplace/images/region-vacaria.png',
    properties: 124,
    forSale: 88,
    forRent: 36,
    areas: ['Centro', 'Bela Vista', 'Santa Catarina', 'Km 3'],
    tags: ['Clima ameno', 'Perto de tudo', 'Bom para famílias'],
  },
  {
    slug: 'serra-gaucha',
    name: 'Serra Gaúcha',
    description:
      'Região de colinas, vinhedos e cidades charmosas. Une natureza exuberante, turismo consolidado e uma rotina acolhedora entre a serra e o vale.',
    image: '/marketplace/images/region-serra.png',
    properties: 86,
    forSale: 60,
    forRent: 26,
    areas: ['Bento Gonçalves', 'Garibaldi', 'Nova Pádua', 'Interior'],
    tags: ['Natureza', 'Turismo', 'Vinhedos'],
  },
  {
    slug: 'campos-de-cima-da-serra',
    name: 'Campos de Cima da Serra',
    description:
      'Planaltos abertos, ar puro e amplos horizontes. Uma região para quem quer espaço, contato com a natureza e um ritmo de vida mais calmo.',
    image: '/marketplace/images/region-campos.png',
    properties: 53,
    forSale: 39,
    forRent: 14,
    areas: ['Bom Jesus', 'São José dos Ausentes', 'Cambará do Sul'],
    tags: ['Espaço', 'Ar puro', 'Vida no campo'],
  },
]

// Regiões mais procuradas (nomes leves para descoberta rápida).
export const popularAreas = [
  'Centro de Vacaria',
  'Bela Vista',
  'Bento Gonçalves',
  'Bom Jesus',
  'São José dos Ausentes',
  'Garibaldi',
  'Cambará do Sul',
  'Santa Catarina',
]

export const regionLifestyles: Intent[] = [
  { slug: 'vida-no-campo', label: 'Vida no campo', image: '/marketplace/images/lifestyle-space.png' },
  { slug: 'perto-do-centro', label: 'Perto do centro', image: '/marketplace/images/lifestyle-nearby.png' },
  { slug: 'natureza-e-lazer', label: 'Natureza e lazer', image: '/marketplace/images/region-serra.png' },
  { slug: 'para-investir', label: 'Para investir', image: '/marketplace/images/lifestyle-invest.png' },
]

/* ---------------------------- CORRETORES --------------------------- */

export type BrokerProfile = {
  slug: string
  name: string
  creci: string
  region: string
  regionSlug: string
  specialty: string
  image: string
  activeListings: number
  rating: number
  reviewCount: number
  featured: boolean
  verified: boolean
  transaction: 'compra' | 'aluguel' | 'ambos'
  propertyTypes: PropertyType[]
}

export const brokerProfiles: BrokerProfile[] = [
  {
    slug: 'carla-goulart',
    name: 'Carla Goulart',
    creci: 'CRECI 00.000-F',
    region: 'Vacaria e região',
    regionSlug: 'vacaria',
    specialty: 'Casas e primeiro imóvel',
    image: '/marketplace/images/broker-carla.png',
    activeListings: 32,
    rating: 4.9,
    reviewCount: 87,
    featured: true,
    verified: true,
    transaction: 'ambos',
    propertyTypes: ['casa', 'apartamento'],
  },
  {
    slug: 'rafael-martins',
    name: 'Rafael Martins',
    creci: 'CRECI 00.000-F',
    region: 'Serra Gaúcha',
    regionSlug: 'serra-gaucha',
    specialty: 'Imóveis de alto padrão',
    image: '/marketplace/images/broker-rafael.png',
    activeListings: 27,
    rating: 4.8,
    reviewCount: 64,
    featured: true,
    verified: true,
    transaction: 'compra',
    propertyTypes: ['casa', 'terreno'],
  },
  {
    slug: 'juliana-ramos',
    name: 'Juliana Ramos',
    creci: 'CRECI 00.000-F',
    region: 'Campos de Cima da Serra',
    regionSlug: 'campos-de-cima-da-serra',
    specialty: 'Casas de campo e terrenos',
    image: '/marketplace/images/broker-juliana.png',
    activeListings: 19,
    rating: 4.9,
    reviewCount: 51,
    featured: true,
    verified: true,
    transaction: 'compra',
    propertyTypes: ['casa', 'terreno'],
  },
  {
    slug: 'marcos-teixeira',
    name: 'Marcos Teixeira',
    creci: 'CRECI 00.000-F',
    region: 'Vacaria e região',
    regionSlug: 'vacaria',
    specialty: 'Locação residencial',
    image: '/marketplace/images/broker-marcos.png',
    activeListings: 41,
    rating: 4.7,
    reviewCount: 73,
    featured: false,
    verified: true,
    transaction: 'aluguel',
    propertyTypes: ['apartamento', 'casa', 'mobiliado'],
  },
  {
    slug: 'fernanda-lima',
    name: 'Fernanda Lima',
    creci: 'CRECI 00.000-F',
    region: 'Serra Gaúcha',
    regionSlug: 'serra-gaucha',
    specialty: 'Apartamentos e investimento',
    image: '/marketplace/images/broker-fernanda.png',
    activeListings: 23,
    rating: 4.8,
    reviewCount: 58,
    featured: false,
    verified: true,
    transaction: 'ambos',
    propertyTypes: ['apartamento', 'comercial'],
  },
  {
    slug: 'diego-souza',
    name: 'Diego Souza',
    creci: 'CRECI 00.000-F',
    region: 'Campos de Cima da Serra',
    regionSlug: 'campos-de-cima-da-serra',
    specialty: 'Imóveis comerciais',
    image: '/marketplace/images/broker-diego.png',
    activeListings: 15,
    rating: 4.5,
    reviewCount: 29,
    featured: false,
    verified: true,
    transaction: 'ambos',
    propertyTypes: ['comercial', 'terreno'],
  },
]

export const brokerRegionOptions = [
  { value: 'all', label: 'Todas as regiões' },
  { value: 'vacaria', label: 'Vacaria' },
  { value: 'serra-gaucha', label: 'Serra Gaúcha' },
  { value: 'campos-de-cima-da-serra', label: 'Campos de Cima da Serra' },
]

export const brokerSpecialtyOptions = [
  { value: 'all', label: 'Todas as especialidades' },
  { value: 'casa', label: 'Casas' },
  { value: 'apartamento', label: 'Apartamentos' },
  { value: 'terreno', label: 'Terrenos' },
  { value: 'comercial', label: 'Comerciais' },
  { value: 'mobiliado', label: 'Mobiliados' },
]

export const brokerTransactionOptions = [
  { value: 'all', label: 'Comprar ou alugar' },
  { value: 'compra', label: 'Comprar' },
  { value: 'aluguel', label: 'Alugar' },
]

export const formatMonthly = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
