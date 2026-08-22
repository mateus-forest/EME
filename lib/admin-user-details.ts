import "server-only"

import { EME_PLANS, normalizeEmePlanKey } from "@/lib/eme-plans"
import { prisma } from "@/lib/prisma"
import type { AdminUserDetails } from "@/lib/admin-user-details-contract"

const DETAILS_BLOCK_TIMEOUT_MS = 5000

function planLabel(value: string | null | undefined) {
  const key = normalizeEmePlanKey(value)
  return EME_PLANS[key]?.name ?? "Free"
}

async function safeDetailsBlock<T>(
  block: string,
  query: () => Promise<T>,
  fallback: T,
  unavailableBlocks: string[],
): Promise<T> {
  const startedAt = Date.now()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      query(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Block timed out after ${DETAILS_BLOCK_TIMEOUT_MS}ms`)),
          DETAILS_BLOCK_TIMEOUT_MS,
        )
      }),
    ])
    const durationMs = Date.now() - startedAt
    if (durationMs >= 1500) console.warn("[admin][user-details][slow-block]", { block, durationMs })
    return result
  } catch (error) {
    unavailableBlocks.push(block)
    console.error("[admin][user-details][block-failed]", {
      block,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "unknown",
    })
    return fallback
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function latestDate(values: Array<Date | null | undefined>) {
  return values
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
}

export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails | null> {
  const startedAt = Date.now()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      plan: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      createdAt: true,
      trustedDevices: {
        orderBy: { trustedAt: "desc" },
        select: {
          id: true,
          label: true,
          browser: true,
          platform: true,
          lastAccessAt: true,
          trustedAt: true,
          revokedAt: true,
        },
      },
      broker: {
        select: {
          id: true,
          status: true,
          creci: true,
          creciUf: true,
          creciOfficialRegistration: true,
          creciValidationStatus: true,
          aiCreditsBalance: true,
          aiCreditsUsedThisMonth: true,
          aiLastInteractionAt: true,
          catalogSlug: true,
          marketplaceSpecialties: true,
          marketplaceRegion: true,
          marketplaceAbout: true,
          planAccount: { select: { planKey: true } },
        },
      },
    },
  })
  if (!user) return null

  const lastAccessAt = latestDate([
    user.broker?.aiLastInteractionAt,
    ...user.trustedDevices.map((device) => device.lastAccessAt ?? device.trustedAt),
  ])
  const baseUser: AdminUserDetails["user"] = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.broker?.status ?? null,
    createdAt: user.createdAt.toISOString(),
    lastAccessAt: lastAccessAt?.toISOString() ?? null,
  }
  const devices: AdminUserDetails["devices"] = user.trustedDevices.map((device) => ({
    id: device.id,
    label: device.label,
    browser: device.browser,
    platform: device.platform,
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
      unavailableBlocks: [],
    }
  }

  const unavailableBlocks: string[] = []
  const [properties, clients, proposalCount, contractCount] = await Promise.all([
    safeDetailsBlock("imóveis", () => prisma.property.findMany({ where: { brokerId: broker.id }, select: { id: true, published: true, marketplacePublished: true, viewsCount: true } }), [], unavailableBlocks),
    safeDetailsBlock("clientes", () => prisma.lead.findMany({ where: { brokerId: broker.id }, select: { id: true, name: true, status: true, source: true, createdAt: true, property: { select: { title: true } } }, orderBy: { createdAt: "desc" } }), [], unavailableBlocks),
    safeDetailsBlock("propostas", () => prisma.brokerDocument.count({ where: { brokerId: broker.id, type: "proposal" } }), 0, unavailableBlocks),
    safeDetailsBlock("contratos", () => prisma.contractTemplateInstance.count({ where: { brokerId: broker.id } }), 0, unavailableBlocks),
  ])
  const [cosInteractions, studioCampaigns, studioAssets, aiAggregate] = await Promise.all([
    safeDetailsBlock("COS", () => prisma.aiAssistantInteraction.count({ where: { brokerId: broker.id } }), 0, unavailableBlocks),
    safeDetailsBlock("Studio IA", () => prisma.studioCampaign.count({ where: { brokerId: broker.id } }), 0, unavailableBlocks),
    safeDetailsBlock("assets do Studio IA", () => prisma.studioCampaignAsset.count({ where: { campaign: { brokerId: broker.id } } }), 0, unavailableBlocks),
    safeDetailsBlock("consumo de IA", () => prisma.aiOperationTelemetry.aggregate({ where: { brokerId: broker.id }, _sum: { creditsConsumed: true, costBrl: true } }), { _sum: { creditsConsumed: null, costBrl: null } }, unavailableBlocks),
  ])
  const [aiOperations, catalogViews, catalogShares, marketplaceConversations] = await Promise.all([
    safeDetailsBlock("operações de IA", () => prisma.aiOperationTelemetry.count({ where: { brokerId: broker.id } }), 0, unavailableBlocks),
    safeDetailsBlock("acessos do Catálogo", () => prisma.catalogEvent.count({ where: { brokerId: broker.id, eventType: { in: ["catalog_view", "profile_view"] } } }), 0, unavailableBlocks),
    safeDetailsBlock("compartilhamentos do Catálogo", () => prisma.catalogEvent.count({ where: { brokerId: broker.id, eventType: { in: ["catalog_share", "share"] } } }), 0, unavailableBlocks),
    safeDetailsBlock("conversas do Marketplace", () => prisma.marketplaceConversation.count({ where: { brokerId: broker.id } }), 0, unavailableBlocks),
  ])
  const [subscription, purchases] = await Promise.all([
    safeDetailsBlock("assinatura", () => prisma.subscription.findFirst({ where: { ownerType: "BROKER", ownerId: broker.id } }), null, unavailableBlocks),
    safeDetailsBlock("cobranças", () => prisma.extraPackagePurchase.findMany({ where: { brokerId: broker.id }, select: { id: true, packageKey: true, packageType: true, quantity: true, amountCents: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }), [], unavailableBlocks),
  ])

  const publishedProperties = properties.filter((property) => property.published)
  const marketplaceProperties = properties.filter((property) => property.marketplacePublished)
  const marketplaceConfigured = broker.marketplaceSpecialties.length > 0 || Boolean(broker.marketplaceRegion || broker.marketplaceAbout)
  const details: AdminUserDetails = {
    user: baseUser,
    account: {
      plan: planLabel(broker.planAccount?.planKey ?? user.plan),
      brokerStatus: broker.status,
      creci: [broker.creciUf, broker.creciOfficialRegistration || broker.creci].filter(Boolean).join(" / ") || null,
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
      profileStatus: marketplaceConfigured ? "Configurado" : "Não configurado",
    },
    billing: {
      subscriptionStatus: user.subscriptionStatus,
      stripeLinked: Boolean(user.stripeCustomerId),
      localSubscriptionStatus: subscription?.status ?? null,
      recentPurchases: purchases.map((purchase) => ({
        id: purchase.id,
        type: purchase.packageType || purchase.packageKey,
        quantity: purchase.quantity,
        amountCents: purchase.amountCents,
        status: purchase.status,
        createdAt: purchase.createdAt.toISOString(),
      })),
    },
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      status: client.status,
      source: client.source,
      createdAt: client.createdAt.toISOString(),
      property: client.property?.title ?? null,
    })),
    unavailableBlocks,
  }
  console.info("[admin][user-details][completed]", {
    userId,
    durationMs: Date.now() - startedAt,
    unavailableBlocks,
  })
  return details
}
