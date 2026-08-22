export type AdminUserClientDetail = {
  id: string
  name: string | null
  status: string
  source: string
  createdAt: string
  property: string | null
}

export type AdminUserDetails = {
  user: { id: string; name: string; email: string; role: string; status: string | null; createdAt: string; lastAccessAt: string | null }
  account: { plan: string; brokerStatus: string | null; creci: string | null; creciStatus: string | null; creditsBalance: number; creditsUsed: number }
  devices: Array<{ id: string; label: string; browser: string | null; platform: string | null; status: string; lastAccessAt: string | null }>
  operation: {
    properties: number
    publishedProperties: number
    clients: number
    proposals: number
    contracts: number
    cosInteractions: number
    studioCampaigns: number
    studioAssets: number
    aiOperations: number
    aiCredits: number
    aiCostBrl: number
  }
  catalog: { slug: string | null; publishedProperties: number; views: number; contacts: number; shares: number; status: string }
  marketplace: { publishedProperties: number; views: number; leads: number; conversations: number; profileStatus: string }
  billing: {
    subscriptionStatus: string
    stripeLinked: boolean
    localSubscriptionStatus: string | null
    recentPurchases: Array<{ id: string; type: string; quantity: number; amountCents: number; status: string; createdAt: string }>
  }
  clients: AdminUserClientDetail[]
  unavailableBlocks: string[]
}
