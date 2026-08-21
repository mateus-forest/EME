import { NextRequest, NextResponse } from 'next/server'
import { ensureRole, getAuthenticatedUser } from '@/lib/auth-route'
import { UserRole } from '@/lib/prisma-enums'
import { prisma } from '@/lib/prisma'
import { getMarketplaceBroker } from '@/lib/marketplace/server-data'

export const dynamic = 'force-dynamic'

async function payloadFor(brokerId: string, slug: string) {
  const [profile, settings, properties, leads, conversations, reviewCounts] = await Promise.all([
    getMarketplaceBroker(slug),
    prisma.broker.findUnique({ where: { id: brokerId }, select: { catalogSlug: true, catalogBio: true, description: true, marketplaceSpecialties: true, marketplaceRegion: true, marketplaceTransactions: true, user: { select: { name: true, photoUrl: true } } } }),
    prisma.property.findMany({ where: { brokerId, marketplacePublished: true }, select: { id: true, title: true, marketplaceSlug: true, purpose: true, price: true, city: true, imageUrls: true }, orderBy: { marketplacePublishedAt: 'desc' }, take: 30 }),
    prisma.lead.findMany({ where: { brokerId, source: { startsWith: 'marketplace' } }, select: { id: true, name: true, phone: true, message: true, intent: true, status: true, createdAt: true }, orderBy: { updatedAt: 'desc' }, take: 30 }),
    prisma.marketplaceConversation.count({ where: { brokerId, status: 'OPEN' } }),
    prisma.marketplaceReview.groupBy({ by: ['status'], where: { brokerId }, _count: true }),
  ])
  return { profile, settings: settings ? { slug: settings.catalogSlug, displayName: settings.user.name, photoUrl: settings.user.photoUrl || '', specialties: settings.marketplaceSpecialties, region: settings.marketplaceRegion || '', transactions: settings.marketplaceTransactions || 'BOTH', bio: settings.catalogBio || settings.description || '' } : null, publicPath: profile ? `/imoveis/corretores/${encodeURIComponent(slug)}` : null, properties: properties.map((item) => ({ ...item, price: Math.round(item.price / 100), image: Array.isArray(item.imageUrls) ? item.imageUrls.find((image): image is string => typeof image === 'string') || '' : '', imageUrls: undefined })), leads: leads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString() })), counts: { conversations, properties: properties.length, leads: leads.length, reviews: Object.fromEntries(reviewCounts.map((row) => [row.status, row._count])) } }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER]); if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: 'Perfil de corretor não encontrado.' }, { status: 404 })
  return NextResponse.json(await payloadFor(user.broker.id, user.broker.catalogSlug))
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER]); if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: 'Perfil de corretor não encontrado.' }, { status: 404 })
  const body = await request.json().catch(() => null)
  const rawSpecialties = Array.isArray(body?.specialties) ? body.specialties : []
  if (rawSpecialties.length > 4 || rawSpecialties.some((value) => typeof value !== 'string')) {
    return NextResponse.json({ error: 'Informe no máximo 4 especialidades.' }, { status: 400 })
  }
  const specialties = rawSpecialties.map((value: string) => value.trim()).filter(Boolean)
  if (specialties.some((value) => value.length > 40)) {
    return NextResponse.json({ error: 'Cada especialidade deve ter no máximo 40 caracteres.' }, { status: 400 })
  }
  const specialtyKeys = specialties.map((value) => value.toLocaleLowerCase('pt-BR'))
  if (new Set(specialtyKeys).size !== specialtyKeys.length) {
    return NextResponse.json({ error: 'Não é possível repetir a mesma especialidade.' }, { status: 400 })
  }
  const region = typeof body?.region === 'string' ? body.region.trim().slice(0, 120) : ''
  const bio = typeof body?.bio === 'string' ? body.bio.trim().slice(0, 2_500) : ''
  const transactions = ['SALE', 'RENT', 'BOTH'].includes(body?.transactions) ? body.transactions : 'BOTH'
  await prisma.broker.update({ where: { id: user.broker.id }, data: { marketplaceSpecialties: specialties, marketplaceRegion: region || null, catalogBio: bio || null, marketplaceTransactions: transactions } })
  return NextResponse.json(await payloadFor(user.broker.id, user.broker.catalogSlug))
}
