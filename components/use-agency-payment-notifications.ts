"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  FinancialSummary,
  PaymentNotification,
  PaymentNotificationPriority,
} from "@/components/use-payment-notifications"

export function useAgencyPaymentNotifications() {
  const [notifications, setNotifications] = useState<PaymentNotification[]>([])

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
    const data = (await response.json().catch(() => null)) as { notifications?: PaymentNotification[] } | null

    if (response.ok && data?.notifications) {
      setNotifications(data.notifications)
    }
  }, [])

  useEffect(() => {
    loadNotifications().catch(() => setNotifications([]))
  }, [loadNotifications])

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
      contextMessage: referenceNotification.contextMessage ?? referenceNotification.message,
    }
  }, [historyNotifications, primaryNotification])

  function updateNotification(id: string, updater: (notification: PaymentNotification) => PaymentNotification) {
    setNotifications((current) =>
      current.map((notification) => (notification.id === id ? updater(notification) : notification)),
    )
  }

  function markAsRead(id: string) {
    updateNotification(id, (notification) => ({ ...notification, lida: true }))

    void fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    }).catch(() => null)
  }

  return {
    notifications: visibleNotifications,
    historyNotifications,
    unreadCount,
    primaryNotification,
    financialSummary,
    markAsRead,
    dismiss(id: string) {
      markAsRead(id)
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
      void fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => null)
    },
    requestRegularization(id: string) {
      markAsRead(id)
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
