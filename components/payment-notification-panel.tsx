"use client"

import { useMemo, useState } from "react"
import { AlertCircle, BellRing, CheckCircle2, Clock3, CreditCard, Eye, X } from "lucide-react"

import type { PaymentNotification } from "@/components/use-payment-notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isFinancialNotification } from "@/lib/notification-contract"

type PaymentNotificationPanelProps = {
  entityLabel: string
  dismissLabel: string
  notifications: PaymentNotification[]
  primaryNotification: PaymentNotification | null
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
  onRegularize: (id: string) => void
}

const statusStyles = {
  "em-dia": {
    label: "Pagamento em dia",
    chip: "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]",
    icon: CheckCircle2,
    accent: "text-[#69F0AE]",
  },
  "vencimento-proximo": {
    label: "Vencimento próximo",
    chip: "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]",
    icon: Clock3,
    accent: "text-[#69F0AE]",
  },
  "atraso-leve": {
    label: "Atraso leve",
    chip: "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]",
    icon: AlertCircle,
    accent: "text-[#ffe082]",
  },
  inadimplente: {
    label: "Inadimplente",
    chip: "border-[#ff6b6b]/20 bg-[#ff6b6b]/10 text-[#ff9b9b]",
    icon: AlertCircle,
    accent: "text-[#ff9b9b]",
  },
  "notificacao-recebida": {
    label: "Notificação recebida",
    chip: "border-white/[0.08] bg-white/[0.06] text-white/80",
    icon: BellRing,
    accent: "text-white",
  },
  "aguardando-regularizacao": {
    label: "Aguardando regularização",
    chip: "border-[#8ecae6]/20 bg-[#8ecae6]/10 text-[#c9f0ff]",
    icon: CreditCard,
    accent: "text-[#c9f0ff]",
  },
} as const

export function PaymentNotificationPanel({
  entityLabel,
  dismissLabel,
  notifications,
  primaryNotification,
  unreadCount,
  onMarkAsRead,
  onDismiss,
  onRegularize,
}: PaymentNotificationPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const orderedNotifications = useMemo(
    () => [...notifications].sort((first, second) => Number(first.lida) - Number(second.lida)),
    [notifications],
  )

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2200)
  }

  function handleDetails(id: string) {
    setExpandedId((current) => (current === id ? null : id))
    onMarkAsRead(id)
    showFeedback("Notificação marcada como lida")
  }

  function handleRegularize(id: string) {
    onRegularize(id)
    setExpandedId(id)
    showFeedback("Redirecionamento para regularização em breve")
  }

  function handleDismiss(id: string) {
    onDismiss(id)
    setExpandedId((current) => (current === id ? null : current))
    showFeedback("Aviso removido")
  }

  function canRegularize(notification: PaymentNotification) {
    return (
      isFinancialNotification(notification) &&
      (notification.financialStatus === "atraso-leve" ||
        notification.financialStatus === "inadimplente" ||
        notification.financialStatus === "vencimento-proximo")
    )
  }

  if (!primaryNotification && notifications.length === 0) {
    return null
  }

  return (
    <div className="mb-6 grid gap-4">
      {feedback && (
        <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          {feedback}
        </div>
      )}

      {primaryNotification && (
        <div className="rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(14,14,14,0.94))] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] ${statusStyles[primaryNotification.financialStatus].accent}`}
              >
                {(() => {
                  const Icon = statusStyles[primaryNotification.financialStatus].icon
                  return <Icon className="size-4.5" />
                })()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm uppercase tracking-[0.2em] text-white/40">
                    {isFinancialNotification(primaryNotification) ? entityLabel : "Notificações"}
                  </p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${statusStyles[primaryNotification.financialStatus].chip}`}
                  >
                    {statusStyles[primaryNotification.financialStatus].label}
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65">
                      {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">{primaryNotification.title}</h3>
                <p className="mt-1 text-sm leading-6 text-white/60">{primaryNotification.message}</p>
                <p className="mt-2 text-xs text-white/35">{primaryNotification.date}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleDetails(primaryNotification.id)}
                className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
              >
                <Eye className="size-4" />
                Ver detalhes
              </Button>
              {canRegularize(primaryNotification) && (
                <Button
                  type="button"
                  onClick={() => handleRegularize(primaryNotification.id)}
                  className="h-9 rounded-xl bg-[#00C853] px-3 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  Regularizar pagamento
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleDismiss(primaryNotification.id)}
                className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-4" />
                {dismissLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
        <CardHeader className="px-6 py-5">
          <CardTitle className="text-xl text-white">Atividades recentes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 pt-0">
          {orderedNotifications.map((notification) => {
            const status = statusStyles[notification.financialStatus]
            const isExpanded = expandedId === notification.id

            return (
              <div
                key={notification.id}
                className={`rounded-[1.25rem] border p-4 transition-colors ${
                  notification.lida
                    ? "border-white/[0.08] bg-white/[0.03]"
                    : "border-[#00C853]/14 bg-[#00C853]/[0.05]"
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{notification.title}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${status.chip}`}>
                        {status.label}
                      </span>
                      {!notification.lida && (
                        <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-2.5 py-1 text-[11px] text-[#69F0AE]">
                          Não lida
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/58">{notification.message}</p>
                    <p className="mt-2 text-xs text-white/35">{notification.date}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleDetails(notification.id)}
                      className="h-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
                    >
                      Ver detalhes
                    </Button>
                    {canRegularize(notification) && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRegularize(notification.id)}
                        className="h-8.5 rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 px-3 text-xs text-[#69F0AE] hover:bg-[#00C853]/14"
                      >
                        Regularizar pagamento
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleDismiss(notification.id)}
                      className="h-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/70 hover:bg-white/[0.08] hover:text-white"
                    >
                      {dismissLabel}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 rounded-[1rem] border border-white/[0.08] bg-black/20 p-4 text-sm text-white/62">
                    <div className="flex flex-wrap gap-2">
                      <InfoBadge label={`Prioridade ${notification.priority}`} />
                      <InfoBadge label={notification.lida ? "Lida" : "Não lida"} />
                      <InfoBadge label={`Categoria ${notification.category}`} />
                      {notification.financialStatus === "notificacao-recebida" && (
                        <InfoBadge label="Notificação recebida" />
                      )}
                      {notification.financialStatus === "aguardando-regularizacao" && (
                        <InfoBadge label="Pagamento aguardando compensação" />
                      )}
                    </div>
                    <p className="mt-3 leading-6">
                      {isFinancialNotification(notification)
                        ? "Este aviso acompanha o status de pagamento e assinatura da sua conta."
                        : "Este aviso acompanha uma atividade operacional recente da sua conta."}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
      {label}
    </span>
  )
}
