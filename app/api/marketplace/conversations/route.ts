import { NextRequest, NextResponse } from 'next/server'
import { createMarketplaceConversation } from '@/lib/marketplace/communication'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const conversation = await createMarketplaceConversation({
      brokerSlug: body?.brokerSlug,
      propertyId: body?.propertyId,
      customerName: body?.customerName,
      customerPhone: body?.customerPhone,
      message: body?.message,
    })
    return NextResponse.json({ conversation }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    if (code === 'BROKER_NOT_FOUND' || code === 'PROPERTY_NOT_FOUND') return NextResponse.json({ error: 'Perfil ou imóvel indisponível.' }, { status: 404 })
    if (code === 'INVALID_CONVERSATION') return NextResponse.json({ error: 'Preencha nome, telefone e mensagem válidos.' }, { status: 400 })
    console.error('[api][marketplace][conversations] create failed', { code })
    return NextResponse.json({ error: 'Não foi possível iniciar a conversa.' }, { status: 500 })
  }
}
