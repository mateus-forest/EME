import { NextRequest, NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { UserRole } from '@/lib/prisma-enums'
import {
  addBrokerMarketplaceMessage,
  addBrokerMarketplaceShare,
  closeBrokerMarketplaceConversation,
  getBrokerMarketplaceShareOptions,
} from '@/lib/marketplace/communication'

async function brokerId() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }), id: '' }
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return { response: forbidden, id: '' }
  if (!user.broker) return { response: NextResponse.json({ error: 'Perfil de corretor não encontrado.' }, { status: 404 }), id: '' }
  return { response: null, id: user.broker.id }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await brokerId()
  if (auth.response) return auth.response
  try {
    const { id } = await params
    return NextResponse.json(await getBrokerMarketplaceShareOptions(auth.id, id))
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar os itens disponíveis.' }, { status: 404 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await brokerId()
  if (auth.response) return auth.response
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (body?.kind === 'PROPERTY' || body?.kind === 'PROPOSAL') {
      await addBrokerMarketplaceShare(auth.id, id, body.kind, typeof body?.referenceId === 'string' ? body.referenceId : '')
    } else {
      await addBrokerMarketplaceMessage(auth.id, id, body?.message)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    const message = code === 'CONVERSATION_CLOSED'
      ? 'Conversa encerrada.'
      : code === 'PROPERTY_NOT_FOUND'
        ? 'Este imóvel não está publicado no Marketplace.'
        : code === 'PROPOSAL_NOT_COMPATIBLE'
          ? 'Esta proposta não pertence a este atendimento.'
          : 'Não foi possível responder.'
    return NextResponse.json({ error: message }, { status: code === 'CONVERSATION_CLOSED' ? 409 : 400 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await brokerId()
  if (auth.response) return auth.response
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (body?.action !== 'close') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    await closeBrokerMarketplaceConversation(auth.id, id, body?.requestReview !== false)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Não foi possível encerrar a conversa.' }, { status: 400 })
  }
}
