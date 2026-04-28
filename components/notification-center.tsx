"use client"

import { useMemo, useState } from "react"
import { Archive, Bell, BellRing, CircleAlert, CreditCard, Eye } from "lucide-react"

import type {
  PaymentNotification,
  PaymentNotificationCategory,
  PaymentNotificationStatus,
} from "@/components/use-payment-notifications"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type NotificationCenterProps = {
  title: string
  notifications: PaymentNotification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onArchive: (id: string) => void
  onOpenDetails?: (id: string) => void
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
}: NotificationCenterProps) {
  const [feedback, setFeedback] = useState<string | null>(null)

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
    showFeedback("Detalhes da notificação atualizados")
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative h-8.5 w-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-0 text-white/75 hover:bg-white/[0.08] hover:text-white"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-[#00C853] px-1.5 py-0.5 text-[10px] font-semibold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[360px] rounded-[1.5rem] border border-white/[0.08] bg-[#101010]/96 p-0 text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      >
        <div className="border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs text-white/45">
                {unreadCount > 0
                  ? `${unreadCount} notificação${unreadCount > 1 ? "es" : ""} não lida${unreadCount > 1 ? "s" : ""}`
                  : "Tudo em ordem por aqui"}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
              <BellRing className="size-4.5" />
            </div>
          </div>
          {feedback && <p className="mt-3 text-xs text-[#69F0AE]">{feedback}</p>}
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
          {orderedNotifications.length > 0 ? (
            orderedNotifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-[1.25rem] border p-4 ${
                  notification.lida
                    ? "border-white/[0.08] bg-white/[0.03]"
                    : "border-[#00C853]/14 bg-[#00C853]/[0.05]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{notification.title}</p>
                      {!notification.lida && (
                        <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-2 py-0.5 text-[10px] text-[#69F0AE]">
                          Nova
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/58">{notification.message}</p>
                  </div>
                  <StatusIcon status={notification.financialStatus} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/45">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
                    {categoryLabels[notification.category]}
                  </span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
                    {statusLabels[notification.financialStatus]}
                  </span>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1">
                    {notification.date}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenDetails(notification.id)}
                    className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Eye className="size-3.5" />
                    Ver detalhes
                  </Button>
                  {!notification.lida && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="h-8 rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 px-3 text-xs text-[#69F0AE] hover:bg-[#00C853]/14"
                    >
                      Marcar como lida
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleArchive(notification.id)}
                    className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/70 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Archive className="size-3.5" />
                    Arquivar
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
              Nenhuma notificação disponível.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function StatusIcon({ status }: { status: PaymentNotificationStatus }) {
  if (status === "aguardando-regularizacao") {
    return (
      <div className="flex size-9 items-center justify-center rounded-2xl border border-[#8ecae6]/20 bg-[#8ecae6]/10 text-[#c9f0ff]">
        <CreditCard className="size-4" />
      </div>
    )
  }

  if (status === "atraso-leve" || status === "inadimplente") {
    return (
      <div className="flex size-9 items-center justify-center rounded-2xl border border-[#ff6b6b]/20 bg-[#ff6b6b]/10 text-[#ff9b9b]">
        <CircleAlert className="size-4" />
      </div>
    )
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
      <BellRing className="size-4" />
    </div>
  )
}
