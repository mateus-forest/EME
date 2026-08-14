import { NextRequest, NextResponse } from 'next/server'
import { submitMarketplaceReview } from '@/lib/marketplace/reviews'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const review = await submitMarketplaceReview({
      token: typeof body?.token === 'string' ? body.token : typeof body?.conversationToken === 'string' ? body.conversationToken : '',
      rating: Number(body?.rating),
      comment: typeof body?.comment === 'string' ? body.comment : '',
    })
    return NextResponse.json({ review: { id: review.id, status: review.status } }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    const status = code === 'CONVERSATION_NOT_FOUND' ? 404 : code === 'REVIEW_EXISTS' || code === 'CONVERSATION_OPEN' ? 409 : 400
    const message = code === 'REVIEW_EXISTS'
      ? 'Este atendimento já foi avaliado.'
      : code === 'CONVERSATION_OPEN'
        ? 'A avaliação fica disponível após o encerramento do atendimento.'
        : 'Informe uma nota e um comentário válido.'
    return NextResponse.json({ error: message }, { status })
  }
}
