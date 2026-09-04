import 'server-only'

import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CreciValidationStatus } from '@/lib/prisma-enums'
import { parsePropertyLegalData } from '@/lib/legal-entities'
import type { Property } from '@/lib/marketplace/data'
import type { BrokerProfile, MarketplaceRegion } from '@/lib/marketplace/pages-data'
import type { PropertyDetail, SimilarProperty } from '@/lib/marketplace/property-detail'
import { ensureMarketplaceRegionMedia } from '@/lib/marketplace/region-media'
import { marketplaceRegionSlug as buildMarketplaceRegionSlug, normalizeMarketplaceRegion } from '@/lib/marketplace/region-media-contract'
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
  if (/invest|renda|liquidez|condominio|academia|lavanderia/.test(text) || (record.bedrooms > 0 && record.bedrooms <= 2 && area > 0 && area <= 90)) tags.push('para-investir')
  if (/novo|pronto|mobiliad|reformad|acabamento|chaves/.test(text)) tags.push('pronto-para-morar', 'pronto-para-entrar')
  if (/campo|rural|sitio|chacara/.test(text)) tags.push('vida-no-campo', 'natureza-e-lazer')
  if (record.bedrooms <= 2 && area > 0 && area <= 75) tags.push('morar-sozinho')
  if (record.purpose === 'SALE' && record.price <= 60000000) tags.push('primeiro-imovel')
  if (marketplacePropertyType(record) === 'comercial') tags.push('para-o-negocio')
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
    patio: /patio|quintal|area externa|terreno amplo/.test(text),
    furnished: /mobiliad|moveis planejados/.test(text),
    isNew: /novo|lancamento|recem construido/.test(text),
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
      record.broker.marketplaceSpecialties.join(' '),
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

export const getMarketplaceProperties = cache(async function getMarketplaceProperties() {
  const records = await prisma.property.findMany({
    where: marketplacePropertyWhere(),
    include: marketplacePropertyInclude,
    orderBy: [{ marketplacePublishedAt: 'desc' }, { updatedAt: 'desc' }],
  })
  return records.map(mapMarketplaceProperty)
})

export async function getMarketplacePropertyCards(limit?: number, purpose?: 'SALE' | 'RENT'): Promise<Property[]> {
  const expectedPurpose = purpose === 'RENT' ? 'aluguel' : purpose === 'SALE' ? 'compra' : null
  const properties = (await getMarketplaceProperties()).filter(
    (property) => !expectedPurpose || property.purpose === expectedPurpose,
  )
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
    compatibility: property.compatibility,
    reasons: property.reasons,
  }))
}

export async function getMarketplaceRentals(limit?: number): Promise<Property[]> {
  const rentals = (await getMarketplaceProperties()).filter((property) => property.purpose === 'aluguel')
  return (limit ? rentals.slice(0, limit) : rentals).map((mapped) => {
    return {
      slug: mapped.slug,
      title: mapped.title,
      city: mapped.city,
      state: mapped.state,
      price: mapped.price,
      bedrooms: mapped.bedrooms,
      area: mapped.area,
      parking: mapped.parking,
      image: mapped.image,
      compatibility: mapped.compatibility,
      reasons: mapped.reasons,
      priceSuffix: '/mês',
      commercial: mapped.propertyType === 'comercial',
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

const marketplaceBrokerInclude = {
  user: true,
  properties: { where: { marketplacePublished: true }, select: { purpose: true } },
  marketplaceReviews: {
    where: { status: 'APPROVED' as const },
    orderBy: { createdAt: 'desc' as const },
    take: 6,
    select: { id: true, authorName: true, rating: true, comment: true, verified: true, createdAt: true },
  },
  _count: { select: { properties: { where: { marketplacePublished: true } } } },
} satisfies Prisma.BrokerInclude

type BrokerWithMarketplaceCount = Prisma.BrokerGetPayload<{ include: typeof marketplaceBrokerInclude }>

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
    specialties: record.marketplaceSpecialties.length ? record.marketplaceSpecialties : ['Atendimento imobiliário'],
    about: record.catalogBio || record.description || '',
    phone: record.phone || record.user.phone || '',
    image: record.user.photoUrl || '/marketplace/placeholder-user.jpg',
    activeListings: record._count.properties,
    rating: hasVerifiedRating ? Number(record.marketplaceRating) : 0,
    reviewCount: hasVerifiedRating ? record.marketplaceReviewCount : 0,
    reviews: record.marketplaceReviews.map((review) => ({
      id: review.id,
      authorName: review.authorName,
      rating: review.rating,
      comment: review.comment,
      publishedAtLabel: review.createdAt.toLocaleDateString('pt-BR'),
      verified: review.verified,
    })),
    featured: record.marketplaceFeatured,
    verified: record.creciValidationStatus === CreciValidationStatus.VERIFIED,
    transaction: brokerTransaction(record, record.properties.map((property) => property.purpose)),
    propertyTypes: [],
  }
}

export const getMarketplaceBrokers = cache(async function getMarketplaceBrokers() {
  const records = await prisma.broker.findMany({
    where: {
      status: 'ACTIVE',
      properties: { some: { marketplacePublished: true } },
    },
    include: marketplaceBrokerInclude,
    orderBy: [{ marketplaceFeatured: 'desc' }, { createdAt: 'asc' }],
  })
  return records.map(mapMarketplaceBroker)
})

export async function getMarketplaceBroker(slug: string) {
  const record = await prisma.broker.findFirst({
    where: { catalogSlug: slug, status: 'ACTIVE', properties: { some: { marketplacePublished: true } } },
    include: marketplaceBrokerInclude,
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
      compatibility: property.compatibility,
      reasons: property.reasons,
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
    legal.registryNumber ? 'Matrícula informada no cadastro' : '',
    legal.condominiumName ? `Condomínio ${legal.condominiumName}` : '',
    legal.privateArea ? `Área privativa cadastrada: ${legal.privateArea}` : '',
    result.bedrooms ? `${result.bedrooms} ${result.bedrooms === 1 ? 'quarto cadastrado' : 'quartos cadastrados'}` : '',
    result.bathrooms ? `${result.bathrooms} ${result.bathrooms === 1 ? 'banheiro cadastrado' : 'banheiros cadastrados'}` : '',
    result.parking ? `${result.parking} ${result.parking === 1 ? 'vaga cadastrada' : 'vagas cadastradas'}` : '',
  ].filter(Boolean)
  const central = /\b(centro|central|regiao central)\b/.test(result.searchableText)
  const routine = [
    result.neighborhood
      ? { key: 'bairro', label: 'Bairro informado', detail: result.neighborhood, icon: 'center' as const }
      : null,
    central
      ? { key: 'perfil-regiao', label: 'Perfil da região', detail: 'Região central indicada no anúncio', icon: 'market' as const }
      : null,
    { key: 'cidade', label: 'Referência urbana', detail: [result.city, result.state].filter(Boolean).join(' · '), icon: 'school' as const },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))
  return {
    slug: result.slug,
    code: record.publicCode ? `EME ${record.publicCode}` : `EME ${record.id.slice(-6).toUpperCase()}`,
    propertyId: record.id,
    title: result.title,
    city: result.city,
    state: result.state,
    neighborhood: result.neighborhood,
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
    routine,
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
    include: marketplaceBrokerInclude,
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
      parking: mapped.parking,
      compatibility: mapped.compatibility,
      reasons: mapped.reasons,
      image: mapped.image,
    }
  })
  return {
    property: mapPropertyDetail(record, result),
    broker: brokerRecords[0] ? mapMarketplaceBroker(brokerRecords[0]) : null,
    similar,
  }
}

export function marketplaceRegionSlug(value: string) {
  return buildMarketplaceRegionSlug(value)
}

export const getMarketplaceRegions = cache(async function getMarketplaceRegions(): Promise<MarketplaceRegion[]> {
  const [properties, events] = await Promise.all([
    getMarketplaceProperties(),
    prisma.searchEvent.findMany({
      where: { source: 'marketplace' },
      select: { query: true, filters: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ])
  const groups = new Map<string, MarketplaceRegion & { mediaKey: string; legacySlug: string; state: string }>()

  for (const property of properties) {
    const name = property.city.trim()
    if (!name) continue
    const normalized = normalizeMarketplaceRegion(name, property.state)
    const current = groups.get(normalized.key) || {
      slug: normalized.legacySlug,
      legacySlug: normalized.legacySlug,
      mediaKey: normalized.key,
      name,
      state: normalized.state,
      description: `Inventário publicado em ${name}${normalized.state ? `, ${normalized.state}` : ''}, atualizado diretamente pelos corretores da rede EME.`,
      image: '',
      properties: 0,
      forSale: 0,
      forRent: 0,
      areas: [],
      tags: [],
      searchVolume: 0,
    }
    current.properties += 1
    if (property.purpose === 'compra') current.forSale += 1
    else current.forRent += 1
    if (property.neighborhood && !current.areas.includes(property.neighborhood)) current.areas.push(property.neighborhood)
    groups.set(normalized.key, current)
  }

  const legacySlugCounts = new Map<string, number>()
  for (const region of groups.values()) {
    legacySlugCounts.set(region.legacySlug, (legacySlugCounts.get(region.legacySlug) || 0) + 1)
  }
  for (const region of groups.values()) {
    if ((legacySlugCounts.get(region.legacySlug) || 0) > 1) region.slug = region.mediaKey
  }

  try {
    const media = await ensureMarketplaceRegionMedia(
      [...groups.values()].map((region) => ({ city: region.name, state: region.state })),
    )
    for (const region of groups.values()) {
      const resolvedMedia = media.get(region.mediaKey)
      region.image = resolvedMedia?.imageUrl || ''
      region.state = resolvedMedia?.state || region.state
      region.mediaKey = resolvedMedia?.slug || region.mediaKey
    }
  } catch (error) {
    console.error('[marketplace][regions] persisted media unavailable', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
  }

  for (const event of events) {
    const searchable = normalizeText(`${event.query || ''} ${JSON.stringify(event.filters || {})}`)
    for (const region of groups.values()) {
      if (searchable.includes(normalizeText(region.name))) region.searchVolume += 1
    }
  }

  return [...groups.values()]
    .map(({ mediaKey: _mediaKey, legacySlug: _legacySlug, ...region }) => ({
      ...region,
      areas: region.areas.sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 12),
    }))
    .sort((a, b) => b.properties - a.properties || a.name.localeCompare(b.name, 'pt-BR'))
})
