import { CatalogOwnerType, UserRole } from '@/lib/prisma-enums'
import { NextRequest, NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from '@/lib/auth-route'
import { slugify } from '@/lib/catalog-slug'
import { prisma, type PrismaTransaction } from '@/lib/prisma'

function serialize(user: { name: string; photoUrl: string | null; broker: { catalogSlug: string; description: string | null } | null }) {
  return { settings: { slug: user.broker?.catalogSlug ?? '', displayName: user.name, photoUrl: user.photoUrl ?? '', description: user.broker?.description ?? '' } }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER]); if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: 'Corretor não encontrado para esta conta.' }, { status: 404 })
  const response = NextResponse.json(serialize(user)); response.headers.set('Cache-Control', 'no-store, max-age=0'); return response
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER]); if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: 'Corretor não encontrado para esta conta.' }, { status: 404 })
  try {
    const body = await request.json().catch(() => null)
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : user.name
    const requestedSlug = typeof body?.slug === 'string' && body.slug.trim() ? slugify(body.slug) : user.broker.catalogSlug
    const photoUrl = typeof body?.photoUrl === 'string' ? body.photoUrl.trim() : user.photoUrl ?? ''
    const description = typeof body?.description === 'string' ? body.description.trim() : user.broker.description ?? ''
    if (!displayName || !requestedSlug) return NextResponse.json({ error: 'Nome e endereço do catálogo são obrigatórios.' }, { status: 400 })
    if (displayName.length > 120 || description.length > 600 || photoUrl.length > 800_000) return NextResponse.json({ error: 'Revise o tamanho dos dados informados.' }, { status: 400 })
    const updated = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const [brokerConflict, catalogConflict] = await Promise.all([
        tx.broker.findFirst({ where: { catalogSlug: requestedSlug, NOT: { id: user.broker!.id } }, select: { id: true } }),
        tx.catalog.findFirst({ where: { slug: requestedSlug }, select: { ownerType: true, ownerId: true } }),
      ])
      const ownCatalog = catalogConflict?.ownerType === CatalogOwnerType.BROKER && catalogConflict.ownerId === user.broker!.id
      if (brokerConflict || (catalogConflict && !ownCatalog)) throw new Error('CATALOG_SLUG_IN_USE')
      await tx.broker.update({ where: { id: user.broker!.id }, data: { catalogSlug: requestedSlug, description: description || null } })
      await tx.catalog.upsert({ where: { slug: user.broker!.catalogSlug }, update: { slug: requestedSlug, ownerType: CatalogOwnerType.BROKER, ownerId: user.broker!.id }, create: { slug: requestedSlug, ownerType: CatalogOwnerType.BROKER, ownerId: user.broker!.id } })
      return tx.user.update({ where: { id: user.id }, data: { name: displayName, photoUrl: photoUrl || null }, include: { broker: true, ownedAgency: true } })
    })
    const response = NextResponse.json(serialize(updated)); response.headers.set('Cache-Control', 'no-store, max-age=0'); return response
  } catch (caught) {
    if (caught instanceof Error && caught.message === 'CATALOG_SLUG_IN_USE') return NextResponse.json({ error: 'Este endereço de catálogo já está em uso.' }, { status: 409 })
    if (isPrismaUnavailable(caught)) return NextResponse.json({ error: 'O serviço de catálogo está indisponível.' }, { status: 503 })
    console.error('[api][brokers][catalog] update failed', { message: caught instanceof Error ? caught.message : 'unknown' })
    return NextResponse.json({ error: 'Erro interno ao atualizar o catálogo.' }, { status: 500 })
  }
}
