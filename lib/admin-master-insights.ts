import "server-only"

import type { AdminActivityItem, AdminAlertItem, AdminInsights, AdminMetricPoint, AdminTrendRow } from "@/lib/admin-insights-contract"
import { EME_PLANS, normalizeEmePlanKey } from "@/lib/eme-plans"
import { prisma } from "@/lib/prisma"
import { SubscriptionStatus, UserRole } from "@/lib/prisma-enums"

const ESTIMATED_COST_PER_CREDIT = 0.08
const ESTIMATED_HOURLY_SAVINGS_BRL = 55

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

function formatDate(date?: Date | null) {
  if (!date) return null
  return date.toISOString()
}

function formatDateTimeLabel(date?: Date | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function bucketByDay(items: Date[], days: number) {
  const today = startOfDay()
  const labels = Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index - (days - 1))
    const key = day.toISOString().slice(0, 10)
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(day),
      value: 0,
    }
  })

  const map = new Map(labels.map((item) => [item.key, item]))
  items.forEach((item) => {
    const key = startOfDay(item).toISOString().slice(0, 10)
    const row = map.get(key)
    if (row) row.value += 1
  })

  return labels.map<AdminMetricPoint>(({ label, value }) => ({ label, value }))
}

function bucketByMonth(items: Date[], months: number) {
  const now = new Date()
  const labels = Array.from({ length: months }, (_, index) => {
    const month = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), index - (months - 1))
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(month),
      value: 0,
    }
  })

  const map = new Map(labels.map((item) => [item.key, item]))
  items.forEach((item) => {
    const key = `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, "0")}`
    const row = map.get(key)
    if (row) row.value += 1
  })

  return labels.map<AdminMetricPoint>(({ label, value }) => ({ label, value }))
}

function bucketByHour(items: Date[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}h`,
    value: 0,
  }))

  items.forEach((item) => {
    buckets[item.getHours()].value += 1
  })

  return buckets
}

function average(numbers: number[]) {
  if (!numbers.length) return null
  return Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1))
}

function topRowsFromMap(source: Map<string, number>, limit = 6, detailMap?: Map<string, string>): AdminTrendRow[] {
  return [...source.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value,
      detail: detailMap?.get(label),
    }))
}

function normalizeCommercialPlanLabel(value: string | null | undefined) {
  const planKey = normalizeEmePlanKey(value)
  return planKey === "scale" ? "Scale" : planKey === "pro" ? "Pro" : "Free"
}

function inferBrokerPlanKey(broker: {
  planAccount?: { planKey: string } | null
  user: { plan: string }
}) {
  if (broker.planAccount?.planKey) return normalizeEmePlanKey(broker.planAccount.planKey)
  if (broker.user.plan === "AGENCY") return "scale"
  if (broker.user.plan === "BROKER") return "pro"
  return "free"
}

function classifyStudioFeature(asset: {
  assetKey: string
  type: string
  campaignKind: string
}) {
  if (asset.type === "VIDEO") return "Videos"
  if (asset.assetKey === "story" || asset.type === "STORY") return "Stories"
  if (asset.assetKey === "post_feed" || asset.assetKey === "carousel") return "Posts"
  if (asset.type === "IMAGE" || asset.type === "THUMBNAIL") return "Imagens"
  if (asset.campaignKind === "SELL_PROPERTY") return "Anuncios"
  if (asset.type === "COPY") return "Descricoes"
  return "Biblioteca"
}

function buildAlertItems(input: {
  creditsUsed: number
  creditsBalance: number
  inactiveUsers: number
  delinquentSubscriptions: number
  cosFailures: number
  studioFailures: number
  nearLimitUsers: number
  pendingStudioReviews: number
}): AdminAlertItem[] {
  const items: AdminAlertItem[] = []

  if (input.creditsBalance > 0 && input.creditsUsed > input.creditsBalance * 2) {
    items.push({
      id: "high-ai-usage",
      title: "Consumo IA elevado",
      description: "O uso de Créditos IA já superou com folga o saldo agregado disponível.",
      severity: "high",
    })
  }

  if (input.delinquentSubscriptions > 0) {
    items.push({
      id: "pending-payments",
      title: "Assinaturas pendentes",
      description: `${input.delinquentSubscriptions} contas pagas precisam de regularização.`,
      severity: "high",
    })
  }

  if (input.cosFailures > 0) {
    items.push({
      id: "cos-errors",
      title: "Falhas no COS",
      description: `${input.cosFailures} interações do COS falharam no período recente.`,
      severity: "medium",
    })
  }

  if (input.studioFailures > 0) {
    items.push({
      id: "studio-errors",
      title: "Falhas no Studio IA",
      description: `${input.studioFailures} campanhas ou assets do Studio IA falharam recentemente.`,
      severity: "medium",
    })
  }

  if (input.pendingStudioReviews > 0) {
    items.push({
      id: "studio-pending-review",
      title: "Itens pendentes no Studio IA",
      description: `${input.pendingStudioReviews} assets aguardam revisão, aprovação ou publicação.`,
      severity: input.pendingStudioReviews > 20 ? "high" : "medium",
    })
  }

  if (input.nearLimitUsers > 0) {
    items.push({
      id: "near-limit",
      title: "Contas próximas do limite",
      description: `${input.nearLimitUsers} corretores estão próximos de consumir o saldo total de Créditos IA.`,
      severity: "low",
    })
  }

  if (input.inactiveUsers > 0) {
    items.push({
      id: "inactive-users",
      title: "Usuários inativos",
      description: `${input.inactiveUsers} contas estão sem acesso ativo e merecem acompanhamento.`,
      severity: "low",
    })
  }

  if (!items.length) {
    items.push({
      id: "healthy",
      title: "Operação saudável",
      description: "Nenhum alerta crítico foi identificado com os dados atuais da plataforma.",
      severity: "low",
    })
  }

  return items
}

export async function getAdminMasterInsights(): Promise<AdminInsights> {
  const now = new Date()
  const today = startOfDay(now)
  const last7Days = addDays(today, -6)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    users,
    brokers,
    subscriptions,
    interactions,
    documents,
    leads,
    agendaEvents,
    searchEvents,
    creditTransactions,
    extraPackagePurchases,
    studioCampaigns,
    aiTelemetry,
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        broker: {
          include: {
            planAccount: true,
          },
        },
        ownedAgency: true,
        trustedDevices: {
          where: { revokedAt: null },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.broker.findMany({
      include: {
        user: true,
        planAccount: true,
        _count: {
          select: {
            properties: true,
            leads: true,
            documents: true,
            agendaEvents: true,
            aiAssistantInteractions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { ownerType: "BROKER" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAssistantInteraction.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.brokerDocument.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.agendaEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.searchEvent.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.aiCreditTransaction.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2400,
    }),
    prisma.extraPackagePurchase.findMany({
      where: {
        metadata: {
          path: ["source"],
          equals: "admin_bonus",
        },
      },
      include: {
        broker: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.studioCampaign.findMany({
      include: {
        broker: { include: { user: true } },
        assets: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.aiOperationTelemetry.findMany({
      orderBy: { createdAt: "desc" },
      take: 2400,
    }),
  ])

  const proposals = documents.filter((item) => item.type === "proposal")
  const conversations = documents.filter((item) => item.type === "cos_conversation")
  const activeUsersToday = brokers.filter((item) => item.aiLastInteractionAt && item.aiLastInteractionAt >= today)
  const activePropertyCount = brokers.reduce((sum, broker) => sum + broker._count.properties, 0)
  const cosFailures = interactions.filter((item) => item.actionStatus && item.actionStatus !== "completed").length
  const totalCreditsConsumed = brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0)
  const totalCreditsBalance = brokers.reduce((sum, broker) => sum + broker.aiCreditsBalance, 0)
  const nearLimitUsers = brokers.filter((broker) => broker.aiCreditsBalance <= 10 && broker.aiCreditsUsedThisMonth > 0).length
  const paidBrokers = brokers.filter((broker) => inferBrokerPlanKey(broker) !== "free")
  const monthlyRevenue = paidBrokers.reduce((sum, broker) => sum + EME_PLANS[inferBrokerPlanKey(broker)].priceCents / 100, 0)
  const monthlySeries = bucketByMonth(
    paidBrokers.map((broker) => broker.createdAt ?? now).filter((item): item is Date => Boolean(item)),
    6,
  )
  const openAiCost = aiTelemetry
    .filter((item) => item.provider?.toLowerCase() === "openai" && item.costBrl !== null)
    .reduce((sum, item) => sum + Number(item.costBrl ?? 0), 0)
  const totalOperationCost = aiTelemetry.reduce((sum, item) => sum + Number(item.costBrl ?? 0), 0)
  const totalOperations = aiTelemetry.length
  const studioAssets = studioCampaigns.flatMap((campaign) =>
    campaign.assets.map((asset) => ({
      ...asset,
      campaignKind: campaign.kind,
      brokerName: campaign.broker?.user.name ?? "Sem corretor",
      createdAt: campaign.createdAt,
    })),
  )
  const pendingStudioReviews = studioAssets.filter((asset) => ["DRAFT", "PENDING_REVIEW", "APPROVED"].includes(asset.status)).length
  const studioFailures = studioCampaigns.filter((campaign) => campaign.status === "FAILED").length
  const studioFeatureUsage = new Map<string, number>()
  const studioBrokerUsage = new Map<string, number>()
  const studioBrokerDetail = new Map<string, string>()

  studioAssets.forEach((asset) => {
    const feature = classifyStudioFeature(asset)
    studioFeatureUsage.set(feature, (studioFeatureUsage.get(feature) || 0) + 1)
    studioBrokerUsage.set(asset.brokerName, (studioBrokerUsage.get(asset.brokerName) || 0) + 1)
    studioBrokerDetail.set(asset.brokerName, `${asset.type} • ${asset.assetKey}`)
  })

  const cosUsageByBroker = new Map<string, number>()
  const cosUsageByBrokerDetail = new Map<string, string>()
  interactions.forEach((item) => {
    const label = item.broker.user.name
    cosUsageByBroker.set(label, (cosUsageByBroker.get(label) || 0) + 1)
    cosUsageByBrokerDetail.set(label, item.broker.user.email)
  })

  const planDistributionMap = new Map<string, number>()
  users.forEach((user) => {
    if (user.role === UserRole.ADMIN) {
      planDistributionMap.set("Admin", (planDistributionMap.get("Admin") || 0) + 1)
      return
    }

    const planLabel = normalizeCommercialPlanLabel(user.broker?.planAccount?.planKey ?? user.plan)
    planDistributionMap.set(planLabel, (planDistributionMap.get(planLabel) || 0) + 1)
  })

  const topProductivity = brokers
    .map((broker) => ({
      label: broker.user.name,
      value: broker._count.properties * 2 + broker._count.leads * 2 + broker._count.documents * 2 + broker.aiCreditsUsedThisMonth,
      detail: `${broker._count.properties} imóveis • ${broker._count.leads} clientes`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const usersItems = users
    .filter((user) => [UserRole.BROKER, UserRole.ADMIN, UserRole.AGENCY].includes(user.role))
    .map((user) => {
      const broker = user.broker
      const brokerCampaigns = broker ? studioCampaigns.filter((campaign) => campaign.brokerId === broker.id) : []
      const brokerAssets = brokerCampaigns.flatMap((campaign) => campaign.assets)
      const brokerVideos = brokerAssets.filter((asset) => asset.type === "VIDEO").length
      const brokerImages = brokerAssets.filter((asset) => asset.type === "IMAGE" || asset.type === "THUMBNAIL").length
      const brokerInteractions = broker ? interactions.filter((item) => item.brokerId === broker.id) : []

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        type: user.role === UserRole.ADMIN ? "Admin" : user.role === UserRole.AGENCY ? "Operação" : "Corretor",
        plan: user.role === UserRole.ADMIN ? "Admin" : normalizeCommercialPlanLabel(broker?.planAccount?.planKey ?? user.plan),
        status: user.role === UserRole.BROKER && user.broker?.status === "INACTIVE" ? "Inativo" : "Ativo",
        createdAt: formatDateTimeLabel(user.createdAt),
        creditsBalance: broker?.aiCreditsBalance ?? 0,
        creditsUsed: broker?.aiCreditsUsedThisMonth ?? 0,
        imageGenerations: brokerImages,
        videoGenerations: brokerVideos,
        studioActions: brokerAssets.length,
        cosActions: brokerInteractions.length,
        lastAccess: formatDate(broker?.aiLastInteractionAt ?? null),
        devicesLabel: `${user.trustedDevices.length} dispositivo(s) confiável(is)`,
        historyLabel: broker ? `${brokerInteractions.length} interações e ${brokerAssets.length} assets do Studio IA` : "Conta sem operação de corretor",
        subscriptionLabel: user.role === UserRole.ADMIN ? "Conta administrativa" : `${normalizeCommercialPlanLabel(broker?.planAccount?.planKey ?? user.plan)} em operação`,
        financeLabel: user.role === UserRole.ADMIN ? "N/A" : broker ? `${broker.aiCreditsBalance} Créditos IA disponíveis` : "Sem carteira vinculada",
      }
    })

  const latestConversations: AdminActivityItem[] = conversations.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    detail: `${item.broker.user.name} • ${item.status}`,
    timestamp: formatDateTimeLabel(item.updatedAt),
    tone: item.status === "archived" ? "warning" : "default",
  }))

  const propertyBonusHistory: AdminActivityItem[] = extraPackagePurchases.map((purchase) => {
    const metadata =
      purchase.metadata && typeof purchase.metadata === "object"
        ? (purchase.metadata as Record<string, unknown>)
        : {}

    return {
      id: purchase.id,
      title: `${purchase.broker.user.name} recebeu +${purchase.quantity} imóveis na carteira`,
      detail: typeof metadata.reason === "string" ? metadata.reason : "Expansão administrativa da carteira",
      timestamp: formatDateTimeLabel(purchase.createdAt),
      tone: "success" as const,
    }
  })

  const bonusesHistory: AdminActivityItem[] = [
    ...creditTransactions
      .filter((item) => item.type === "admin_bonus")
      .map((item) => ({
        id: item.id,
        title: `${item.broker.user.name} recebeu ${Math.abs(item.amount)} Créditos IA`,
        detail: item.description || "Bonificação administrativa",
        timestamp: formatDateTimeLabel(item.createdAt),
          tone: "success" as const,
      })),
    ...propertyBonusHistory,
  ]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 12)

  const adminBonusTransactions = creditTransactions.filter((item) => item.type === "admin_bonus")
  const adminPropertyBonuses = extraPackagePurchases

  return {
    generatedAt: now.toISOString(),
    users: {
      total: usersItems.length,
      newLast7Days: users.filter((item) => item.createdAt >= last7Days).length,
      activeToday: activeUsersToday.length,
      blocked: usersItems.filter((item) => item.status === "Inativo").length,
      trial: usersItems.filter((item) => item.plan === "Free").length,
      activePlans: paidBrokers.length,
      planDistribution: [...planDistributionMap.entries()].map(([label, value]) => ({ label, value })),
      items: usersItems,
    },
    brokers: {
      total: brokers.length,
      active: brokers.filter((broker) => broker.status !== "INACTIVE").length,
      inactive: brokers.filter((broker) => broker.status === "INACTIVE").length,
      properties: activePropertyCount,
      leads: leads.length,
      proposals: proposals.length,
      agenda: agendaEvents.length,
      revenue: monthlyRevenue,
      creditsBalance: totalCreditsBalance,
      creditsUsed: totalCreditsConsumed,
      topProductivity,
      items: brokers.map((broker) => ({
        id: broker.id,
        name: broker.user.name,
        email: broker.user.email,
        status: broker.status === "INACTIVE" ? "Inativo" : "Ativo",
        plan: normalizeCommercialPlanLabel(broker.planAccount?.planKey ?? broker.user.plan),
        properties: broker._count.properties,
        clients: broker._count.leads,
        proposals: broker._count.documents,
        agenda: broker._count.agendaEvents,
        leads: broker._count.leads,
        sales: leads.filter((lead) => lead.brokerId === broker.id && lead.status === "WON").length,
        revenue: EME_PLANS[inferBrokerPlanKey(broker)].priceCents / 100,
        creditsBalance: broker.aiCreditsBalance,
        monthlyCreditsUsed: broker.aiCreditsUsedThisMonth,
        studioActions: studioCampaigns.filter((item) => item.brokerId === broker.id).length,
        cosActions: interactions.filter((item) => item.brokerId === broker.id).length,
        imagesCreated: studioAssets.filter((asset) => asset.brokerName === broker.user.name && (asset.type === "IMAGE" || asset.type === "THUMBNAIL")).length,
        videosCreated: studioAssets.filter((asset) => asset.brokerName === broker.user.name && asset.type === "VIDEO").length,
        productivityScore: broker._count.properties * 2 + broker._count.leads * 2 + broker._count.documents * 2 + broker.aiCreditsUsedThisMonth,
        lastAccess: formatDate(broker.aiLastInteractionAt),
        corretorEmeStatus: "Nao configurado",
      })),
    },
    assessor: {
      status: "Descontinuado",
      officialNumber: "Nao aplicavel",
      sessions: 0,
      messagesReceived: 0,
      messagesSent: 0,
      commandsExecuted: 0,
      createdClients: 0,
      createdProperties: 0,
      failures: 0,
      avgResponseMinutes: null,
      aiConsumption: 0,
      timeline: [],
    },
    corretorEme: {
      connectedBrokers: 0,
      activeWhatsApps: 0,
      needsQrCode: 0,
      lastSyncLabel: "-",
      messagesReceived: 0,
      messagesSent: 0,
      leadsGenerated: 0,
      clientsCreated: 0,
      aiUsage: 0,
      creditsConsumed: 0,
      brokerActivity: [],
    },
    cos: {
      conversationsToday: conversations.filter((item) => item.createdAt >= today).length,
      conversationsTotal: conversations.length,
      messages: interactions.length,
      commandsExecuted: interactions.length,
      propertySearches: searchEvents.length + interactions.filter((item) => item.actionType === "searchProperties").length,
      proposalsCreated: proposals.length,
      clientsCreated: interactions.filter((item) => item.actionType === "createLead").length,
      propertiesCreated: interactions.filter((item) => item.actionType === "createProperty").length,
      appointments: agendaEvents.length,
      aiConsumption: interactions.reduce((sum, item) => sum + item.creditsUsed, 0),
      creditsSpent: interactions.reduce((sum, item) => sum + item.creditsUsed, 0),
      avgResponseMinutes: null,
      satisfaction: null,
      usageByDay: bucketByDay(interactions.map((item) => item.createdAt), 7),
      usageByBroker: topRowsFromMap(cosUsageByBroker, 8, cosUsageByBrokerDetail),
      usageByHour: bucketByHour(interactions.map((item) => item.createdAt)),
      latestConversations,
      ranking: topRowsFromMap(cosUsageByBroker, 8, cosUsageByBrokerDetail),
    },
    studioIa: {
      campaigns: studioCampaigns.length,
      libraryItems: studioCampaigns.length,
      libraryAssets: studioAssets.length,
      imagesCreated: studioAssets.filter((asset) => asset.type === "IMAGE" || asset.type === "THUMBNAIL").length,
      videosCreated: studioAssets.filter((asset) => asset.type === "VIDEO").length,
      postsCreated: studioAssets.filter((asset) => asset.assetKey === "post_feed" || asset.assetKey === "carousel").length,
      storiesCreated: studioAssets.filter((asset) => asset.assetKey === "story" || asset.type === "STORY").length,
      anuncios: studioCampaigns.filter((campaign) => campaign.kind === "SELL_PROPERTY").length,
      descriptions: studioAssets.filter((asset) => asset.type === "COPY").length,
      postsInstagram: studioCampaigns.filter((campaign) => campaign.kind === "INSTAGRAM").length,
      homeStaging: studioCampaigns.filter((campaign) => campaign.kind === "CONSTRUCTION").length,
      captacoes: studioCampaigns.filter((campaign) => campaign.kind === "OWNERS").length,
      aiConsumption: creditTransactions.filter((item) => (item.actionType || "").startsWith("studio_")).reduce((sum, item) => sum + Math.abs(item.amount), 0),
      creditsUsed: creditTransactions.filter((item) => (item.actionType || "").startsWith("studio_")).reduce((sum, item) => sum + Math.abs(item.amount), 0),
      estimatedSavings: Number((((studioAssets.length * 8) / 60) * ESTIMATED_HOURLY_SAVINGS_BRL).toFixed(2)),
      generationByDay: bucketByDay(studioCampaigns.map((item) => item.createdAt), 7),
      usageByMonth: bucketByMonth(studioCampaigns.map((item) => item.createdAt), 6),
      consumptionByFeature: topRowsFromMap(studioFeatureUsage, 8),
      ranking: topRowsFromMap(studioBrokerUsage, 8, studioBrokerDetail),
    },
    aiConsumption: {
      totalCreditsConsumed,
      currentBalance: totalCreditsBalance,
      estimatedCost: Number((totalCreditsConsumed * ESTIMATED_COST_PER_CREDIT).toFixed(2)),
      totalOperations,
      activeUsers: activeUsersToday.length,
      averagePerOperation: Number((totalCreditsConsumed / Math.max(totalOperations, 1)).toFixed(2)),
      averageCostPerUser: Number((openAiCost / Math.max(activeUsersToday.length, 1)).toFixed(2)),
      averageCostPerOperation: Number((totalOperationCost / Math.max(totalOperations, 1)).toFixed(4)),
      openAiCost: Number(openAiCost.toFixed(2)),
      averagePerUser: Number((totalCreditsConsumed / Math.max(activeUsersToday.length, 1)).toFixed(1)),
      averagePerBroker: Number((totalCreditsConsumed / Math.max(brokers.length, 1)).toFixed(1)),
      byResource: [
        { label: "COS", value: interactions.reduce((sum, item) => sum + item.creditsUsed, 0), detail: "Interações operacionais e buscas" },
        { label: "Studio IA", value: creditTransactions.filter((item) => (item.actionType || "").startsWith("studio_")).reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "Campanhas, criativos, imagens e vídeos" },
        { label: "Imóveis", value: creditTransactions.filter((item) => ["generate_property_ai", "improve_description", "smart_import_image", "smart_import_text", "smart_import_url", "smart_import_print"].includes(item.actionType || "")).reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "Cadastro, importação e melhoria de anúncios" },
        { label: "Propostas e contratos", value: creditTransactions.filter((item) => ["CREATE_PROPOSAL", "CREATE_CONTRACT"].includes(item.actionType || "")).reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "Fluxos documentais com IA" },
      ],
    },
    revenue: {
      mrr: Number(monthlyRevenue.toFixed(2)),
      arr: Number((monthlyRevenue * 12).toFixed(2)),
      monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
      annualRevenue: Number((monthlyRevenue * 12).toFixed(2)),
      growth: null,
      delinquency: subscriptions.filter((item) => item.status === SubscriptionStatus.PAST_DUE).length,
      upgrades: 0,
      downgrades: 0,
      cancellations: subscriptions.filter((item) => item.status === SubscriptionStatus.CANCELED).length,
      ltv: paidBrokers.length ? Number((monthlyRevenue * 8).toFixed(2)) : null,
      averageTicket: Number((monthlyRevenue / Math.max(paidBrokers.length, 1)).toFixed(2)),
      paidUsers: paidBrokers.length,
      monthlySeries,
    },
    analytics: {
      activeUsers: activeUsersToday.length,
      properties: activePropertyCount,
      clients: leads.length,
      proposals: proposals.length,
      studioIa: studioCampaigns.length,
      cos: interactions.length,
      videos: studioAssets.filter((asset) => asset.type === "VIDEO").length,
      images: studioAssets.filter((asset) => asset.type === "IMAGE" || asset.type === "THUMBNAIL").length,
      conversions: leads.filter((lead) => lead.status === "WON").length,
      sales: leads.filter((lead) => lead.status === "WON").length,
      retention: paidBrokers.length ? Number(((paidBrokers.length / Math.max(brokers.length, 1)) * 100).toFixed(1)) : null,
      engagement: interactions.length > 0 ? Number((interactions.length / Math.max(activeUsersToday.length, 1)).toFixed(1)) : null,
    },
    alerts: {
      items: buildAlertItems({
        creditsUsed: totalCreditsConsumed,
        creditsBalance: totalCreditsBalance,
        inactiveUsers: usersItems.filter((item) => item.status === "Inativo").length,
        delinquentSubscriptions: subscriptions.filter((item) => item.status === SubscriptionStatus.PAST_DUE).length,
        cosFailures,
        studioFailures,
        nearLimitUsers,
        pendingStudioReviews,
      }),
    },
    bonuses: {
      totalBonuses: adminBonusTransactions.length + adminPropertyBonuses.length,
      last30Days:
        adminBonusTransactions.filter((item) => item.createdAt >= addDays(today, -29)).length +
        adminPropertyBonuses.filter((item) => item.createdAt >= addDays(today, -29)).length,
      campaigns: adminBonusTransactions.filter((item) => (item.description || "").toLowerCase().includes("campanha")).length,
      indications: adminBonusTransactions.filter((item) => (item.description || "").toLowerCase().includes("indic")).length,
      subscriptions: adminBonusTransactions.filter((item) => (item.description || "").toLowerCase().includes("assin")).length,
      manual:
        adminBonusTransactions.filter((item) => !(item.description || "").toLowerCase().includes("campanha") && !(item.description || "").toLowerCase().includes("indic") && !(item.description || "").toLowerCase().includes("assin")).length +
        adminPropertyBonuses.length,
      history: bonusesHistory,
    },
  }
}
