"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Sparkles,
  UsersRound,
} from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { CosPromptComposer } from "@/components/cos-prompt-composer"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

type ShortcutDefinition = {
  id: string
  label: string
  icon: typeof Sparkles
  href?: string
  onClick?: () => void
}

type StoredShortcutPreferences = {
  order: string[]
  hidden: string[]
}

export function BrokerPortal() {
  const { properties } = useBrokerProperties()
  const { profile } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const [prompt, setPrompt] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [isNextStepModalOpen, setIsNextStepModalOpen] = useState(false)
  const [isShortcutEditorOpen, setIsShortcutEditorOpen] = useState(false)
  const [isShortcutRailExpanded, setIsShortcutRailExpanded] = useState(false)
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>([])
  const [assistantCredits, setAssistantCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [assistantEnabled, setAssistantEnabled] = useState(true)
  const [shortcutOrder, setShortcutOrder] = useState<string[]>([])
  const [hiddenShortcutIds, setHiddenShortcutIds] = useState<string[]>([])
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
    source: "cos_home",
  })

  const publishedPropertiesCount = useMemo(
    () => properties.filter((property) => property.status === "Publicado").length,
    [properties],
  )
  const hasReachedLimit =
    subscription.isProfileResolved &&
    !subscription.isUpgraded &&
    publishedPropertiesCount >= (subscription.propertyLimit ?? 3)

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
  const showConversationTitle = Boolean(
    activeConversation?.title && activeConversation.title !== DEFAULT_COS_CONVERSATION_TITLE,
  )

  const shortcutDefinitions = useMemo<ShortcutDefinition[]>(
    () => [
      {
        id: "clients",
        label: "Clientes",
        icon: UsersRound,
        href: "/corretor/clientes",
      },
      {
        id: "proposal",
        label: "Criar proposta",
        icon: FileText,
        href: "/corretor/documentos",
      },
      {
        id: "today-agenda",
        label: "Agenda de hoje",
        icon: CalendarDays,
        href: "/corretor/agenda",
      },
      {
        id: "studio-ia",
        label: "Studio IA",
        icon: Bot,
        href: "/corretor/studio-ia",
      },
    ],
    [],
  )

  const visibleShortcutCards = useMemo(() => {
    const orderedIds = shortcutOrder.length > 0 ? shortcutOrder : shortcutDefinitions.map((item) => item.id)
    const definitionMap = new Map(shortcutDefinitions.map((item) => [item.id, item]))

    return orderedIds
      .map((id) => definitionMap.get(id))
      .filter((item): item is ShortcutDefinition => Boolean(item))
      .filter((item) => !hiddenShortcutIds.includes(item.id))
      .slice(0, 4)
  }, [hiddenShortcutIds, shortcutDefinitions, shortcutOrder])

  const editableShortcutCards = useMemo(() => {
    const orderedIds = shortcutOrder.length > 0 ? shortcutOrder : shortcutDefinitions.map((item) => item.id)
    const definitionMap = new Map(shortcutDefinitions.map((item) => [item.id, item]))

    return orderedIds.map((id) => definitionMap.get(id)).filter((item): item is ShortcutDefinition => Boolean(item))
  }, [shortcutDefinitions, shortcutOrder])

  useEffect(() => {
    if (!profile.id || typeof window === "undefined") return

    const stored = window.localStorage.getItem(getShortcutStorageKey(profile.id))
    if (!stored) {
      setShortcutOrder(shortcutDefinitions.map((item) => item.id))
      setHiddenShortcutIds([])
      return
    }

    try {
      const parsed = JSON.parse(stored) as StoredShortcutPreferences
      const availableIds = new Set(shortcutDefinitions.map((item) => item.id))
      const nextOrder = (parsed.order ?? []).filter((id) => availableIds.has(id))
      const missing = shortcutDefinitions.map((item) => item.id).filter((id) => !nextOrder.includes(id))
      setShortcutOrder([...nextOrder, ...missing])
      setHiddenShortcutIds((parsed.hidden ?? []).filter((id) => availableIds.has(id)))
    } catch {
      setShortcutOrder(shortcutDefinitions.map((item) => item.id))
      setHiddenShortcutIds([])
    }
  }, [profile.id, shortcutDefinitions])

  useEffect(() => {
    if (!profile.id || typeof window === "undefined" || shortcutOrder.length === 0) return

    const payload: StoredShortcutPreferences = {
      order: shortcutOrder,
      hidden: hiddenShortcutIds,
    }
    window.localStorage.setItem(getShortcutStorageKey(profile.id), JSON.stringify(payload))
  }, [hiddenShortcutIds, profile.id, shortcutOrder])

  async function handleSubmit(promptOverride?: string) {
    const normalizedPrompt = (promptOverride ?? prompt).trim()
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

  function moveShortcut(id: string, direction: "up" | "down") {
    setShortcutOrder((current) => {
      const next = current.length > 0 ? [...current] : shortcutDefinitions.map((item) => item.id)
      const index = next.indexOf(id)
      if (index < 0) return next
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return next
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  function toggleShortcutVisibility(id: string) {
    setHiddenShortcutIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <>
      <BrokerPageShell title="COS" variant="cos" contentClassName="overflow-hidden">
        <section className="flex h-full min-h-0 min-w-0 w-full bg-[#f4f1eb]">
          <div className="flex min-h-0 min-w-0 flex-1 justify-center px-4 py-2.5 sm:px-5 lg:px-7 lg:py-3">
            <div className="grid h-[calc(100dvh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_-_1rem)] w-full max-w-[72rem] min-w-0 gap-3 lg:h-[calc(100dvh_-_1.5rem)] lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
              <div className="space-y-3 pt-1 text-center">
                <div className="mx-auto flex size-6 items-center justify-center rounded-full bg-white/80 text-[#111111] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="space-y-1">
                  <p className="text-[0.82rem] font-medium text-[#6d7a8c]">COS ao seu lado, {brokerFirstName}</p>
                  <h2 className="text-[1.2rem] font-semibold tracking-tight text-[#111111] sm:text-[1.45rem]">
                    O que vamos destravar agora?
                  </h2>
                </div>

                <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon
                    const className =
                      "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#d9dde5] bg-white px-3 text-[12px] font-medium text-[#2f3a4d] transition-colors hover:bg-[#f8f9fb] sm:h-8.5 sm:px-3.5 sm:text-[13px]"

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

                <div className="flex flex-wrap justify-center gap-2 lg:hidden">
                  {visibleShortcutCards.map((item) => {
                    const Icon = item.icon
                    const className =
                      "inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3 text-[12px] font-medium text-[#2f3a4d] shadow-[0_8px_18px_rgba(15,23,42,0.04)]"

                    if (item.onClick) {
                      return (
                        <button key={item.id} type="button" onClick={item.onClick} className={className}>
                          <Icon className="size-4 text-[#009b3a]" />
                          {item.label}
                        </button>
                      )
                    }

                    return (
                      <Link key={item.id} href={item.href ?? "#"} className={className}>
                        <Icon className="size-4 text-[#009b3a]" />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="min-h-0 w-full max-w-[58rem] min-w-0 justify-self-center">
                <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-[2rem] border border-white/40 bg-white/[0.14] px-1 py-1">
                  <div className="flex flex-col gap-1.5 px-2 pb-1.5 pt-1 sm:px-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        {showConversationTitle ? (
                          <p className="truncate text-[0.92rem] font-semibold text-[#111111]">{activeConversation?.title}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#7a8798]">
                        <span className="rounded-full border border-black/[0.06] bg-white/82 px-2.5 py-1 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                          {assistantEnabled ? "COS ativo" : "COS pausado"}
                        </span>
                        <span className="rounded-full border border-black/[0.06] bg-white/82 px-2.5 py-1 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
                          {assistantCredits.balance} creditos
                        </span>
                      </div>
                    </div>
                  </div>

                  <div ref={chatViewportRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1 sm:px-2">
                    {isConversationLoading ? (
                      <div className="rounded-[1.5rem] border border-black/[0.06] bg-white/78 px-5 py-4 text-sm leading-7 text-[#6f7f97] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                        Carregando conversa...
                      </div>
                    ) : null}

                    {!isConversationLoading &&
                      conversation.map((item) => (
                        <div
                          key={item.id}
                          className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[92%] min-w-0 rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm sm:max-w-[85%] ${
                              item.role === "user"
                                ? "bg-[#111111] text-white"
                                : item.state === "error"
                                  ? "border border-red-500/15 bg-red-50 text-red-700"
                                  : "border border-black/[0.06] bg-white/82 text-[#334155] shadow-[0_14px_30px_rgba(15,23,42,0.04)]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{item.content}</p>
                            {item.role === "assistant" && item.actionStatus ? (
                              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8a97a8]">
                                {formatCosStatus(item.actionStatus)}
                              </p>
                            ) : null}
                            {item.confirmRequired && pendingConfirmation?.sourceInteractionId === item.sourceInteractionId ? (
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
                        <div className="max-w-[92%] rounded-[1.5rem] border border-black/[0.06] bg-white/82 px-4 py-3 text-sm text-[#6f7f97] shadow-[0_14px_30px_rgba(15,23,42,0.04)] sm:max-w-[85%]">
                          COS analisando...
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-1.5">
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
                </div>

                {hasReachedLimit ? (
                  <div className="mt-2 flex justify-center">
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

              <aside
                className={`hidden min-h-0 shrink-0 self-stretch rounded-[1.75rem] border border-black/[0.05] bg-white/65 px-2 py-3 backdrop-blur lg:flex lg:flex-col ${
                  isShortcutRailExpanded ? "w-56" : "w-20"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsShortcutRailExpanded((current) => !current)}
                  className="flex h-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-white text-[#5e6d82] transition-colors hover:bg-white"
                >
                  {isShortcutRailExpanded ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </button>

                <div className="mt-3 flex-1 space-y-2">
                  {visibleShortcutCards.map((item) => {
                    const Icon = item.icon
                    const content = (
                      <>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#009b3a]/12 bg-[#f5fbf7] text-[#009b3a]">
                          <Icon className="size-4" />
                        </span>
                        {isShortcutRailExpanded ? (
                          <>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#1f2937]">{item.label}</span>
                            <ArrowRight className="size-3.5 text-[#9aa6b6]" />
                          </>
                        ) : null}
                      </>
                    )

                    const className =
                      "flex w-full items-center gap-3 rounded-[1.25rem] border border-transparent px-1.5 py-1.5 text-left transition-all hover:border-black/[0.06] hover:bg-white/90"

                    if (item.onClick) {
                      return (
                        <button key={item.id} type="button" onClick={item.onClick} className={className}>
                          {content}
                        </button>
                      )
                    }

                    return (
                      <Link key={item.id} href={item.href ?? "#"} className={className}>
                        {content}
                      </Link>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setIsShortcutEditorOpen(true)}
                  className="mt-3 flex items-center gap-3 rounded-[1.25rem] border border-black/[0.06] bg-white px-2 py-2 text-left text-[#5e6d82] transition-colors hover:text-[#111111]"
                >
                  <span className="flex size-9 items-center justify-center rounded-2xl border border-black/[0.06] bg-[#fbfbf8]">
                    <Sparkles className="size-4" />
                  </span>
                  {isShortcutRailExpanded ? <span className="text-sm font-medium">Editar atalhos</span> : null}
                </button>
              </aside>
            </div>
          </div>
        </section>
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
      <Dialog open={isShortcutEditorOpen} onOpenChange={setIsShortcutEditorOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white p-0 text-[#111111] shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:max-h-[calc(100vh-4rem)]">
          <div className="max-h-[calc(100vh-2rem)] overflow-y-auto px-6 py-6 sm:max-h-[calc(100vh-4rem)]">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold tracking-tight text-[#111111]">
                Editar atalhos inteligentes
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-[#6B7280]">
                Reordene os atalhos, escolha quais ficam visiveis na Home e mantenha o painel focado no que voce usa todos os dias.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-3">
              {editableShortcutCards.map((item, index) => {
                const isHidden = hiddenShortcutIds.includes(item.id)
                const Icon = item.icon

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4"
                  >
                    <span className="mt-0.5 flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-white text-[#009b3a]">
                      <Icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#111111]">{item.label}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => moveShortcut(item.id, "up")}
                        className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-50"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={index === editableShortcutCards.length - 1}
                        onClick={() => moveShortcut(item.id, "down")}
                        className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-50"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleShortcutVisibility(item.id)}
                        className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                      >
                        {isHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        {isHidden ? "Mostrar" : "Ocultar"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

function getShortcutStorageKey(userId: string) {
  return `eme-broker-portal-shortcuts:${userId}`
}

function formatCosStatus(status: string) {
  if (status === "needs_confirmation") return "Aguardando confirmacao"
  if (status === "processing") return "Em processamento"
  if (status === "unsupported") return "Fora do escopo da Home"
  if (status === "error") return "Erro"
  if (status === "cancelled") return "Cancelado"
  return "Concluido"
}
