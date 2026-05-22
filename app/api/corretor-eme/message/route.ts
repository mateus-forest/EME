import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { cleanText, generateCorretorEmeReply, inferCustomerIntent, normalizePhone, searchBrokerProperties } from "@/lib/eme-backend"
import { LeadStatus, UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  const body = await request.json().catch(() => null)
  const brokerId = cleanText(body?.brokerId, 120) || user.broker.id
  if (brokerId !== user.broker.id) return NextResponse.json({ error: "Acesso não permitido para este corretor." }, { status: 403 })

  const message = cleanText(body?.message, 3000)
  const phone = normalizePhone(body?.customerPhone ?? body?.phone)
  const customerName = cleanText(body?.customerName ?? body?.name, 120)
  const propertyId = cleanText(body?.propertyId, 120)
  const source = cleanText(body?.source, 80) || "corretor_eme"

  if (!message || !phone) {
    return NextResponse.json({ error: "Informe mensagem e telefone do cliente." }, { status: 400 })
  }

  try {
    const intent = inferCustomerIntent(message)
    const creditsUsed = 1
    const reserved = await prisma.broker.updateMany({
      where: {
        id: brokerId,
        aiCreditsBalance: { gte: creditsUsed },
      },
      data: {
        aiCreditsBalance: { decrement: creditsUsed },
        aiCreditsUsedThisMonth: { increment: creditsUsed },
      },
    })

    if (reserved.count === 0) {
      return NextResponse.json({ error: "Créditos insuficientes para processar o Corretor EME." }, { status: 402 })
    }

    const suggestions = await searchBrokerProperties(brokerId, message, 3)
    const existingLead = await prisma.lead.findFirst({
      where: { brokerId, phone },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    })
    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: { name: customerName || undefined, message, intent, source, status: LeadStatus.CONTACTED, propertyId: propertyId || undefined },
        })
      : await prisma.lead.create({
          data: { name: customerName || null, phone, message, intent, source, status: LeadStatus.NEW, brokerId, propertyId: propertyId || null },
        })

    const responseText = await generateCorretorEmeReply({
      message,
      customerName,
      intent,
      suggestions: suggestions.map((property) => ({
        title: property.title,
        price: property.price,
        city: property.city,
        neighborhood: property.neighborhood,
      })),
    })

    await Promise.all([
      prisma.emeMessage.create({
        data: {
          brokerId,
          leadId: lead.id,
          propertyId: propertyId || null,
          channel: "corretor_eme",
          direction: "customer_to_ai",
          fromPhone: phone,
          customerName: customerName || null,
          message,
          response: responseText,
          detectedIntent: intent,
          actionType: "qualifyLead",
          actionStatus: "completed",
          metadata: { suggestedPropertyIds: suggestions.map((property) => property.id), source },
          creditsUsed,
        },
      }),
      prisma.aiAssistantInteraction.create({
        data: {
          userId: user.id,
          brokerId,
          prompt: message,
          response: responseText,
          actionType: "qualifyLead",
          creditsUsed,
          channel: "corretor_eme",
          intent,
          actionStatus: "completed",
          leadId: lead.id,
          propertyId: propertyId || null,
          metadata: { source },
        },
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          title: "Lead qualificado pelo Corretor EME",
          message: `${customerName || phone} enviou uma mensagem com intenção de ${intent}.`,
          read: false,
        },
      }),
    ])

    return NextResponse.json({
      response: responseText,
      intent,
      leadId: lead.id,
      creditsUsed,
      suggestedProperties: suggestions.map((property) => ({
        id: property.id,
        title: property.title,
        city: property.city,
        neighborhood: property.neighborhood,
      })),
    })
  } catch (caughtError) {
    console.error("[api][corretor-eme][message] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    if (isPrismaUnavailable(caughtError)) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível processar a mensagem do Corretor EME." }, { status: 500 })
  }
}
