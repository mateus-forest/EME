import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parsePropertyLegalData } from '@/lib/legal-entities'
import type { Property } from '@/lib/marketplace/data'
import type { BrokerProfile, Rental } from '@/lib/marketplace/pages-data'
import type { PropertyDetail, SimilarProperty } from '@/lib/marketplace/property-detail'
import type { SearchResult } from '@/lib/marketplace/search-data'

const marketplacePropertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.PropertyInclude

type MarketplacePropertyRecord = Prisma.PropertyGetPayload<{ include: typeof marketplacePropertyInclude }>

function numberFromText(value?: string | null) {
  if (!value) return 0
  const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function normalizeText(value?: string | null) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function propertyImage(record: MarketplacePropertyRecord) {
  const images = Array.isArray(record.imageUrls)
    ? record.imageUrls.filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    : []
  return images[0] || '/marketplace/placeholder.svg'
}

function propertyImages(record: MarketplacePropertyRecord) {
  const images = Array.isArray(record.imageUrls)
    ? record.imageUrls.filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    : []
  return images.length ? images : ['/marketplace/placeholder.svg']
}

function propertyIntentTags(record: MarketplacePropertyRecord, area: number) {
  const text = normalizeText(`${record.title} ${record.description} ${record.neighborhood} ${record.city}`)
  const tags: string[] = []
  if (area >= 130 || /ampl|espac|terreno|patio/.test(text)) tags.push('mais-espaco', 'espaco-familia')
  if (/centro|central/.test(text)) tags.push('perto-do-centro', 'perto-de-tudo', 'perto-do-trabalho')
  if (/invest|renda|comercial|loca/.test(text)) tags.push('para-investir')
  if (/novo|pronto|mobiliado|reformado/.test(text)) tags.push('pronto-para-morar', 'pronto-para-entrar')
  if (/campo|rural|sitio|chacara/.test(text)) tags.push('vida-no-campo', 'natureza-e-lazer')
  if (record.bedrooms <= 1) tags.push('morar-sozinho')
  if (record.price <= 60000000) tags.push('primeiro-imovel')
  return [...new Set(tags)]
}

function hashPosition(value: string, offset: number) {
  const hash = [...value].reduce((total, character, index) => total + character.charCodeAt(0) * (index + offset), 0)
  return 18 + (hash % 65)
}

function marketplacePropertyType(record: MarketplacePropertyRecord): SearchResult['propertyType'] {
  if (record.type === 'HOUSE') {
    return normalizeText(record.title).includes('sobrado') ? 'sobrado' : 'casa'
  }
  if (record.type === 'LAND') return 'terreno'
  if (record.type === 'APARTMENT' || record.type === 'PENTHOUSE') return 'apartamento'
  return 'comercial'
}

export function mapMarketplaceProperty(record: MarketplacePropertyRecord): SearchResult {
  const legal = parsePropertyLegalData(record.legalData)
  const area = numberFromText(legal.privateArea) || numberFromText(legal.totalArea)
  const text = normalizeText(`${record.title} ${record.description}`)
  const intentTags = propertyIntentTags(record, area)
  const reasons = [
    record.neighborhood ? `Localizado em ${record.neighborhood}` : `Imóvel em ${record.city}`,
    record.bedrooms ? `${record.bedrooms} ${record.bedrooms === 1 ? 'quarto' : 'quartos'}` : '',
    area ? `${area} m² de área cadastrada` : '',
  ].filter(Boolean)

  return {
    id: record.id,
    slug: record.marketplaceSlug || record.id,
    title: record.title,
    city: legal.city || record.city,
    state: legal.state || '',
    price: Math.round(record.price / 100),
    purpose: record.purpose === 'RENT' ? 'aluguel' : 'compra',
    propertyType: marketplacePropertyType(record),
    bedrooms: record.bedrooms,
    suites: /suite/.test(text) ? 1 : 0,
    bathrooms: record.bathrooms,
    area,
    parking: record.parkingSpots,
    patio: /patio|quintal|terreno/.test(text),
    furnished: /mobiliado/.test(text),
    isNew: /novo|lancamento/.test(text),
    neighborhood: record.neighborhood || legal.district || '',
    region: record.broker.marketplaceRegion || '',
    brokerSlug: record.broker.catalogSlug,
    intentTags,
    searchableText: normalizeText([
      record.title,
      record.description,
      record.type,
      record.purpose,
      record.neighborhood,
      record.city,
      legal.district,
      legal.city,
      record.broker.marketplaceRegion,
      record.broker.marketplaceSpecialty,
    ].filter(Boolean).join(' ')),
    image: propertyImage(record),
    compatibility: 'boa',
    reasons: reasons.length ? reasons : ['Dados fornecidos pelo corretor responsável'],
    map: { x: hashPosition(record.id, 3), y: hashPosition(record.id, 7) },
  }
}

function marketplacePropertyWhere(): Prisma.PropertyWhereInput {
  return {
    marketplacePublished: true,
    marketplaceSlug: { not: null },
    broker: { status: 'ACTIVE' },
  }
}

export async function getMarketplaceProperties() {
  const records = await prisma.property.findMany({
    where: marketplacePropertyWhere(),
    include: marketplacePropertyInclude,
    orderBy: [{ marketplacePublishedAt: 'desc' }, { updatedAt: 'desc' }],
  })
  return records.map(mapMarketplaceProperty)
}

export async function getMarketplacePropertyCards(limit?: number, purpose?: 'SALE' | 'RENT'): Promise<Property[]> {
  const records = await prisma.property.findMany({
    where: { ...marketplacePropertyWhere(), ...(purpose ? { purpose } : {}) },
    include: marketplacePropertyInclude,
    orderBy: [{ marketplacePublishedAt: 'desc' }, { updatedAt: 'desc' }],
    ...(limit ? { take: limit } : {}),
  })
  const properties = records.map(mapMarketplaceProperty)
  return (limit ? properties.slice(0, limit) : properties).map((property) => ({
    slug: property.slug,
    title: property.title,
    city: property.city,
    state: property.state,
    price: property.price,
    bedrooms: property.bedrooms,
    area: property.area,
    parking: property.parking,
    image: property.image,
    featured: false,
  }))
}

export async function getMarketplaceRentals(limit?: number): Promise<Rental[]> {
  const records = await prisma.property.findMany({
    where: { ...marketplacePropertyWhere(), purpose: 'RENT' },
    include: marketplacePropertyInclude,
    orderBy: [{ marketplacePublishedAt: 'desc' }, { updatedAt: 'desc' }],
    ...(limit ? { take: limit } : {}),
  })
  return records.map((record) => {
    const mapped = mapMarketplaceProperty(record)
    return {
      slug: mapped.slug,
      title: mapped.title,
      city: mapped.city,
      state: mapped.state,
      monthly: mapped.price,
      bedrooms: mapped.bedrooms,
      area: mapped.area,
      parking: mapped.parking,
      image: mapped.image,
      featured: false,
    }
  })
}

function brokerTransaction(record: MarketplacePropertyRecord['broker'], purposes: string[]) {
  const configured = record.marketplaceTransactions
  if (configured === 'SALE') return 'compra' as const
  if (configured === 'RENT') return 'aluguel' as const
  if (configured === 'BOTH') return 'ambos' as const
  const hasSale = purposes.includes('SALE')
  const hasRent = purposes.includes('RENT')
  return hasSale && hasRent ? 'ambos' as const : hasRent ? 'aluguel' as const : 'compra' as const
}

type BrokerWithMarketplaceCount = Prisma.BrokerGetPayload<{
  include: { user: true; properties: { select: { purpose: true } }; _count: { select: { properties: true } } }
}>

export function mapMarketplaceBroker(record: BrokerWithMarketplaceCount): BrokerProfile {
  const hasVerifiedRating = record.marketplaceReviewCount > 0 && Boolean(record.marketplaceRating)
  return {
    id: record.id,
    slug: record.catalogSlug,
    name: record.user.name,
    creci: record.creci
      ? (record.creci.toLocaleUpperCase('pt-BR').startsWith('CRECI') ? record.creci : `CRECI ${record.creci}`)
      : 'CRECI não informado',
    region: record.marketplaceRegion || 'Região não informada',
    regionSlug: normalizeText(record.marketplaceRegion).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outras-regioes',
    specialty: record.marketplaceSpecialty || 'Atendimento imobiliário',
    about: record.marketplaceAbout || record.description || '',
    phone: record.phone || record.user.phone || '',
    image: record.user.photoUrl || '/marketplace/placeholder-user.jpg',
    activeListings: record._count.properties,
    rating: hasVerifiedRating ? Number(record.marketplaceRating) : 0,
    reviewCount: hasVerifiedRating ? record.marketplaceReviewCount : 0,
    featured: record.marketplaceFeatured,
    verified: Boolean(record.creci),
    transaction: brokerTransaction(record, record.properties.map((property) => property.purpose)),
    propertyTypes: [],
  }
}

export async function getMarketplaceBrokers() {
  const records = await prisma.broker.findMany({
    where: {
      status: 'ACTIVE',
      properties: { some: { marketplacePublished: true } },
    },
    include: {
      user: true,
      properties: { where: { marketplacePublished: true }, select: { purpose: true } },
      _count: { select: { properties: { where: { marketplacePublished: true } } } },
    },
    orderBy: [{ marketplaceFeatured: 'desc' }, { createdAt: 'asc' }],
  })
  return records.map(mapMarketplaceBroker)
}

export async function getMarketplaceBroker(slug: string) {
  const record = await prisma.broker.findFirst({
    where: { catalogSlug: slug, status: 'ACTIVE', properties: { some: { marketplacePublished: true } } },
    include: {
      user: true,
      properties: { where: { marketplacePublished: true }, select: { purpose: true } },
      _count: { select: { properties: { where: { marketplacePublished: true } } } },
    },
  })
  return record ? mapMarketplaceBroker(record) : null
}

export async function getMarketplaceBrokerPropertyCards(brokerId: string, limit = 3) {
  const records = await prisma.property.findMany({
    where: { ...marketplacePropertyWhere(), brokerId },
    include: marketplacePropertyInclude,
    orderBy: [{ marketplacePublishedAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  })
  return records.map((record) => {
    const property = mapMarketplaceProperty(record)
    return {
      slug: property.slug,
      title: property.title,
      city: property.city,
      state: property.state,
      price: property.price,
      bedrooms: property.bedrooms,
      area: property.area,
      parking: property.parking,
      image: property.image,
      featured: false,
    } satisfies Property
  })
}

function mapPropertyDetail(record: MarketplacePropertyRecord, result: SearchResult): PropertyDetail {
  const legal = parsePropertyLegalData(record.legalData)
  const gallery = propertyImages(record)
  const highlights = [
    result.area ? `${result.area} m² de área` : '',
    result.patio ? 'Pátio ou área externa' : '',
    result.furnished ? 'Mobiliado' : '',
    result.isNew ? 'Imóvel novo' : '',
  ].filter(Boolean)
  const confirmedInfo = [
    legal.registryNumber ? 'Matrícula informada' : '',
    legal.condominiumName ? `Condomínio ${legal.condominiumName}` : '',
    legal.privateArea ? 'Área privativa cadastrada' : '',
  ].filter(Boolean)
  return {
    slug: result.slug,
    code: record.publicCode ? `EME ${record.publicCode}` : `EME ${record.id.slice(-6).toUpperCase()}`,
    propertyId: record.id,
    title: result.title,
    city: result.city,
    state: result.state,
    price: result.price,
    updatedLabel: `Atualizado em ${record.updatedAt.toLocaleDateString('pt-BR')}`,
    bedrooms: result.bedrooms,
    suites: result.suites,
    bathrooms: result.bathrooms,
    area: result.area,
    parking: result.parking,
    patio: result.patio,
    photoCount: gallery.length,
    compatibility: result.compatibility,
    compatibilitySummary: result.reasons.join(', '),
    originCriteria: [],
    summary: record.description || 'Consulte o corretor responsável para conhecer todos os detalhes deste imóvel.',
    highlights,
    confirmedInfo,
    toConfirm: ['Disponibilidade para visita', 'Condições de negociação'],
    routine: [],
    gallery,
    environments: gallery.map((image, index) => ({ key: `foto-${index + 1}`, label: `Foto ${index + 1}`, image })),
    brokerSlug: record.broker.catalogSlug,
    brokerCreci: record.broker.creci || 'CRECI não informado',
    map: result.map,
  }
}

export async function getMarketplacePropertyDetail(slug: string) {
  const record = await prisma.property.findFirst({
    where: { ...marketplacePropertyWhere(), marketplaceSlug: slug },
    include: marketplacePropertyInclude,
  })
  if (!record) return null
  const result = mapMarketplaceProperty(record)
  const brokerRecords = await prisma.broker.findMany({
    where: { id: record.brokerId },
    include: {
      user: true,
      properties: { where: { marketplacePublished: true }, select: { purpose: true } },
      _count: { select: { properties: { where: { marketplacePublished: true } } } },
    },
  })
  const similarRecords = await prisma.property.findMany({
    where: { ...marketplacePropertyWhere(), id: { not: record.id }, purpose: record.purpose },
    include: marketplacePropertyInclude,
    take: 3,
    orderBy: { updatedAt: 'desc' },
  })
  const similar: SimilarProperty[] = similarRecords.map((item) => {
    const mapped = mapMarketplaceProperty(item)
    return {
      slug: mapped.slug,
      title: mapped.title,
      city: mapped.city,
      state: mapped.state,
      price: mapped.price,
      bedrooms: mapped.bedrooms,
      area: mapped.area,
      compatibility: mapped.compatibility,
      image: mapped.image,
    }
  })
  return {
    property: mapPropertyDetail(record, result),
    broker: brokerRecords[0] ? mapMarketplaceBroker(brokerRecords[0]) : null,
    similar,
  }
}
