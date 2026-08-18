import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  buildPexelsRegionQueries,
  effectiveMarketplaceRegionImage,
  isMarketplaceRegionMediaReusable,
  isPexelsImageUrl,
  isSafeMarketplaceRegionImageUrl,
  normalizeMarketplaceRegion,
  normalizeMarketplaceRegionText,
  regionIdentityFromStoredMedia,
  type NormalizedMarketplaceRegion,
} from '@/lib/marketplace/region-media-contract'

type RegionInput = { city: string; state: string }

type IbgeMunicipality = {
  id: number
  nome: string
  microrregiao?: {
    mesorregiao?: { UF?: IbgeState }
  }
  'regiao-imediata'?: {
    'regiao-intermediaria'?: { UF?: IbgeState }
  }
}

type IbgeState = { sigla: string; nome: string }

type PexelsPhoto = {
  id: number
  url: string
  photographer: string
  photographer_url: string
  src: {
    original: string
    landscape?: string
    large2x?: string
    large?: string
  }
}

export type MarketplaceRegionMediaView = {
  slug: string
  displayName: string
  city: string
  state: string
  ibgeCode: string | null
  provider: string
  pexelsPhotoId: string | null
  imageUrl: string
  automaticImageUrl: string
  originalUrl: string | null
  photoPageUrl: string | null
  photographer: string | null
  photographerUrl: string | null
  query: string | null
  resolvedAt: Date | null
  source: string
  manualImageUrl: string | null
}

type RegionMediaRecord = Omit<MarketplaceRegionMediaView, 'displayName' | 'city' | 'state' | 'automaticImageUrl'> & {
  displayName: string | null
  city: string | null
  state: string | null
}

const regionResolutionPromises = new Map<string, Promise<MarketplaceRegionMediaView>>()
const ibgeMunicipalityPromises = new Map<string, Promise<IbgeMunicipality[]>>()
let allIbgeMunicipalitiesPromise: Promise<IbgeMunicipality[]> | null = null

export class MarketplaceRegionMediaConfigurationError extends Error {
  readonly code = 'PEXELS_API_KEY_MISSING'

  constructor() {
    super('PEXELS_API_KEY não está configurada no ambiente do servidor.')
    this.name = 'MarketplaceRegionMediaConfigurationError'
  }
}

export class MarketplaceRegionStateAmbiguousError extends Error {
  readonly code = 'MARKETPLACE_REGION_STATE_AMBIGUOUS'

  constructor(city: string) {
    super(`A cidade ${city} existe em mais de uma UF no IBGE; informe a UF no imóvel.`)
    this.name = 'MarketplaceRegionStateAmbiguousError'
  }
}

export function assertMarketplaceRegionMediaConfiguration() {
  if (!process.env.PEXELS_API_KEY?.trim()) throw new MarketplaceRegionMediaConfigurationError()
}

function fallbackResolution(region: NormalizedMarketplaceRegion, ibge?: { id: string; city: string }) {
  return {
    city: ibge?.city ?? region.city,
    state: region.state,
    ibgeCode: ibge?.id ?? null,
    provider: 'eme',
    pexelsPhotoId: null,
    imageUrl: '',
    originalUrl: null,
    photoPageUrl: null,
    photographer: null,
    photographerUrl: null,
    query: null,
    resolvedAt: new Date(),
  }
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`REGION_MEDIA_PROVIDER_${response.status}`)
  return response.json() as Promise<unknown>
}

function parseIbgeMunicipalities(payload: unknown) {
  return Array.isArray(payload) ? payload.filter((item): item is IbgeMunicipality => (
    Boolean(item) && typeof item === 'object' &&
    typeof (item as Partial<IbgeMunicipality>).id === 'number' &&
    typeof (item as Partial<IbgeMunicipality>).nome === 'string'
  )) : []
}

function ibgeMunicipalityState(municipality: IbgeMunicipality) {
  const state = municipality['regiao-imediata']?.['regiao-intermediaria']?.UF || municipality.microrregiao?.mesorregiao?.UF
  return state && typeof state.sigla === 'string' && typeof state.nome === 'string' ? state : null
}

async function getIbgeMunicipalitiesByState(state: string) {
  let pending = ibgeMunicipalityPromises.get(state)
  if (!pending) {
    pending = fetchJson(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state)}/municipios?orderBy=nome`,
    ).then(parseIbgeMunicipalities).catch((error) => {
      ibgeMunicipalityPromises.delete(state)
      throw error
    })
    ibgeMunicipalityPromises.set(state, pending)
  }
  return pending
}

async function getAllIbgeMunicipalities() {
  if (!allIbgeMunicipalitiesPromise) {
    allIbgeMunicipalitiesPromise = fetchJson(
      'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
    ).then(parseIbgeMunicipalities).catch((error) => {
      allIbgeMunicipalitiesPromise = null
      throw error
    })
  }
  return allIbgeMunicipalitiesPromise
}

async function resolveIbgeMunicipality(region: NormalizedMarketplaceRegion) {
  if (!region.city) return null
  const municipalities = region.state
    ? await getIbgeMunicipalitiesByState(region.state)
    : await getAllIbgeMunicipalities()
  const expectedCity = normalizeMarketplaceRegionText(region.city)
  const matches = municipalities.filter((item) => normalizeMarketplaceRegionText(item.nome) === expectedCity)
  if (!matches.length) return null

  const officialMatches = matches.map((municipality) => ({ municipality, state: ibgeMunicipalityState(municipality) }))
  if (!region.state) {
    const states = new Set(officialMatches.map((match) => match.state?.sigla).filter(Boolean))
    if (states.size !== 1) throw new MarketplaceRegionStateAmbiguousError(region.city)
  }
  const match = officialMatches.find((item) => !region.state || item.state?.sigla === region.state) || officialMatches[0]
  return match ? {
    id: String(match.municipality.id),
    city: match.municipality.nome,
    state: match.state?.sigla || region.state,
    stateName: match.state?.nome || region.stateName,
  } : null
}

async function resolvePexelsPhoto(city: string, stateName: string) {
  assertMarketplaceRegionMediaConfiguration()
  const apiKey = process.env.PEXELS_API_KEY?.trim() || ''

  for (const query of buildPexelsRegionQueries(city, stateName)) {
    const params = new URLSearchParams({
      query,
      orientation: 'landscape',
      locale: 'pt-BR',
      per_page: '1',
    })
    const payload = await fetchJson(`https://api.pexels.com/v1/search?${params.toString()}`, {
      headers: { Authorization: apiKey },
    })
    if (!payload || typeof payload !== 'object') continue
    const photos = (payload as { photos?: unknown }).photos
    if (!Array.isArray(photos) || !photos.length) continue
    const photo = photos[0] as Partial<PexelsPhoto>
    const imageUrl = photo.src?.landscape || photo.src?.large2x || photo.src?.large
    if (
      typeof photo.id !== 'number' ||
      typeof imageUrl !== 'string' ||
      typeof photo.src?.original !== 'string' ||
      typeof photo.url !== 'string' ||
      !isPexelsImageUrl(imageUrl) ||
      !isPexelsImageUrl(photo.src.original) ||
      !isSafeMarketplaceRegionImageUrl(photo.url)
    ) continue
    return {
      provider: 'pexels',
      pexelsPhotoId: String(photo.id),
      imageUrl,
      originalUrl: photo.src.original,
      photoPageUrl: photo.url,
      photographer: typeof photo.photographer === 'string' ? photo.photographer : null,
      photographerUrl: typeof photo.photographer_url === 'string' ? photo.photographer_url : null,
      query,
    }
  }
  return null
}

function serializeRegionMedia(media: RegionMediaRecord): MarketplaceRegionMediaView {
  return {
    ...media,
    displayName: media.displayName || media.city || media.slug,
    city: media.city || media.displayName || media.slug,
    state: media.state || '',
    imageUrl: effectiveMarketplaceRegionImage(media),
    automaticImageUrl: media.imageUrl,
  }
}

async function persistAutomaticResolution(region: NormalizedMarketplaceRegion, forceAutomatic = false) {
  let ibge: Awaited<ReturnType<typeof resolveIbgeMunicipality>> = null
  let pexels: Awaited<ReturnType<typeof resolvePexelsPhoto>> = null
  try {
    ibge = await resolveIbgeMunicipality(region)
    if (ibge) pexels = await resolvePexelsPhoto(ibge.city, ibge.stateName)
  } catch (error) {
    if (error instanceof MarketplaceRegionMediaConfigurationError || error instanceof MarketplaceRegionStateAmbiguousError) {
      throw error
    }
    console.error('[marketplace][region-media] automatic resolution failed', {
      region: region.key,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
  }

  const targetRegion = ibge ? normalizeMarketplaceRegion(ibge.city, ibge.state) : region

  const automatic = pexels
    ? {
        city: ibge?.city ?? targetRegion.city,
        state: ibge?.state ?? targetRegion.state,
        ibgeCode: ibge?.id ?? null,
        ...pexels,
        resolvedAt: new Date(),
      }
    : fallbackResolution(targetRegion, ibge ?? undefined)

  if (!forceAutomatic) {
    const current = await prisma.marketplaceRegionMedia.findUnique({ where: { slug: targetRegion.key } })
    if (current?.source === 'manual' && isMarketplaceRegionMediaReusable(current)) {
      const savedManual = await prisma.marketplaceRegionMedia.update({
        where: { slug: targetRegion.key },
        data: {
          displayName: automatic.city,
          ...automatic,
          source: 'manual',
          manualImageUrl: current.manualImageUrl,
        },
      })
      return serializeRegionMedia(savedManual)
    }
  }

  const saved = await prisma.marketplaceRegionMedia.upsert({
    where: { slug: targetRegion.key },
    create: {
      slug: targetRegion.key,
      displayName: automatic.city,
      ...automatic,
      source: 'automatic',
      manualImageUrl: null,
    },
    update: {
      displayName: automatic.city,
      ...automatic,
      source: 'automatic',
      manualImageUrl: null,
    },
  })
  if (targetRegion.key !== region.key) {
    await prisma.marketplaceRegionMedia.deleteMany({
      where: { slug: region.key, source: 'automatic', ibgeCode: null },
    })
  }
  return serializeRegionMedia(saved)
}

function hasOfficialRegionIdentity(media: RegionMediaRecord) {
  return Boolean(media.state && media.ibgeCode)
}

async function migrateManualOverride(target: MarketplaceRegionMediaView, legacy: RegionMediaRecord) {
  const manualImageUrl = legacy.manualImageUrl || legacy.imageUrl
  if (legacy.source !== 'manual' || !isSafeMarketplaceRegionImageUrl(manualImageUrl)) return target
  const saved = await prisma.marketplaceRegionMedia.update({
    where: { slug: target.slug },
    data: { source: 'manual', manualImageUrl },
  })
  if (legacy.slug !== target.slug) await prisma.marketplaceRegionMedia.delete({ where: { slug: legacy.slug } })
  return serializeRegionMedia(saved)
}

export async function ensureMarketplaceRegionMedia(inputs: RegionInput[]) {
  const inputRegions = [...new Map(inputs.map((input) => {
    const region = normalizeMarketplaceRegion(input.city, input.state)
    return [region.key, region]
  })).values()].filter((region) => region.city)
  if (!inputRegions.length) return new Map<string, MarketplaceRegionMediaView>()

  const inputSlugs = [...new Set(inputRegions.flatMap((region) => [region.key, region.legacySlug]))]
  const inputCities = [...new Set(inputRegions.map((region) => region.city))]
  const existing = await prisma.marketplaceRegionMedia.findMany({
    where: {
      OR: [
        { slug: { in: inputSlugs } },
        { city: { in: inputCities, mode: 'insensitive' } },
      ],
    },
  })
  const existingBySlug = new Map(existing.map((media) => [media.slug, media]))
  const resolved = new Map<string, MarketplaceRegionMediaView>()

  await Promise.all(inputRegions.map(async (inputRegion) => {
    const region = regionIdentityFromStoredMedia(inputRegion.city, inputRegion.state, existing)

    const direct = existingBySlug.get(region.key)
    if (direct && hasOfficialRegionIdentity(direct) && isMarketplaceRegionMediaReusable(direct)) {
      const view = serializeRegionMedia(direct)
      resolved.set(inputRegion.key, view)
      resolved.set(view.slug, view)
      return
    }

    const legacy = existingBySlug.get(inputRegion.key) || existingBySlug.get(region.legacySlug)

    let pending = regionResolutionPromises.get(region.key)
    if (!pending) {
      pending = persistAutomaticResolution(region).finally(() => regionResolutionPromises.delete(region.key))
      regionResolutionPromises.set(region.key, pending)
    }
    const automatic = await pending
    const view = legacy ? await migrateManualOverride(automatic, legacy) : automatic
    resolved.set(inputRegion.key, view)
    resolved.set(view.slug, view)
  }))

  return resolved
}

export async function listMarketplaceRegionMedia() {
  const records = await prisma.marketplaceRegionMedia.findMany({
    where: { city: { not: null } },
    orderBy: [{ state: 'asc' }, { city: 'asc' }, { displayName: 'asc' }],
  })
  return records.map(serializeRegionMedia)
}

export async function setMarketplaceRegionManualImage(slug: string, manualImageUrl: string) {
  const saved = await prisma.marketplaceRegionMedia.update({
    where: { slug },
    data: { manualImageUrl, source: 'manual' },
  })
  return serializeRegionMedia(saved)
}

export async function restoreMarketplaceRegionAutomaticImage(slug: string) {
  const current = await prisma.marketplaceRegionMedia.findUnique({ where: { slug } })
  if (!current) return null
  if (current.provider === 'pexels' && current.ibgeCode && current.state && isMarketplaceRegionMediaReusable(current)) {
    const saved = await prisma.marketplaceRegionMedia.update({
      where: { slug },
      data: { manualImageUrl: null, source: 'automatic' },
    })
    return serializeRegionMedia(saved)
  }
  const region = normalizeMarketplaceRegion(current.city || current.displayName || '', current.state || '')
  if (!region.city) return null
  const resolved = await persistAutomaticResolution(region, true)
  if (resolved.slug !== slug) await prisma.marketplaceRegionMedia.deleteMany({ where: { slug } })
  return resolved
}
