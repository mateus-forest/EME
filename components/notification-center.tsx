"use client"

import { useMemo, useState } from "react"
import { Archive, Bell, BellRing, CircleAlert, CreditCard, Eye } from "lucide-react"

import type {
  PaymentNotification,
  PaymentNotificationCategory,
  PaymentNotificationStatus,
} from "@/components/use-payment-notifications"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type NotificationCenterProps = {
  title: string
  notifications: PaymentNotification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onArchive: (id: string) => void
  onOpenDetails?: (id: string) => void
  tone?: "dark" | "light"
}

const statusLabels: Record<PaymentNotificationStatus, string> = {
  "em-dia": "Em dia",
  "vencimento-proximo": "Vencendo",
  "atraso-leve": "Atraso leve",
  inadimplente: "Inadimplente",
  "notificacao-recebida": "Notificação recebida",
  "aguardando-regularizacao": "Aguardando regularização",
}

const categoryLabels: Record<PaymentNotificationCategory, string> = {
  cobranca: "Cobrança",
  assinatura: "Assinatura",
  sistema: "Sistema",
  "aviso-administrativo": "Aviso administrativo",
  "confirmacao-pagamento": "Confirmação",
}

export function NotificationCenter({
  title,
  notifications,
  unreadCount,
  onMarkAsRead,
  onArchive,
  onOpenDetails,
  tone = "dark",
}: NotificationCenterProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isLight = tone === "light"

  const orderedNotifications = useMemo(
    () => [...notifications].sort((first, second) => Number(first.lida) - Number(second.lida)),
    [notifications],
  )

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 1800)
  }

  function handleMarkAsRead(id: string) {
    onMarkAsRead(id)
    showFeedback("Notificação marcada como lida")
  }

  function handleArchive(id: string) {
    onArchive(id)
    showFeedback("Aviso arquivado")
  }

  function handleOpenDetails(id: string) {
    onMarkAsRead(id)
    onOpenDetails?.(id)
    if (!onOpenDetails) setSelectedId(id)
    showFeedback("Detalhes da notificação atualizados")
  }
  const selectedNotification = orderedNotifications.find((notification) => notification.id === selectedId) ?? null

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={
            isLight
              ? "relative h-8.5 w-8.5 rounded-xl border border-black/[0.06] bg-white/80 px-0 text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
              : "relative h-8.5 w-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-0 text-white/75 hover:bg-white/[0.08] hover:text-white"
          }
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-[#009b3a] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className={
          isLight
            ? "w-[calc(100vw-2rem)] max-w-[360px] rounded-[1.5rem] border border-black/[0.06] bg-white/95 p-0 text-[#050505] shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
            : "w-[calc(100vw-2rem)] max-w-[360px] rounded-[1.5rem] border border-white/[0.08] bg-[#101010]/96 p-0 text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
        }
      >
        <div className={`${isLight ? "border-b border-black/[0.06]" : "border-b border-white/[0.08]"} px-5 py-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-sm font-semibold ${isLight ? "text-[#050505]" : "text-white"}`}>{title}</p>
              <p className={`mt-1 text-xs ${isLight ? "text-[#7B8491]" : "text-white/45"}`}>
                {unreadCount > 0
                  ? `${unreadCount} notificação${unreadCount > 1 ? "es" : ""} não lida${unreadCount > 1 ? "s" : ""}`
                  : "Tudo em ordem por aqui"}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
              <BellRing className="size-4.5" />
            </div>
          </div>
          {feedback && <p className="mt-3 text-xs text-[#009b3a]">{feedback}</p>}
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
          {orderedNotifications.length > 0 ? (
            orderedNotifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-[1.25rem] border p-4 ${
                  notification.lida
                    ? isLight
                      ? "border-black/[0.06] bg-[#fbfbf8]"
                      : "border-white/[0.08] bg-white/[0.03]"
                    : "border-[#009b3a]/14 bg-[#009b3a]/[0.05]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-medium ${isLight ? "text-[#050505]" : "text-white"}`}>{notification.title}</p>
                      {!notification.lida && (
                        <span className="rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-2 py-0.5 text-[10px] text-[#009b3a]">
                          Nova
                        </span>
                      )}
                    </div>
                    <p className={`mt-2 text-xs leading-5 ${isLight ? "text-[#5F6B7A]" : "text-white/58"}`}>{notification.message}</p>
                  </div>
                  <StatusIcon status={notification.financialStatus} tone={tone} />
                </div>

                <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${isLight ? "text-[#7B8491]" : "text-white/45"}`}>
                  <span className={`rounded-full border px-2.5 py-1 ${isLight ? "border-black/[0.06] bg-white/80" : "border-white/[0.08] bg-white/[0.04]"}`}>
                    {categoryLabels[notification.category]}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 ${isLight ? "border-black/[0.06] bg-white/80" : "border-white/[0.08] bg-white/[0.04]"}`}>
                    {statusLabels[notification.financialStatus]}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 ${isLight ? "border-black/[0.06] bg-white/80" : "border-white/[0.08] bg-white/[0.04]"}`}>
                    {notification.date}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenDetails(notification.id)}
                    className={
                      isLight
                        ? "h-8 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-xs text-[#4B5563] hover:bg-white hover:text-[#050505]"
                        : "h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
                    }
                  >
                    <Eye className="size-3.5" />
                    Ver detalhes
                  </Button>
                  {!notification.lida && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="h-8 rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 text-xs text-[#009b3a] hover:bg-[#009b3a]/14"
                    >
                      Marcar como lida
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleArchive(notification.id)}
                    className={
                      isLight
                        ? "h-8 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-xs text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
                        : "h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/70 hover:bg-white/[0.08] hover:text-white"
                    }
                  >
                    <Archive className="size-3.5" />
                    Arquivar
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div
              className={
                isLight
                  ? "rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-8 text-center text-sm text-[#6B7280]"
                  : "rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55"
              }
            >
              Nenhuma notificação disponível.
            </div>
          )}
        </div>
      </PopoverContent>
      </Popover>
      <Dialog open={Boolean(selectedNotification)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className={isLight ? "max-w-lg border-black/[0.06] bg-white/95 text-[#050505]" : "max-w-lg border-white/[0.08] bg-[#111111] text-white"}>
          {selectedNotification ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedNotification.title}</DialogTitle>
                <DialogDescription className={isLight ? "text-[#6B7280]" : "text-white/55"}>{selectedNotification.date}</DialogDescription>
              </DialogHeader>
              <div className={isLight ? "rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4" : "rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4"}>
                <p className={`break-words text-sm leading-7 ${isLight ? "text-[#5F6B7A]" : "text-white/70"}`}>{selectedNotification.contextMessage || selectedNotification.message}</p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatusIcon({ status, tone }: { status: PaymentNotificationStatus; tone: "dark" | "light" }) {
  const isLight = tone === "light"

  if (status === "aguardando-regularizacao") {
    return (
      <div className={`flex size-9 items-center justify-center rounded-2xl border border-[#8ecae6]/20 bg-[#8ecae6]/10 ${isLight ? "text-[#277da1]" : "text-[#c9f0ff]"}`}>
        <CreditCard className="size-4" />
      </div>
    )
  }

  if (status === "atraso-leve" || status === "inadimplente") {
    return (
      <div className={`flex size-9 items-center justify-center rounded-2xl border border-[#ff6b6b]/20 bg-[#ff6b6b]/10 ${isLight ? "text-[#d94848]" : "text-[#ff9b9b]"}`}>
        <CircleAlert className="size-4" />
      </div>
    )
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
      <BellRing className="size-4" />
    </div>
  )
}
