import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import {
  cleanText,
  generateAssessorText,
  generateCorretorEmeReply,
  inferAssessorAction,
  inferCustomerIntent,
  runAssessorAction,
  searchBrokerProperties,
  type AssessorAction,
} from "@/lib/eme-backend"
import { isPrismaUnavailable } from "@/lib/auth-route"
import { LeadStatus } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { markAsRead, sendTextMessage, sanitizeWhatsAppNumber } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"

const WHATSAPP_WEBHOOK_RECIPIENT_VERSION = "whatsapp-reply-to-meta-from-v2"

function getWebhookRuntimeLogContext() {
  return {
    timestamp: new Date().toISOString(),
    version: WHATSAPP_WEBHOOK_RECIPIENT_VERSION,
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
      "local-a7c2cdd",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
  }
}

type WhatsAppIncomingMessage = {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

type WhatsAppWebhookChange = {
  value?: {
    messaging_product?: string
    metadata?: {
      display_phone_number?: string
      phone_number_id?: string
    }
    contacts?: Array<{
      profile?: { name?: string }
      wa_id?: string
    }>
    messages?: WhatsAppIncomingMessage[]
  }
}

type WhatsAppWebhookPayload = {
  object?: string
  entry?: Array<{
    changes?: WhatsAppWebhookChange[]
  }>
}

function verifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || ""
}

function normalizeComparablePhone(value?: string | null) {
  return sanitizeWhatsAppNumber(value ?? "")
}

function extractTextMessage(message: WhatsAppIncomingMessage) {
  if (message.type !== "text") return ""
  return cleanText(message.text?.body, 3000)
}

function getContactName(change: WhatsAppWebhookChange, fromPhone: string) {
  const contact = change.value?.contacts?.find((item) => item.wa_id === fromPhone) ?? change.value?.contacts?.[0]
  return cleanText(contact?.profile?.name, 120)
}

function getContactWaId(change: WhatsAppWebhookChange, rawFrom: string) {
  return cleanText(change.value?.contacts?.find((item) => item.wa_id === rawFrom)?.wa_id ?? change.value?.contacts?.[0]?.wa_id, 80)
}

function resolveReplyRecipient(change: WhatsAppWebhookChange, incomingMessage: WhatsAppIncomingMessage) {
  const rawFrom = cleanText(incomingMessage.from, 80)
  const contactWaId = getContactWaId(change, rawFrom)
  const rawFromFromMeta = rawFrom || contactWaId
  const whatsappReplyTo = rawFromFromMeta.replace(/\D/g, "")

  console.info("[api][whatsapp][recipient]", {
    ...getWebhookRuntimeLogContext(),
    rawFrom,
    contactWaId,
    rawFromFromMeta,
    whatsappReplyTo,
    finalPayload: {
      to: whatsappReplyTo,
    },
    length: whatsappReplyTo.length,
  })

  return { rawFrom, contactWaId, whatsappReplyTo }
}

async function sendWebhookReply(to: string, text: string, phoneNumberId: string) {
  try {
    await sendTextMessage(to, text, { phoneNumberId })
  } catch (caughtError) {
    console.error("[api][whatsapp][webhook] reply send failed", {
      to,
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
  }
}

async function reserveAssistantCredits(brokerId: string, creditsUsed: number) {
  const reserved = await prisma.broker.updateMany({
    where: {
      id: brokerId,
      aiAssistantEnabled: true,
      aiCreditsBalance: { gte: creditsUsed },
    },
    data: {
      aiCreditsBalance: { decrement: creditsUsed },
      aiCreditsUsedThisMonth: { increment: creditsUsed },
      aiMonthlyUsage: { increment: creditsUsed },
      aiLastInteractionAt: new Date(),
    },
  })

  return reserved.count > 0
}

async function findAssessorBroker(fromPhone: string) {
  const phone = normalizeComparablePhone(fromPhone)
  if (!phone) return null

  return prisma.broker.findFirst({
    where: {
      OR: [
        { phone: { contains: phone.slice(-8) } },
        { user: { phone: { contains: phone.slice(-8) } } },
        { corretorEmeConfig: { whatsApp: { contains: phone.slice(-8) } } },
      ],
    },
    include: { user: true },
  })
}

async function recordDisabledAssessorMessage({
  brokerId,
  userId,
  fromPhone,
  message,
  metadata,
}: {
  brokerId: string
  userId: string
  fromPhone: string
  message: string
  metadata: Prisma.InputJsonObject
}) {
  const response = "Seu Assessor EME está desativado no momento."
  await prisma.emeMessage.create({
    data: {
      userId,
      brokerId,
      channel: "assessor_eme",
      direction: "whatsapp_inbound",
      fromPhone,
      message,
      response,
      detectedIntent: "disabled",
      actionType: "assistant_disabled",
      actionStatus: "disabled",
      creditsUsed: 0,
      metadata,
    },
  })
  return response
}

async function findCorretorEmeBroker(phoneNumberId: string, displayPhoneNumber: string) {
  const displayPhone = normalizeComparablePhone(displayPhoneNumber)
  const filters = [
    phoneNumberId ? { phoneNumberId } : null,
    displayPhone ? { whatsApp: { contains: displayPhone.slice(-8) } } : null,
  ].filter((item): item is { phoneNumberId: string } | { whatsApp: { contains: string } } => Boolean(item))

  if (filters.length === 0) return null

  return prisma.brokerEmeConfig.findFirst({
    where: {
      OR: filters,
    },
    include: {
      broker: {
        include: { user: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  })
}

async function getAssessorConfigPhoneNumberId() {
  const config = await prisma.assessorEmeConfig.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { phoneNumberId: true, officialNumber: true },
  })

  return config?.phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || ""
}

async function processAssessorMessage({
  brokerId,
  userId,
  fromPhone,
  messageId,
  message,
  metadata,
}: {
  brokerId: string
  userId: string
  fromPhone: string
  messageId: string
  message: string
  metadata: Prisma.InputJsonObject
}) {
  const action = inferAssessorAction(message) as AssessorAction
  const creditsUsed = 1

  if (!(await reserveAssistantCredits(brokerId, creditsUsed))) {
    const response = "Você atingiu o limite de créditos do Assessor EME do seu plano. Adquira créditos adicionais no painel para continuar utilizando."
    await prisma.emeMessage.create({
      data: {
        userId,
        brokerId,
        channel: "assessor_eme",
        direction: "whatsapp_inbound",
        fromPhone,
        message,
        response,
        detectedIntent: action,
        actionType: action,
        actionStatus: "insufficient_credits",
        creditsUsed: 0,
        metadata,
      },
    })
    return { response, intent: action, actionType: action, actionStatus: "insufficient_credits", creditsUsed: 0 }
  }

  let actionResult: Awaited<ReturnType<typeof runAssessorAction>> = { response: "", metadata: {} }
  let responseText = ""
  let actionStatus = "completed"
  let errorMessage: string | null = null

  try {
    actionResult = await runAssessorAction({
      brokerId,
      userId,
      message,
      action,
      confirm: false,
      payload: {},
    })
    actionStatus =
      Array.isArray(actionResult.metadata?.required) && actionResult.metadata.required.length > 0
        ? "needs_input"
        : actionResult.response.includes("confirmação") || actionResult.response.includes("confirmaÃ§Ã£o")
          ? "needs_confirmation"
          : "completed"
    responseText = action === "createLead" || action === "searchProperties" ? actionResult.response : await generateAssessorText(message, action, actionResult.response)
    console.info("[api][whatsapp][assessor-action]", {
      detectedIntent: action,
      executedAction: action,
      actionStatus,
      brokerId,
      leadId: actionResult.leadId ?? null,
      propertySearchFilters: actionResult.metadata?.propertySearchFilters ?? null,
    })
  } catch (caughtError) {
    actionStatus = "error"
    errorMessage = caughtError instanceof Error ? caughtError.message : "Erro na ação interna."
    responseText = "Não consegui concluir essa ação agora. Registrei o erro para acompanhamento interno."
  }

  await Promise.all([
    prisma.emeMessage.create({
      data: {
        userId,
        brokerId,
        leadId: actionResult.leadId ?? null,
        propertyId: actionResult.propertyId ?? null,
        channel: "assessor_eme",
        direction: "whatsapp_inbound",
        fromPhone,
        message,
        response: responseText,
        detectedIntent: action,
        actionType: action,
        actionStatus,
        metadata: { ...metadata, ...(actionResult.metadata ?? {}), whatsappMessageId: messageId },
        errorMessage,
        creditsUsed,
      },
    }),
    prisma.aiAssistantInteraction.create({
      data: {
        userId,
        brokerId,
        prompt: message,
        response: responseText,
        actionType: action,
        creditsUsed,
        channel: "assessor_eme",
        intent: action,
        actionStatus,
        metadata: { ...metadata, ...(actionResult.metadata ?? {}), whatsappMessageId: messageId },
        errorMessage,
        leadId: actionResult.leadId ?? null,
        propertyId: actionResult.propertyId ?? null,
      },
    }),
  ])

  return { response: responseText, intent: action, actionType: action, actionStatus, creditsUsed }
}

async function processCorretorMessage({
  brokerId,
  userId,
  fromPhone,
  customerName,
  messageId,
  message,
  metadata,
}: {
  brokerId: string
  userId: string
  fromPhone: string
  customerName: string
  messageId: string
  message: string
  metadata: Prisma.InputJsonObject
}) {
  const intent = inferCustomerIntent(message)
  const actionType = "qualifyLead"
  const creditsUsed = 1

  if (!(await reserveAssistantCredits(brokerId, creditsUsed))) {
    const response = "Obrigado pelo contato. Recebi sua mensagem e o corretor dará continuidade ao atendimento em breve."
    await prisma.emeMessage.create({
      data: {
        userId,
        brokerId,
        channel: "corretor_eme",
        direction: "whatsapp_inbound",
        fromPhone,
        customerName: customerName || null,
        message,
        response,
        detectedIntent: intent,
        actionType,
        actionStatus: "insufficient_credits",
        creditsUsed: 0,
        metadata,
      },
    })
    return { response, intent, actionType, actionStatus: "insufficient_credits", creditsUsed: 0 }
  }

  const suggestions = await searchBrokerProperties(brokerId, message, 3)
  const existingLead = await prisma.lead.findFirst({
    where: { brokerId, phone: fromPhone },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  })
  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: { name: customerName || undefined, message, intent, source: "whatsapp", status: LeadStatus.CONTACTED },
      })
    : await prisma.lead.create({
        data: { name: customerName || null, phone: fromPhone, message, intent, source: "whatsapp", status: LeadStatus.NEW, brokerId },
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
        userId,
        brokerId,
        leadId: lead.id,
        channel: "corretor_eme",
        direction: "whatsapp_inbound",
        fromPhone,
        customerName: customerName || null,
        message,
        response: responseText,
        detectedIntent: intent,
        actionType,
        actionStatus: "completed",
        metadata: { ...metadata, suggestedPropertyIds: suggestions.map((property) => property.id), whatsappMessageId: messageId },
        creditsUsed,
      },
    }),
    prisma.aiAssistantInteraction.create({
      data: {
        userId,
        brokerId,
        prompt: message,
        response: responseText,
        actionType,
        creditsUsed,
        channel: "corretor_eme",
        intent,
        actionStatus: "completed",
        leadId: lead.id,
        metadata: { ...metadata, whatsappMessageId: messageId },
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        title: "Mensagem recebida pelo Corretor EME",
        message: `${customerName || fromPhone} enviou uma mensagem com intenção de ${intent}.`,
        read: false,
      },
    }),
  ])

  return { response: responseText, intent, actionType, actionStatus: "completed", creditsUsed }
}

async function processIncomingMessage(change: WhatsAppWebhookChange, incomingMessage: WhatsAppIncomingMessage) {
  const phoneNumberId = cleanText(change.value?.metadata?.phone_number_id, 120)
  const displayPhoneNumber = cleanText(change.value?.metadata?.display_phone_number, 80)
  const recipient = resolveReplyRecipient(change, incomingMessage)
  const fromPhone = recipient.whatsappReplyTo
  const messageId = cleanText(incomingMessage.id, 240)
  const message = extractTextMessage(incomingMessage)
  if (!fromPhone || !message) return

  await markAsRead(messageId, { phoneNumberId }).catch(() => null)

  const assessorPhoneNumberId = await getAssessorConfigPhoneNumberId()
  const metadata = {
    provider: "whatsapp_cloud_api",
    phoneNumberId,
    displayPhoneNumber,
    whatsappMessageId: messageId,
    timestamp: incomingMessage.timestamp ?? null,
  } satisfies Prisma.InputJsonObject

  if (phoneNumberId && assessorPhoneNumberId && phoneNumberId === assessorPhoneNumberId) {
    const broker = await findAssessorBroker(fromPhone)
    if (!broker) {
      await sendWebhookReply(recipient.whatsappReplyTo, "Não encontrei seu cadastro de corretor no EME para usar o Assessor EME.", phoneNumberId)
      return
    }
    if (!broker.aiAssistantEnabled) {
      const response = await recordDisabledAssessorMessage({
        brokerId: broker.id,
        userId: broker.userId,
        fromPhone,
        message,
        metadata,
      })
      await sendWebhookReply(recipient.whatsappReplyTo, response, phoneNumberId)
      return
    }
    const result = await processAssessorMessage({
      brokerId: broker.id,
      userId: broker.userId,
      fromPhone,
      messageId,
      message,
      metadata,
    })
    await sendWebhookReply(recipient.whatsappReplyTo, result.response, phoneNumberId)
    return
  }

  await sendWebhookReply(recipient.whatsappReplyTo, "Canal EME em preparação. O atendimento será retomado em breve.", phoneNumberId)
}

export async function GET(request: NextRequest) {
  console.info("[api][whatsapp][webhook][GET]", getWebhookRuntimeLogContext())

  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token && token === verifyToken() && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Token de verificação inválido." }, { status: 403 })
}

export async function POST(request: NextRequest) {
  console.info("[api][whatsapp][webhook][POST]", getWebhookRuntimeLogContext())

  try {
    const payload = (await request.json().catch(() => null)) as WhatsAppWebhookPayload | null
    const changes = payload?.entry?.flatMap((entry) => entry.changes ?? []) ?? []

    for (const change of changes) {
      const messages = change.value?.messages ?? []
      for (const message of messages) {
        await processIncomingMessage(change, message)
      }
    }

    return NextResponse.json({ received: true })
  } catch (caughtError) {
    console.error("[api][whatsapp][webhook] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço EME indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível processar o webhook do WhatsApp." }, { status: 500 })
  }
}
