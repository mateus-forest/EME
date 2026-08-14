import { NextRequest, NextResponse } from 'next/server'
import { submitMarketplaceReview } from '@/lib/marketplace/reviews'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const review = await submitMarketplaceReview({
      token: typeof body?.token === 'string'
        ? body.token
        : typeof body?.conversationToken === 'string'
          ? body.conversationToken
          : '',
      brokerSlug: typeof body?.brokerSlug === 'string' ? body.brokerSlug : '',
      authorName: typeof body?.authorName === 'string' ? body.authorName : '',
      authorPhone: typeof body?.authorPhone === 'string' ? body.authorPhone : '',
      rating: Number(body?.rating),
      comment: typeof body?.comment === 'string' ? body.comment : '',
      attendanceConfirmed: body?.attendanceConfirmed === true,
    })
    return NextResponse.json({ review: { id: review.id, status: review.status } }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    const status = code === 'CONVERSATION_NOT_FOUND' || code === 'BROKER_NOT_FOUND'
      ? 404
      : code === 'REVIEW_EXISTS' || code === 'CONVERSATION_OPEN'
        ? 409
        : 400
    const message = code === 'REVIEW_EXISTS'
      ? 'Este atendimento já possui uma avaliação.'
      : code === 'CONVERSATION_OPEN'
        ? 'A avaliação fica disponível após o encerramento do atendimento.'
        : code === 'BROKER_NOT_FOUND'
          ? 'Perfil de corretor não encontrado.'
          : 'Preencha nome, WhatsApp, nota, comentário e confirme o atendimento.'
    return NextResponse.json({ error: message }, { status })
  }
}
