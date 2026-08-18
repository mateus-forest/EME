export type NormalizedMarketplaceRegion = {
  city: string
  state: string
  stateName: string
  key: string
  legacySlug: string
}

export type StoredMarketplaceRegionMedia = {
  provider: string
  imageUrl: string
  pexelsPhotoId: string | null
  source: string
  manualImageUrl: string | null
}

const BRAZILIAN_STATES: Record<string, { code: string; name: string }> = {
  AC: { code: 'AC', name: 'Acre' },
  AL: { code: 'AL', name: 'Alagoas' },
  AP: { code: 'AP', name: 'Amapá' },
  AM: { code: 'AM', name: 'Amazonas' },
  BA: { code: 'BA', name: 'Bahia' },
  CE: { code: 'CE', name: 'Ceará' },
  DF: { code: 'DF', name: 'Distrito Federal' },
  ES: { code: 'ES', name: 'Espírito Santo' },
  GO: { code: 'GO', name: 'Goiás' },
  MA: { code: 'MA', name: 'Maranhão' },
  MT: { code: 'MT', name: 'Mato Grosso' },
  MS: { code: 'MS', name: 'Mato Grosso do Sul' },
  MG: { code: 'MG', name: 'Minas Gerais' },
  PA: { code: 'PA', name: 'Pará' },
  PB: { code: 'PB', name: 'Paraíba' },
  PR: { code: 'PR', name: 'Paraná' },
  PE: { code: 'PE', name: 'Pernambuco' },
  PI: { code: 'PI', name: 'Piauí' },
  RJ: { code: 'RJ', name: 'Rio de Janeiro' },
  RN: { code: 'RN', name: 'Rio Grande do Norte' },
  RS: { code: 'RS', name: 'Rio Grande do Sul' },
  RO: { code: 'RO', name: 'Rondônia' },
  RR: { code: 'RR', name: 'Roraima' },
  SC: { code: 'SC', name: 'Santa Catarina' },
  SP: { code: 'SP', name: 'São Paulo' },
  SE: { code: 'SE', name: 'Sergipe' },
  TO: { code: 'TO', name: 'Tocantins' },
}

export function normalizeMarketplaceRegionText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function marketplaceRegionSlug(value: string) {
  return normalizeMarketplaceRegionText(value).replace(/\s+/g, '-')
}

export function normalizeMarketplaceRegion(cityInput: string, stateInput: string): NormalizedMarketplaceRegion {
  const city = cityInput.trim().replace(/\s+/g, ' ')
  const normalizedState = normalizeMarketplaceRegionText(stateInput)
  const state = Object.values(BRAZILIAN_STATES).find((item) => (
    item.code.toLocaleLowerCase('pt-BR') === normalizedState ||
    normalizeMarketplaceRegionText(item.name) === normalizedState
  ))
  const stateCode = state?.code ?? (/^[a-z]{2}$/.test(normalizedState) ? normalizedState.toUpperCase() : '')
  const stateName = state?.name ?? stateInput.trim()
  const legacySlug = marketplaceRegionSlug(city)

  return {
    city,
    state: stateCode,
    stateName,
    key: `${legacySlug}-${stateCode.toLocaleLowerCase('pt-BR') || 'sem-uf'}`,
    legacySlug,
  }
}

export function buildPexelsRegionQueries(city: string, stateName: string) {
  const values = [
    `${city} ${stateName} Brazil`,
    `${city} ${stateName}`,
    `${stateName} Brazil`,
  ].map((value) => value.trim().replace(/\s+/g, ' '))
  return [...new Set(values.filter(Boolean))]
}

export function isSafeMarketplaceRegionImageUrl(value: string | null | undefined) {
  if (!value) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function isPexelsImageUrl(value: string | null | undefined) {
  if (!isSafeMarketplaceRegionImageUrl(value)) return false
  try {
    return new URL(value || '').hostname === 'images.pexels.com'
  } catch {
    return false
  }
}

export function effectiveMarketplaceRegionImage(media: StoredMarketplaceRegionMedia) {
  if (media.source === 'manual' && isSafeMarketplaceRegionImageUrl(media.manualImageUrl)) {
    return media.manualImageUrl || ''
  }
  return isSafeMarketplaceRegionImageUrl(media.imageUrl) ? media.imageUrl : ''
}

export function isMarketplaceRegionMediaReusable(media: StoredMarketplaceRegionMedia) {
  if (media.source === 'manual') return isSafeMarketplaceRegionImageUrl(media.manualImageUrl)
  if (media.provider === 'pexels') {
    return Boolean(media.pexelsPhotoId) && isPexelsImageUrl(media.imageUrl)
  }
  return media.provider === 'eme'
}
