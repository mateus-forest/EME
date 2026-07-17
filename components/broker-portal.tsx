"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UsersRound,
} from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { NotificationCenter } from "@/components/notification-center"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_COS_CONVERSATION_TITLE } from "@/lib/cos-conversations"

type AgendaEventItem = {
  id: string
  title: string
  date: string
  time: string
  status: string
}

type AssistantCredits = {
  balance: number
  usedThisMonth: number
}

type AssistantBootstrapResponse = {
  credits?: AssistantCredits
  aiAssistantEnabled?: boolean
  error?: string
}

type CosConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastInteractionAt: string
}

type AssistantMessageResponse = {
  response?: string
  action?: string
  actionStatus?: string
  credits?: AssistantCredits
  creditsUsed?: number
  error?: string
  confirmRequired?: boolean
  conversation?: CosConversationSummary | null
}

type ConversationDetailResponse = {
  conversation?: CosConversationSummary
  messages?: CosConversationItem[]
  pendingConfirmation?: PendingConfirmation | null
  error?: string
}

type ConversationListResponse = {
  conversations?: CosConversationSummary[]
  conversation?: CosConversationSummary
  error?: string
}

type CosConversationItem = {
  id: string
  role: "user" | "assistant"
  content: string
  state: "ready" | "error"
  action?: string | null
  actionStatus?: string | null
  confirmRequired?: boolean
  sourceMessage?: string
  createdAt?: string
}

type PendingConfirmation = {
  action: string
  sourceMessage: string
}

type NextStepSuggestion =
  | { label: string; message: string; focusOnly?: false }
  | { label: string; focusOnly: true; message?: never }

const CONVERSATION_GROUP_ORDER = ["Hoje", "Ontem", "Ultimos 7 dias", "Este mes", "Anteriores"] as const

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
  const [conversation, setConversation] = useState<CosConversationItem[]>([])
  const [conversations, setConversations] = useState<CosConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [conversationSearch, setConversationSearch] = useState("")
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [chatFeedback, setChatFeedback] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatViewportRef = useRef<HTMLDivElement>(null)

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

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/assistant/eme/conversations", {
      credentials: "include",
      cache: "no-store",
    })

    const data = (await response.json().catch(() => null)) as ConversationListResponse | null
    if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar o historico do COS.")

    const nextConversations = data?.conversations ?? []
    setConversations(nextConversations)
    return nextConversations
  }, [])

  const openConversation = useCallback(async (conversationId: string) => {
    setIsConversationLoading(true)
    setChatFeedback("")

    try {
      const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationDetailResponse | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel abrir a conversa.")

      setConversation(data?.messages ?? [])
      setPendingConfirmation(data?.pendingConfirmation ?? null)
      setActiveConversationId(conversationId)
    } catch (caughtError) {
      setChatFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel abrir a conversa.")
    } finally {
      setIsConversationLoading(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [])

  const createConversation = useCallback(async () => {
    const response = await fetch("/api/assistant/eme/conversations", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
    const data = (await response.json().catch(() => null)) as ConversationListResponse | null
    if (!response.ok || !data?.conversation) {
      throw new Error(data?.error || "Nao foi possivel criar a conversa.")
    }

    setConversations((current) => [data.conversation!, ...current.filter((item) => item.id !== data.conversation!.id)])
    setActiveConversationId(data.conversation.id)
    setConversation([])
    setPendingConfirmation(null)
    setChatFeedback("")
    setPrompt("")
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return data.conversation
  }, [])

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

    loadConversations()
      .then((items) => {
        if (!ignore && items[0]) {
          return openConversation(items[0].id)
        }
        return null
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [loadConversations, openConversation])

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

  const suggestedPrompts = [
    "Buscar imovel: apartamento ate 900 mil em Porto Alegre",
    "Minha agenda de amanha",
    "Analisar financeiro",
    "Minhas notificacoes",
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

  const filteredConversations = useMemo(() => {
    const normalizedSearch = normalizeSearchText(conversationSearch)
    if (!normalizedSearch) return conversations

    return conversations.filter((item) => normalizeSearchText(item.title).includes(normalizedSearch))
  }, [conversationSearch, conversations])

  const groupedConversations = useMemo(() => {
    const groups = new Map<string, CosConversationSummary[]>()

    for (const conversationItem of filteredConversations) {
      const group = getConversationGroupLabel(conversationItem.lastInteractionAt)
      const bucket = groups.get(group) ?? []
      bucket.push(conversationItem)
      groups.set(group, bucket)
    }

    return CONVERSATION_GROUP_ORDER
      .map((label) => ({
        label,
        items: groups.get(label) ?? [],
      }))
      .filter((group) => group.items.length > 0)
  }, [filteredConversations])

  async function renameConversation(conversationId: string, currentTitle: string) {
    const nextTitle = window.prompt("Novo titulo da conversa", currentTitle)?.trim()
    if (!nextTitle || nextTitle === currentTitle) return

    try {
      const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ title: nextTitle }),
      })
      const data = (await response.json().catch(() => null)) as ConversationListResponse | null
      if (!response.ok || !data?.conversation) throw new Error(data?.error || "Nao foi possivel renomear a conversa.")

      setConversations((current) =>
        current.map((item) => (item.id === conversationId ? data.conversation! : item)),
      )
    } catch (caughtError) {
      setChatFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel renomear a conversa.")
    }
  }

  async function deleteConversation(conversationId: string) {
    if (!window.confirm("Deseja excluir esta conversa do COS?")) return

    try {
      const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel excluir a conversa.")

      const nextConversations = conversations.filter((item) => item.id !== conversationId)
      setConversations(nextConversations)

      if (activeConversationId === conversationId) {
        setActiveConversationId("")
        setConversation([])
        setPendingConfirmation(null)

        if (nextConversations[0]) {
          await openConversation(nextConversations[0].id)
        }
      }
    } catch (caughtError) {
      setChatFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel excluir a conversa.")
    }
  }

  async function sendCosMessage(
    messageToSend: string,
    options?: { confirm?: boolean; action?: string; visibleMessage?: string; cancel?: boolean },
  ) {
    const normalizedMessage = messageToSend.trim()
    if (!normalizedMessage || isSending) return

    if (!options?.cancel && !assistantEnabled) {
      setChatFeedback("Ative o Assessor EME para conversar com o COS.")
      return
    }

    if (!options?.cancel && assistantCredits.balance <= 0) {
      setChatFeedback("Creditos insuficientes para usar o COS agora.")
      return
    }

    const visibleMessage = options?.visibleMessage ?? normalizedMessage
    const optimisticUserMessage: CosConversationItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: visibleMessage,
      state: "ready",
      createdAt: new Date().toISOString(),
    }

    setConversation((current) => [...current, optimisticUserMessage])
    setIsSending(true)
    setChatFeedback("")
    setPrompt("")

    try {
      const response = await fetch("/api/assistant/eme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          message: normalizedMessage,
          displayMessage: visibleMessage,
          action: options?.action,
          confirm: Boolean(options?.confirm),
          cancel: Boolean(options?.cancel),
          source: "cos_home",
          conversationId: activeConversationId || undefined,
        }),
      })

      const data = (await response.json().catch(() => null)) as AssistantMessageResponse | null
      if (data?.credits) setAssistantCredits(data.credits)
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel falar com o COS agora.")

      if (data?.conversation) {
        setActiveConversationId(data.conversation.id)
      }

      const assistantMessage: CosConversationItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.response || "Nao consegui responder agora.",
        state: "ready",
        action: data?.action ?? options?.action ?? null,
        actionStatus: data?.actionStatus ?? "success",
        confirmRequired: Boolean(data?.confirmRequired),
        sourceMessage: normalizedMessage,
        createdAt: new Date().toISOString(),
      }

      setConversation((current) => [...current, assistantMessage])

      if (data?.confirmRequired && assistantMessage.action) {
        setPendingConfirmation({
          action: assistantMessage.action,
          sourceMessage: normalizedMessage,
        })
        setChatFeedback("Confirmacao pendente para alterar dados.")
      } else {
        setPendingConfirmation(null)
        setChatFeedback(
          data?.creditsUsed
            ? `${formatCosAction(data?.action || options?.action || "general")} -${data.creditsUsed} credito IA`
            : options?.cancel
              ? "Alteracao cancelada."
              : "",
        )
      }

      const nextConversations = await loadConversations()
      if (!activeConversationId && data?.conversation?.id && !nextConversations.some((item) => item.id === data.conversation?.id)) {
        setConversations(nextConversations)
      }
    } catch (caughtError) {
      const messageText =
        caughtError instanceof Error ? caughtError.message : "Nao foi possivel falar com o COS agora."

      setConversation((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: messageText,
          state: "error",
          actionStatus: "error",
          sourceMessage: normalizedMessage,
          createdAt: new Date().toISOString(),
        },
      ])
      setChatFeedback(messageText)
    } finally {
      setIsSending(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setChatFeedback("Digite uma mensagem para o COS.")
      return
    }
    await sendCosMessage(normalizedPrompt)
  }

  async function confirmPendingAction() {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      confirm: true,
      action: pendingConfirmation.action,
      visibleMessage: "Confirmar",
    })
  }

  async function cancelPendingAction() {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      cancel: true,
      action: pendingConfirmation.action,
      visibleMessage: "Cancelar",
    })
  }

  function hydratePrompt(nextPrompt: string) {
    setPrompt(nextPrompt)
    window.setTimeout(() => inputRef.current?.focus(), 0)
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
        <section className="grid min-h-full w-full grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
          <aside className="hidden border-r border-black/[0.06] bg-white lg:flex lg:min-h-full lg:flex-col">
            <div className="border-b border-black/[0.06] px-4 py-4">
              <Button
                type="button"
                onClick={() => void createConversation()}
                className="h-11 w-full justify-start rounded-2xl bg-[#111111] px-4 text-sm font-semibold text-white hover:bg-[#050505]"
              >
                <Plus className="mr-2 size-4" />
                Nova conversa
              </Button>

              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                <Search className="size-4 text-[#97A3B6]" />
                <Input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder="Pesquisar conversas"
                  className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-[#111111] shadow-none placeholder:text-[#8A97A8] focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {groupedConversations.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-4 py-4 text-sm leading-6 text-[#7B8491]">
                  {conversationSearch.trim() ? "Nenhuma conversa encontrada." : "Suas conversas com o COS aparecerao aqui automaticamente."}
                </div>
              ) : (
                groupedConversations.map((group) => (
                  <div key={group.label} className="mb-5 last:mb-0">
                    <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#97A3B6]">
                      {group.label}
                    </p>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const isActive = item.id === activeConversationId

                        return (
                          <div
                            key={item.id}
                            className={`group rounded-[1.25rem] border transition ${
                              isActive
                                ? "border-[#009b3a]/20 bg-[#009b3a]/8"
                                : "border-transparent bg-transparent hover:border-black/[0.06] hover:bg-[#fbfbf8]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void openConversation(item.id)}
                              className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left"
                            >
                              <span className={`line-clamp-2 text-sm ${isActive ? "font-semibold text-[#111111]" : "text-[#334155]"}`}>
                                {item.title}
                              </span>
                              <span className="text-xs text-[#8A97A8]">{formatConversationTimestamp(item.lastInteractionAt)}</span>
                            </button>
                            <div className="flex items-center gap-1 px-3 pb-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => void renameConversation(item.id, item.title)}
                                className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.06] bg-white text-[#6B7280] hover:bg-[#F8F9FB]"
                                aria-label="Renomear conversa"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteConversation(item.id)}
                                className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.06] bg-white text-[#6B7280] hover:bg-[#F8F9FB]"
                                aria-label="Excluir conversa"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <div className="flex min-h-full items-start justify-center bg-[#f4f1eb] px-6 py-8 lg:px-10 lg:py-10 xl:px-12 xl:py-12">
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
                        <p className="mt-1 text-sm text-[#7a8798]">
                          Converse com o COS, consulte a operacao e continue conversas anteriores com o contexto restaurado.
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
                        Posso ajudar com busca de imoveis, agenda, clientes, desempenho, financeiro, notificacoes e acoes operacionais com confirmacao.
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

                  <div className="border-t border-black/[0.05] px-6 py-5">
                    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 rounded-full bg-[#fbfbf8] px-5 py-4">
                        <MessageCircle className="size-5 text-[#9aa6b6]" />
                        <Input
                          ref={inputRef}
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                          placeholder="Fale com o COS..."
                          className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] text-[#111111] shadow-none outline-none placeholder:text-[#7a8798] focus-visible:ring-0"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          disabled={isSending || isConversationLoading}
                          className="size-11 shrink-0 rounded-full bg-[#111111] text-white shadow-none hover:bg-[#050505] disabled:opacity-60"
                          aria-label="Enviar mensagem ao COS"
                        >
                          <Send className="size-4" />
                        </Button>
                      </div>

                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {suggestedPrompts.map((example) => (
                            <button
                              key={example}
                              type="button"
                              onClick={() => hydratePrompt(example)}
                              className="rounded-full border border-black/[0.06] bg-white px-3 py-1.5 text-xs text-[#5f6d82] transition-colors hover:bg-[#f8f9fb]"
                            >
                              {example}
                            </button>
                          ))}
                        </div>
                        {chatFeedback ? <p className="text-sm text-[#009b3a]">{chatFeedback}</p> : null}
                      </div>
                    </form>
                  </div>
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

          <aside className="hidden border-l border-black/[0.06] bg-white xl:flex xl:min-h-full xl:flex-col">
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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getConversationGroupLabel(isoDate: string) {
  const now = new Date()
  const target = new Date(isoDate)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compared = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffDays = Math.floor((today.getTime() - compared.getTime()) / 86_400_000)

  if (diffDays <= 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  if (diffDays <= 7) return "Ultimos 7 dias"
  if (today.getFullYear() === compared.getFullYear() && today.getMonth() === compared.getMonth()) return "Este mes"
  return "Anteriores"
}

function formatConversationTimestamp(isoDate: string) {
  const date = new Date(isoDate)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatCosAction(action: string | null) {
  if (!action) return "Acao do COS"
  const normalized = action.toLowerCase()
  if (normalized.includes("searchproperties")) return "Busca de imoveis"
  if (normalized.includes("createpropertydraft")) return "Cadastro de imovel"
  if (normalized.includes("createlead")) return "Cadastro de cliente"
  if (normalized.includes("create_proposal")) return "Criacao de proposta"
  if (normalized.includes("create_agenda_event")) return "Agendamento"
  if (normalized.includes("list_agenda_events")) return "Consulta de agenda"
  if (normalized.includes("getleadssummary") || normalized.includes("summarizelead")) return "Analise de clientes"
  if (normalized.includes("analytics") || normalized.includes("catalog")) return "Consulta de desempenho"
  if (normalized.includes("financial")) return "Analise financeira"
  if (normalized.includes("notification")) return "Consulta de notificacoes"
  return action.replace(/_/g, " ")
}

function formatCosStatus(status: string) {
  if (status === "needs_confirmation") return "Aguardando confirmacao"
  if (status === "processing") return "Em processamento"
  if (status === "unsupported") return "Fora do escopo da Home"
  if (status === "error") return "Erro"
  if (status === "cancelled") return "Cancelado"
  return "Concluido"
}
