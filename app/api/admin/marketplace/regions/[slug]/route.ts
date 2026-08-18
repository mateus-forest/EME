import { NextRequest, NextResponse } from 'next/server'

import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import {
  MarketplaceRegionMediaConfigurationError,
  MarketplaceRegionStateAmbiguousError,
  restoreMarketplaceRegionAutomaticImage,
  setMarketplaceRegionManualImage,
} from '@/lib/marketplace/region-media'
import { isSafeMarketplaceRegionImageUrl } from '@/lib/marketplace/region-media-contract'
import { UserRole } from '@/lib/prisma-enums'

async function requireAdmin() {
  const authenticated = await getAuthenticatedUser()
  if (authenticated.error || !authenticated.user) {
    return { response: authenticated.error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  }
  const forbidden = ensureRole(authenticated.user.role, [UserRole.ADMIN])
  return forbidden ? { response: forbidden } : { response: null }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { response } = await requireAdmin()
  if (response) return response
  const body = await request.json().catch(() => null)
  const manualImageUrl = typeof body?.manualImageUrl === 'string' ? body.manualImageUrl.trim() : ''
  if (!isSafeMarketplaceRegionImageUrl(manualImageUrl)) {
    return NextResponse.json({ error: 'Informe uma URL HTTPS ou um caminho público válido.' }, { status: 400 })
  }

  try {
    const { slug } = await params
    const region = await setMarketplaceRegionManualImage(slug, manualImageUrl)
    return NextResponse.json({ region })
  } catch {
    return NextResponse.json({ error: 'Região não encontrada.' }, { status: 404 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { response } = await requireAdmin()
  if (response) return response

  try {
    const { slug } = await params
    const region = await restoreMarketplaceRegionAutomaticImage(slug)
    if (!region) return NextResponse.json({ error: 'Região não encontrada.' }, { status: 404 })
    return NextResponse.json({ region })
  } catch (error) {
    if (error instanceof MarketplaceRegionMediaConfigurationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }
    if (error instanceof MarketplaceRegionStateAmbiguousError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
    }
    console.error('[api][admin][marketplace][regions] automatic restore failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json({ error: 'Não foi possível restaurar a imagem automática.' }, { status: 500 })
  }
}
