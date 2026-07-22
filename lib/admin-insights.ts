import "server-only"

import type { AdminAlertItem, AdminInsights, AdminMetricPoint, AdminTrendRow } from "@/lib/admin-insights-contract"
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

function formatDateLabel(date?: Date | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
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

function average(numbers: number[]) {
  if (!numbers.length) return null
  return Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1))
}

function growthRate(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : null
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function inferStudioResource(actionType: string | null | undefined) {
  const normalized = (actionType || "").toLowerCase()
  if (!normalized) return null
  if (normalized.includes("video")) return "Videos"
  if (normalized.includes("instagram")) return "Posts Instagram"
  if (normalized.includes("sell_property")) return "Anuncios"
  if (normalized.includes("buyers")) return "Descricoes"
  if (normalized.includes("owners")) return "Captacoes"
  if (normalized.includes("property_ai") || normalized.includes("construction")) return "Imagens"
  return normalized.startsWith("studio_ia_") ? "Studio IA" : null
}

function inferBonusKind(reason: string) {
  const normalized = reason.toLowerCase()
  if (normalized.includes("campanha")) return "campaign"
  if (normalized.includes("indic")) return "indication"
  if (normalized.includes("assin")) return "subscription"
  return "manual"
}

function buildAlertItems(input: {
  creditsUsed: number
  creditsBalance: number
  activeUsers: number
  inactiveUsers: number
  generationFailures: number
  offlineIntegrations: number
  delinquentSubscriptions: number
  pausedWhatsApps: number
  cosFailures: number
  studioFailures: number
  nearLimitUsers: number
}): AdminAlertItem[] {
  const items: AdminAlertItem[] = []

  if (input.creditsUsed > input.creditsBalance * 2) {
    items.push({
      id: "high-ai-usage",
      title: "Consumo IA elevado",
      description: "O uso mensal de créditos já supera com folga o saldo agregado disponível.",
      severity: "high",
    })
  }

  if (input.inactiveUsers > 0) {
    items.push({
      id: "inactive-users",
      title: "Usuários sem acesso ativo",
      description: `${input.inactiveUsers} contas estão inativas e podem precisar de ação comercial ou suporte.`,
      severity: "medium",
    })
  }

  if (input.generationFailures > 0) {
    items.push({
      id: "generation-failures",
      title: "Falhas de geração recentes",
      description: `${input.generationFailures} execuções de IA registraram falha recentemente.`,
      severity: input.generationFailures > 5 ? "high" : "medium",
    })
  }

  if (input.offlineIntegrations > 0) {
    items.push({
      id: "offline-integrations",
      title: "Integrações offline",
      description: `${input.offlineIntegrations} integrações do Corretor EME estão pausadas ou não configuradas.`,
      severity: "medium",
    })
  }

  if (input.delinquentSubscriptions > 0) {
    items.push({
      id: "pending-payments",
      title: "Pagamentos pendentes",
      description: `${input.delinquentSubscriptions} assinaturas estão em atraso ou demandam regularização.`,
      severity: "high",
    })
  }

  if (input.pausedWhatsApps > 0) {
    items.push({
      id: "paused-whatsapp",
      title: "WhatsApps desconectados",
      description: `${input.pausedWhatsApps} corretores estão com o canal pausado ou em preparação.`,
      severity: "medium",
    })
  }

  if (input.cosFailures > 0) {
    items.push({
      id: "cos-errors",
      title: "Erros no COS",
      description: `${input.cosFailures} interações do COS falharam e merecem revisão.`,
      severity: "medium",
    })
  }

  if (input.studioFailures > 0) {
    items.push({
      id: "studio-errors",
      title: "Erros no Studio IA",
      description: `${input.studioFailures} execuções do Studio IA falharam no período recente.`,
      severity: "medium",
    })
  }

  if (input.nearLimitUsers > 0) {
    items.push({
      id: "near-limit",
      title: "Limites próximos",
      description: `${input.nearLimitUsers} corretores estão próximos de consumir o saldo total de créditos.`,
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

export async function getAdminInsights(): Promise<AdminInsights> {
  const now = new Date()
  const today = startOfDay(now)
  const last7Days = addDays(today, -6)
  const previous7DaysStart = addDays(today, -13)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    users,
    brokers,
    subscriptions,
    interactions,
    messages,
    documents,
    leads,
    agendaEvents,
    searchEvents,
    bonusTransactions,
    assessorConfig,
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        broker: {
          include: {
            corretorEmeConfig: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.broker.findMany({
      include: {
        user: true,
        corretorEmeConfig: true,
        _count: {
          select: {
            properties: true,
            leads: true,
            documents: true,
            agendaEvents: true,
            aiAssistantInteractions: true,
            emeMessages: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAssistantInteraction.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 600,
    }),
    prisma.emeMessage.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 800,
    }),
    prisma.brokerDocument.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 800,
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 800,
    }),
    prisma.agendaEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 800,
    }),
    prisma.searchEvent.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 800,
    }),
    prisma.aiCreditTransaction.findMany({
      include: {
        broker: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1200,
    }),
    prisma.assessorEmeConfig.findFirst({
      orderBy: { updatedAt: "desc" },
    }),
  ])

  const interactionsToday = interactions.filter((item) => item.createdAt >= today)
  const messagesToday = messages.filter((item) => item.createdAt >= today)
  const conversations = documents.filter((item) => item.type === "cos_conversation")
  const conversationsToday = conversations.filter((item) => item.createdAt >= today)
  const proposals = documents.filter((item) => item.type === "proposal")
  const studioVideoJobs = documents.filter((item) => item.type === "studio_ia_video_job")
  const savedVideos = documents.filter((item) => item.type === "studio_ia_video")
  const newUsersLast7 = users.filter((item) => item.createdAt >= last7Days)
  const activeUsersToday = brokers.filter((item) => item.aiLastInteractionAt && item.aiLastInteractionAt >= today)
  const trialSubscriptions = subscriptions.filter((item) => item.status === SubscriptionStatus.TRIALING)
  const activeSubscriptions = subscriptions.filter((item) => item.status === SubscriptionStatus.ACTIVE)
  const delinquentSubscriptions = subscriptions.filter((item) => item.status === SubscriptionStatus.PAST_DUE)
  const cancellations = subscriptions.filter((item) => item.status === SubscriptionStatus.CANCELED).length
  const propertiesCreatedByCos = interactions.filter((item) => item.actionType === "createProperty").length
  const clientsCreatedByCos = interactions.filter((item) => item.actionType === "createLead").length
  const proposalsCreatedByCos = interactions.filter((item) => item.actionType === "createProposal").length
  const appointmentsByCos = interactions.filter((item) => item.actionType === "scheduleVisit" || item.actionType === "createTask").length
  const propertySearches = interactions.filter((item) => item.actionType === "searchProperties").length + searchEvents.length
  const cosFailures = interactions.filter((item) => item.actionStatus && item.actionStatus !== "completed").length
  const studioTransactions = bonusTransactions.filter((item) => (item.actionType || "").startsWith("studio_ia_"))
  const studioFailures = studioVideoJobs.filter((item) => item.status === "failed").length
  const imageCredits = bonusTransactions.filter((item) => (item.actionType || "").includes("property_ai") || (item.actionType || "").includes("construction"))
  const videoCredits = bonusTransactions.filter((item) => (item.actionType || "").includes("video"))
  const brokerMap = new Map(brokers.map((broker) => [broker.id, broker]))

  const usageByBroker = new Map<string, number>()
  const usageByBrokerDetail = new Map<string, string>()
  interactions.forEach((item) => {
    const label = item.broker.user.name
    usageByBroker.set(label, (usageByBroker.get(label) || 0) + 1)
    usageByBrokerDetail.set(label, item.broker.user.email)
  })

  const studioUsageByBroker = new Map<string, number>()
  studioTransactions.forEach((item) => {
    const label = item.broker.user.name
    studioUsageByBroker.set(label, (studioUsageByBroker.get(label) || 0) + Math.abs(item.amount))
  })

  const usageByFeature = new Map<string, number>()
  studioTransactions.forEach((item) => {
    const resource = inferStudioResource(item.actionType)
    if (!resource) return
    usageByFeature.set(resource, (usageByFeature.get(resource) || 0) + Math.abs(item.amount))
  })

  const planDistribution = new Map<string, number>()
  users.forEach((user) => {
    const plan = user.role === UserRole.ADMIN ? "Admin" : user.plan === "BROKER" ? "Pro" : user.plan === "AGENCY" ? "Imobiliária" : "Sem plano"
    planDistribution.set(plan, (planDistribution.get(plan) || 0) + 1)
  })

  const productivities = brokers.map((broker) => {
    const documentsCount = proposals.filter((item) => item.brokerId === broker.id).length
    const score = broker._count.properties * 2 + broker._count.leads * 2 + documentsCount * 3 + broker.aiCreditsUsedThisMonth
    return {
      label: broker.user.name,
      value: score,
      detail: `${broker._count.properties} imóveis • ${broker._count.leads} clientes`,
    }
  })

  const brokerItems = brokers.map((broker) => {
    const brokerInteractions = interactions.filter((item) => item.brokerId === broker.id)
    const brokerStudioCredits = studioTransactions.filter((item) => item.brokerId === broker.id)
    const brokerVideos = brokerStudioCredits.filter((item) => (item.actionType || "").includes("video")).length
    const brokerImages = brokerStudioCredits.filter((item) => (item.actionType || "").includes("property_ai") || (item.actionType || "").includes("construction")).length
    const brokerProposals = proposals.filter((item) => item.brokerId === broker.id).length
    const sales = leads.filter((lead) => lead.brokerId === broker.id && lead.status === "WON").length
    const revenue = leads
      .filter((lead) => lead.brokerId === broker.id && lead.status === "WON")
      .length * 89.9
    const productivityScore = broker._count.properties * 2 + broker._count.leads * 2 + brokerProposals * 3 + broker.aiCreditsUsedThisMonth

    return {
      id: broker.id,
      name: broker.user.name,
      email: broker.user.email,
      status: broker.status === "INACTIVE" ? "Inativo" : "Ativo",
      plan: broker.user.plan === "BROKER" ? "EME Pro" : "Sem plano",
      properties: broker._count.properties,
      clients: broker._count.leads,
      proposals: brokerProposals,
      agenda: broker._count.agendaEvents,
      leads: broker._count.leads,
      sales,
      revenue,
      creditsBalance: broker.aiCreditsBalance,
      monthlyCreditsUsed: broker.aiCreditsUsedThisMonth,
      studioActions: brokerStudioCredits.length,
      cosActions: brokerInteractions.length,
      imagesCreated: brokerImages,
      videosCreated: brokerVideos,
      productivityScore,
      lastAccess: formatDate(broker.aiLastInteractionAt),
      corretorEmeStatus:
        broker.corretorEmeConfig?.status === "ACTIVE"
          ? "Ativo"
          : broker.corretorEmeConfig?.status === "PAUSED"
            ? "Pausado"
            : broker.corretorEmeConfig?.status === "NOT_CONFIGURED"
              ? "Nao configurado"
              : "Em preparacao",
    }
  })

  const userItems = users
    .filter((user) => user.role === UserRole.BROKER || user.role === UserRole.ADMIN)
    .map((user) => {
      const broker = user.broker
      const brokerStudioCredits = broker ? studioTransactions.filter((item) => item.brokerId === broker.id) : []
      const brokerInteractions = broker ? interactions.filter((item) => item.brokerId === broker.id) : []
      const imagesCreated = brokerStudioCredits.filter((item) => (item.actionType || "").includes("property_ai") || (item.actionType || "").includes("construction")).length
      const videosCreated = brokerStudioCredits.filter((item) => (item.actionType || "").includes("video")).length

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        type: user.role === UserRole.ADMIN ? "Admin" : "Corretor",
        plan: user.role === UserRole.ADMIN ? "Admin" : user.plan === "BROKER" ? "EME Pro" : "Sem plano",
        status:
          user.role === UserRole.ADMIN
            ? "Ativo"
            : user.broker?.status === "INACTIVE"
              ? "Bloqueado"
              : "Ativo",
        createdAt: formatDateTimeLabel(user.createdAt),
        creditsBalance: broker?.aiCreditsBalance ?? 0,
        creditsUsed: broker?.aiCreditsUsedThisMonth ?? 0,
        imageGenerations: imagesCreated,
        videoGenerations: videosCreated,
        studioActions: brokerStudioCredits.length,
        cosActions: brokerInteractions.length,
        lastAccess: formatDate(broker?.aiLastInteractionAt ?? null),
        devicesLabel: "Sem telemetria conectada",
        historyLabel: broker ? `${brokerInteractions.length} interações e ${brokerStudioCredits.length} ações de IA` : "Histórico administrativo",
        subscriptionLabel: user.subscriptionStatus === "ACTIVE" ? "Assinatura ativa" : "Em avaliação ou sem assinatura",
        financeLabel: user.subscriptionStatus === "ACTIVE" ? "Operação adimplente" : "Acompanhar ciclo comercial",
      }
    })

  const responseDiffs: number[] = []
  const groupedIncoming = new Map<string, Date[]>()
  messages
    .filter((item) => item.direction === "inbound" || item.direction === "received")
    .forEach((item) => {
      const key = `${item.brokerId}:${item.channel}`
      const arr = groupedIncoming.get(key) || []
      arr.push(item.createdAt)
      groupedIncoming.set(key, arr)
    })
  messages
    .filter((item) => item.direction === "outbound" || item.direction === "sent")
    .forEach((item) => {
      const key = `${item.brokerId}:${item.channel}`
      const arr = groupedIncoming.get(key)
      if (!arr?.length) return
      const candidate = arr.find((createdAt) => createdAt <= item.createdAt)
      if (!candidate) return
      responseDiffs.push((item.createdAt.getTime() - candidate.getTime()) / 60000)
    })

  const assessorTimeline = messages
    .filter((item) => item.channel === "assessor_eme")
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title: item.direction === "inbound" || item.direction === "received" ? "Mensagem recebida" : "Mensagem enviada",
      detail: `${item.broker.user.name} • ${item.message.slice(0, 80) || "Sem conteúdo"}`,
      timestamp: formatDateTimeLabel(item.createdAt),
      tone: item.errorMessage ? ("danger" as const) : ("default" as const),
    }))

  const latestConversations = conversations.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    detail: `${item.broker.user.name} • ${item.status}`,
    timestamp: formatDateTimeLabel(item.updatedAt),
    tone: item.status === "archived" ? ("warning" as const) : ("default" as const),
  }))

  const totalCreditsConsumed = brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0)
  const currentBalance = brokers.reduce((sum, broker) => sum + broker.aiCreditsBalance, 0)
  const nearLimitUsers = brokers.filter((broker) => broker.aiCreditsBalance <= 10 && broker.aiCreditsUsedThisMonth > 0).length
  const currentMonthSubscriptions = subscriptions.filter((item) => item.createdAt >= startOfMonth).length
  const previousMonthSubscriptions = subscriptions.filter(
    (item) => item.createdAt >= previousMonthStart && item.createdAt < startOfMonth,
  ).length
  const monthlyRevenue = activeSubscriptions.length * 89.9
  const activeUserCount = activeUsersToday.length
  const activeProperties = brokers.reduce((sum, broker) => sum + broker._count.properties, 0)
  const totalClients = leads.length
  const totalVideos = savedVideos.length
  const totalImages = imageCredits.length
  const topBrokerActivity = topRowsFromMap(usageByBroker, 8, usageByBrokerDetail)

  const bonusesHistory = bonusTransactions
    .filter((item) => item.type === "admin_bonus")
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      title: `${item.broker.user.name} recebeu ${Math.abs(item.amount)} créditos`,
      detail: item.description || "Bonificação administrativa",
      timestamp: formatDateTimeLabel(item.createdAt),
      tone: "success" as const,
    }))

  const bonusesKinds = bonusTransactions
    .filter((item) => item.type === "admin_bonus")
    .reduce(
      (acc, item) => {
        const key = inferBonusKind(item.description || "")
        acc[key] += 1
        return acc
      },
      { campaign: 0, indication: 0, subscription: 0, manual: 0 },
    )

  return {
    generatedAt: now.toISOString(),
    users: {
      total: userItems.length,
      newLast7Days: newUsersLast7.length,
      activeToday: activeUserCount,
      blocked: userItems.filter((item) => item.status === "Bloqueado").length,
      trial: trialSubscriptions.length,
      activePlans: activeSubscriptions.length,
      planDistribution: [...planDistribution.entries()].map(([label, value]) => ({ label, value })),
      items: userItems,
    },
    brokers: {
      total: brokers.length,
      active: brokers.filter((broker) => broker.status !== "INACTIVE").length,
      inactive: brokers.filter((broker) => broker.status === "INACTIVE").length,
      properties: activeProperties,
      leads: totalClients,
      proposals: proposals.length,
      agenda: agendaEvents.length,
      revenue: brokerItems.reduce((sum, item) => sum + item.revenue, 0),
      creditsBalance: currentBalance,
      creditsUsed: totalCreditsConsumed,
      topProductivity: productivities.sort((a, b) => b.value - a.value).slice(0, 6),
      items: brokerItems,
    },
    assessor: {
      status:
        assessorConfig?.status === "ACTIVE"
          ? "Ativo"
          : assessorConfig?.status === "PAUSED"
            ? "Pausado"
            : "Em preparação",
      officialNumber: assessorConfig?.officialNumber || "Não configurado",
      sessions: conversations.length,
      messagesReceived: messages.filter((item) => item.channel === "assessor_eme" && (item.direction === "inbound" || item.direction === "received")).length,
      messagesSent: messages.filter((item) => item.channel === "assessor_eme" && (item.direction === "outbound" || item.direction === "sent")).length,
      commandsExecuted: interactions.filter((item) => item.channel === "assessor_eme").length,
      createdClients: clientsCreatedByCos,
      createdProperties: propertiesCreatedByCos,
      failures: messages.filter((item) => item.channel === "assessor_eme" && item.errorMessage).length,
      avgResponseMinutes: average(responseDiffs),
      aiConsumption: interactions.filter((item) => item.channel === "assessor_eme").reduce((sum, item) => sum + item.creditsUsed, 0),
      timeline: assessorTimeline,
    },
    corretorEme: {
      connectedBrokers: brokers.filter((broker) => broker.corretorEmeConfig).length,
      activeWhatsApps: brokers.filter((broker) => broker.corretorEmeConfig?.status === "ACTIVE").length,
      needsQrCode: brokers.filter((broker) => !broker.corretorEmeConfig || broker.corretorEmeConfig.status !== "ACTIVE").length,
      lastSyncLabel: formatDateTimeLabel(
        brokers
          .map((broker) => broker.corretorEmeConfig?.updatedAt || null)
          .filter((item): item is Date => Boolean(item))
          .sort((a, b) => b.getTime() - a.getTime())[0] || null,
      ),
      messagesReceived: messages.filter((item) => item.channel === "corretor_eme" && (item.direction === "inbound" || item.direction === "received")).length,
      messagesSent: messages.filter((item) => item.channel === "corretor_eme" && (item.direction === "outbound" || item.direction === "sent")).length,
      leadsGenerated: leads.filter((lead) => lead.source.toLowerCase().includes("whatsapp") || lead.source.toLowerCase().includes("eme")).length,
      clientsCreated: clientsCreatedByCos,
      aiUsage: interactions.filter((item) => item.channel === "corretor_eme").length,
      creditsConsumed: interactions.filter((item) => item.channel === "corretor_eme").reduce((sum, item) => sum + item.creditsUsed, 0),
      brokerActivity: brokerItems
        .map((item) => ({
          label: item.name,
          value: item.cosActions + item.studioActions,
          detail: `${item.corretorEmeStatus} • ${item.monthlyCreditsUsed} créditos no mês`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    },
    cos: {
      conversationsToday: conversationsToday.length,
      conversationsTotal: conversations.length,
      messages: messages.length,
      commandsExecuted: interactions.length,
      propertySearches,
      proposalsCreated: proposalsCreatedByCos,
      clientsCreated: clientsCreatedByCos,
      propertiesCreated: propertiesCreatedByCos,
      appointments: appointmentsByCos,
      aiConsumption: interactions.reduce((sum, item) => sum + item.creditsUsed, 0),
      creditsSpent: interactions.reduce((sum, item) => sum + item.creditsUsed, 0),
      avgResponseMinutes: average(responseDiffs),
      satisfaction: null,
      usageByDay: bucketByDay(interactions.map((item) => item.createdAt), 7),
      usageByBroker: topBrokerActivity,
      usageByHour: bucketByHour(interactions.map((item) => item.createdAt)),
      latestConversations,
      ranking: topBrokerActivity,
    },
    studioIa: {
      imagesCreated: totalImages,
      videosCreated: totalVideos,
      homeStaging: studioVideoJobs.filter((item) => item.title.toLowerCase().includes("video studio ia")).length,
      anuncios: studioTransactions.filter((item) => (item.actionType || "").includes("sell_property")).length,
      postsInstagram: studioTransactions.filter((item) => (item.actionType || "").includes("instagram")).length,
      descriptions: studioTransactions.filter((item) => (item.actionType || "").includes("buyers")).length,
      captacoes: studioTransactions.filter((item) => (item.actionType || "").includes("owners")).length,
      aiConsumption: studioTransactions.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      creditsUsed: studioTransactions.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      estimatedSavings: Number((((studioTransactions.length * 8) / 60) * ESTIMATED_HOURLY_SAVINGS_BRL).toFixed(2)),
      generationByDay: bucketByDay(studioTransactions.map((item) => item.createdAt), 7),
      usageByMonth: bucketByMonth(studioTransactions.map((item) => item.createdAt), 6),
      consumptionByFeature: topRowsFromMap(usageByFeature, 8),
      ranking: topRowsFromMap(studioUsageByBroker, 8),
    },
    aiConsumption: {
      totalCreditsConsumed,
      currentBalance,
      estimatedCost: Number((totalCreditsConsumed * ESTIMATED_COST_PER_CREDIT).toFixed(2)),
      averagePerUser: Number((totalCreditsConsumed / Math.max(userItems.length, 1)).toFixed(1)),
      averagePerBroker: Number((totalCreditsConsumed / Math.max(brokers.length, 1)).toFixed(1)),
      byResource: [
        { label: "COS", value: interactions.reduce((sum, item) => sum + item.creditsUsed, 0), detail: "Interações e comandos assistidos" },
        { label: "Studio IA", value: studioTransactions.reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "Fluxos visuais e automações" },
        { label: "Geração de imagem", value: imageCredits.reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "Imagens e transformação estática" },
        { label: "Geração de vídeo", value: videoCredits.reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "Vídeos e animações" },
        { label: "Propostas", value: bonusTransactions.filter((item) => item.actionType === "generate_proposal_pdf").reduce((sum, item) => sum + Math.abs(item.amount), 0), detail: "PDFs e materiais salvos" },
      ],
    },
    revenue: {
      mrr: Number(monthlyRevenue.toFixed(2)),
      arr: Number((monthlyRevenue * 12).toFixed(2)),
      monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
      annualRevenue: Number((monthlyRevenue * 12).toFixed(2)),
      growth: growthRate(currentMonthSubscriptions, previousMonthSubscriptions),
      delinquency: delinquentSubscriptions.length,
      upgrades: bonusTransactions.filter((item) => (item.description || "").toLowerCase().includes("upgrade")).length,
      downgrades: bonusTransactions.filter((item) => (item.description || "").toLowerCase().includes("downgrade")).length,
      cancellations,
      ltv: activeSubscriptions.length ? Number((monthlyRevenue * 8).toFixed(2)) : null,
      averageTicket: Number((monthlyRevenue / Math.max(activeSubscriptions.length, 1)).toFixed(2)),
      monthlySeries: bucketByMonth(activeSubscriptions.map((item) => item.createdAt), 6),
    },
    analytics: {
      activeUsers: activeUserCount,
      properties: activeProperties,
      clients: totalClients,
      proposals: proposals.length,
      studioIa: studioTransactions.length,
      cos: interactions.length,
      videos: totalVideos,
      images: totalImages,
      conversions: leads.filter((lead) => lead.status === "WON").length,
      sales: leads.filter((lead) => lead.status === "WON").length,
      retention: activeSubscriptions.length ? Number(((activeSubscriptions.length / Math.max(subscriptions.length, 1)) * 100).toFixed(1)) : null,
      engagement: interactionsToday.length + messagesToday.length > 0 ? Number((((interactionsToday.length + messagesToday.length) / Math.max(activeUserCount, 1))).toFixed(1)) : null,
    },
    alerts: {
      items: buildAlertItems({
        creditsUsed: totalCreditsConsumed,
        creditsBalance: currentBalance,
        activeUsers: activeUserCount,
        inactiveUsers: userItems.filter((item) => item.status === "Bloqueado").length,
        generationFailures: studioFailures + cosFailures,
        offlineIntegrations: brokers.filter((broker) => !broker.corretorEmeConfig || broker.corretorEmeConfig.status !== "ACTIVE").length,
        delinquentSubscriptions: delinquentSubscriptions.length,
        pausedWhatsApps: brokers.filter((broker) => broker.corretorEmeConfig?.status === "PAUSED" || broker.corretorEmeConfig?.status === "IN_PREPARATION").length,
        cosFailures,
        studioFailures,
        nearLimitUsers,
      }),
    },
    bonuses: {
      totalBonuses: bonusTransactions.filter((item) => item.type === "admin_bonus").length,
      last30Days: bonusTransactions.filter((item) => item.type === "admin_bonus" && item.createdAt >= addDays(today, -29)).length,
      campaigns: bonusesKinds.campaign,
      indications: bonusesKinds.indication,
      subscriptions: bonusesKinds.subscription,
      manual: bonusesKinds.manual,
      history: bonusesHistory,
    },
  }
}
