import 'server-only'

import { prisma } from '@/lib/prisma'

export async function submitMarketplaceReview(input: { token: string; rating: number; comment: string }) {
  const token = input.token.trim()
  const rating = Math.trunc(input.rating)
  const comment = input.comment.trim().slice(0, 1_500)
  if (!token || rating < 1 || rating > 5 || comment.length < 10) throw new Error('INVALID_REVIEW')
  const conversation = await prisma.marketplaceConversation.findUnique({
    where: { publicToken: token },
    select: { id: true, brokerId: true, customerName: true, status: true, review: { select: { id: true } } },
  })
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  if (conversation.status !== 'CLOSED') throw new Error('CONVERSATION_OPEN')
  if (conversation.review) throw new Error('REVIEW_EXISTS')
  return prisma.marketplaceReview.create({
    data: {
      conversationId: conversation.id,
      brokerId: conversation.brokerId,
      authorName: conversation.customerName,
      rating,
      comment,
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

export async function moderateMarketplaceReview(reviewId: string, status: 'APPROVED' | 'REJECTED', moderatorUserId: string) {
  const review = await prisma.marketplaceReview.update({
    where: { id: reviewId },
    data: { status, moderatorUserId, moderatedAt: new Date() },
    select: { id: true, brokerId: true, status: true },
  })
  await refreshBrokerMarketplaceRating(review.brokerId)
  return review
}
