"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  FinancialSummary,
  PaymentNotification,
  PaymentNotificationPriority,
} from "@/components/use-payment-notifications"
import { isFinancialNotification } from "@/lib/notification-contract"

const notificationRequests = new Map<string, Promise<PaymentNotification[] | null>>()

function requestNotifications(includeArchived: boolean) {
  const key = includeArchived ? "history" : "active"
  const existing = notificationRequests.get(key)
  if (existing) return existing

  const request = fetch(includeArchived ? "/api/notifications?history=1" : "/api/notifications", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as { notifications?: PaymentNotification[] } | null
      return response.ok && data?.notifications ? data.notifications : null
    })
    .finally(() => {
      notificationRequests.delete(key)
    })

  notificationRequests.set(key, request)
  return request
}

export function useBrokerPaymentNotifications(options?: { includeArchived?: boolean; enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const includeArchived = options?.includeArchived ?? false
  const [notifications, setNotifications] = useState<PaymentNotification[]>([])

  const loadNotifications = useCallback(async () => {
    const nextNotifications = await requestNotifications(includeArchived)
    if (nextNotifications) setNotifications(nextNotifications)
  }, [includeArchived])

  useEffect(() => {
    if (!enabled) return
    loadNotifications().catch(() => setNotifications([]))
  }, [enabled, loadNotifications])

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

  const financialNotifications = useMemo(
    () => historyNotifications.filter(isFinancialNotification),
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
    const referenceNotification =
      (primaryNotification && isFinancialNotification(primaryNotification) ? primaryNotification : null) ??
      financialNotifications[0]

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
  }, [financialNotifications, primaryNotification])

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
    allNotifications: notifications,
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
      updateNotification(id, (notification) =>
        isFinancialNotification(notification)
          ? {
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
            }
          : { ...notification, lida: true },
      )
    },
  }
}
