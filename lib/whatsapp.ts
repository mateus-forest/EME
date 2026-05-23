export function sanitizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "")

  if (!digits) return ""
  if (digits.startsWith("55")) return digits

  return `55${digits}`
}

export function createWhatsAppUrl(number: string, message: string) {
  const sanitizedNumber = sanitizeWhatsAppNumber(number)
  const encodedMessage = encodeURIComponent(message)

  return `https://wa.me/${sanitizedNumber}?text=${encodedMessage}`
}

export function normalizeWhatsAppCloudRecipient(value: string) {
  return value.replace(/\D/g, "")
}

type WhatsAppSendOptions = {
  phoneNumberId?: string | null
  accessToken?: string | null
}

function getWhatsAppApiConfig(options: WhatsAppSendOptions = {}) {
  const accessToken = options.accessToken?.trim() || process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = options.phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()

  if (!accessToken || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API indisponível: configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.")
  }

  return {
    accessToken,
    phoneNumberId,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v20.0",
  }
}

async function whatsappGraphRequest(path: string, body: Record<string, unknown>, options: WhatsAppSendOptions = {}) {
  const config = getWhatsAppApiConfig(options)
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    if (detail.includes("131030")) {
      console.error("[whatsapp] Número destinatário não autorizado na lista de teste da Meta", { status: response.status, detail })
    }
    console.error("[whatsapp] graph request failed", { status: response.status, detail })
    throw new Error("Não foi possível enviar a mensagem pelo WhatsApp.")
  }

  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

export async function sendTextMessage(to: string, text: string, options: WhatsAppSendOptions = {}) {
  const config = getWhatsAppApiConfig(options)
  const sanitizedTo = normalizeWhatsAppCloudRecipient(to)

  if (!sanitizedTo) {
    throw new Error("Informe um telefone válido para envio pelo WhatsApp.")
  }

  const finalPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: sanitizedTo,
    type: "text",
    text: {
      preview_url: false,
      body: text.slice(0, 4000),
    },
  }

  console.info("[whatsapp] sending text message", {
    normalizedTo: sanitizedTo,
    finalPayload: {
      to: finalPayload.to,
    },
    length: finalPayload.to.length,
  })

  return whatsappGraphRequest(`${config.phoneNumberId}/messages`, finalPayload, options)
}

export async function markAsRead(messageId: string, options: WhatsAppSendOptions = {}) {
  const config = getWhatsAppApiConfig(options)
  const normalizedMessageId = messageId.trim()
  if (!normalizedMessageId) return null

  return whatsappGraphRequest(
    `${config.phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: normalizedMessageId,
    },
    options,
  )
}
