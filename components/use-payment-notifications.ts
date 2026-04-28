"use client"

import { useEffect, useMemo, useState } from "react"

export type PaymentNotificationPriority = "baixa" | "media" | "alta" | "critica"
export type PaymentNotificationCategory =
  | "cobranca"
  | "assinatura"
  | "sistema"
  | "aviso-administrativo"
  | "confirmacao-pagamento"
export type PaymentNotificationStatus =
  | "em-dia"
  | "vencimento-proximo"
  | "atraso-leve"
  | "inadimplente"
  | "notificacao-recebida"
  | "aguardando-regularizacao"

export type PaymentNotification = {
  id: string
  title: string
  message: string
  date: string
  financialStatus: PaymentNotificationStatus
  category: PaymentNotificationCategory
  lida: boolean
  priority: PaymentNotificationPriority
  dismissed?: boolean
  dashboardClosed?: boolean
  archived?: boolean
  lastPaymentAt?: string
  nextBillingAt?: string
  currentAmount?: string
  valueOpen?: string
  contextMessage?: string
}

export type FinancialSummary = {
  financialStatus: PaymentNotificationStatus
  lastPaymentAt: string
  nextBillingAt: string
  currentAmount: string
  valueOpen?: string
  contextMessage: string
}

function readStoredNotifications(storageKey: string, initialNotifications: PaymentNotification[]) {
  if (typeof window === "undefined") return initialNotifications

  // Legacy local notifications should not keep repopulating the UI in real-data tests.
  window.localStorage.removeItem(storageKey)
  return initialNotifications
}

export function usePaymentNotifications(storageKey: string, initialNotifications: PaymentNotification[]) {
  const [notifications, setNotifications] = useState<PaymentNotification[]>(() =>
    readStoredNotifications(storageKey, initialNotifications),
  )

  useEffect(() => {
    if (notifications.length === 0) {
      window.localStorage.removeItem(storageKey)
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(notifications))
  }, [notifications, storageKey])

  const historyNotifications = useMemo(
    () => notifications.filter((notification) => !notification.archived),
    [notifications],
  )

  const visibleNotifications = useMemo(
    () => historyNotifications.filter((notification) => !notification.dismissed),
    [historyNotifications],
  )

  const unreadCount = useMemo(
    () => historyNotifications.filter((notification) => !notification.lida).length,
    [historyNotifications],
  )

  const primaryNotification = useMemo(() => {
    const priorityOrder: Record<PaymentNotificationPriority, number> = {
      critica: 4,
      alta: 3,
      media: 2,
      baixa: 1,
    }

    return [...visibleNotifications].sort((first, second) => {
      const priorityDifference = priorityOrder[second.priority] - priorityOrder[first.priority]
      if (priorityDifference !== 0) return priorityDifference
      return Number(first.lida) - Number(second.lida)
    })[0] ?? null
  }, [visibleNotifications])

  const financialSummary = useMemo<FinancialSummary>(() => {
    const referenceNotification = primaryNotification ?? historyNotifications[0]

    if (!referenceNotification) {
      return {
        financialStatus: "em-dia",
        lastPaymentAt: "-",
        nextBillingAt: "-",
        currentAmount: "R$ 0,00",
        contextMessage: "Nenhuma notificação financeira disponível.",
      }
    }

    return {
      financialStatus: referenceNotification.financialStatus,
      lastPaymentAt: referenceNotification.lastPaymentAt ?? "-",
      nextBillingAt: referenceNotification.nextBillingAt ?? "-",
      currentAmount: referenceNotification.currentAmount ?? "R$ 0,00",
      valueOpen: referenceNotification.valueOpen,
      contextMessage:
        referenceNotification.contextMessage ??
        {
          "em-dia": "Seu pagamento está em dia.",
          "vencimento-proximo": "Sua próxima cobrança vence em breve.",
          "atraso-leve": "Existe uma pendência financeira nesta conta.",
          inadimplente: "Regularize para evitar bloqueios futuros.",
          "notificacao-recebida": "Há uma notificação administrativa pendente para sua assinatura.",
          "aguardando-regularizacao": "Pagamento aguardando compensação.",
        }[referenceNotification.financialStatus],
    }
  }, [historyNotifications, primaryNotification])

  function updateNotification(id: string, updater: (notification: PaymentNotification) => PaymentNotification) {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? updater(notification) : notification)),
    )
  }

  return {
    notifications: visibleNotifications,
    historyNotifications,
    unreadCount,
    primaryNotification,
    financialSummary,
    markAsRead(id: string) {
      updateNotification(id, (notification) => ({ ...notification, lida: true }))
    },
    dismiss(id: string) {
      updateNotification(id, (notification) => ({
        ...notification,
        lida: true,
        dismissed: true,
        dashboardClosed: true,
      }))
    },
    archive(id: string) {
      updateNotification(id, (notification) => ({
        ...notification,
        lida: true,
        archived: true,
      }))
    },
    requestRegularization(id: string) {
      updateNotification(id, (notification) => ({
        ...notification,
        lida: true,
        financialStatus: "aguardando-regularizacao",
        priority: notification.priority === "critica" ? "alta" : notification.priority,
        title: "Regularização em andamento",
        message: "Pagamento aguardando compensação. Vamos atualizar sua assinatura em breve.",
        date: "Agora mesmo",
        currentAmount: notification.currentAmount ?? "R$ 0,00",
        nextBillingAt: notification.nextBillingAt ?? "-",
        contextMessage: "Pagamento aguardando compensação.",
      }))
    },
  }
}
