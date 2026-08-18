import { expect, test } from '@playwright/test'

import {
  buildPexelsRegionQueries,
  effectiveMarketplaceRegionImage,
  isMarketplaceRegionMediaReusable,
  isPexelsImageUrl,
  isSafeMarketplaceRegionImageUrl,
  normalizeMarketplaceRegion,
  regionIdentityFromStoredMedia,
} from '@/lib/marketplace/region-media-contract'

test.describe('Marketplace region media contract', () => {
  test('normalizes city and UF without a manual municipality catalog', () => {
    expect(normalizeMarketplaceRegion('  São José dos Ausentes  ', 'Rio Grande do Sul')).toEqual({
      city: 'São José dos Ausentes',
      state: 'RS',
      stateName: 'Rio Grande do Sul',
      key: 'sao-jose-dos-ausentes-rs',
      legacySlug: 'sao-jose-dos-ausentes',
    })
    expect(normalizeMarketplaceRegion('Vacaria', 'rs').key).toBe('vacaria-rs')
  })

  test('keeps the required Pexels query fallback order', () => {
    expect(buildPexelsRegionQueries('Vacaria', 'Rio Grande do Sul')).toEqual([
      'Vacaria Rio Grande do Sul Brazil',
      'Vacaria Rio Grande do Sul',
      'Rio Grande do Sul Brazil',
    ])
  })

  test('reuses the official UF persisted for properties that still only contain a city', () => {
    expect(regionIdentityFromStoredMedia('Porto Alegre', '', [{
      city: 'Porto Alegre',
      displayName: 'Porto Alegre',
      state: 'RS',
      ibgeCode: '4314902',
    }]).key).toBe('porto-alegre-rs')
    expect(regionIdentityFromStoredMedia('Bom Jesus', '', [
      { city: 'Bom Jesus', displayName: 'Bom Jesus', state: 'RS', ibgeCode: '4302303' },
      { city: 'Bom Jesus', displayName: 'Bom Jesus', state: 'PI', ibgeCode: '2201903' },
    ]).key).toBe('bom-jesus-sem-uf')
  })

  test('reuses valid automatic media and the neutral EME fallback', () => {
    expect(isMarketplaceRegionMediaReusable({
      provider: 'pexels',
      imageUrl: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
      pexelsPhotoId: '123',
      source: 'automatic',
      manualImageUrl: null,
    })).toBe(true)
    expect(isMarketplaceRegionMediaReusable({
      provider: 'eme',
      imageUrl: '',
      pexelsPhotoId: null,
      source: 'automatic',
      manualImageUrl: null,
    })).toBe(true)
    expect(isMarketplaceRegionMediaReusable({
      provider: 'pexels',
      imageUrl: '',
      pexelsPhotoId: '123',
      source: 'automatic',
      manualImageUrl: null,
    })).toBe(false)
  })

  test('manual override wins without replacing the automatic reference', () => {
    const media = {
      provider: 'pexels',
      imageUrl: 'https://images.pexels.com/photos/123/automatic.jpeg',
      pexelsPhotoId: '123',
      source: 'manual',
      manualImageUrl: 'https://cdn.eme.com.br/regioes/vacaria.jpg',
    }
    expect(effectiveMarketplaceRegionImage(media)).toBe(media.manualImageUrl)
    expect(isMarketplaceRegionMediaReusable(media)).toBe(true)
  })

  test('rejects insecure and protocol-relative manual URLs', () => {
    expect(isSafeMarketplaceRegionImageUrl('http://example.com/photo.jpg')).toBe(false)
    expect(isSafeMarketplaceRegionImageUrl('//example.com/photo.jpg')).toBe(false)
    expect(isSafeMarketplaceRegionImageUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeMarketplaceRegionImageUrl('/marketplace/images/region-vacaria.png')).toBe(true)
    expect(isSafeMarketplaceRegionImageUrl('https://example.com/photo.jpg')).toBe(true)
    expect(isPexelsImageUrl('https://images.pexels.com/photos/123/photo.jpeg')).toBe(true)
    expect(isPexelsImageUrl('https://example.com/photos/123/photo.jpeg')).toBe(false)
  })
})
