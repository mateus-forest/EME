import { NextRequest, NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { UserRole } from '@/lib/prisma-enums'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden
  const requestedStatus = request.nextUrl.searchParams.get('status')
  const status = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(requestedStatus || '')
    ? requestedStatus as 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
    : undefined
  const reviews = await prisma.marketplaceReview.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true,
      authorName: true,
      authorPhone: true,
      rating: true,
      comment: true,
      origin: true,
      verified: true,
      attendanceConfirmed: true,
      status: true,
      rejectionReason: true,
      moderatedAt: true,
      moderatorUserId: true,
      createdAt: true,
      broker: { select: { id: true, catalogSlug: true, user: { select: { name: true } } } },
      conversation: { select: { id: true, customerName: true, customerPhone: true, property: { select: { title: true } } } },
      lead: { select: { id: true, name: true, phone: true, whatsapp: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 300,
  })
  return NextResponse.json({ reviews })
}
