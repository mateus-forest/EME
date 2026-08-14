import { formatPrice, type Criterion, type CriteriaKey, type SearchResult } from '@/lib/marketplace/search-data'
import { getIntentLabel, intentionsFromQuery, intentReasons, intentScore, normalizeIntentSlugs } from '@/lib/marketplace/search-intents'

export type MarketplaceFilters = {
  purpose?: 'compra' | 'aluguel'
  propertyType?: SearchResult['propertyType']
  location?: string
  priceMin?: number
  priceMax?: number
  bedrooms?: number
  bathrooms?: number
  parking?: number
  areaMin?: number
  features: string[]
  intentions: string[]
}

export const emptyMarketplaceFilters: MarketplaceFilters = { features: [], intentions: [] }
type SearchParamValue = string | string[] | undefined
type SearchParamSource = URLSearchParams | Record<string, SearchParamValue>

export function normalizeMarketplaceText(value?: string | null) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

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

function moneyFromQuery(raw: string) {
  const digits = Number(raw.replace(/[^\d]/g, ''))
  if (!digits) return undefined
  const text = normalizeMarketplaceText(raw)
  if (/milhao|milhoes/.test(text)) return digits * 1_000_000
  if (/\bmil\b/.test(text)) return digits * 1_000
  return digits
}

export function inferMarketplaceFilters(query: string, results: SearchResult[] = []): MarketplaceFilters {
  const text = normalizeMarketplaceText(query)
  const inferred: MarketplaceFilters = { features: [], intentions: intentionsFromQuery(query) }
  if (/\b(alugar|aluguel|locacao|locar)\b/.test(text)) inferred.purpose = 'aluguel'
  else if (/\b(comprar|compra|venda|adquirir)\b/.test(text)) inferred.purpose = 'compra'

  const types: [RegExp, SearchResult['propertyType']][] = [
    [/\b(apartamento|apto|cobertura)\b/, 'apartamento'],
    [/\b(sobrado)\b/, 'sobrado'],
    [/\b(terreno|lote)\b/, 'terreno'],
    [/\b(comercial|loja|sala comercial)\b/, 'comercial'],
    [/\b(casa|residencia)\b/, 'casa'],
  ]
  inferred.propertyType = types.find(([pattern]) => pattern.test(text))?.[1]
  const count = (pattern: RegExp) => positiveNumber(text.match(pattern)?.[1])
  inferred.bedrooms = count(/(\d+)\s*(?:quarto|quartos|dormitorio|dormitorios)/)
  inferred.bathrooms = count(/(\d+)\s*(?:banheiro|banheiros)/)
  inferred.parking = count(/(\d+)\s*(?:vaga|vagas)/)
  inferred.areaMin = count(/(?:a partir de|mais de|acima de|minimo de)?\s*(\d+)\s*(?:m2|metros quadrados)/)
  const maximum = query.match(/(?:ate|até|no maximo|no máximo)\s*(?:r\$\s*)?([\d.]+\s*(?:milhao|milhões|milhoes|mil)?)/i)
  const minimum = query.match(/(?:a partir de|acima de|minimo|minímo|mínimo)\s*(?:r\$\s*)?([\d.]+\s*(?:milhao|milhões|milhoes|mil)?)/i)
  inferred.priceMax = maximum ? moneyFromQuery(maximum[1]) : undefined
  inferred.priceMin = minimum ? moneyFromQuery(minimum[1]) : undefined
  if (/\b(patio|quintal|area externa)\b/.test(text)) inferred.features.push('patio')
  if (/\b(mobiliado|mobiliada)\b/.test(text)) inferred.features.push('mobiliado')
  if (/\b(novo|nova|lancamento)\b/.test(text)) inferred.features.push('novo')

  const locations = [...new Set(results.flatMap((item) => [item.neighborhood, item.city, item.region]).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
  inferred.location = locations.find((location) => text.includes(normalizeMarketplaceText(location)))
  return inferred
}

export function mergeMarketplaceFilters(base: MarketplaceFilters, inferred: MarketplaceFilters): MarketplaceFilters {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(inferred).filter(([key, value]) => !['features', 'intentions'].includes(key) && value !== undefined)),
    features: [...new Set([...base.features, ...inferred.features])],
    intentions: normalizeIntentSlugs([...base.intentions, ...inferred.intentions]),
  }
}

export function filtersFromSearchParams(source: SearchParamSource, results: SearchResult[] = []): MarketplaceFilters {
  const rawPurpose = readParam(source, 'finalidade')
  const rawType = readParam(source, 'tipo')
  const rawFeatures = readParam(source, 'caracteristicas')
  const rawIntentions = readParam(source, 'intencao') || readParam(source, 'intencoes')
  const rawValue = readParam(source, 'valor')
  const rawQuery = readParam(source, 'q') || ''
  const valueRange = rawValue?.split('-').map(positiveNumber) || []
  const rawRegion = readParam(source, 'regiao')
  const explicit: MarketplaceFilters = {
    purpose: rawPurpose === 'compra' || rawPurpose === 'aluguel' ? rawPurpose : undefined,
    propertyType: ['casa', 'apartamento', 'terreno', 'sobrado', 'comercial'].includes(rawType || '') ? rawType as SearchResult['propertyType'] : undefined,
    location: rawRegion === 'centro' ? undefined : rawRegion || readParam(source, 'cidade') || readParam(source, 'local'),
    priceMin: positiveNumber(readParam(source, 'precoMin')) || (valueRange.length > 1 ? valueRange[0] : undefined),
    priceMax: positiveNumber(readParam(source, 'precoMax')) || valueRange[1] || (valueRange.length === 1 ? valueRange[0] : undefined),
    bedrooms: positiveNumber(readParam(source, 'quartos')),
    bathrooms: positiveNumber(readParam(source, 'banheiros')),
    parking: positiveNumber(readParam(source, 'vagas')),
    areaMin: positiveNumber(readParam(source, 'area')),
    features: [...(rawFeatures ? rawFeatures.split(',').filter(Boolean) : []), ...(rawType === 'mobiliado' ? ['mobiliado'] : [])],
    intentions: normalizeIntentSlugs([...(rawIntentions ? rawIntentions.split(',') : []), ...(rawRegion === 'centro' ? ['perto-do-centro'] : [])]),
  }
  return mergeMarketplaceFilters(inferMarketplaceFilters(rawQuery, results), explicit)
}

export function hasActiveFilters(filters: MarketplaceFilters) {
  return Boolean(filters.purpose || filters.propertyType || filters.location || filters.priceMin || filters.priceMax || filters.bedrooms || filters.bathrooms || filters.parking || filters.areaMin || filters.features.length || filters.intentions.length)
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
  if (filters.intentions.length) params.set('intencao', filters.intentions.join(','))
  return params
}

export function buildMarketplaceSearchHref(filters: MarketplaceFilters, query?: string) {
  const params = filtersToSearchParams(filters)
  if (query?.trim()) params.set('q', query.trim())
  return `/imoveis/busca${params.size ? `?${params.toString()}` : ''}`
}

export function buildIntentSearchHref(intent: string, purpose?: MarketplaceFilters['purpose']) {
  return buildMarketplaceSearchHref({ ...emptyMarketplaceFilters, purpose, intentions: [intent] })
}

export function buildQuickSearchHref(purpose: MarketplaceFilters['purpose'], param: string, value: string) {
  const filters: MarketplaceFilters = { ...emptyMarketplaceFilters, purpose, features: [], intentions: [] }
  if (param === 'cidade') filters.location = value
  if (param === 'regiao' && value === 'centro') filters.intentions = ['perto-do-centro']
  if (param === 'tipo' && value === 'mobiliado') filters.features = ['mobiliado']
  else if (param === 'tipo') filters.propertyType = value as SearchResult['propertyType']
  if (param === 'quartos') filters.bedrooms = positiveNumber(value)
  if (param === 'valor') [filters.priceMin, filters.priceMax] = value.split('-').map(positiveNumber)
  return buildMarketplaceSearchHref(filters)
}

export function filtersToCriteria(filters: MarketplaceFilters): Criterion[] {
  const criteria: Criterion[] = []
  if (filters.purpose) criteria.push({ key: 'finalidade', label: filters.purpose === 'compra' ? 'Comprar' : 'Alugar', icon: 'buy' })
  if (filters.propertyType) criteria.push({ key: 'tipo', label: filters.propertyType.charAt(0).toUpperCase() + filters.propertyType.slice(1), icon: 'home' })
  if (filters.location) criteria.push({ key: 'cidade', label: filters.location, icon: 'pin' })
  if (filters.priceMin) criteria.push({ key: 'valorMin', label: `A partir de ${formatPrice(filters.priceMin)}`, icon: 'wallet' })
  if (filters.priceMax) criteria.push({ key: 'valorMax', label: `Até ${formatPrice(filters.priceMax)}`, icon: 'wallet' })
  if (filters.bedrooms) criteria.push({ key: 'quartos', label: `${filters.bedrooms}+ quartos`, icon: 'bed' })
  if (filters.bathrooms) criteria.push({ key: 'banheiros', label: `${filters.bathrooms}+ banheiros`, icon: 'bath' })
  if (filters.parking) criteria.push({ key: 'vagas', label: `${filters.parking}+ vagas`, icon: 'car' })
  if (filters.areaMin) criteria.push({ key: 'areaMin', label: `${filters.areaMin} m²+`, icon: 'ruler' })
  if (filters.features.includes('patio')) criteria.push({ key: 'patio', label: 'Pátio', icon: 'tree' })
  if (filters.features.includes('mobiliado')) criteria.push({ key: 'mobiliado', label: 'Mobiliado', icon: 'home' })
  if (filters.features.includes('novo')) criteria.push({ key: 'novo', label: 'Imóvel novo', icon: 'home' })
  filters.intentions.forEach((intent) => criteria.push({ key: `intencao:${intent}`, label: getIntentLabel(intent), icon: 'home' }))
  return criteria
}

export function removeFilterCriterion(filters: MarketplaceFilters, key: CriteriaKey): MarketplaceFilters {
  const next = { ...filters, features: [...filters.features], intentions: [...filters.intentions] }
  const fields: Partial<Record<CriteriaKey, keyof MarketplaceFilters>> = { finalidade: 'purpose', tipo: 'propertyType', cidade: 'location', valorMin: 'priceMin', valorMax: 'priceMax', quartos: 'bedrooms', banheiros: 'bathrooms', vagas: 'parking', areaMin: 'areaMin' }
  const field = fields[key]
  if (field) delete next[field]
  if (key === 'patio' || key === 'mobiliado' || key === 'novo') next.features = next.features.filter((item) => item !== key)
  if (key.startsWith('intencao:')) next.intentions = next.intentions.filter((item) => item !== key.slice(10))
  return next
}

const textStopWords = new Set(['a', 'o', 'as', 'os', 'de', 'do', 'da', 'em', 'com', 'para', 'por', 'ate', 'no', 'na', 'mais', 'menos', 'r', 'mil', 'milhao', 'milhoes', 'comprar', 'compra', 'venda', 'alugar', 'aluguel', 'locacao', 'casa', 'apartamento', 'apto', 'sobrado', 'terreno', 'lote', 'comercial', 'quarto', 'quartos', 'banheiro', 'banheiros', 'vaga', 'vagas', 'm2', 'metros', 'quadrados'])
function queryTokens(query: string) {
  return normalizeMarketplaceText(query).split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !textStopWords.has(token) && !/^\d+$/.test(token))
}

export function filterSearchResults(results: SearchResult[], filters: MarketplaceFilters, query = '') {
  const location = normalizeMarketplaceText(filters.location)
  const tokens = filters.intentions.length ? [] : queryTokens(query)
  const filtered = results.filter((result) => {
    if (filters.purpose && result.purpose !== filters.purpose) return false
    if (filters.propertyType && result.propertyType !== filters.propertyType) return false
    if (location && !normalizeMarketplaceText(`${result.neighborhood} ${result.city} ${result.state} ${result.region}`).includes(location)) return false
    if (filters.priceMin && result.price < filters.priceMin) return false
    if (filters.priceMax && result.price > filters.priceMax) return false
    if (filters.bedrooms && result.bedrooms < filters.bedrooms) return false
    if (filters.bathrooms && result.bathrooms < filters.bathrooms) return false
    if (filters.parking && result.parking < filters.parking) return false
    if (filters.areaMin && result.area < filters.areaMin) return false
    if (filters.features.includes('patio') && !result.patio) return false
    if (filters.features.includes('mobiliado') && !result.furnished) return false
    if (filters.features.includes('novo') && !result.isNew) return false
    return tokens.every((token) => result.searchableText.includes(token))
  })
  if (!filters.intentions.length) return filtered
  return filtered.map((result) => {
    const score = intentScore(result, filters.intentions)
    const reasons = intentReasons(result, filters.intentions)
    return { ...result, compatibility: score >= 6 ? 'muito' as const : score >= 3 ? 'boa' as const : 'considerar' as const, reasons: reasons.length ? [...reasons, ...result.reasons].slice(0, 3) : result.reasons, intentCompatibilityScore: score }
  }).sort((a, b) => b.intentCompatibilityScore - a.intentCompatibilityScore)
}
