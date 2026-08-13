import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/lib/prisma-enums'
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from '@/lib/auth-route'
import { slugify } from '@/lib/catalog-slug'
import { serializeProperty } from '@/lib/property-contract'
import { prisma } from '@/lib/prisma'

const propertyInclude = {
  broker: { include: { user: true } },
  agency: true,
  _count: { select: { leads: true } },
} as const

export const dynamic = 'force-dynamic'

function marketplaceSlug(title: string, publicCode: number | null, id: string) {
  const suffix = `${publicCode ? `${publicCode}-` : ''}${id.slice(-8)}`
  return `${slugify(title).slice(0, 70)}-${suffix}`
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const property = await prisma.property.findUnique({ where: { id }, include: propertyInclude })
    if (!property) return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    const ownedByBroker = Boolean(user.broker && property.brokerId === user.broker.id)
    const ownedByAgency = Boolean(user.ownedAgency && property.agencyId === user.ownedAgency.id)
    if (!ownedByBroker && !ownedByAgency) {
      return NextResponse.json({ error: 'Acesso não permitido a este imóvel.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (typeof body?.published !== 'boolean') {
      return NextResponse.json({ error: 'Informe se o imóvel deve aparecer no Marketplace.' }, { status: 400 })
    }
    if (body.published && (!property.title.trim() || !property.city.trim() || property.price <= 0)) {
      return NextResponse.json({ error: 'Complete título, cidade e preço antes de publicar no Marketplace.' }, { status: 400 })
    }

    const updated = await prisma.property.update({
      where: { id: property.id },
      data: {
        marketplacePublished: body.published,
        marketplacePublishedAt: body.published ? property.marketplacePublishedAt ?? new Date() : null,
        marketplaceSlug: property.marketplaceSlug || marketplaceSlug(property.title, property.publicCode, property.id),
      },
      include: propertyInclude,
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: body.published ? 'Imóvel publicado no Marketplace' : 'Imóvel removido do Marketplace',
        message: body.published
          ? `${updated.title} agora aparece no EME Imóveis.`
          : `${updated.title} foi removido do EME Imóveis, sem alterar o catálogo.`,
        read: false,
      },
    })

    const response = NextResponse.json({ property: serializeProperty(updated) })
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    return response
  } catch (caughtError) {
    console.error('[api][properties][marketplace] update failed', {
      message: caughtError instanceof Error ? caughtError.message : 'unknown',
    })
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: 'O serviço de imóveis está indisponível no momento.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Não foi possível atualizar a publicação no Marketplace.' }, { status: 500 })
  }
}
