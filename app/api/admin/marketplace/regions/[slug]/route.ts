import { NextRequest, NextResponse } from 'next/server'

import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import {
  MarketplaceRegionMediaConfigurationError,
  MarketplaceRegionStateAmbiguousError,
  restoreMarketplaceRegionAutomaticImage,
  setMarketplaceRegionManualImage,
} from '@/lib/marketplace/region-media'
import {
  deleteMarketplaceRegionStorageFile,
  InvalidMarketplaceRegionImageError,
  saveMarketplaceRegionImage,
  saveMarketplaceRegionImageFromUrl,
} from '@/lib/property-storage'
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
  const sourceUrl = typeof body?.sourceUrl === 'string' ? body.sourceUrl.trim() : ''
  if (!sourceUrl) return NextResponse.json({ error: 'O link informado não é uma imagem válida.' }, { status: 400 })
  let uploadedUrl = ''
  try {
    const { slug } = await params
    uploadedUrl = await saveMarketplaceRegionImageFromUrl(slug, sourceUrl)
    const region = await setMarketplaceRegionManualImage(slug, uploadedUrl)
    return NextResponse.json({ region })
  } catch (error) {
    const { slug } = await params
    if (uploadedUrl) await deleteMarketplaceRegionStorageFile(slug, uploadedUrl)
    if (error instanceof InvalidMarketplaceRegionImageError) {
      console.warn(`[api][admin][marketplace][regions] manual URL rejected: ${error.reason}`)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[api][admin][marketplace][regions] manual URL import failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json({ error: 'Não foi possível salvar a imagem manual.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { response } = await requireAdmin()
  if (response) return response
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Envie uma imagem JPG, PNG ou WebP.' }, { status: 400 })
  }

  let uploadedUrl = ''
  try {
    const { slug } = await params
    uploadedUrl = await saveMarketplaceRegionImage(slug, file)
    const region = await setMarketplaceRegionManualImage(slug, uploadedUrl)
    return NextResponse.json({ region }, { status: 201 })
  } catch (error) {
    const { slug } = await params
    if (uploadedUrl) await deleteMarketplaceRegionStorageFile(slug, uploadedUrl)
    if (error instanceof InvalidMarketplaceRegionImageError) {
      return NextResponse.json({ error: 'Envie uma imagem JPG, PNG ou WebP válida.' }, { status: 400 })
    }
    if (error instanceof Error && error.message.startsWith('Use uma imagem')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[api][admin][marketplace][regions] manual upload failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json({ error: 'Não foi possível enviar a imagem.' }, { status: 500 })
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
