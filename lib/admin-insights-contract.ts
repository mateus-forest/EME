export type AdminMetricPoint = {
  label: string
  value: number
}

export type AdminTrendRow = {
  label: string
  value: number
  detail?: string
}

export type AdminActivityItem = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone?: "default" | "success" | "warning" | "danger"
}

export type AdminAlertItem = {
  id: string
  title: string
  description: string
  severity: "low" | "medium" | "high"
}

export type AdminUserInsight = {
  id: string
  name: string
  email: string
  type: string
  plan: string
  status: string
  createdAt: string
  creditsBalance: number
  creditsUsed: number
  imageGenerations: number
  videoGenerations: number
  studioActions: number
  cosActions: number
  lastAccess: string | null
  devicesLabel: string
  historyLabel: string
  subscriptionLabel: string
  financeLabel: string
}

export type AdminBrokerInsight = {
  id: string
  name: string
  email: string
  status: string
  plan: string
  properties: number
  clients: number
  proposals: number
  agenda: number
  leads: number
  sales: number
  revenue: number
  creditsBalance: number
  monthlyCreditsUsed: number
  studioActions: number
  cosActions: number
  imagesCreated: number
  videosCreated: number
  productivityScore: number
  lastAccess: string | null
  corretorEmeStatus: string
}

export type AdminInsights = {
  generatedAt: string
  users: {
    total: number
    newLast7Days: number
    activeToday: number
    blocked: number
    trial: number
    activePlans: number
    planDistribution: AdminMetricPoint[]
    items: AdminUserInsight[]
  }
  brokers: {
    total: number
    active: number
    inactive: number
    properties: number
    leads: number
    proposals: number
    agenda: number
    revenue: number
    creditsBalance: number
    creditsUsed: number
    topProductivity: AdminTrendRow[]
    items: AdminBrokerInsight[]
  }
  assessor: {
    status: string
    officialNumber: string
    sessions: number
    messagesReceived: number
    messagesSent: number
    commandsExecuted: number
    createdClients: number
    createdProperties: number
    failures: number
    avgResponseMinutes: number | null
    aiConsumption: number
    timeline: AdminActivityItem[]
  }
  corretorEme: {
    connectedBrokers: number
    activeWhatsApps: number
    needsQrCode: number
    lastSyncLabel: string
    messagesReceived: number
    messagesSent: number
    leadsGenerated: number
    clientsCreated: number
    aiUsage: number
    creditsConsumed: number
    brokerActivity: AdminTrendRow[]
  }
  cos: {
    conversationsToday: number
    conversationsTotal: number
    messages: number
    commandsExecuted: number
    propertySearches: number
    proposalsCreated: number
    clientsCreated: number
    propertiesCreated: number
    appointments: number
    aiConsumption: number
    creditsSpent: number
    avgResponseMinutes: number | null
    satisfaction: string | null
    usageByDay: AdminMetricPoint[]
    usageByBroker: AdminTrendRow[]
    usageByHour: AdminMetricPoint[]
    latestConversations: AdminActivityItem[]
    ranking: AdminTrendRow[]
  }
  studioIa: {
    campaigns: number
    libraryItems: number
    libraryAssets: number
    imagesCreated: number
    videosCreated: number
    postsCreated: number
    storiesCreated: number
    anuncios: number
    descriptions: number
    postsInstagram: number
    homeStaging: number
    captacoes: number
    aiConsumption: number
    creditsUsed: number
    estimatedSavings: number
    generationByDay: AdminMetricPoint[]
    usageByMonth: AdminMetricPoint[]
    consumptionByFeature: AdminTrendRow[]
    ranking: AdminTrendRow[]
  }
  aiConsumption: {
    totalCreditsConsumed: number
    currentBalance: number
    estimatedCost: number
    totalOperations: number
    activeUsers: number
    averagePerOperation: number
    averageCostPerUser: number
    averageCostPerOperation: number
    openAiCost: number
    averagePerUser: number
    averagePerBroker: number
    byResource: AdminTrendRow[]
  }
  revenue: {
    mrr: number
    arr: number
    monthlyRevenue: number
    annualRevenue: number
    growth: number | null
    delinquency: number
    upgrades: number
    downgrades: number
    cancellations: number
    ltv: number | null
    averageTicket: number
    paidUsers: number
    monthlySeries: AdminMetricPoint[]
  }
  analytics: {
    activeUsers: number
    properties: number
    clients: number
    proposals: number
    studioIa: number
    cos: number
    videos: number
    images: number
    conversions: number
    sales: number
    retention: number | null
    engagement: number | null
  }
  alerts: {
    items: AdminAlertItem[]
  }
  bonuses: {
    totalBonuses: number
    last30Days: number
    campaigns: number
    indications: number
    subscriptions: number
    manual: number
    history: AdminActivityItem[]
  }
}
