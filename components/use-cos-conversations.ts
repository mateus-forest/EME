"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

export type AssistantCredits = {
  balance: number
  usedThisMonth: number
}

export type CosConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastInteractionAt: string
}

export type CosConversationItem = {
  id: string
  role: "user" | "assistant"
  content: string
  state: "ready" | "error"
  action?: string | null
  actionStatus?: string | null
  confirmRequired?: boolean
  sourceMessage?: string
  sourceInteractionId?: string
  createdAt?: string
}

export type PendingConfirmation = {
  action: string
  sourceMessage: string
  sourceInteractionId: string
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

type UseCosConversationsOptions = {
  assistantEnabled: boolean
  assistantCredits: AssistantCredits
  setAssistantCredits: Dispatch<SetStateAction<AssistantCredits>>
  autoOpenLatest?: boolean
  source?: "cos_home" | "portal"
}

export function useCosConversations({
  assistantEnabled,
  assistantCredits,
  setAssistantCredits,
  autoOpenLatest = true,
  source = "portal",
}: UseCosConversationsOptions) {
  const [conversation, setConversation] = useState<CosConversationItem[]>([])
  const [conversations, setConversations] = useState<CosConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [chatFeedback, setChatFeedback] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasBootstrappedRef = useRef(false)

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
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return data.conversation
  }, [])

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ title }),
    })
    const data = (await response.json().catch(() => null)) as ConversationListResponse | null
    if (!response.ok || !data?.conversation) throw new Error(data?.error || "Nao foi possivel renomear a conversa.")

    setConversations((current) => current.map((item) => (item.id === conversationId ? data.conversation! : item)))
    return data.conversation
  }, [])

  const deleteConversation = useCallback(async (conversationId: string) => {
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
  }, [activeConversationId, conversations, openConversation])

  const sendCosMessage = useCallback(async (
    messageToSend: string,
    options?: { confirm?: boolean; action?: string; visibleMessage?: string; cancel?: boolean },
  ) => {
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
          source,
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
        sourceInteractionId: "",
        createdAt: new Date().toISOString(),
      }

      setConversation((current) => [...current, assistantMessage])

      if (data?.confirmRequired && assistantMessage.action) {
        assistantMessage.sourceInteractionId = assistantMessage.id
        setPendingConfirmation({
          action: assistantMessage.action,
          sourceMessage: normalizedMessage,
          sourceInteractionId: assistantMessage.id,
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

      await loadConversations()
    } catch (caughtError) {
      const messageText = caughtError instanceof Error ? caughtError.message : "Nao foi possivel falar com o COS agora."

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
  }, [activeConversationId, assistantCredits.balance, assistantEnabled, isSending, loadConversations, setAssistantCredits, source])

  const confirmPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      confirm: true,
      action: pendingConfirmation.action,
      visibleMessage: "Confirmar",
    })
  }, [pendingConfirmation, sendCosMessage])

  const cancelPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      cancel: true,
      action: pendingConfirmation.action,
      visibleMessage: "Cancelar",
    })
  }, [pendingConfirmation, sendCosMessage])

  useEffect(() => {
    if (hasBootstrappedRef.current) return
    hasBootstrappedRef.current = true

    loadConversations()
      .then((items) => {
        if (autoOpenLatest && items[0]) {
          return openConversation(items[0].id)
        }
        return null
      })
      .catch(() => null)
  }, [autoOpenLatest, loadConversations, openConversation])

  return {
    conversation,
    conversations,
    activeConversationId,
    pendingConfirmation,
    chatFeedback,
    isSending,
    isConversationLoading,
    inputRef,
    setChatFeedback,
    setConversation,
    loadConversations,
    openConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    sendCosMessage,
    confirmPendingAction,
    cancelPendingAction,
  }
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
