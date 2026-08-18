"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Archive, ArrowRight, Bell, BellRing, CircleAlert, CreditCard, Eye } from "lucide-react"

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
  historyHref?: string
  relatedActionHref?: string
  tone?: "dark" | "light"
}

export const notificationStatusLabels: Record<PaymentNotificationStatus, string> = {
  "em-dia": "Em dia",
  "vencimento-proximo": "Vencendo",
  "atraso-leve": "Atraso leve",
  inadimplente: "Inadimplente",
  "notificacao-recebida": "Notificação recebida",
  "aguardando-regularizacao": "Aguardando regularização",
}

export const notificationCategoryLabels: Record<PaymentNotificationCategory, string> = {
  cobranca: "Cobrança",
  assinatura: "Assinatura",
  sistema: "Sistema",
  "aviso-administrativo": "Aviso administrativo",
  "confirmacao-pagamento": "Confirmação",
}

function notificationTime(notification: PaymentNotification) {
  const timestamp = notification.createdAt ? Date.parse(notification.createdAt) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}

function hasRelatedFinancialAction(notification: PaymentNotification) {
  return ["cobranca", "assinatura", "confirmacao-pagamento"].includes(notification.category)
}

export function NotificationCenter({
  title,
  notifications,
  unreadCount,
  onMarkAsRead,
  onArchive,
  onOpenDetails,
  historyHref,
  relatedActionHref,
  tone = "dark",
}: NotificationCenterProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isLight = tone === "light"

  const orderedNotifications = useMemo(
    () => [...notifications].sort((first, second) => notificationTime(second) - notificationTime(first)),
    [notifications],
  )
  const recentNotifications = orderedNotifications.slice(0, 5)
  const selectedNotification = orderedNotifications.find((notification) => notification.id === selectedId) ?? null

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
    if (selectedId === id) setSelectedId(null)
    showFeedback("Aviso arquivado")
  }

  function handleOpenDetails(id: string) {
    onMarkAsRead(id)
    onOpenDetails?.(id)
    if (!onOpenDetails) setSelectedId(id)
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label="Abrir notificações"
            className={
              isLight
                ? "relative h-8.5 w-8.5 rounded-xl border border-black/[0.06] bg-white/80 px-0 text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
                : "relative h-8.5 w-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-0 text-white/75 hover:bg-white/[0.08] hover:text-white"
            }
          >
            <Bell className="size-4.5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-[#009b3a] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className={
            isLight
              ? "w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white/95 p-0 text-[#050505] shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
              : "w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#101010]/96 p-0 text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
          }
        >
          <div className={`${isLight ? "border-b border-black/[0.06]" : "border-b border-white/[0.08]"} px-4 py-3`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${isLight ? "text-[#050505]" : "text-white"}`}>{title}</p>
                <p className={`mt-0.5 text-[11px] ${isLight ? "text-[#7B8491]" : "text-white/45"}`}>
                  {unreadCount > 0
                    ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`
                    : "Tudo em ordem por aqui"}
                </p>
              </div>
              <div className="flex size-8 items-center justify-center rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <BellRing className="size-4" />
              </div>
            </div>
            {feedback ? <p className="mt-2 text-[11px] text-[#009b3a]">{feedback}</p> : null}
          </div>

          <div className="max-h-[340px] space-y-1.5 overflow-y-auto p-2">
            {recentNotifications.length > 0 ? recentNotifications.map((notification) => (
              <article
                key={notification.id}
                className={`rounded-2xl border px-3 py-2.5 ${
                  notification.lida
                    ? isLight
                      ? "border-black/[0.05] bg-[#fbfbf8]"
                      : "border-white/[0.07] bg-white/[0.03]"
                    : "border-[#009b3a]/16 bg-[#009b3a]/[0.05]"
                }`}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <StatusIcon status={notification.financialStatus} tone={tone} compact />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`min-w-0 flex-1 truncate text-xs font-semibold ${isLight ? "text-[#111]" : "text-white"}`}>{notification.title}</p>
                      {!notification.lida ? <span className="size-1.5 shrink-0 rounded-full bg-[#009b3a]" aria-label="Não lida" /> : null}
                    </div>
                    <p className={`mt-1 line-clamp-2 text-[11px] leading-4 ${isLight ? "text-[#667085]" : "text-white/55"}`}>{notification.message}</p>
                    <p className={`mt-1.5 text-[10px] ${isLight ? "text-[#98a2b3]" : "text-white/35"}`}>
                      {notificationCategoryLabels[notification.category]} · {notification.date}
                    </p>
                  </div>
                </div>
                <div className={`mt-2 flex items-center gap-1 border-t pt-1.5 ${isLight ? "border-black/[0.04]" : "border-white/[0.06]"}`}>
                  <Button type="button" variant="ghost" onClick={() => handleOpenDetails(notification.id)} className={`h-7 rounded-lg px-2 text-[11px] ${isLight ? "text-[#4b5563]" : "text-white/70"}`}>
                    <Eye className="size-3" /> Detalhes
                  </Button>
                  {!notification.lida ? (
                    <Button type="button" variant="ghost" onClick={() => handleMarkAsRead(notification.id)} className="h-7 rounded-lg px-2 text-[11px] text-[#008633]">
                      Marcar lida
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" onClick={() => handleArchive(notification.id)} aria-label={`Arquivar ${notification.title}`} className={`ml-auto size-7 rounded-lg p-0 ${isLight ? "text-[#7b8491]" : "text-white/55"}`}>
                    <Archive className="size-3.5" />
                  </Button>
                </div>
              </article>
            )) : (
              <div className={isLight ? "rounded-2xl bg-[#fbfbf8] px-4 py-7 text-center text-sm text-[#6B7280]" : "rounded-2xl bg-white/[0.03] px-4 py-7 text-center text-sm text-white/55"}>
                Nenhuma notificação recente.
              </div>
            )}
          </div>

          {historyHref ? (
            <div className={`${isLight ? "border-t border-black/[0.06]" : "border-t border-white/[0.08]"} p-2`}>
              <Button asChild variant="ghost" className="h-9 w-full justify-between rounded-xl px-3 text-xs">
                <Link href={historyHref}>Ver todas <ArrowRight className="size-3.5" /></Link>
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <NotificationDetailDialog
        notification={selectedNotification}
        open={Boolean(selectedNotification)}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onArchive={handleArchive}
        relatedActionHref={relatedActionHref}
        tone={tone}
      />
    </>
  )
}

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  onArchive,
  relatedActionHref,
  tone = "light",
}: {
  notification: PaymentNotification | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onArchive?: (id: string) => void
  relatedActionHref?: string
  tone?: "dark" | "light"
}) {
  const isLight = tone === "light"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isLight ? "max-w-lg rounded-[1.5rem] border-black/[0.06] bg-white text-[#050505]" : "max-w-lg rounded-[1.5rem] border-white/[0.08] bg-[#111111] text-white"}>
        {notification ? (
          <>
            <DialogHeader className="pr-8">
              <div className="mb-2 flex items-center gap-2">
                <StatusIcon status={notification.financialStatus} tone={tone} />
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${notification.lida ? "bg-black/[0.05] text-[#667085]" : "bg-[#eaf7ee] text-[#008633]"}`}>
                  {notification.lida ? "Lida" : "Não lida"}
                </span>
              </div>
              <DialogTitle className="text-xl leading-tight">{notification.title}</DialogTitle>
              <DialogDescription className={isLight ? "text-[#6B7280]" : "text-white/55"}>{notification.date}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={isLight ? "rounded-xl bg-[#f7f8f5] p-3" : "rounded-xl bg-white/[0.04] p-3"}>
                <p className={isLight ? "text-[#98a2b3]" : "text-white/40"}>Origem</p>
                <p className="mt-1 font-medium">Portal EME</p>
              </div>
              <div className={isLight ? "rounded-xl bg-[#f7f8f5] p-3" : "rounded-xl bg-white/[0.04] p-3"}>
                <p className={isLight ? "text-[#98a2b3]" : "text-white/40"}>Tipo</p>
                <p className="mt-1 font-medium">{notificationCategoryLabels[notification.category]}</p>
              </div>
            </div>

            <div className={isLight ? "rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4" : "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"}>
              <p className={`text-[11px] uppercase tracking-[0.14em] ${isLight ? "text-[#98a2b3]" : "text-white/40"}`}>Contexto</p>
              <p className={`mt-2 break-words text-sm leading-6 ${isLight ? "text-[#475467]" : "text-white/70"}`}>{notification.contextMessage || notification.message}</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {onArchive && !notification.archived ? (
                <Button type="button" variant="ghost" onClick={() => onArchive(notification.id)} className="rounded-xl border border-black/[0.06] text-[#5f6b7a]">
                  <Archive className="size-4" /> Arquivar
                </Button>
              ) : null}
              {relatedActionHref && hasRelatedFinancialAction(notification) ? (
                <Button asChild className="rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
                  <Link href={relatedActionHref}>Ver plano <ArrowRight className="size-4" /></Link>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function StatusIcon({ status, tone, compact = false }: { status: PaymentNotificationStatus; tone: "dark" | "light"; compact?: boolean }) {
  const isLight = tone === "light"
  const size = compact ? "size-7 rounded-lg" : "size-9 rounded-xl"

  if (status === "aguardando-regularizacao") {
    return <div className={`flex ${size} shrink-0 items-center justify-center border border-[#8ecae6]/20 bg-[#8ecae6]/10 ${isLight ? "text-[#277da1]" : "text-[#c9f0ff]"}`}><CreditCard className="size-4" /></div>
  }
  if (status === "atraso-leve" || status === "inadimplente") {
    return <div className={`flex ${size} shrink-0 items-center justify-center border border-[#ff6b6b]/20 bg-[#ff6b6b]/10 ${isLight ? "text-[#d94848]" : "text-[#ff9b9b]"}`}><CircleAlert className="size-4" /></div>
  }
  return <div className={`flex ${size} shrink-0 items-center justify-center border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]`}><BellRing className="size-4" /></div>
}
