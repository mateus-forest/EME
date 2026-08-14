import { NextRequest, NextResponse } from 'next/server'
import { addCustomerMarketplaceMessage, getPublicMarketplaceConversation } from '@/lib/marketplace/communication'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const conversation = await getPublicMarketplaceConversation(token)
  return conversation
    ? NextResponse.json({ conversation })
    : NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => null)
    const conversation = await addCustomerMarketplaceMessage(token, body?.message)
    return NextResponse.json({ conversation })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    if (code === 'CONVERSATION_NOT_FOUND') return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
    if (code === 'CONVERSATION_CLOSED') return NextResponse.json({ error: 'Este atendimento já foi encerrado.' }, { status: 409 })
    if (code === 'INVALID_MESSAGE') return NextResponse.json({ error: 'Digite uma mensagem.' }, { status: 400 })
    return NextResponse.json({ error: 'Não foi possível enviar a mensagem.' }, { status: 500 })
  }
}
