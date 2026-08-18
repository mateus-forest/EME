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
  type NormalizedMarketplaceRegion,
} from '@/lib/marketplace/region-media-contract'

type RegionInput = { city: string; state: string }

type IbgeMunicipality = {
  id: number
  nome: string
}

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

async function resolveIbgeMunicipality(region: NormalizedMarketplaceRegion) {
  if (!region.city || !region.state) return null
  let pending = ibgeMunicipalityPromises.get(region.state)
  if (!pending) {
    pending = fetchJson(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(region.state)}/municipios?orderBy=nome`,
    ).then((payload) => Array.isArray(payload) ? payload.filter((item): item is IbgeMunicipality => (
      Boolean(item) && typeof item === 'object' &&
      typeof (item as Partial<IbgeMunicipality>).id === 'number' &&
      typeof (item as Partial<IbgeMunicipality>).nome === 'string'
    )) : []).catch((error) => {
      ibgeMunicipalityPromises.delete(region.state)
      throw error
    })
    ibgeMunicipalityPromises.set(region.state, pending)
  }
  const municipalities = await pending
  const expectedCity = normalizeMarketplaceRegionText(region.city)
  const municipality = municipalities.find((item) => normalizeMarketplaceRegionText(item.nome) === expectedCity)
  return municipality ? { id: String(municipality.id), city: municipality.nome } : null
}

async function resolvePexelsPhoto(city: string, stateName: string) {
  const apiKey = process.env.PEXELS_API_KEY?.trim()
  if (!apiKey) return null

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
    if (ibge) pexels = await resolvePexelsPhoto(ibge.city, region.stateName)
  } catch (error) {
    console.error('[marketplace][region-media] automatic resolution failed', {
      region: region.key,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
  }

  const automatic = pexels
    ? {
        city: ibge?.city ?? region.city,
        state: region.state,
        ibgeCode: ibge?.id ?? null,
        ...pexels,
        resolvedAt: new Date(),
      }
    : fallbackResolution(region, ibge ?? undefined)

  if (!forceAutomatic) {
    const current = await prisma.marketplaceRegionMedia.findUnique({ where: { slug: region.key } })
    if (current?.source === 'manual' && isMarketplaceRegionMediaReusable(current)) {
      return serializeRegionMedia(current)
    }
  }

  const saved = await prisma.marketplaceRegionMedia.upsert({
    where: { slug: region.key },
    create: {
      slug: region.key,
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
  return serializeRegionMedia(saved)
}

async function cloneLegacyMedia(region: NormalizedMarketplaceRegion, legacy: RegionMediaRecord) {
  const saved = await prisma.marketplaceRegionMedia.upsert({
    where: { slug: region.key },
    create: {
      slug: region.key,
      displayName: region.city,
      city: region.city,
      state: region.state,
      ibgeCode: null,
      provider: legacy.provider,
      pexelsPhotoId: legacy.pexelsPhotoId,
      imageUrl: legacy.imageUrl,
      originalUrl: legacy.originalUrl,
      photoPageUrl: legacy.photoPageUrl,
      photographer: legacy.photographer,
      photographerUrl: legacy.photographerUrl,
      query: legacy.query,
      resolvedAt: legacy.resolvedAt,
      source: legacy.source,
      manualImageUrl: legacy.manualImageUrl || (legacy.source === 'manual' ? legacy.imageUrl : null),
    },
    update: {},
  })
  return serializeRegionMedia(saved)
}

export async function ensureMarketplaceRegionMedia(inputs: RegionInput[]) {
  const regions = [...new Map(inputs.map((input) => {
    const region = normalizeMarketplaceRegion(input.city, input.state)
    return [region.key, region]
  })).values()].filter((region) => region.city)
  if (!regions.length) return new Map<string, MarketplaceRegionMediaView>()

  const slugs = [...new Set(regions.flatMap((region) => [region.key, region.legacySlug]))]
  const existing = await prisma.marketplaceRegionMedia.findMany({ where: { slug: { in: slugs } } })
  const existingBySlug = new Map(existing.map((media) => [media.slug, media]))
  const resolved = new Map<string, MarketplaceRegionMediaView>()

  await Promise.all(regions.map(async (region) => {
    const direct = existingBySlug.get(region.key)
    if (direct && isMarketplaceRegionMediaReusable(direct)) {
      resolved.set(region.key, serializeRegionMedia(direct))
      return
    }
    const legacy = existingBySlug.get(region.legacySlug)
    if (legacy && isMarketplaceRegionMediaReusable(legacy)) {
      const cloned = await cloneLegacyMedia(region, legacy)
      resolved.set(region.key, cloned)
      return
    }

    let pending = regionResolutionPromises.get(region.key)
    if (!pending) {
      pending = persistAutomaticResolution(region).finally(() => regionResolutionPromises.delete(region.key))
      regionResolutionPromises.set(region.key, pending)
    }
    resolved.set(region.key, await pending)
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
  if (current.provider === 'pexels' || current.provider === 'eme') {
    const saved = await prisma.marketplaceRegionMedia.update({
      where: { slug },
      data: { manualImageUrl: null, source: 'automatic' },
    })
    return serializeRegionMedia(saved)
  }
  const region = normalizeMarketplaceRegion(current.city || current.displayName || '', current.state || '')
  if (!region.city || region.key !== slug) {
    const saved = await prisma.marketplaceRegionMedia.update({
      where: { slug },
      data: { manualImageUrl: null, source: 'automatic' },
    })
    return serializeRegionMedia(saved)
  }
  return persistAutomaticResolution(region, true)
}
