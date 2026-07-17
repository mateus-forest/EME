"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Sparkles,
  UsersRound,
} from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { CosPromptComposer } from "@/components/cos-prompt-composer"
import { NotificationCenter } from "@/components/notification-center"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { AssistantCredits, useCosConversations } from "@/components/use-cos-conversations"
import { DEFAULT_COS_CONVERSATION_TITLE } from "@/lib/cos-conversations"

type AgendaEventItem = {
  id: string
  title: string
  date: string
  time: string
  status: string
}

type AssistantBootstrapResponse = {
  credits?: AssistantCredits
  aiAssistantEnabled?: boolean
  error?: string
}

type NextStepSuggestion =
  | { label: string; message: string; focusOnly?: false }
  | { label: string; focusOnly: true; message?: never }

export function BrokerPortal() {
  const { properties } = useBrokerProperties()
  const { profile } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const {
    historyNotifications,
    unreadCount,
    markAsRead,
    archive,
    financialSummary,
  } = useBrokerPaymentNotifications()
  const [prompt, setPrompt] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [isNextStepModalOpen, setIsNextStepModalOpen] = useState(false)
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>([])
  const [assistantCredits, setAssistantCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [assistantEnabled, setAssistantEnabled] = useState(true)
  const chatViewportRef = useRef<HTMLDivElement>(null)

  const {
    conversation,
    conversations,
    activeConversationId,
    pendingConfirmation,
    chatFeedback,
    isSending,
    isConversationLoading,
    inputRef,
    setChatFeedback,
    createConversation,
    sendCosMessage,
    confirmPendingAction,
    cancelPendingAction,
  } = useCosConversations({
    assistantEnabled,
    assistantCredits,
    setAssistantCredits,
  })

  const publishedPropertiesCount = useMemo(
    () => properties.filter((property) => property.status === "Publicado").length,
    [properties],
  )
  const hasReachedLimit =
    subscription.isProfileResolved &&
    !subscription.isUpgraded &&
    publishedPropertiesCount >= (subscription.propertyLimit ?? 3)

  const totalLeads = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.leads || 0), 0),
    [properties],
  )

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/agenda?filter=all", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { events?: AgendaEventItem[] } | null
        if (!ignore && response.ok) setAgendaEvents(data?.events ?? [])
      })
      .catch(() => null)

    fetch("/api/assistant/eme", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as AssistantBootstrapResponse | null
        if (!ignore && response.ok) {
          if (data?.credits) setAssistantCredits(data.credits)
          if (typeof data?.aiAssistantEnabled === "boolean") setAssistantEnabled(data.aiAssistantEnabled)
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const viewport = chatViewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [conversation, isSending, isConversationLoading])

  const brokerFirstName = useMemo(() => {
    const [firstName] = profile.fullName.trim().split(" ").filter(Boolean)
    return firstName || "Corretor"
  }, [profile.fullName])

  const upcomingAppointmentsCount = useMemo(
    () => agendaEvents.filter((event) => event.status !== "cancelled").length,
    [agendaEvents],
  )

  const contextMetrics = useMemo(
    () => [
      { label: "Clientes", value: totalLeads.toLocaleString("pt-BR") },
      { label: "Operacoes", value: String(upcomingAppointmentsCount) },
      { label: "Balanco", value: financialSummary.currentAmount.replace("R$", "").trim() || "0,00" },
      { label: "Imoveis", value: String(publishedPropertiesCount) },
    ],
    [financialSummary.currentAmount, publishedPropertiesCount, totalLeads, upcomingAppointmentsCount],
  )

  const contextFeed = useMemo(() => historyNotifications.slice(0, 5), [historyNotifications])

  const quickActions = [
    {
      label: "Proximo passo",
      icon: Sparkles,
      onClick: () => setIsNextStepModalOpen(true),
    },
    {
      label: "Studio IA",
      icon: Bot,
      href: "/corretor/studio-ia",
    },
    {
      label: "Novo imovel",
      icon: Building2,
      href: "/corretor/novo-imovel",
      onClick: hasReachedLimit ? () => setIsLimitModalOpen(true) : undefined,
    },
    {
      label: "Compromissos",
      icon: CalendarDays,
      href: "/corretor/agenda",
    },
  ]

  const nextStepSuggestions: NextStepSuggestion[] = [
    { label: "Ver proximos compromissos", message: "Minha agenda de amanha" },
    { label: "Analisar carteira", message: "Analisar carteira" },
    { label: "Revisar clientes", message: "Revisar clientes" },
    { label: "Consultar desempenho", message: "Consultar desempenho" },
    { label: "Analisar financeiro", message: "Analisar financeiro" },
    { label: "Ver notificacoes", message: "Minhas notificacoes" },
    { label: "Conversar com o COS", focusOnly: true },
  ]

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )

  async function handleSubmit() {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setChatFeedback("Digite uma mensagem para o COS.")
      return
    }

    await sendCosMessage(normalizedPrompt)
    setPrompt("")
  }

  async function handleNextStepSuggestion(selection: NextStepSuggestion) {
    setIsNextStepModalOpen(false)

    if (selection.focusOnly) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    await sendCosMessage(selection.message, { visibleMessage: selection.label })
  }

  return (
    <>
      <BrokerPageShell title="COS" variant="cos" contentClassName="overflow-hidden">
        <section className="grid min-h-full w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-h-full items-start justify-center bg-[#f4f1eb] px-6 py-8 lg:px-12 lg:py-12">
            <div className="flex w-full max-w-5xl flex-col items-center">
              <div className="flex size-7 items-center justify-center text-[#111111]">
                <Sparkles className="size-4" />
              </div>
              <h2 className="mt-6 text-center text-[2.1rem] font-semibold tracking-tight text-[#111111]">
                Ola, {brokerFirstName}
              </h2>
              <p className="mt-2 text-center text-[15px] text-[#70809a]">O que voce deseja fazer hoje?</p>

              <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  const className =
                    "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d9dde5] bg-white px-5 text-sm font-medium text-[#2f3a4d] transition-colors hover:bg-[#f8f9fb]"

                  if (action.onClick) {
                    return (
                      <button key={action.label} type="button" onClick={action.onClick} className={className}>
                        <Icon className="size-4 text-[#5e6d82]" />
                        {action.label}
                      </button>
                    )
                  }

                  return (
                    <Link key={action.label} href={action.href ?? "#"} className={className}>
                      <Icon className="size-4 text-[#5e6d82]" />
                      {action.label}
                    </Link>
                  )
                })}
              </div>

              <div className="mt-8 w-full max-w-[60rem]">
                <div className="flex items-center justify-between px-6 text-sm text-[#91a0b5]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Atalhos inteligentes
                  </div>
                  <button type="button" className="transition-colors hover:text-[#111111]">
                    Editar
                  </button>
                </div>
                <div className="mt-3 rounded-[1.8rem] bg-white px-8 py-6 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {contextMetrics.map((item) => (
                      <div key={item.label} className="flex flex-col items-center justify-center text-center">
                        <UsersRound className="size-4 text-[#9aa8bd]" />
                        <p className="mt-3 text-[2rem] font-semibold leading-none text-[#111111]">{item.value}</p>
                        <p className="mt-1 text-sm text-[#6f7f97]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 w-full max-w-[60rem]">
                <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
                  <div className="border-b border-black/[0.05] px-6 py-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[1.05rem] font-semibold text-[#111111]">
                          {activeConversation?.title || DEFAULT_COS_CONVERSATION_TITLE}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a8798]">
                        <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">
                          {assistantEnabled ? "COS ativo" : "COS pausado"}
                        </span>
                        <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">
                          {assistantCredits.balance} creditos
                        </span>
                      </div>
                    </div>
                  </div>

                  <div ref={chatViewportRef} className="max-h-[26rem] space-y-4 overflow-y-auto px-6 py-5">
                    {isConversationLoading ? (
                      <div className="rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] px-5 py-4 text-sm leading-7 text-[#6f7f97]">
                        Carregando conversa...
                      </div>
                    ) : null}

                    {!isConversationLoading && conversation.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-5 py-4 text-sm leading-7 text-[#6f7f97]">
                        Inicie uma nova conversa com o COS.
                      </div>
                    ) : null}

                    {!isConversationLoading &&
                      conversation.map((item) => (
                        <div
                          key={item.id}
                          className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm ${
                              item.role === "user"
                                ? "bg-[#111111] text-white"
                                : item.state === "error"
                                  ? "border border-red-500/15 bg-red-50 text-red-700"
                                  : "border border-black/[0.06] bg-[#fbfbf8] text-[#334155]"
                            }`}
                          >
                            <p>{item.content}</p>
                            {item.role === "assistant" && item.actionStatus ? (
                              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8a97a8]">
                                {formatCosStatus(item.actionStatus)}
                              </p>
                            ) : null}
                            {item.confirmRequired && pendingConfirmation?.sourceMessage === item.sourceMessage ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  onClick={() => void confirmPendingAction()}
                                  disabled={isSending}
                                  className="h-9 rounded-full bg-[#111111] px-4 text-xs font-semibold text-white hover:bg-[#050505] disabled:opacity-60"
                                >
                                  Confirmar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => void cancelPendingAction()}
                                  disabled={isSending}
                                  className="h-9 rounded-full border border-black/[0.08] px-4 text-xs text-[#4B5563] hover:bg-white"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}

                    {isSending ? (
                      <div className="flex justify-start">
                        <div className="rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#6f7f97]">
                          COS analisando...
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <CosPromptComposer
                    prompt={prompt}
                    setPrompt={setPrompt}
                    onSubmit={handleSubmit}
                    onNewConversation={async () => {
                      await createConversation()
                    }}
                    quickActions={[
                      { label: "Buscar imovel", message: "Buscar imovel: apartamento ate 900 mil em Porto Alegre" },
                      { label: "Minha agenda", message: "Minha agenda de amanha" },
                      { label: "Analisar financeiro", message: "Analisar financeiro" },
                      { label: "Ver notificacoes", message: "Minhas notificacoes" },
                    ]}
                    disabled={isSending || isConversationLoading}
                    inputRef={inputRef}
                    feedback={chatFeedback}
                  />
                </div>

                {hasReachedLimit ? (
                  <div className="mt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsLimitModalOpen(true)}
                      className="rounded-full text-sm text-[#5f6d82]"
                    >
                      Limite do plano atingido
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="hidden border-l border-black/[0.06] bg-white lg:flex lg:min-h-full lg:flex-col">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-5">
              <h3 className="text-[1.05rem] font-semibold text-[#111111]">Contexto</h3>
              <NotificationCenter
                title="Notificacoes do corretor"
                notifications={historyNotifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onArchive={archive}
                tone="light"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
                  <span className="text-[#9aa6b6]">$</span>
                  Financeiro
                </div>
                <div className="rounded-[1.7rem] bg-[#111111] px-5 py-4 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm">Saldo final</span>
                    <span className="text-[1.05rem] font-semibold">{financialSummary.currentAmount}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2.5">
                  <ContextRow label="Ganhos" value={financialSummary.currentAmount} valueClassName="text-[#16a34a]" />
                  <ContextRow
                    label="Gastos"
                    value={financialSummary.valueOpen ?? "R$ 0,00"}
                    valueClassName="text-[#ef4444]"
                  />
                  <ContextRow label="Saldo anterior" value={financialSummary.currentAmount} />
                </div>
                <p className="mt-3 text-sm text-[#91a0b5]">
                  {historyNotifications.length} atividade(s) registrada(s) no workspace.
                </p>
              </div>

              <div className="mt-7">
                <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
                  <ClockBadge />
                  Atividades recentes
                </div>
                <div className="grid gap-5">
                  {contextFeed.length > 0 ? (
                    contextFeed.map((notification) => (
                      <div key={notification.id} className="flex gap-3">
                        <span className="mt-2 size-2 shrink-0 rounded-full bg-[#4c83ff]" />
                        <div>
                          <p className="text-[15px] text-[#24324a]">{notification.title.toLowerCase()}</p>
                          <p className="mt-1 text-sm text-[#91a0b5]">{notification.date}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#91a0b5]">Sem atividades recentes.</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
      <Dialog open={isNextStepModalOpen} onOpenChange={setIsNextStepModalOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white p-0 text-[#111111] shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:max-h-[calc(100vh-4rem)]">
          <div className="max-h-[calc(100vh-2rem)] overflow-y-auto px-6 py-6 sm:max-h-[calc(100vh-4rem)]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-tight text-[#111111]">
                Proximo passo com o COS
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-[#6B7280]">
                Escolha uma sugestao inteligente para iniciar a conversa agora mesmo na Home.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-3">
              {nextStepSuggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => void handleNextStepSuggestion(suggestion)}
                  className="flex items-center justify-between rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4 text-left transition-colors hover:bg-white hover:border-black/[0.1]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#111111]">{suggestion.label}</p>
                    <p className="mt-1 text-sm text-[#7B8491]">
                      {suggestion.focusOnly ? "Fechar e continuar a conversa manualmente." : "Enviar essa sugestao para o COS."}
                    </p>
                  </div>
                  <Sparkles className="size-4 shrink-0 text-[#7B8491]" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ContextRow({
  label,
  value,
  valueClassName = "text-[#40516d]",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-[1.5rem] bg-[#f8f8f8] px-4 py-4">
      <span className="text-sm text-[#7d8aa0]">{label}</span>
      <span className={`text-[0.95rem] font-semibold ${valueClassName}`}>{value}</span>
    </div>
  )
}

function ClockBadge() {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full border border-[#b6c0d0] text-[#8b98ab]">
      <ArrowRight className="size-3 rotate-90" />
    </span>
  )
}

function formatCosStatus(status: string) {
  if (status === "needs_confirmation") return "Aguardando confirmacao"
  if (status === "processing") return "Em processamento"
  if (status === "unsupported") return "Fora do escopo da Home"
  if (status === "error") return "Erro"
  if (status === "cancelled") return "Cancelado"
  return "Concluido"
}
