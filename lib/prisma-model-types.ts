import type {
  BillingPlan,
  BillingUserSubscriptionStatus,
  BrokerAccountStatus,
  CatalogOwnerType,
  LeadStatus,
  PropertyStatus,
  PropertyType,
  SubscriptionOwnerType,
  SubscriptionStatus,
  UserRole,
} from "@/lib/prisma-enums"

export type User = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  phone: string | null
  photoUrl: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  plan: BillingPlan
  subscriptionStatus: BillingUserSubscriptionStatus
  createdAt: Date
}

export type Broker = {
  id: string
  userId: string
  agencyId: string | null
  phone: string
  catalogSlug: string
  status: BrokerAccountStatus
  creci: string | null
  description: string | null
  aiCreditsBalance: number
  aiCreditsUsedThisMonth: number
  aiAssistantEnabled: boolean
  aiMonthlyUsage: number
  aiLastInteractionAt: Date | null
  createdAt: Date
}

export type Agency = {
  id: string
  ownerUserId: string
  name: string
  catalogSlug: string
  phone: string | null
  cnpj: string | null
  logoUrl: string | null
  description: string | null
  createdAt: Date
}

export type Property = {
  id: string
  title: string
  description: string | null
  audioUrl: string | null
  price: number
  city: string
  neighborhood: string | null
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  type: PropertyType
  purpose: string
  status: PropertyStatus
  published: boolean
  imageUrls: unknown
  viewsCount: number
  leadsCount: number
  brokerId: string
  agencyId: string | null
  createdAt: Date
  updatedAt: Date
}

export type Subscription = {
  id: string
  ownerType: SubscriptionOwnerType
  ownerId: string
  status: SubscriptionStatus
  nextBillingAt: Date | null
  createdAt: Date
}

export type Notification = {
  id: string
  userId: string
  title: string
  message: string
  read: boolean
  archivedAt: Date | null
  createdAt: Date
}

export type Lead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  catalogSlug: string | null
  searchTerm: string | null
  intent: string | null
  source: string
  status: LeadStatus
  propertyId: string | null
  brokerId: string | null
  agencyId: string | null
  userId: string | null
  createdAt: Date
  updatedAt: Date
}

export type Catalog = {
  id: string
  slug: string
  ownerType: CatalogOwnerType
  ownerId: string
  createdAt: Date
}

export type AiAssistantInteraction = {
  id: string
  userId: string
  brokerId: string
  prompt: string
  response: string
  actionType: string
  creditsUsed: number
  createdAt: Date
}
