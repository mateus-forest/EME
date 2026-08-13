import {
  formatPrice,
  type Criterion,
  type CriteriaKey,
  type SearchResult,
} from '@/lib/marketplace/search-data'

export type MarketplaceFilters = {
  purpose?: 'compra' | 'aluguel'
  propertyType?: 'casa' | 'apartamento' | 'terreno' | 'sobrado'
  location?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: number
  bathrooms?: number
  parking?: number
  areaMin?: number
  features: string[]
}

export const emptyMarketplaceFilters: MarketplaceFilters = { features: [] }

export const defaultMarketplaceFilters: MarketplaceFilters = {
  purpose: 'compra',
  propertyType: 'casa',
  location: 'Vacaria',
  priceMax: 750000,
  features: ['patio'],
}

type SearchParamValue = string | string[] | undefined
type SearchParamSource = URLSearchParams | Record<string, SearchParamValue>

function readParam(source: SearchParamSource, key: string) {
  if (source instanceof URLSearchParams) return source.get(key) || undefined
  const value = source[key]
  return Array.isArray(value) ? value[0] : value
}

function positiveNumber(value?: string) {
  if (!value) return undefined
  const parsed = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function filtersFromSearchParams(source: SearchParamSource): MarketplaceFilters {
  const rawPurpose = readParam(source, 'finalidade')
  const rawType = readParam(source, 'tipo')
  const rawFeatures = readParam(source, 'caracteristicas')
  const purpose = rawPurpose === 'compra' || rawPurpose === 'aluguel' ? rawPurpose : undefined
  const propertyType = ['casa', 'apartamento', 'terreno', 'sobrado'].includes(rawType || '')
    ? (rawType as MarketplaceFilters['propertyType'])
    : undefined

  const rawLocation = readParam(source, 'regiao') || readParam(source, 'cidade') || readParam(source, 'local')
  const knownLocations: Record<string, string> = {
    vacaria: 'Vacaria',
    'serra-gaucha': 'Serra Gaúcha',
    'campos-de-cima-da-serra': 'Campos de Cima da Serra',
  }

  return {
    purpose,
    propertyType,
    location: rawLocation ? knownLocations[rawLocation] || rawLocation : undefined,
    priceMin: positiveNumber(readParam(source, 'precoMin')),
    priceMax: positiveNumber(readParam(source, 'precoMax') || readParam(source, 'valor')),
    bedrooms: positiveNumber(readParam(source, 'quartos')),
    bathrooms: positiveNumber(readParam(source, 'banheiros')),
    parking: positiveNumber(readParam(source, 'vagas')),
    areaMin: positiveNumber(readParam(source, 'area')),
    features: rawFeatures ? rawFeatures.split(',').filter(Boolean) : [],
  }
}

export function hasActiveFilters(filters: MarketplaceFilters) {
  return Boolean(
    filters.purpose ||
      filters.propertyType ||
      filters.location ||
      filters.priceMin ||
      filters.priceMax ||
      filters.bedrooms ||
      filters.bathrooms ||
      filters.parking ||
      filters.areaMin ||
      filters.features.length,
  )
}

export function filtersToSearchParams(filters: MarketplaceFilters) {
  const params = new URLSearchParams()
  if (filters.purpose) params.set('finalidade', filters.purpose)
  if (filters.propertyType) params.set('tipo', filters.propertyType)
  if (filters.location) params.set('regiao', filters.location)
  if (filters.priceMin) params.set('precoMin', String(filters.priceMin))
  if (filters.priceMax) params.set('precoMax', String(filters.priceMax))
  if (filters.bedrooms) params.set('quartos', String(filters.bedrooms))
  if (filters.bathrooms) params.set('banheiros', String(filters.bathrooms))
  if (filters.parking) params.set('vagas', String(filters.parking))
  if (filters.areaMin) params.set('area', String(filters.areaMin))
  if (filters.features.length) params.set('caracteristicas', filters.features.join(','))
  return params
}

export function filtersToCriteria(filters: MarketplaceFilters): Criterion[] {
  const criteria: Criterion[] = []
  if (filters.purpose) {
    criteria.push({
      key: 'finalidade',
      label: filters.purpose === 'compra' ? 'Comprar' : 'Alugar',
      icon: 'buy',
    })
  }
  if (filters.propertyType) {
    criteria.push({
      key: 'tipo',
      label: filters.propertyType.charAt(0).toUpperCase() + filters.propertyType.slice(1),
      icon: 'home',
    })
  }
  if (filters.location) criteria.push({ key: 'cidade', label: filters.location, icon: 'pin' })
  if (filters.priceMin) {
    criteria.push({ key: 'valorMin', label: `A partir de ${formatPrice(filters.priceMin)}`, icon: 'wallet' })
  }
  if (filters.priceMax) {
    criteria.push({ key: 'valorMax', label: `Até ${formatPrice(filters.priceMax)}`, icon: 'wallet' })
  }
  if (filters.bedrooms) criteria.push({ key: 'quartos', label: `${filters.bedrooms}+ quartos`, icon: 'bed' })
  if (filters.bathrooms) criteria.push({ key: 'banheiros', label: `${filters.bathrooms}+ banheiros`, icon: 'bath' })
  if (filters.parking) criteria.push({ key: 'vagas', label: `${filters.parking}+ vagas`, icon: 'car' })
  if (filters.areaMin) criteria.push({ key: 'areaMin', label: `${filters.areaMin} m²+`, icon: 'ruler' })
  if (filters.features.includes('patio')) criteria.push({ key: 'patio', label: 'Pátio', icon: 'tree' })
  if (filters.features.includes('mobiliado')) criteria.push({ key: 'mobiliado', label: 'Mobiliado', icon: 'home' })
  if (filters.features.includes('novo')) criteria.push({ key: 'novo', label: 'Imóvel novo', icon: 'home' })
  return criteria
}

export function removeFilterCriterion(filters: MarketplaceFilters, key: CriteriaKey): MarketplaceFilters {
  const next = { ...filters, features: [...filters.features] }
  if (key === 'finalidade') next.purpose = undefined
  if (key === 'tipo') next.propertyType = undefined
  if (key === 'cidade') next.location = undefined
  if (key === 'valorMin') next.priceMin = undefined
  if (key === 'valorMax') next.priceMax = undefined
  if (key === 'quartos') next.bedrooms = undefined
  if (key === 'banheiros') next.bathrooms = undefined
  if (key === 'vagas') next.parking = undefined
  if (key === 'areaMin') next.areaMin = undefined
  if (key === 'patio') next.features = next.features.filter((item) => item !== 'patio')
  if (key === 'mobiliado') next.features = next.features.filter((item) => item !== 'mobiliado')
  if (key === 'novo') next.features = next.features.filter((item) => item !== 'novo')
  return next
}

export function filterSearchResults(results: SearchResult[], filters: MarketplaceFilters) {
  const location = filters.location?.toLocaleLowerCase('pt-BR')
  return results.filter((result) => {
    if (filters.propertyType && !result.title.toLocaleLowerCase('pt-BR').includes(filters.propertyType)) return false
    if (location && !`${result.city} ${result.state}`.toLocaleLowerCase('pt-BR').includes(location)) return false
    if (filters.priceMin && result.price < filters.priceMin) return false
    if (filters.priceMax && result.price > filters.priceMax) return false
    if (filters.bedrooms && result.bedrooms < filters.bedrooms) return false
    if (filters.bathrooms && result.bathrooms < filters.bathrooms) return false
    if (filters.parking && result.parking < filters.parking) return false
    if (filters.areaMin && result.area < filters.areaMin) return false
    if (filters.features.includes('patio') && !result.patio) return false
    if (filters.features.includes('mobiliado') && !result.furnished) return false
    if (filters.features.includes('novo') && !result.isNew) return false
    return true
  })
}
