import { NextRequest, NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { UserRole } from '@/lib/prisma-enums'
import { moderateMarketplaceReview } from '@/lib/marketplace/reviews'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden
  const body = await request.json().catch(() => null)
  if (body?.status !== 'APPROVED' && body?.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Status de moderação inválido.' }, { status: 400 })
  }
  try {
    const { id } = await params
    const review = await moderateMarketplaceReview(id, body.status, user.id)
    return NextResponse.json({ review })
  } catch {
    return NextResponse.json({ error: 'Avaliação não encontrada.' }, { status: 404 })
  }
}
