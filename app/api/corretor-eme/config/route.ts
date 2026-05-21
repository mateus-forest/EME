import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { cleanText, normalizePhone } from "@/lib/eme-backend"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function serializeConfig(config: Awaited<ReturnType<typeof getConfig>>) {
  return {
    whatsApp: config?.whatsApp ?? "",
    displayName: config?.displayName ?? "",
    initialMessage: config?.initialMessage ?? "",
    status: config?.status ?? "IN_PREPARATION",
    notes: config?.notes ?? "",
    provider: config?.provider ?? "",
    phoneNumberId: config?.phoneNumberId ?? "",
    webhookVerifyToken: config?.webhookVerifyToken ?? "",
    webhookStatus: config?.webhookStatus ?? "NOT_CONFIGURED",
    lastWebhookEventAt: config?.lastWebhookEventAt?.toISOString() ?? null,
    integrationRequestedAt: config?.integrationRequestedAt?.toISOString() ?? null,
    integrationActivatedAt: config?.integrationActivatedAt?.toISOString() ?? null,
  }
}

async function getConfig(brokerId: string) {
  return prisma.brokerEmeConfig.findUnique({ where: { brokerId } })
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const [config, history] = await Promise.all([
      getConfig(user.broker.id),
      prisma.emeMessage.findMany({
        where: { brokerId: user.broker.id, channel: "corretor_eme" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, message: true, response: true, detectedIntent: true, actionStatus: true, createdAt: true },
      }),
    ])
    return NextResponse.json({
      config: serializeConfig(config),
      history: history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível carregar o Corretor EME." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  const body = await request.json().catch(() => null)
  const requestActivation = Boolean(body?.requestActivation)

  try {
    const config = await prisma.brokerEmeConfig.upsert({
      where: { brokerId: user.broker.id },
      create: {
        brokerId: user.broker.id,
        whatsApp: normalizePhone(body?.whatsApp) || null,
        displayName: cleanText(body?.displayName, 120) || null,
        initialMessage: cleanText(body?.initialMessage, 800) || null,
        notes: cleanText(body?.notes, 1000) || null,
        provider: cleanText(body?.provider, 80) || null,
        phoneNumberId: cleanText(body?.phoneNumberId, 120) || null,
        webhookVerifyToken: cleanText(body?.webhookVerifyToken, 160) || null,
        status: requestActivation ? "REQUESTED" : "IN_PREPARATION",
        integrationRequestedAt: requestActivation ? new Date() : null,
      },
      update: {
        whatsApp: normalizePhone(body?.whatsApp) || null,
        displayName: cleanText(body?.displayName, 120) || null,
        initialMessage: cleanText(body?.initialMessage, 800) || null,
        notes: cleanText(body?.notes, 1000) || null,
        provider: cleanText(body?.provider, 80) || null,
        phoneNumberId: cleanText(body?.phoneNumberId, 120) || null,
        webhookVerifyToken: cleanText(body?.webhookVerifyToken, 160) || null,
        ...(requestActivation ? { status: "REQUESTED", integrationRequestedAt: new Date() } : {}),
      },
    })

    if (requestActivation) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Ativação do Corretor EME solicitada",
          message: "Sua solicitação de ativação foi registrada. A integração real com WhatsApp será feita em etapa futura.",
          read: false,
        },
      })
    }

    return NextResponse.json({ config: serializeConfig(config) })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível salvar a configuração do Corretor EME." }, { status: 500 })
  }
}
