import "server-only"

import { PROPERTY_PUBLICATION_STANDARDS } from "@/lib/property-publication-readiness"
import type { AdminMarketplaceAd, AdminMarketplaceBroker, AdminMarketplaceRegion, AdminMarketplaceReport } from "@/lib/admin-marketplace-contract"
import { prisma } from "@/lib/prisma"

function imageCount(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).length
    : 0
}

function qualityIssues(property: {
  description: string | null
  imageUrls: unknown
  neighborhood: string | null
  marketplaceSlug: string | null
  broker: { creciValidationStatus: string }
}) {
  const issues: string[] = []
  if ((property.description?.trim().length ?? 0) < PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumDescriptionCharacters) issues.push("Descrição incompleta")
  if (imageCount(property.imageUrls) < PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumPhotos) issues.push("Fotos insuficientes")
  if (!property.neighborhood?.trim()) issues.push("Bairro não informado")
  if (!property.marketplaceSlug) issues.push("Link público indisponível")
  if (property.broker.creciValidationStatus !== "VERIFIED") issues.push("CRECI não verificado")
  return issues
}

export async function getAdminMarketplaceReport(): Promise<AdminMarketplaceReport> {
  const [properties, conversations, leads, totalConversations, totalLeads, totalReviews, pendingReviews] = await Promise.all([
    prisma.property.findMany({
      where: { marketplacePublished: true },
      select: {
        id: true,
        title: true,
        city: true,
        neighborhood: true,
        description: true,
        imageUrls: true,
        viewsCount: true,
        marketplacePublishedAt: true,
        marketplaceSlug: true,
        broker: {
          select: {
            id: true,
            userId: true,
            creci: true,
            creciUf: true,
            creciValidationStatus: true,
            marketplaceRegion: true,
            marketplaceSpecialties: true,
            marketplaceRating: true,
            marketplaceReviewCount: true,
            user: { select: { name: true, email: true, photoUrl: true } },
          },
        },
        _count: { select: { leads: true, marketplaceConversations: true } },
      },
      orderBy: [{ marketplacePublishedAt: "desc" }, { updatedAt: "desc" }],
      take: 500,
    }),
    prisma.marketplaceConversation.findMany({
      select: {
        id: true,
        customerName: true,
        status: true,
        lastMessageAt: true,
        broker: { select: { user: { select: { name: true } } } },
        property: { select: { title: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
    }),
    prisma.lead.findMany({
      where: { source: { in: ["marketplace", "marketplace_chat", "marketplace_assistant"] } },
      select: {
        id: true,
        name: true,
        source: true,
        status: true,
        createdAt: true,
        broker: { select: { user: { select: { name: true } } } },
        property: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.marketplaceConversation.count(),
    prisma.lead.count({ where: { source: { in: ["marketplace", "marketplace_chat", "marketplace_assistant"] } } }),
    prisma.marketplaceReview.count(),
    prisma.marketplaceReview.count({ where: { status: "PENDING_REVIEW" } }),
  ])

  const ads: AdminMarketplaceAd[] = properties.map((property) => {
    const issues = qualityIssues(property)
    return {
      id: property.id,
      title: property.title,
      brokerId: property.broker.id,
      brokerName: property.broker.user.name,
      region: property.broker.marketplaceRegion || property.city,
      status: "Publicado",
      readiness: issues.length ? "Atenção" : "Pronto",
      qualityScore: Math.max(0, 100 - issues.length * 18),
      qualityIssues: issues,
      views: property.viewsCount,
      leads: property._count.leads,
      conversations: property._count.marketplaceConversations,
      publishedAt: property.marketplacePublishedAt?.toISOString() ?? null,
      publicPath: property.marketplaceSlug ? `/imoveis/imovel/${encodeURIComponent(property.marketplaceSlug)}` : null,
    }
  })

  const brokerMap = new Map<string, AdminMarketplaceBroker>()
  for (const property of properties) {
    const current = brokerMap.get(property.broker.id)
    const views = (current?.views ?? 0) + property.viewsCount
    const brokerLeads = (current?.leads ?? 0) + property._count.leads
    const brokerConversations = (current?.conversations ?? 0) + property._count.marketplaceConversations
    const publishedProperties = (current?.publishedProperties ?? 0) + 1
    brokerMap.set(property.broker.id, {
      id: property.broker.id,
      userId: property.broker.userId,
      name: property.broker.user.name,
      email: property.broker.user.email,
      photoUrl: property.broker.user.photoUrl,
      creci: property.broker.creci ? `${property.broker.creciUf ? `${property.broker.creciUf} / ` : ""}${property.broker.creci}` : null,
      creciStatus: property.broker.creciValidationStatus,
      region: property.broker.marketplaceRegion || property.city,
      specialties: property.broker.marketplaceSpecialties,
      publishedProperties,
      reviews: property.broker.marketplaceReviewCount,
      rating: property.broker.marketplaceRating == null ? null : Number(property.broker.marketplaceRating),
      leads: brokerLeads,
      conversations: brokerConversations,
      views,
      performanceScore: views + brokerLeads * 8 + brokerConversations * 5 + property.broker.marketplaceReviewCount * 4,
    })
  }

  const regionMap = new Map<string, AdminMarketplaceRegion>()
  for (const ad of ads) {
    const current = regionMap.get(ad.region) ?? { name: ad.region, properties: 0, views: 0, leads: 0, conversations: 0 }
    current.properties += 1
    current.views += ad.views
    current.leads += ad.leads
    current.conversations += ad.conversations
    regionMap.set(ad.region, current)
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const brokers = [...brokerMap.values()].sort((first, second) => second.performanceScore - first.performanceScore)
  const regions = [...regionMap.values()].sort((first, second) => (second.views + second.leads * 5) - (first.views + first.leads * 5))

  return {
    generatedAt: now.toISOString(),
    overview: {
      publishedProperties: ads.length,
      newAdvertisements: ads.filter((ad) => ad.publishedAt && new Date(ad.publishedAt) >= monthStart).length,
      views: ads.reduce((sum, ad) => sum + ad.views, 0),
      leads: totalLeads,
      conversations: totalConversations,
      pendingReviews,
      lowQualityAdvertisements: ads.filter((ad) => ad.readiness === "Atenção").length,
      activeBrokers: brokers.length,
    },
    reviewSummary: { total: totalReviews, pending: pendingReviews },
    regionSummary: { total: regions.length },
    ads,
    brokers,
    regions,
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      customerName: conversation.customerName,
      brokerName: conversation.broker.user.name,
      propertyTitle: conversation.property?.title ?? "Sem imóvel vinculado",
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    })),
    leads: leads.map((lead) => ({
      id: lead.id,
      name: lead.name || "Contato sem nome",
      brokerName: lead.broker?.user.name ?? "Sem corretor vinculado",
      propertyTitle: lead.property?.title ?? "Sem imóvel vinculado",
      source: lead.source,
      status: lead.status,
      createdAt: lead.createdAt.toISOString(),
    })),
  }
}
