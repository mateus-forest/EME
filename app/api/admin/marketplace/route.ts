import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { getAdminMarketplaceReport } from "@/lib/admin-marketplace"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

async function authorizeAdmin() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 }), user: null }
  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  return forbidden ? { response: forbidden, user: null } : { response: null, user }
}

export async function GET() {
  const authorization = await authorizeAdmin()
  if (authorization.response) return authorization.response
  try {
    return NextResponse.json({ report: await getAdminMarketplaceReport() })
  } catch (error) {
    console.error("[api][admin][marketplace] report failed", { message: error instanceof Error ? error.message : "unknown" })
    return NextResponse.json({ error: "Não foi possível carregar a operação do Marketplace." }, { status: isPrismaUnavailable(error) ? 503 : 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeAdmin()
  if (authorization.response) return authorization.response
  if (!authorization.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const payload = (await request.json().catch(() => null)) as unknown
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Ação administrativa inválida." }, { status: 400 })
  const body = payload as Record<string, unknown>
  const targetType = body.targetType
  const targetId = typeof body.targetId === "string" ? body.targetId : ""
  const action = body.action
  const customMessage = typeof body.message === "string" ? body.message.trim().slice(0, 500) : ""

  try {
    if (targetType === "property" && (action === "notify" || action === "withdraw")) {
      const property = await prisma.property.findUnique({ where: { id: targetId }, select: { id: true, title: true, marketplacePublished: true, broker: { select: { userId: true } } } })
      if (!property) return NextResponse.json({ error: "Anúncio não encontrado." }, { status: 404 })
      if (action === "withdraw") {
        if (!property.marketplacePublished) return NextResponse.json({ error: "Este anúncio já foi retirado." }, { status: 409 })
        await prisma.$transaction([
          prisma.property.update({ where: { id: property.id }, data: { marketplacePublished: false, marketplacePublishedAt: null } }),
          prisma.notification.create({ data: { userId: property.broker.userId, title: "Anúncio retirado do Marketplace", message: customMessage || `O anúncio ${property.title} foi retirado do Marketplace pela administração. Revise os dados antes de solicitar nova publicação.`, read: false } }),
        ])
        return NextResponse.json({ ok: true, message: "Anúncio retirado e corretor notificado." })
      }
      await prisma.notification.create({ data: { userId: property.broker.userId, title: "Revisão de anúncio no Marketplace", message: customMessage || `Revise o anúncio ${property.title}. A administração identificou pontos que merecem atenção.`, read: false } })
      return NextResponse.json({ ok: true, message: "Notificação enviada ao corretor." })
    }

    if (targetType === "broker" && action === "notify") {
      const broker = await prisma.broker.findUnique({ where: { id: targetId }, select: { userId: true, user: { select: { name: true } } } })
      if (!broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
      await prisma.notification.create({ data: { userId: broker.userId, title: "Acompanhamento do Marketplace", message: customMessage || `${broker.user.name}, revise seu perfil e seus anúncios para manter a qualidade da sua presença no Marketplace.`, read: false } })
      return NextResponse.json({ ok: true, message: "Notificação enviada ao corretor." })
    }
    return NextResponse.json({ error: "Ação administrativa não suportada." }, { status: 400 })
  } catch (error) {
    console.error("[api][admin][marketplace] action failed", { targetType, targetId, action, message: error instanceof Error ? error.message : "unknown" })
    return NextResponse.json({ error: "Não foi possível concluir a ação administrativa." }, { status: isPrismaUnavailable(error) ? 503 : 500 })
  }
}
