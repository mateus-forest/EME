import 'server-only'

import { prisma } from '@/lib/prisma'

const conversationInclude = {
  property: { select: { id: true, title: true, marketplaceSlug: true } },
  broker: { select: { id: true, catalogSlug: true, phone: true, user: { select: { name: true, photoUrl: true } } } },
  messages: { orderBy: { createdAt: 'asc' as const } },
  review: true,
} as const

function cleanText(value: unknown, max = 2_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanPhone(value: unknown) {
  return cleanText(value, 30).replace(/\D/g, '').slice(0, 15)
}

export function serializeMarketplaceConversation(conversation: {
  id: string
  publicToken: string
  customerName: string
  customerPhone: string
  status: string
  lastMessageAt: Date
  closedAt: Date | null
  reviewRequestedAt: Date | null
  createdAt: Date
  property: { id: string; title: string; marketplaceSlug: string | null } | null
  broker: { id: string; catalogSlug: string; phone: string; user: { name: string; photoUrl: string | null } }
  messages: Array<{ id: string; sender: string; body: string; readAt: Date | null; createdAt: Date }>
  review: { id: string; rating: number; comment: string; status: string; createdAt: Date } | null
}) {
  return {
    id: conversation.id,
    token: conversation.publicToken,
    customerName: conversation.customerName,
    customerPhone: conversation.customerPhone,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    closedAt: conversation.closedAt?.toISOString() ?? null,
    reviewRequestedAt: conversation.reviewRequestedAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    property: conversation.property
      ? { id: conversation.property.id, title: conversation.property.title, slug: conversation.property.marketplaceSlug }
      : null,
    broker: {
      id: conversation.broker.id,
      slug: conversation.broker.catalogSlug,
      name: conversation.broker.user.name,
      photoUrl: conversation.broker.user.photoUrl ?? '',
      phone: conversation.broker.phone,
    },
    messages: conversation.messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      body: message.body,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
    review: conversation.review
      ? {
          id: conversation.review.id,
          rating: conversation.review.rating,
          comment: conversation.review.comment,
          status: conversation.review.status,
          createdAt: conversation.review.createdAt.toISOString(),
        }
      : null,
  }
}

export async function createMarketplaceConversation(input: {
  brokerSlug: string
  propertyId?: string
  customerName: string
  customerPhone: string
  message: string
}) {
  const brokerSlug = cleanText(input.brokerSlug, 120)
  const customerName = cleanText(input.customerName, 120)
  const customerPhone = cleanPhone(input.customerPhone)
  const message = cleanText(input.message)
  if (!brokerSlug || customerName.length < 2 || customerPhone.length < 10 || message.length < 2) {
    throw new Error('INVALID_CONVERSATION')
  }

  const broker = await prisma.broker.findFirst({
    where: { catalogSlug: brokerSlug, status: 'ACTIVE' },
    select: { id: true, userId: true, catalogSlug: true },
  })
  if (!broker) throw new Error('BROKER_NOT_FOUND')

  const property = input.propertyId
    ? await prisma.property.findFirst({
        where: { id: input.propertyId, brokerId: broker.id, marketplacePublished: true },
        select: { id: true, title: true },
      })
    : null
  if (input.propertyId && !property) throw new Error('PROPERTY_NOT_FOUND')

  const conversation = await prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findFirst({
      where: {
        brokerId: broker.id,
        OR: [{ phone: customerPhone }, { whatsapp: customerPhone }],
      },
      orderBy: { updatedAt: 'desc' },
    })
    const lead = existingLead
      ? await tx.lead.update({
          where: { id: existingLead.id },
          data: {
            name: customerName,
            phone: customerPhone,
            whatsapp: customerPhone,
            message,
            searchTerm: message,
            intent: property ? `Interesse em ${property.title}` : 'Atendimento pelo Marketplace',
            propertyId: property?.id ?? existingLead.propertyId,
            source: 'marketplace_chat',
          },
        })
      : await tx.lead.create({
          data: {
            name: customerName,
            phone: customerPhone,
            whatsapp: customerPhone,
            message,
            searchTerm: message,
            intent: property ? `Interesse em ${property.title}` : 'Atendimento pelo Marketplace',
            source: 'marketplace_chat',
            status: 'NEW',
            propertyId: property?.id,
            brokerId: broker.id,
            catalogSlug: broker.catalogSlug,
          },
        })

    const created = await tx.marketplaceConversation.create({
      data: {
        brokerId: broker.id,
        propertyId: property?.id,
        leadId: lead.id,
        customerName,
        customerPhone,
        messages: { create: { sender: 'CUSTOMER', body: message } },
      },
      include: conversationInclude,
    })
    await tx.notification.create({
      data: {
        userId: broker.userId,
        title: 'Nova conversa no Marketplace',
        message: property
          ? `${customerName} quer falar sobre ${property.title}.`
          : `${customerName} iniciou um atendimento pelo seu perfil público.`,
      },
    })
    return created
  })
  return serializeMarketplaceConversation(conversation)
}

export async function getPublicMarketplaceConversation(token: string) {
  const conversation = await prisma.marketplaceConversation.findUnique({
    where: { publicToken: token },
    include: conversationInclude,
  })
  if (!conversation) return null
  await prisma.marketplaceMessage.updateMany({
    where: { conversationId: conversation.id, sender: 'BROKER', readAt: null },
    data: { readAt: new Date() },
  })
  return serializeMarketplaceConversation(conversation)
}

export async function addCustomerMarketplaceMessage(token: string, bodyValue: unknown) {
  const body = cleanText(bodyValue)
  if (body.length < 1) throw new Error('INVALID_MESSAGE')
  const conversation = await prisma.marketplaceConversation.findUnique({
    where: { publicToken: token },
    select: { id: true, status: true, leadId: true, broker: { select: { userId: true } } },
  })
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  if (conversation.status !== 'OPEN') throw new Error('CONVERSATION_CLOSED')
  await prisma.$transaction([
    prisma.marketplaceMessage.create({ data: { conversationId: conversation.id, sender: 'CUSTOMER', body } }),
    prisma.marketplaceConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
    ...(conversation.leadId
      ? [prisma.lead.update({ where: { id: conversation.leadId }, data: { message: body, status: 'NEW' } })]
      : []),
    prisma.notification.create({
      data: { userId: conversation.broker.userId, title: 'Nova mensagem no Marketplace', message: body.slice(0, 180) },
    }),
  ])
  return getPublicMarketplaceConversation(token)
}

export async function getBrokerMarketplaceConversations(brokerId: string) {
  const conversations = await prisma.marketplaceConversation.findMany({
    where: { brokerId },
    include: conversationInclude,
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
  })
  return conversations.map(serializeMarketplaceConversation)
}

export async function addBrokerMarketplaceMessage(brokerId: string, conversationId: string, bodyValue: unknown) {
  const body = cleanText(bodyValue)
  if (!body) throw new Error('INVALID_MESSAGE')
  const conversation = await prisma.marketplaceConversation.findFirst({
    where: { id: conversationId, brokerId },
    select: { id: true, status: true, leadId: true },
  })
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  if (conversation.status !== 'OPEN') throw new Error('CONVERSATION_CLOSED')
  await prisma.$transaction([
    prisma.marketplaceMessage.create({ data: { conversationId, sender: 'BROKER', body } }),
    prisma.marketplaceConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
    ...(conversation.leadId
      ? [prisma.lead.update({ where: { id: conversation.leadId }, data: { status: 'CONTACTED' } })]
      : []),
  ])
}

export async function closeBrokerMarketplaceConversation(brokerId: string, conversationId: string, requestReview: boolean) {
  const conversation = await prisma.marketplaceConversation.findFirst({ where: { id: conversationId, brokerId } })
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  await prisma.$transaction([
    prisma.marketplaceConversation.update({
      where: { id: conversationId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        reviewRequestedAt: requestReview ? new Date() : conversation.reviewRequestedAt,
        lastMessageAt: new Date(),
      },
    }),
    ...(requestReview
      ? [prisma.marketplaceMessage.create({
          data: {
            conversationId,
            sender: 'BROKER',
            body: 'Atendimento encerrado. Se desejar, avalie esta experiência pelo EME.',
          },
        })]
      : []),
  ])
}
