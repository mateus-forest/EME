import { NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { UserRole } from '@/lib/prisma-enums'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden
  const reviews = await prisma.marketplaceReview.findMany({
    include: {
      broker: { select: { catalogSlug: true, user: { select: { name: true } } } },
      conversation: { select: { customerPhone: true, property: { select: { title: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ reviews })
}
