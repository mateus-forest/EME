export type AdminMarketplaceAd = {
  id: string
  title: string
  brokerId: string
  brokerName: string
  region: string
  status: string
  readiness: "Pronto" | "Atenção"
  qualityScore: number
  qualityIssues: string[]
  views: number
  leads: number
  conversations: number
  publishedAt: string | null
  publicPath: string | null
}

export type AdminMarketplaceBroker = {
  id: string
  userId: string
  name: string
  email: string
  photoUrl: string | null
  creci: string | null
  creciStatus: string
  region: string
  specialties: string[]
  publishedProperties: number
  reviews: number
  rating: number | null
  leads: number
  conversations: number
  views: number
  performanceScore: number
}

export type AdminMarketplaceRegion = {
  name: string
  properties: number
  views: number
  leads: number
  conversations: number
}

export type AdminMarketplaceConversation = {
  id: string
  customerName: string
  brokerName: string
  propertyTitle: string
  status: string
  lastMessageAt: string
}

export type AdminMarketplaceLead = {
  id: string
  name: string
  brokerName: string
  propertyTitle: string
  source: string
  status: string
  createdAt: string
}

export type AdminMarketplaceReport = {
  generatedAt: string
  overview: {
    publishedProperties: number
    newAdvertisements: number
    views: number
    leads: number
    conversations: number
    pendingReviews: number
    lowQualityAdvertisements: number
    activeBrokers: number
  }
  reviewSummary: { total: number; pending: number }
  regionSummary: { total: number }
  ads: AdminMarketplaceAd[]
  brokers: AdminMarketplaceBroker[]
  regions: AdminMarketplaceRegion[]
  conversations: AdminMarketplaceConversation[]
  leads: AdminMarketplaceLead[]
}
