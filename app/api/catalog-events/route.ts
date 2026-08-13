import { CatalogOwnerType } from '@/lib/prisma-enums'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const allowedEvents = new Set(['catalog_view', 'property_view', 'whatsapp_click', 'catalog_search', 'marketplace_view', 'marketplace_search', 'interest'])
const DEDUPE_WINDOW_MS = 30 * 60 * 1000

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const eventType = cleanText(body?.eventType, 40)
    const source = cleanText(body?.source, 40) === 'marketplace' ? 'marketplace' : 'catalog'
    const catalogSlug = cleanText(body?.catalogSlug, 160)
    const propertyId = cleanText(body?.propertyId, 120)
    const visitorKey = cleanText(body?.visitorKey, 160)
    const query = cleanText(body?.query, 240)
    const resultCount = typeof body?.resultCount === 'number' ? Math.max(0, Math.trunc(body.resultCount)) : 0
    const propertyIds = Array.isArray(body?.propertyIds) ? body.propertyIds.map((id: unknown) => cleanText(id, 120)).filter(Boolean).slice(0, 100) : []

    if (!allowedEvents.has(eventType)) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })

    if (eventType === 'marketplace_search') {
      const properties = await prisma.property.findMany({
        where: { id: { in: propertyIds }, marketplacePublished: true, broker: { status: 'ACTIVE' } },
        select: { id: true, brokerId: true, agencyId: true },
      })
      const byBroker = new Map<string, { count: number; agencyId: string | null }>()
      properties.forEach((property) => {
        const current = byBroker.get(property.brokerId) || { count: 0, agencyId: property.agencyId }
        current.count += 1
        byBroker.set(property.brokerId, current)
      })
      await prisma.$transaction([...byBroker].flatMap(([brokerId, data]) => [
        prisma.catalogEvent.create({ data: { eventType, source, visitorKey: visitorKey || null, brokerId, agencyId: data.agencyId } }),
        prisma.searchEvent.create({ data: { brokerId, query: query || 'Busca por filtros', filters: body?.filters ?? undefined, resultCount: data.count, source } }),
      ]))
      return NextResponse.json({ ok: true })
    }

    const property = propertyId ? await prisma.property.findFirst({
      where: { id: propertyId, ...(source === 'marketplace' ? { marketplacePublished: true } : { published: true }) },
      select: { id: true, brokerId: true, agencyId: true },
    }) : null
    const catalog = !property && catalogSlug ? await prisma.catalog.findFirst({
      where: { slug: catalogSlug, ownerType: body?.catalogType === 'agency' ? CatalogOwnerType.AGENCY : CatalogOwnerType.BROKER },
    }) : null
    const brokerId = property?.brokerId ?? (catalog?.ownerType === CatalogOwnerType.BROKER ? catalog.ownerId : null)
    const agencyId = property?.agencyId ?? (catalog?.ownerType === CatalogOwnerType.AGENCY ? catalog.ownerId : null)
    if (!brokerId && !agencyId) return NextResponse.json({ ok: true })

    if (visitorKey && eventType !== 'catalog_search') {
      const existing = await prisma.catalogEvent.findFirst({ where: { visitorKey, eventType, source, propertyId: property?.id ?? null, catalogSlug: catalogSlug || null, createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } }, select: { id: true } })
      if (existing) return NextResponse.json({ ok: true, deduped: true })
    }

    await prisma.$transaction([
      prisma.catalogEvent.create({ data: { eventType, source, catalogSlug: catalogSlug || null, visitorKey: visitorKey || null, propertyId: property?.id ?? null, brokerId, agencyId } }),
      ...(brokerId && eventType === 'catalog_search' && query ? [prisma.searchEvent.create({ data: { brokerId, query, filters: body?.filters ?? undefined, resultCount, source } })] : []),
      ...(property?.id && eventType === 'property_view' ? [prisma.property.update({ where: { id: property.id }, data: { viewsCount: { increment: 1 } } })] : []),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api][catalog-events] create failed', { message: error instanceof Error ? error.message : 'unknown' })
    return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 500 })
  }
}
