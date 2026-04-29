import type { Notification } from "@/lib/prisma-model-types"

export function serializePaymentNotification(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(notification.createdAt),
    financialStatus: "notificacao-recebida",
    category: "aviso-administrativo",
    lida: notification.read,
    priority: "media",
    archived: Boolean(notification.archivedAt),
    contextMessage: notification.message,
  }
}

