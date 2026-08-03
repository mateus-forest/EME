"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { usePathname } from "next/navigation"
import type { CosComposerAttachment } from "@/components/cos-prompt-composer"
import { getCosCapabilityLabel } from "@/lib/cos/capability-catalog"
import { deriveWorkspaceContextFromPathname } from "@/lib/cos/workspace-context"
import type { CosWorkspaceContext } from "@/lib/cos/types"

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
  attachments?: CosComposerAttachment[]
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
  bootstrapEnabled?: boolean
  source?: "cos_home" | "portal"
  workspaceContext?: Partial<CosWorkspaceContext> | null
}

export function useCosConversations({
  assistantEnabled,
  assistantCredits,
  setAssistantCredits,
  autoOpenLatest = true,
  bootstrapEnabled = true,
  source = "portal",
  workspaceContext,
}: UseCosConversationsOptions) {
  const pathname = usePathname()
  const [conversation, setConversation] = useState<CosConversationItem[]>([])
  const [conversations, setConversations] = useState<CosConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [chatFeedback, setChatFeedback] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [isBootstrappingConversation, setIsBootstrappingConversation] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasBootstrappedRef = useRef(false)
  const isMountedRef = useRef(true)
  const conversationListRequestIdRef = useRef(0)
  const openConversationRequestIdRef = useRef(0)

  const resolvedWorkspaceContext = useMemo(
    () =>
      deriveWorkspaceContextFromPathname({
        pathname: pathname || "/corretor",
        surface: source,
        workspace: workspaceContext,
      }),
    [pathname, source, workspaceContext],
  )

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      conversationListRequestIdRef.current += 1
      openConversationRequestIdRef.current += 1
    }
  }, [])

  const loadConversations = useCallback(async () => {
    const requestId = ++conversationListRequestIdRef.current
    const response = await fetch("/api/assistant/eme/conversations", {
      credentials: "include",
      cache: "no-store",
    })

    const data = (await response.json().catch(() => null)) as ConversationListResponse | null
    if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar o historico do COS.")

    const nextConversations = data?.conversations ?? []
    if (!isMountedRef.current || requestId !== conversationListRequestIdRef.current) {
      return nextConversations
    }

    setConversations(nextConversations)
    return nextConversations
  }, [])

  const openConversation = useCallback(async (conversationId: string) => {
    const requestId = ++openConversationRequestIdRef.current
    setIsConversationLoading(true)
    setChatFeedback("")
    setActiveConversationId(conversationId)
    setConversation([])
    setPendingConfirmation(null)

    try {
      const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationDetailResponse | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel abrir a conversa.")

      if (!isMountedRef.current || requestId !== openConversationRequestIdRef.current) {
        return
      }

      setConversation(data?.messages ?? [])
      setPendingConfirmation(data?.pendingConfirmation ?? null)
      setActiveConversationId(conversationId)
    } catch (caughtError) {
      if (!isMountedRef.current || requestId !== openConversationRequestIdRef.current) {
        return
      }
      setChatFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel abrir a conversa.")
    } finally {
      if (isMountedRef.current && requestId === openConversationRequestIdRef.current) {
        setIsConversationLoading(false)
        window.setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
  }, [])

  const createConversation = useCallback(async () => {
    conversationListRequestIdRef.current += 1
    openConversationRequestIdRef.current += 1

    const response = await fetch("/api/assistant/eme/conversations", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
    const data = (await response.json().catch(() => null)) as ConversationListResponse | null
    if (!response.ok || !data?.conversation) {
      throw new Error(data?.error || "Nao foi possivel criar a conversa.")
    }

    if (!isMountedRef.current) {
      return data.conversation
    }

    setIsBootstrappingConversation(false)
    setIsConversationLoading(false)
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
    options?: {
      confirm?: boolean
      action?: string
      visibleMessage?: string
      cancel?: boolean
      workspaceContext?: Partial<CosWorkspaceContext> | null
      attachments?: CosComposerAttachment[]
    },
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
      const messageWorkspaceContext = deriveWorkspaceContextFromPathname({
        pathname: pathname || "/corretor",
        surface: source,
        workspace: {
          ...resolvedWorkspaceContext,
          ...(options?.workspaceContext ?? {}),
        },
      })

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
          attachments: options?.attachments ?? [],
          source,
          conversationId: activeConversationId || undefined,
          workspace: messageWorkspaceContext,
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
          attachments: options?.attachments ?? [],
        })
        setChatFeedback("Aguardando sua confirmacao.")
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
  }, [activeConversationId, assistantCredits.balance, assistantEnabled, isSending, loadConversations, pathname, resolvedWorkspaceContext, setAssistantCredits, source])

  const confirmPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      confirm: true,
      action: pendingConfirmation.action,
      visibleMessage: "Confirmar",
      attachments: pendingConfirmation.attachments ?? [],
    })
  }, [pendingConfirmation, sendCosMessage])

  const cancelPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      cancel: true,
      action: pendingConfirmation.action,
      visibleMessage: "Cancelar",
      attachments: pendingConfirmation.attachments ?? [],
    })
  }, [pendingConfirmation, sendCosMessage])

  useEffect(() => {
    if (!bootstrapEnabled) {
      // Bootstrap hasn't run yet: keep the skeleton up. If it already ran,
      // this flag flipping off later (e.g. an unrelated loading state this
      // caller ties it to) must not re-hide an already-loaded conversation.
      if (!hasBootstrappedRef.current) {
        setIsBootstrappingConversation(true)
      }
      return
    }

    if (hasBootstrappedRef.current) {
      setIsBootstrappingConversation(false)
      return
    }
    hasBootstrappedRef.current = true

    setIsBootstrappingConversation(true)
    setConversation([])
    setPendingConfirmation(null)
    setActiveConversationId("")
    loadConversations()
      .then((items) => {
        if (autoOpenLatest && items[0]) {
          return openConversation(items[0].id)
        }
        return null
      })
      .catch(() => {
        if (isMountedRef.current) {
          setChatFeedback("Não foi possível carregar o histórico do COS. Tente novamente.")
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsBootstrappingConversation(false)
        }
      })
  }, [autoOpenLatest, bootstrapEnabled, loadConversations, openConversation])

  return {
    conversation,
    conversations,
    activeConversationId,
    pendingConfirmation,
    chatFeedback,
    isSending,
    isConversationLoading,
    isBootstrappingConversation,
    inputRef,
    setChatFeedback,
    setConversation,
    loadConversations,
    openConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    workspaceContext: resolvedWorkspaceContext,
    sendCosMessage,
    confirmPendingAction,
    cancelPendingAction,
  }
}

function formatCosAction(action: string | null) {
  return getCosCapabilityLabel(action)
}
