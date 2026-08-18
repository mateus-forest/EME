"use client"

import { useMemo, useState } from "react"
import { Archive, BellRing, Eye } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import {
  NotificationDetailDialog,
  notificationCategoryLabels,
} from "@/components/notification-center"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import type { PaymentNotificationCategory } from "@/components/use-payment-notifications"
import { Button } from "@/components/ui/button"

type StateFilter = "all" | "unread" | "read" | "archived"
type CategoryFilter = "all" | PaymentNotificationCategory

const stateFilters: Array<{ value: StateFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "read", label: "Lidas" },
  { value: "archived", label: "Arquivadas" },
]

export function BrokerNotificationsPage() {
  const { allNotifications, markAsRead, archive } = useBrokerPaymentNotifications({ includeArchived: true })
  const [stateFilter, setStateFilter] = useState<StateFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const availableCategories = useMemo(
    () => [...new Set(allNotifications.map((notification) => notification.category))],
    [allNotifications],
  )
  const filteredNotifications = useMemo(
    () => allNotifications.filter((notification) => {
      const matchesState = stateFilter === "all"
        || (stateFilter === "unread" && !notification.lida && !notification.archived)
        || (stateFilter === "read" && notification.lida && !notification.archived)
        || (stateFilter === "archived" && notification.archived)
      const matchesCategory = categoryFilter === "all" || notification.category === categoryFilter
      return matchesState && matchesCategory
    }),
    [allNotifications, categoryFilter, stateFilter],
  )
  const selectedNotification = allNotifications.find((notification) => notification.id === selectedId) ?? null

  function openDetails(id: string) {
    markAsRead(id)
    setSelectedId(id)
  }

  return (
    <BrokerPageShell
      title="Notificações"
      subtitle="Histórico persistido de avisos do Portal EME."
    >
      <div className="grid gap-4">
        <section className="flex flex-col gap-3 rounded-[1.25rem] border border-black/[0.06] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.035)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {stateFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={stateFilter === filter.value}
                onClick={() => setStateFilter(filter.value)}
                className={`h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition ${stateFilter === filter.value ? "bg-[#eaf7ee] text-[#008633]" : "text-[#667085] hover:bg-[#f7f8f5]"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#667085]">
            Tipo
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
              className="h-9 min-w-40 rounded-lg border border-black/[0.07] bg-white px-3 text-xs text-[#344054]"
            >
              <option value="all">Todos os tipos</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>{notificationCategoryLabels[category]}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y divide-black/[0.055]">
              {filteredNotifications.map((notification) => (
                <article key={notification.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${notification.lida ? "bg-[#f3f5f2] text-[#7b8491]" : "bg-[#eaf7ee] text-[#008633]"}`}>
                    <BellRing className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-[#111827]">{notification.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${notification.archived ? "bg-[#f2f4f7] text-[#667085]" : notification.lida ? "bg-[#f7f8f5] text-[#7b8491]" : "bg-[#eaf7ee] text-[#008633]"}`}>
                        {notification.archived ? "Arquivada" : notification.lida ? "Lida" : "Não lida"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-[#98a2b3]">{notificationCategoryLabels[notification.category]} · {notification.date}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button type="button" variant="ghost" onClick={() => openDetails(notification.id)} className="h-8 rounded-lg border border-black/[0.06] px-2.5 text-xs text-[#475467]">
                      <Eye className="size-3.5" /> Ver detalhe
                    </Button>
                    {!notification.archived ? (
                      <Button type="button" variant="ghost" onClick={() => archive(notification.id)} aria-label={`Arquivar ${notification.title}`} className="size-8 rounded-lg border border-black/[0.06] p-0 text-[#667085]">
                        <Archive className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-5 py-14 text-center">
              <BellRing className="mx-auto size-6 text-[#98a2b3]" />
              <p className="mt-3 text-sm font-medium text-[#344054]">Nenhuma notificação neste filtro.</p>
              <p className="mt-1 text-xs text-[#98a2b3]">Os avisos persistidos aparecerão aqui.</p>
            </div>
          )}
        </section>
      </div>

      <NotificationDetailDialog
        notification={selectedNotification}
        open={Boolean(selectedNotification)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onArchive={(id) => { archive(id); setSelectedId(null) }}
        relatedActionHref="/corretor/plano"
      />
    </BrokerPageShell>
  )
}
