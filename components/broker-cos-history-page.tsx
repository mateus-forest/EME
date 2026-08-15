"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"

import { CosConversationMessageBody, CosMessageAttachments, CosPendingAction } from "@/components/cos-pending-action"
import { CosPromptComposer } from "@/components/cos-prompt-composer"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerSurface } from "@/components/broker-portal-ui"
import { Button } from "@/components/ui/button"
import {
  AssistantCredits,
  CosConversationSummary,
  useCosConversations,
} from "@/components/use-cos-conversations"
import {
  COS_CONVERSATION_CATEGORIES,
  getCosConversationCategoryLabel,
  resolveCosConversationCategory,
  type CosConversationCategoryId,
} from "@/lib/cos-conversations"

type AssistantBootstrapResponse = {
  credits?: AssistantCredits
  aiAssistantEnabled?: boolean
  error?: string
}

const CONVERSATION_GROUP_ORDER = ["Hoje", "Ontem", "Últimos 7 dias", "Este mês", "Anteriores"] as const
const MAX_VISIBLE_CONVERSATIONS_PER_GROUP = 8
type ConversationCategoryFilter = "all" | CosConversationCategoryId

export function BrokerCosHistoryPage() {
  const [prompt, setPrompt] = useState("")
  const [assistantCredits, setAssistantCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [assistantEnabled, setAssistantEnabled] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<ConversationCategoryFilter>("all")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
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
    renameConversation,
    deleteConversation,
    openConversation,
    sendCosMessage,
    confirmPendingAction,
    cancelPendingAction,
    selectPendingOption,
    hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations,
  } = useCosConversations({
    assistantEnabled,
    assistantCredits,
    setAssistantCredits,
  })

  useEffect(() => {
    let ignore = false

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
  }, [conversation, isConversationLoading, isSending])

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )

  const filteredConversations = useMemo(() => {
    const normalized = normalizeSearchText(search)
    return conversations.filter((item) => {
      const category = getConversationCategory(item)
      const matchesCategory = categoryFilter === "all" || category === categoryFilter
      const matchesSearch =
        !normalized ||
        normalizeSearchText(item.title).includes(normalized) ||
        normalizeSearchText(getCosConversationCategoryLabel(category)).includes(normalized)

      return matchesCategory && matchesSearch
    })
  }, [categoryFilter, conversations, search])

  const categoryCounts = useMemo(() => {
    const counts = new Map<CosConversationCategoryId, number>()
    for (const item of conversations) {
      const category = getConversationCategory(item)
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
    return counts
  }, [conversations])

  const groupedConversations = useMemo(() => {
    return COS_CONVERSATION_CATEGORIES.map((category) => {
      const categoryItems = filteredConversations.filter((item) => getConversationCategory(item) === category.id)
      const temporalGroups = new Map<string, CosConversationSummary[]>()

      for (const item of categoryItems) {
        const label = getConversationGroupLabel(item.lastInteractionAt)
        const bucket = temporalGroups.get(label) ?? []
        bucket.push(item)
        temporalGroups.set(label, bucket)
      }

      return {
        ...category,
        items: categoryItems,
        temporalGroups: CONVERSATION_GROUP_ORDER
          .map((label) => ({ label, items: temporalGroups.get(label) ?? [] }))
          .filter((group) => group.items.length > 0),
      }
    }).filter((group) => group.items.length > 0)
  }, [filteredConversations])

  async function handleSubmit(input?: { promptOverride?: string; attachments?: import("@/components/cos-prompt-composer").CosComposerAttachment[] }) {
    const normalizedPrompt = (input?.promptOverride ?? prompt).trim()
    if (!normalizedPrompt) {
      setChatFeedback("Digite uma mensagem para o COS.")
      return
    }

    await sendCosMessage(normalizedPrompt, { attachments: input?.attachments })
    setPrompt("")
  }

  async function handleRename(conversationId: string, currentTitle: string) {
    const nextTitle = window.prompt("Novo título da conversa", currentTitle)?.trim()
    if (!nextTitle || nextTitle === currentTitle) return

    try {
      await renameConversation(conversationId, nextTitle)
    } catch (caughtError) {
      setChatFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível renomear a conversa.")
    }
  }

  async function handleDelete(conversationId: string) {
    if (!window.confirm("Deseja excluir esta conversa do COS?")) return

    try {
      await deleteConversation(conversationId)
    } catch (caughtError) {
      setChatFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir a conversa.")
    }
  }

  return (
    <BrokerPageShell
      title="Histórico"
      searchPlaceholder="Pesquisar conversas"
      searchValue={search}
      onSearchChange={setSearch}
      primaryActionLabel="Nova conversa"
      primaryActionOnClick={() => void createConversation()}
    >
      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <BrokerSurface
          tone="subtle"
          padding="compact"
          className="eme-subtle-scrollbar max-h-[25rem] overflow-y-auto xl:max-h-[calc(100svh-9rem)]"
        >
          <div className="mb-4 border-b border-[var(--broker-border)] pb-3" data-testid="cos-history-category-filters">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#97A3B6]">
              Organizar por intenção
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={categoryFilter === "all"}
                data-testid="cos-history-category-all"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  categoryFilter === "all"
                    ? "border-[#009b3a]/20 bg-[#edf8f1] text-[#087331]"
                    : "border-black/[0.06] bg-white text-[#667085] hover:text-[#111111]"
                }`}
              >
                Todas <span className="ml-1 text-[10px] opacity-70">{conversations.length}</span>
              </button>
              {COS_CONVERSATION_CATEGORIES.filter((category) => (categoryCounts.get(category.id) ?? 0) > 0).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryFilter === category.id}
                  data-testid={`cos-history-category-${category.id}`}
                  onClick={() => setCategoryFilter(category.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    categoryFilter === category.id
                      ? "border-[#009b3a]/20 bg-[#edf8f1] text-[#087331]"
                      : "border-black/[0.06] bg-white text-[#667085] hover:text-[#111111]"
                  }`}
                >
                  {category.label} <span className="ml-1 text-[10px] opacity-70">{categoryCounts.get(category.id)}</span>
                </button>
              ))}
            </div>
          </div>

          {groupedConversations.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-white px-4 py-4 text-sm text-[#7B8491]">
              {search.trim()
                ? "Nenhuma conversa encontrada."
                : categoryFilter !== "all"
                  ? "Nenhuma conversa nesta categoria."
                  : "As conversas do COS aparecerão aqui por intenção e data da última interação."}
            </div>
          ) : (
            groupedConversations.map((categoryGroup) => (
              <section key={categoryGroup.id} className="mb-6 last:mb-0" data-category={categoryGroup.id}>
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <h2 className="text-sm font-semibold text-[#111111]">{categoryGroup.label}</h2>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[#7B8491]">{categoryGroup.items.length}</span>
                </div>

                <div className="space-y-3">
                  {categoryGroup.temporalGroups.map((temporalGroup) => {
                    const expansionKey = `${categoryGroup.id}:${temporalGroup.label}`
                    const visibleItems = expandedGroups[expansionKey]
                      ? temporalGroup.items
                      : temporalGroup.items.slice(0, MAX_VISIBLE_CONVERSATIONS_PER_GROUP)

                    return (
                      <div key={expansionKey}>
                        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#97A3B6]">
                          {temporalGroup.label}
                        </p>
                        <div className="space-y-2">
                          {visibleItems.map((item) => {
                            const isActive = item.id === activeConversationId

                            return (
                              <div
                                key={item.id}
                                className={`rounded-xl border px-3 py-2 transition ${
                                  isActive
                                    ? "border-[#009b3a]/18 bg-[#effaf3]"
                                    : "border-black/[0.06] bg-white hover:bg-[#f8f9fb]"
                                }`}
                              >
                                <div className="flex min-w-0 items-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void openConversation(item.id)}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <p className={`line-clamp-2 break-words text-sm ${isActive ? "font-semibold text-[#111111]" : "text-[#334155]"}`}>
                                      {item.title}
                                    </p>
                                    <p className="mt-1 text-xs text-[#8A97A8]">{formatConversationTimestamp(item.lastInteractionAt)}</p>
                                  </button>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Renomear ${item.title}`}
                                      onClick={() => void handleRename(item.id, item.title)}
                                      className="size-8 rounded-full text-[#667085] hover:bg-white hover:text-[#111111]"
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Excluir ${item.title}`}
                                      onClick={() => void handleDelete(item.id)}
                                      className="size-8 rounded-full text-[#667085] hover:bg-white hover:text-red-600"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {temporalGroup.items.length > MAX_VISIBLE_CONVERSATIONS_PER_GROUP && !expandedGroups[expansionKey] ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setExpandedGroups((current) => ({ ...current, [expansionKey]: true }))}
                            className="mt-2 h-8 rounded-full border border-black/[0.06] bg-white px-3 text-xs text-[#4B5563] hover:bg-white"
                          >
                            Mostrar mais
                          </Button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          )}

          {hasMoreConversations ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadMoreConversations()}
              disabled={isLoadingMoreConversations}
              className="mt-2 h-10 w-full rounded-[1rem] border border-black/[0.06] bg-white px-4 text-sm text-[#4B5563] hover:bg-white"
            >
              {isLoadingMoreConversations ? "Carregando..." : "Ver histórico completo"}
            </Button>
          ) : null}
        </BrokerSurface>

        <div className="flex min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-surface)] shadow-[var(--broker-shadow-xs)] xl:min-h-[calc(100svh-9rem)] xl:max-h-[calc(100svh-9rem)]">
          <div className="border-b border-[var(--broker-border)] px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[1.05rem] font-semibold text-[#111111]">
                  {activeConversation?.title || "Histórico do COS"}
                </p>
                <p className="mt-1 text-sm text-[#7a8798]">
                  Reabra conversas anteriores, continue do ponto onde parou e mantenha o contexto separado por corretor.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a8798]">
                <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">
                  {assistantEnabled ? "COS ativo" : "COS pausado"}
                </span>
                <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1">
                  {assistantCredits.balance} créditos
                </span>
              </div>
            </div>
          </div>

          <div ref={chatViewportRef} className="eme-hidden-scrollbar min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {isConversationLoading ? (
              <div className="rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] px-5 py-4 text-sm leading-7 text-[#6f7f97]">
                Carregando conversa...
              </div>
            ) : null}

            {!isConversationLoading && conversation.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-5 py-4 text-sm leading-7 text-[#6f7f97]">
                Abra uma conversa existente ou crie uma nova para continuar falando com o COS.
              </div>
            ) : null}

            {!isConversationLoading &&
              conversation.map((item) => (
                <div key={item.id} className={`flex min-w-0 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] min-w-0 rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm sm:max-w-[85%] ${
                      item.role === "user"
                        ? "bg-[#111111] text-white"
                        : item.state === "error"
                          ? "border border-red-500/15 bg-red-50 text-red-700"
                          : "border border-black/[0.06] bg-[#fbfbf8] text-[#334155]"
                    }`}
                  >
                    <CosConversationMessageBody item={item} />
                    <CosMessageAttachments attachments={item.attachments} inverted={item.role === "user"} />
                    <CosPendingAction
                      item={item}
                      pendingConfirmation={pendingConfirmation}
                      isSending={isSending}
                      onConfirm={() => void confirmPendingAction()}
                      onCancel={() => void cancelPendingAction()}
                      onSelectOption={(option) => void selectPendingOption(option)}
                    />
                  </div>
                </div>
              ))}

            {isSending ? (
              <div className="flex min-w-0 justify-start">
                <div className="max-w-[92%] rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#6f7f97] sm:max-w-[85%]">
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
              setPrompt("")
              setChatFeedback("")
              await createConversation()
            }}
            disabled={isSending || isConversationLoading}
            inputRef={inputRef}
            feedback={chatFeedback}
          />
        </div>
      </section>
    </BrokerPageShell>
  )
}

function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function getConversationCategory(conversation: CosConversationSummary) {
  return conversation.category ?? resolveCosConversationCategory({ title: conversation.title })
}

function getConversationGroupLabel(isoDate: string) {
  const now = new Date()
  const target = new Date(isoDate)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compared = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffDays = Math.floor((today.getTime() - compared.getTime()) / 86_400_000)

  if (diffDays <= 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  if (diffDays <= 7) return "Últimos 7 dias"
  if (today.getFullYear() === compared.getFullYear() && today.getMonth() === compared.getMonth()) return "Este mês"
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
