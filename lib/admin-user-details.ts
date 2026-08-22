import "server-only"

import { EME_PLANS, normalizeEmePlanKey } from "@/lib/eme-plans"
import { prisma } from "@/lib/prisma"
import type { AdminUserDetails } from "@/lib/admin-user-details-contract"

function planLabel(value: string | null | undefined) {
  const key = normalizeEmePlanKey(value)
  return EME_PLANS[key]?.name ?? "Free"
}

export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { trustedDevices: { orderBy: { trustedAt: "desc" } }, broker: { include: { planAccount: true } } },
  })
  if (!user) return null

  const baseUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }
  const devices = user.trustedDevices.map((device) => ({
    id: device.id,
    status: device.revokedAt ? "Revogado" : "Confiável",
    lastAccessAt: device.lastAccessAt?.toISOString() ?? null,
  }))
  const broker = user.broker
  if (!broker) {
    return {
      user: baseUser,
      account: { plan: planLabel(user.plan), brokerStatus: null, creci: null, creciStatus: null, creditsBalance: 0, creditsUsed: 0 },
      devices,
      operation: { properties: 0, publishedProperties: 0, clients: 0, proposals: 0, contracts: 0, cosInteractions: 0, studioCampaigns: 0, studioAssets: 0, aiOperations: 0, aiCredits: 0, aiCostBrl: 0 },
      catalog: { slug: null, publishedProperties: 0, views: 0, contacts: 0, shares: 0, status: "Sem corretor vinculado" },
      marketplace: { publishedProperties: 0, views: 0, leads: 0, conversations: 0, profileStatus: "Sem corretor vinculado" },
      billing: { subscriptionStatus: user.subscriptionStatus, stripeLinked: Boolean(user.stripeCustomerId), localSubscriptionStatus: null, recentPurchases: [] },
      clients: [],
    }
  }

  const [properties, clients, proposalCount, contractCount, cosInteractions, studioCampaigns, studioAssets, aiAggregate, aiOperations, catalogViews, catalogShares, marketplaceConversations, subscription, purchases] = await Promise.all([
    prisma.property.findMany({ where: { brokerId: broker.id }, select: { id: true, published: true, marketplacePublished: true, viewsCount: true } }),
    prisma.lead.findMany({ where: { brokerId: broker.id }, select: { id: true, name: true, status: true, source: true, createdAt: true, property: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.brokerDocument.count({ where: { brokerId: broker.id, type: "proposal" } }),
    prisma.contractTemplateInstance.count({ where: { brokerId: broker.id } }),
    prisma.aiAssistantInteraction.count({ where: { brokerId: broker.id } }),
    prisma.studioCampaign.count({ where: { brokerId: broker.id } }),
    prisma.studioCampaignAsset.count({ where: { campaign: { brokerId: broker.id } } }),
    prisma.aiOperationTelemetry.aggregate({ where: { brokerId: broker.id }, _sum: { creditsConsumed: true, costBrl: true } }),
    prisma.aiOperationTelemetry.count({ where: { brokerId: broker.id } }),
    prisma.catalogEvent.count({ where: { brokerId: broker.id, eventType: { in: ["catalog_view", "profile_view"] } } }),
    prisma.catalogEvent.count({ where: { brokerId: broker.id, eventType: { in: ["catalog_share", "share"] } } }),
    prisma.marketplaceConversation.count({ where: { brokerId: broker.id } }),
    prisma.subscription.findFirst({ where: { ownerType: "BROKER", ownerId: broker.id }, orderBy: { updatedAt: "desc" } }),
    prisma.extraPackagePurchase.findMany({ where: { brokerId: broker.id, status: "COMPLETED" }, select: { id: true, kind: true, quantity: true, amountCents: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ])

  const publishedProperties = properties.filter((property) => property.published)
  const marketplaceProperties = properties.filter((property) => property.marketplacePublished)
  return {
    user: baseUser,
    account: {
      plan: planLabel(broker.planAccount?.planKey ?? user.plan),
      brokerStatus: broker.status,
      creci: [broker.creciState, broker.creciOfficialRegistration || broker.creciNumber].filter(Boolean).join(" / ") || null,
      creciStatus: broker.creciValidationStatus,
      creditsBalance: broker.aiCreditsBalance,
      creditsUsed: broker.aiCreditsUsedThisMonth,
    },
    devices,
    operation: {
      properties: properties.length,
      publishedProperties: publishedProperties.length,
      clients: clients.length,
      proposals: proposalCount,
      contracts: contractCount,
      cosInteractions,
      studioCampaigns,
      studioAssets,
      aiOperations,
      aiCredits: aiAggregate._sum.creditsConsumed ?? 0,
      aiCostBrl: Number(aiAggregate._sum.costBrl ?? 0),
    },
    catalog: {
      slug: broker.catalogSlug,
      publishedProperties: publishedProperties.length,
      views: catalogViews,
      contacts: clients.filter((client) => client.source.toLowerCase().includes("catalog")).length,
      shares: catalogShares,
      status: broker.status === "INACTIVE" ? "Inativo" : publishedProperties.length ? "Ativo" : "Sem imóveis publicados",
    },
    marketplace: {
      publishedProperties: marketplaceProperties.length,
      views: marketplaceProperties.reduce((sum, property) => sum + property.viewsCount, 0),
      leads: clients.filter((client) => client.source.toLowerCase().includes("marketplace")).length,
      conversations: marketplaceConversations,
      profileStatus: broker.marketplaceProfilePublished ? "Publicado" : "Não publicado",
    },
    billing: {
      subscriptionStatus: user.subscriptionStatus,
      stripeLinked: Boolean(user.stripeCustomerId),
      localSubscriptionStatus: subscription?.status ?? null,
      recentPurchases: purchases.map((purchase) => ({ id: purchase.id, type: purchase.kind, quantity: purchase.quantity, amountCents: purchase.amountCents, status: purchase.status, createdAt: purchase.createdAt.toISOString() })),
    },
    clients: clients.map((client) => ({ id: client.id, name: client.name, status: client.status, source: client.source, createdAt: client.createdAt.toISOString(), property: client.property?.title ?? null })),
  }
}
