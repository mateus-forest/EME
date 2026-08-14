import 'server-only'

import { prisma } from '@/lib/prisma'

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanPhone(value: unknown) {
  return cleanText(value, 30).replace(/\D/g, '').slice(0, 15)
}

export async function submitMarketplaceReview(input: {
  token?: string
  brokerSlug?: string
  authorName?: string
  authorPhone?: string
  rating: number
  comment: string
  attendanceConfirmed?: boolean
}) {
  const token = cleanText(input.token, 120)
  const brokerSlug = cleanText(input.brokerSlug, 120)
  const rating = Math.trunc(Number(input.rating))
  const comment = cleanText(input.comment, 1_500)
  if (rating < 1 || rating > 5 || comment.length < 3) throw new Error('INVALID_REVIEW')

  if (token) {
    const conversation = await prisma.marketplaceConversation.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        brokerId: true,
        leadId: true,
        customerName: true,
        customerPhone: true,
        status: true,
        review: { select: { id: true } },
      },
    })
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
    if (conversation.status !== 'CLOSED') throw new Error('CONVERSATION_OPEN')
    if (conversation.review) throw new Error('REVIEW_EXISTS')
    return prisma.marketplaceReview.create({
      data: {
        conversationId: conversation.id,
        brokerId: conversation.brokerId,
        leadId: conversation.leadId,
        authorName: conversation.customerName,
        authorPhone: conversation.customerPhone,
        rating,
        comment,
        origin: 'POST_CHAT',
        verified: true,
        attendanceConfirmed: true,
        status: 'PENDING_REVIEW',
      },
    })
  }

  const authorName = cleanText(input.authorName, 120)
  const authorPhone = cleanPhone(input.authorPhone)
  if (!brokerSlug || authorName.length < 2 || authorPhone.length < 10 || input.attendanceConfirmed !== true) {
    throw new Error('INVALID_REVIEW')
  }
  const broker = await prisma.broker.findFirst({
    where: { catalogSlug: brokerSlug, status: 'ACTIVE' },
    select: { id: true },
  })
  if (!broker) throw new Error('BROKER_NOT_FOUND')

  const phoneSuffix = authorPhone.slice(-8)
  const conversation = await prisma.marketplaceConversation.findFirst({
    where: {
      brokerId: broker.id,
      OR: [{ customerPhone: authorPhone }, { customerPhone: { endsWith: phoneSuffix } }],
    },
    select: { id: true, leadId: true, review: { select: { id: true } } },
    orderBy: { lastMessageAt: 'desc' },
  })
  if (conversation?.review) throw new Error('REVIEW_EXISTS')

  const lead = conversation?.leadId
    ? { id: conversation.leadId }
    : await prisma.lead.findFirst({
        where: {
          brokerId: broker.id,
          OR: [
            { phone: authorPhone },
            { whatsapp: authorPhone },
            { phone: { endsWith: phoneSuffix } },
            { whatsapp: { endsWith: phoneSuffix } },
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      })

  const duplicateSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000)
  const duplicate = await prisma.marketplaceReview.findFirst({
    where: {
      brokerId: broker.id,
      authorPhone,
      origin: 'PUBLIC_PROFILE',
      status: { in: ['PENDING_REVIEW', 'APPROVED'] },
      createdAt: { gte: duplicateSince },
    },
    select: { id: true },
  })
  if (duplicate) throw new Error('REVIEW_EXISTS')

  return prisma.marketplaceReview.create({
    data: {
      conversationId: conversation?.id,
      brokerId: broker.id,
      leadId: lead?.id,
      authorName,
      authorPhone,
      rating,
      comment,
      origin: 'PUBLIC_PROFILE',
      verified: Boolean(conversation || lead),
      attendanceConfirmed: true,
      status: 'PENDING_REVIEW',
    },
  })
}

export async function refreshBrokerMarketplaceRating(brokerId: string) {
  const aggregate = await prisma.marketplaceReview.aggregate({
    where: { brokerId, status: 'APPROVED' },
    _avg: { rating: true },
    _count: { rating: true },
  })
  await prisma.broker.update({
    where: { id: brokerId },
    data: {
      marketplaceRating: aggregate._avg.rating ?? null,
      marketplaceReviewCount: aggregate._count.rating,
    },
  })
}

export async function moderateMarketplaceReview(
  reviewId: string,
  status: 'APPROVED' | 'REJECTED',
  moderatorUserId: string,
  reason?: string,
) {
  const rejectionReason = cleanText(reason, 500)
  const review = await prisma.marketplaceReview.update({
    where: { id: reviewId },
    data: {
      status,
      moderatorUserId,
      moderatedAt: new Date(),
      rejectionReason: status === 'REJECTED' ? rejectionReason || null : null,
    },
    select: { id: true, brokerId: true, status: true, rejectionReason: true },
  })
  await refreshBrokerMarketplaceRating(review.brokerId)
  return review
}
