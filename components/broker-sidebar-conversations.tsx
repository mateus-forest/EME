"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, MessageSquareText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"

import {
  COS_CONVERSATIONS_REFRESH_EVENT,
  COS_CONVERSATIONS_SYNC_EVENT,
  type CosConversationSummary,
} from "@/components/use-cos-conversations"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { repairLegacyCosText } from "@/lib/cos/localization"

type ConversationListResponse = {
  conversations?: CosConversationSummary[]
  conversation?: CosConversationSummary
  error?: string
}

const conversationGroups = ["Hoje", "Últimos 7 dias", "Anteriores"] as const

function normalizeConversation(item: CosConversationSummary): CosConversationSummary {
  return {
    ...item,
    title: repairLegacyCosText(item.title),
  }
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function conversationGroup(isoDate: string): (typeof conversationGroups)[number] {
  const now = new Date()
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return "Anteriores"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compared = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffDays = Math.floor((today.getTime() - compared.getTime()) / 86_400_000)
  if (diffDays <= 0) return "Hoje"
  if (diffDays < 7) return "Últimos 7 dias"
  return "Anteriores"
}

export function BrokerSidebarConversations({
  collapsed,
  isMobile,
  onNavigate,
  onCollapsedClick,
}: {
  collapsed: boolean
  isMobile: boolean
  onNavigate: () => void
  onCollapsedClick: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeConversationId = searchParams.get("conversa")?.trim() || ""
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState("")
  const [conversations, setConversations] = useState<CosConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState("")

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/assistant/eme/conversations?limit=50&offset=0", {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationListResponse | null
      if (!response.ok) throw new Error(repairLegacyCosText(data?.error || "Não foi possível carregar as conversas."))
      setConversations((data?.conversations ?? []).map(normalizeConversation))
      setFeedback("")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar as conversas.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (expanded) void loadConversations()
  }, [expanded, loadConversations])

  useEffect(() => {
    function handleSync(event: Event) {
      const detail = (event as CustomEvent<{ conversations?: CosConversationSummary[] }>).detail
      if (Array.isArray(detail?.conversations)) {
        setConversations(detail.conversations.map(normalizeConversation))
      }
    }
    window.addEventListener(COS_CONVERSATIONS_SYNC_EVENT, handleSync)
    return () => window.removeEventListener(COS_CONVERSATIONS_SYNC_EVENT, handleSync)
  }, [])

  useEffect(() => {
    function handleRefresh() {
      if (expanded) void loadConversations()
    }
    window.addEventListener(COS_CONVERSATIONS_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(COS_CONVERSATIONS_REFRESH_EVENT, handleRefresh)
  }, [expanded, loadConversations])

  const groupedConversations = useMemo(() => {
    const normalizedSearch = normalizeSearch(search)
    const filtered = conversations.filter((item) => !normalizedSearch || normalizeSearch(item.title).includes(normalizedSearch))
    return conversationGroups
      .map((label) => ({ label, items: filtered.filter((item) => conversationGroup(item.lastInteractionAt) === label) }))
      .filter((group) => group.items.length > 0)
  }, [conversations, search])

  function navigateToConversation(conversationId: string, replace = false) {
    const href = `/corretor?conversa=${encodeURIComponent(conversationId)}`
    if (replace) router.replace(href, { scroll: false })
    else router.push(href, { scroll: false })
    onNavigate()
  }

  function notifyConversationChange() {
    window.dispatchEvent(new Event(COS_CONVERSATIONS_REFRESH_EVENT))
  }

  async function createConversation() {
    try {
      const response = await fetch("/api/assistant/eme/conversations", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationListResponse | null
      if (!response.ok || !data?.conversation) {
        throw new Error(repairLegacyCosText(data?.error || "Não foi possível criar a conversa."))
      }
      const created = normalizeConversation(data.conversation)
      setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setFeedback("")
      notifyConversationChange()
      navigateToConversation(created.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar a conversa.")
    }
  }

  async function renameConversation(item: CosConversationSummary) {
    const title = window.prompt("Novo título da conversa", item.title)?.trim()
    if (!title || title === item.title) return
    try {
      const response = await fetch(`/api/assistant/eme/conversations/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ title }),
      })
      const data = (await response.json().catch(() => null)) as ConversationListResponse | null
      if (!response.ok || !data?.conversation) {
        throw new Error(repairLegacyCosText(data?.error || "Não foi possível renomear a conversa."))
      }
      const renamed = normalizeConversation(data.conversation)
      setConversations((current) => current.map((conversation) => conversation.id === item.id ? renamed : conversation))
      setFeedback("")
      notifyConversationChange()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível renomear a conversa.")
    }
  }

  async function deleteConversation(item: CosConversationSummary) {
    if (!window.confirm("Deseja excluir esta conversa do COS?")) return
    try {
      const response = await fetch(`/api/assistant/eme/conversations/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(repairLegacyCosText(data?.error || "Não foi possível excluir a conversa."))
      const remaining = conversations.filter((conversation) => conversation.id !== item.id)
      setConversations(remaining)
      setFeedback("")
      notifyConversationChange()
      if (activeConversationId === item.id) {
        if (remaining[0]) navigateToConversation(remaining[0].id, true)
        else await createConversation()
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir a conversa.")
    }
  }

  if (collapsed && !isMobile) {
    return (
      <button
        type="button"
        onClick={onCollapsedClick}
        className="mt-2 flex h-9 w-full items-center justify-center rounded-[var(--broker-radius-sm)] text-[var(--broker-muted)] transition-colors hover:bg-[var(--broker-surface-inset)] hover:text-[var(--broker-ink)]"
        title="Conversas"
      >
        <MessageSquareText className="size-4" />
        <span className="sr-only">Expandir conversas</span>
      </button>
    )
  }

  return (
    <section className="mt-2 flex min-h-0 flex-col border-t border-[var(--broker-border)] pt-2" aria-label="Conversas do COS">
      <div className="flex items-center gap-1 px-0.5">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex h-5.5 min-w-0 flex-1 items-center justify-between rounded-lg px-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--broker-muted-soft)] transition-colors hover:bg-[var(--broker-surface-inset)] hover:text-[var(--broker-ink)]"
          aria-expanded={expanded}
          aria-controls="cos-sidebar-conversation-history"
        >
          <span className="min-w-0 flex-1 truncate">Conversas</span>
          <ChevronDown className={`size-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => void createConversation()}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[var(--broker-muted)] transition-colors hover:bg-[var(--broker-accent-soft)] hover:text-[var(--broker-accent-strong)]"
          title="Nova conversa"
        >
          <Plus className="size-3" />
          <span className="sr-only">Nova conversa</span>
        </button>
      </div>

      {expanded ? (
        <div id="cos-sidebar-conversation-history" className="mt-1.5 flex min-h-0 flex-col">
          <label className="relative mx-1 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--broker-muted-soft)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversas"
              className="h-8 w-full rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] pl-8 pr-2 text-xs text-[var(--broker-ink)] outline-none placeholder:text-[var(--broker-muted-soft)] focus:border-[var(--broker-accent-border)]"
            />
          </label>

          <div className="eme-subtle-scrollbar mt-2 max-h-[min(34vh,19rem)] overflow-y-auto pr-0.5">
            {isLoading && conversations.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[var(--broker-muted-soft)]">Carregando conversas...</p>
            ) : groupedConversations.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-relaxed text-[var(--broker-muted-soft)]">
                {search.trim() ? "Nenhuma conversa encontrada." : "Suas conversas aparecerão aqui."}
              </p>
            ) : (
              groupedConversations.map((group) => (
                <div key={group.label} className="mb-2.5 last:mb-0">
                  <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--broker-muted-soft)]">{group.label}</p>
                  <div className="grid gap-0.5">
                    {group.items.map((item) => {
                      const active = item.id === activeConversationId
                      return (
                        <div
                          key={item.id}
                          className={`group flex min-w-0 items-center rounded-[var(--broker-radius-sm)] border transition-colors ${
                            active
                              ? "border-[var(--broker-accent-border)] bg-[var(--broker-accent-soft)]"
                              : "border-transparent hover:bg-[var(--broker-surface-inset)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => navigateToConversation(item.id)}
                            className={`min-w-0 flex-1 truncate px-2 py-2 text-left text-[12px] font-medium ${active ? "text-[var(--broker-accent-strong)]" : "text-[var(--broker-muted)]"}`}
                            title={item.title}
                          >
                            {item.title}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--broker-muted-soft)] opacity-0 transition-opacity hover:bg-white hover:text-[var(--broker-ink)] focus:opacity-100 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="size-3.5" />
                                <span className="sr-only">Ações para {item.title}</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40 rounded-xl border-black/[0.07] bg-white p-1.5 text-[#344054]">
                              <DropdownMenuItem onClick={() => void renameConversation(item)} className="rounded-lg">
                                <Pencil className="size-3.5" /> Renomear
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void deleteConversation(item)} className="rounded-lg text-red-600 focus:text-red-600">
                                <Trash2 className="size-3.5" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {feedback ? <p className="mt-2 px-2 text-[10px] leading-relaxed text-red-600">{feedback}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
