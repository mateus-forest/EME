import { NextResponse } from 'next/server'
import { getMarketplaceRegions } from '@/lib/marketplace/server-data'

export async function GET() {
  const regions = await getMarketplaceRegions()
  const locations = [...new Set(regions.flatMap((region) => [region.name, ...region.areas]))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return NextResponse.json({ locations })
}
