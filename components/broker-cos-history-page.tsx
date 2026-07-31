"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MessageCircle, Pencil, Trash2 } from "lucide-react"

import { CosPromptComposer } from "@/components/cos-prompt-composer"
import { Button } from "@/components/ui/button"
import { BrokerPageShell } from "@/components/broker-page-shell"
import {
  AssistantCredits,
  CosConversationSummary,
  useCosConversations,
} from "@/components/use-cos-conversations"

type AssistantBootstrapResponse = {
  credits?: AssistantCredits
  aiAssistantEnabled?: boolean
  error?: string
}

const CONVERSATION_GROUP_ORDER = ["Hoje", "Ontem", "Últimos 7 dias", "Este mês", "Anteriores"] as const

export function BrokerCosHistoryPage() {
  const [prompt, setPrompt] = useState("")
  const [assistantCredits, setAssistantCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [assistantEnabled, setAssistantEnabled] = useState(true)
  const [search, setSearch] = useState("")
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
    if (!normalized) return conversations
    return conversations.filter((item) => normalizeSearchText(item.title).includes(normalized))
  }, [conversations, search])

  const groupedConversations = useMemo(() => {
    const groups = new Map<string, CosConversationSummary[]>()

    for (const item of filteredConversations) {
      const label = getConversationGroupLabel(item.lastInteractionAt)
      const bucket = groups.get(label) ?? []
      bucket.push(item)
      groups.set(label, bucket)
    }

    return CONVERSATION_GROUP_ORDER
      .map((label) => ({ label, items: groups.get(label) ?? [] }))
      .filter((group) => group.items.length > 0)
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
      <section className="grid min-w-0 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-w-0 rounded-[1.75rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
          {groupedConversations.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-white px-4 py-4 text-sm text-[#7B8491]">
              {search.trim() ? "Nenhuma conversa encontrada." : "As conversas do COS aparecerão aqui por corretor, com título e última interação."}
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label} className="mb-5 last:mb-0">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#97A3B6]">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const isActive = item.id === activeConversationId

                    return (
                      <div
                        key={item.id}
                        className={`rounded-[1.25rem] border p-3 transition ${
                          isActive
                            ? "border-[#009b3a]/18 bg-[#effaf3]"
                            : "border-black/[0.06] bg-white hover:bg-[#f8f9fb]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void openConversation(item.id)}
                          className="w-full text-left"
                        >
                          <p className={`line-clamp-2 text-sm ${isActive ? "font-semibold text-[#111111]" : "text-[#334155]"}`}>
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-[#8A97A8]">{formatConversationTimestamp(item.lastInteractionAt)}</p>
                        </button>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleRename(item.id, item.title)}
                            className="h-8 rounded-full border border-black/[0.06] bg-white px-3 text-xs text-[#4B5563] hover:bg-white"
                          >
                            <Pencil className="mr-1.5 size-3.5" />
                            Renomear
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleDelete(item.id)}
                            className="h-8 rounded-full border border-black/[0.06] bg-white px-3 text-xs text-[#4B5563] hover:bg-white"
                          >
                            <Trash2 className="mr-1.5 size-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex min-h-[calc(100svh-9.5rem)] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] md:min-h-[42rem]">
          <div className="border-b border-black/[0.05] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[1.05rem] font-semibold text-[#111111]">
                  {activeConversation?.title || "Historico do COS"}
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

          <div ref={chatViewportRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
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
                <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] min-w-0 rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm sm:max-w-[85%] ${
                      item.role === "user"
                        ? "bg-[#111111] text-white"
                        : item.state === "error"
                          ? "border border-red-500/15 bg-red-50 text-red-700"
                          : "border border-black/[0.06] bg-[#fbfbf8] text-[#334155]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{item.content}</p>
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

