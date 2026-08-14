import { NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { UserRole } from '@/lib/prisma-enums'
import { getBrokerMarketplaceConversations } from '@/lib/marketplace/communication'

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: 'Perfil de corretor não encontrado.' }, { status: 404 })
  const conversations = await getBrokerMarketplaceConversations(user.broker.id)
  return NextResponse.json({ conversations })
}
