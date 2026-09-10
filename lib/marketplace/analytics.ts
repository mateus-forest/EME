'use client'
import { trackJourney } from '@/lib/journey/browser'

let searchId: string | undefined

export type MarketplaceEvent = 'marketplace_view' | 'property_view' | 'marketplace_search' | 'interest' | 'whatsapp_click'

function visitorKey() {
  try {
  const key = 'eme_marketplace_visitor'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, created)
  return created
  } catch { return undefined }
}

export function trackMarketplaceEvent(payload: {
  eventType: MarketplaceEvent
  propertyId?: string
  propertyIds?: string[]
  catalogSlug?: string
  query?: string
  filters?: unknown
  resultCount?: number
}) {
  if (typeof window === 'undefined') return Promise.resolve()
  try {
    if (payload.eventType === 'marketplace_search') {
      searchId = crypto.randomUUID()
      trackJourney('marketplace_search', { module: 'marketplace', outcome: 'completed', metadata: { searchId, resultCount: payload.resultCount ?? 0, queryLength: payload.query?.length ?? 0, filterCount: payload.filters && typeof payload.filters === 'object' ? Object.values(payload.filters).filter(Boolean).length : 0, legacySource: 'SearchEvent' } })
      try { sessionStorage.setItem('eme_journey_search', searchId) } catch { /* memory fallback */ }
    } else if (payload.eventType === 'property_view') {
      try { searchId ??= sessionStorage.getItem('eme_journey_search') ?? undefined } catch { /* memory fallback */ }
      trackJourney('marketplace_result_opened', { propertyId: payload.propertyId, module: 'marketplace', outcome: 'viewed', metadata: { ...(searchId ? { searchId } : {}), legacySource: 'CatalogEvent' }, dedupeKey: payload.propertyId })
    }
  } catch { /* Tracking does not affect search or navigation. */ }
  return fetch('/api/catalog-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ ...payload, source: 'marketplace', visitorKey: visitorKey() }),
  }).then(() => undefined).catch(() => undefined)
}
