import type { Notification } from "@/lib/prisma-model-types"

type NotificationClassificationInput = {
  title: string
  message: string
  category?: string
  financialStatus?: string
}

const financialKeywords = ["pagamento", "cobran", "assinatura", "inadimpl", "vencid", "regulariza"]

export function isFinancialNotification(notification: NotificationClassificationInput) {
  if (["cobranca", "assinatura", "confirmacao-pagamento"].includes(notification.category ?? "")) return true
  if (notification.financialStatus && notification.financialStatus !== "notificacao-recebida") return true

  const searchable = `${notification.title} ${notification.message}`.toLowerCase()
  return financialKeywords.some((keyword) => searchable.includes(keyword))
}

export function serializePaymentNotification(notification: Notification) {
  const isFinancial = isFinancialNotification(notification)

  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(notification.createdAt),
    createdAt: notification.createdAt.toISOString(),
    financialStatus: "notificacao-recebida",
    category: isFinancial ? "cobranca" : "aviso-administrativo",
    lida: notification.read,
    priority: isFinancial ? "alta" : "media",
    archived: Boolean(notification.archivedAt),
    contextMessage: notification.message,
  }
}
