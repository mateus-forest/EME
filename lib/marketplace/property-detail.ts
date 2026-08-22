import type { Compatibility } from '@/lib/marketplace/search-data'

export type EnvironmentPhoto = { key: string; label: string; image: string }
export type PropertyDetail = {
  slug: string; propertyId: string; code: string; title: string; city: string; state: string; neighborhood: string; price: number; updatedLabel: string
  bedrooms: number; suites: number; bathrooms: number; area: number; parking: number; patio: boolean; photoCount: number
  compatibility: Compatibility; compatibilitySummary: string; originCriteria: string[]; summary: string; highlights: string[]
  confirmedInfo: string[]; toConfirm: string[]
  routine: { key: string; label: string; detail: string; icon: 'center' | 'market' | 'school' }[]
  gallery: string[]; environments: EnvironmentPhoto[]; brokerSlug: string; brokerCreci: string; map: { x: number; y: number }
}
export type SimilarProperty = {
  slug: string; title: string; city: string; state: string; price: number; bedrooms: number; area: number; parking: number
  compatibility: Compatibility; reasons: string[]; image: string
}
