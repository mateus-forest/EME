import { NextResponse } from 'next/server'

import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { getMarketplaceRegions } from '@/lib/marketplace/server-data'
import {
  assertMarketplaceRegionMediaConfiguration,
  MarketplaceRegionMediaConfigurationError,
  listMarketplaceRegionMedia,
} from '@/lib/marketplace/region-media'
import { UserRole } from '@/lib/prisma-enums'

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    assertMarketplaceRegionMediaConfiguration()
    await getMarketplaceRegions()
    const regions = await listMarketplaceRegionMedia()
    return NextResponse.json({ regions })
  } catch (error) {
    if (error instanceof MarketplaceRegionMediaConfigurationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }
    console.error('[api][admin][marketplace][regions] load failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json({ error: 'Não foi possível carregar as mídias das regiões.' }, { status: 500 })
  }
}
