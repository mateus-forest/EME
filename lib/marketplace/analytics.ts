'use client'

export type MarketplaceEvent = 'marketplace_view' | 'property_view' | 'marketplace_search' | 'interest' | 'whatsapp_click'

function visitorKey() {
  const key = 'eme_marketplace_visitor'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, created)
  return created
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
  return fetch('/api/catalog-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ ...payload, source: 'marketplace', visitorKey: visitorKey() }),
  }).then(() => undefined).catch(() => undefined)
}
