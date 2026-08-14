// Conteúdo editorial e contratos do Marketplace. Dados operacionais vêm de server-data.

export type PropertyType = 'casa' | 'apartamento' | 'terreno' | 'comercial' | 'mobiliado'
export type TypeEntry = { slug: PropertyType; label: string; count: number }
export type Intent = { slug: string; label: string; image: string }

export const buyTypes: TypeEntry[] = [
  { slug: 'casa', label: 'Casas', count: 0 },
  { slug: 'apartamento', label: 'Apartamentos', count: 0 },
  { slug: 'terreno', label: 'Terrenos', count: 0 },
  { slug: 'comercial', label: 'Imóveis comerciais', count: 0 },
]
export const buyIntents: Intent[] = [
  { slug: 'mais-espaco', label: 'Mais espaço', image: '/marketplace/images/lifestyle-space.png' },
  { slug: 'perto-do-centro', label: 'Perto do centro', image: '/marketplace/images/lifestyle-nearby.png' },
  { slug: 'primeiro-imovel', label: 'Primeiro imóvel', image: '/marketplace/images/lifestyle-ready.png' },
  { slug: 'para-investir', label: 'Para investir', image: '/marketplace/images/lifestyle-invest.png' },
  { slug: 'pronto-para-morar', label: 'Pronto para morar', image: '/marketplace/images/result-gramado.png' },
]

export type Rental = {
  slug: string; title: string; city: string; state: string; monthly: number; condo?: number
  bedrooms: number; area: number; parking: number; image: string; badge?: string; commercial?: boolean; featured?: boolean
}
export const rentTypes: TypeEntry[] = [
  { slug: 'casa', label: 'Casas', count: 0 },
  { slug: 'apartamento', label: 'Apartamentos', count: 0 },
  { slug: 'mobiliado', label: 'Imóveis mobiliados', count: 0 },
  { slug: 'comercial', label: 'Imóveis comerciais', count: 0 },
]
export const rentIntents: Intent[] = [
  { slug: 'morar-sozinho', label: 'Para morar sozinho', image: '/marketplace/images/rental-apto-novo.png' },
  { slug: 'espaco-familia', label: 'Mais espaço para a família', image: '/marketplace/images/rental-casa-familia.png' },
  { slug: 'perto-do-trabalho', label: 'Perto do trabalho', image: '/marketplace/images/rental-apto-centro.png' },
  { slug: 'pronto-para-entrar', label: 'Pronto para entrar', image: '/marketplace/images/rental-mobiliado.png' },
  { slug: 'para-o-negocio', label: 'Para o seu negócio', image: '/marketplace/images/rental-comercial.png' },
]

export type RegionDetail = {
  slug: string; name: string; description: string; image: string; properties: number; forSale: number; forRent: number; areas: string[]; tags: string[]
}
export const regionDetails: RegionDetail[] = [
  { slug: 'vacaria', name: 'Vacaria', description: 'Cidade tranquila dos Campos de Cima da Serra, com clima ameno, boa infraestrutura e forte ligação com o campo.', image: '/marketplace/images/region-vacaria.png', properties: 0, forSale: 0, forRent: 0, areas: ['Centro', 'Bela Vista', 'Santa Catarina', 'Km 3'], tags: ['Clima ameno', 'Perto de tudo', 'Bom para famílias'] },
  { slug: 'serra-gaucha', name: 'Serra Gaúcha', description: 'Região de colinas, vinhedos e cidades charmosas, com natureza, turismo e uma rotina acolhedora.', image: '/marketplace/images/region-serra.png', properties: 0, forSale: 0, forRent: 0, areas: ['Bento Gonçalves', 'Garibaldi', 'Nova Pádua', 'Interior'], tags: ['Natureza', 'Turismo', 'Vinhedos'] },
  { slug: 'campos-de-cima-da-serra', name: 'Campos de Cima da Serra', description: 'Planaltos abertos, ar puro e amplos horizontes para quem busca espaço e contato com a natureza.', image: '/marketplace/images/region-campos.png', properties: 0, forSale: 0, forRent: 0, areas: ['Bom Jesus', 'São José dos Ausentes', 'Cambará do Sul'], tags: ['Espaço', 'Ar puro', 'Vida no campo'] },
]
export const popularAreas = ['Centro de Vacaria', 'Bela Vista', 'Bento Gonçalves', 'Bom Jesus', 'São José dos Ausentes', 'Garibaldi', 'Cambará do Sul', 'Santa Catarina']
export const regionLifestyles: Intent[] = [
  { slug: 'vida-no-campo', label: 'Vida no campo', image: '/marketplace/images/lifestyle-space.png' },
  { slug: 'perto-do-centro', label: 'Perto do centro', image: '/marketplace/images/lifestyle-nearby.png' },
  { slug: 'natureza-e-lazer', label: 'Natureza e lazer', image: '/marketplace/images/region-serra.png' },
  { slug: 'para-investir', label: 'Para investir', image: '/marketplace/images/lifestyle-invest.png' },
]

export type BrokerProfile = {
  id: string; slug: string; name: string; creci: string; region: string; regionSlug: string; specialty: string; about: string; phone: string; image: string
  activeListings: number; rating: number; reviewCount: number; reviews: BrokerReview[]; featured: boolean; verified: boolean; transaction: 'compra' | 'aluguel' | 'ambos'; propertyTypes: PropertyType[]
}
export type BrokerReview = {
  id: string; authorName: string; rating: number; comment: string; publishedAtLabel: string; verified: boolean
}
export const brokerTransactionOptions = [
  { value: 'all', label: 'Comprar ou alugar' },
  { value: 'compra', label: 'Comprar' },
  { value: 'aluguel', label: 'Alugar' },
]
export const formatMonthly = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
