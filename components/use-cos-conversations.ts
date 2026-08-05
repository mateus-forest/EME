"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { usePathname } from "next/navigation"
import type { CosComposerAttachment } from "@/components/cos-prompt-composer"
import { getCosCapabilityLabel } from "@/lib/cos/capability-catalog"
import { deriveWorkspaceContextFromPathname } from "@/lib/cos/workspace-context"
import type { CosWorkspaceContext } from "@/lib/cos/types"
import { dispatchEntitySync } from "@/lib/entity-sync"
import { getEmeCreditCost } from "@/lib/eme-plans"

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

export type CosResponseOption = {
  id: string
  label: string
  description?: string
}

export type CosConversationItem = {
  id: string
  role: "user" | "assistant"
  content: string
  state: "ready" | "error"
  action?: string | null
  actionStatus?: string | null
  confirmRequired?: boolean
  options?: CosResponseOption[]
  attachments?: CosComposerAttachment[]
  sourceMessage?: string
  sourceInteractionId?: string
  createdAt?: string
}

export type PendingConfirmation = {
  action: string
  sourceMessage: string
  sourceInteractionId: string
  attachments?: CosComposerAttachment[]
  options?: CosResponseOption[]
}

type AssistantMessageResponse = {
  response?: string
  action?: string
  actionStatus?: string
  credits?: AssistantCredits
  creditsUsed?: number
  creditsBlocked?: boolean
  availableCredits?: number
  requiredCredits?: number
  missingCredits?: number
  ctaHref?: string
  ctaLabel?: string
  error?: string
  confirmRequired?: boolean
  conversation?: CosConversationSummary | null
  metadata?: {
    leadId?: unknown
    options?: unknown
    workflow?: {
      pendingInput?: {
        parsedData?: {
          options?: unknown
        } | null
      } | null
    } | null
  } | null
}

function parseCosResponseOptions(value: unknown): CosResponseOption[] | undefined {
  if (!Array.isArray(value)) return undefined

  const options = value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => typeof item.id === "string" && typeof item.label === "string")
    .map((item) => ({
      id: item.id as string,
      label: repairCosText(item.label as string),
      description: typeof item.description === "string" ? repairCosText(item.description) : undefined,
    }))

  return options.length > 0 ? options : undefined
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
  total?: number
  hasMore?: boolean
  nextOffset?: number
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

type CosConversationCache = {
  conversation: CosConversationItem[]
  conversations: CosConversationSummary[]
  activeConversationId: string
  pendingConfirmation: PendingConfirmation | null
}

const COS_CONVERSATION_CACHE_KEY = "eme-cos-conversation-cache"
const INITIAL_CONVERSATION_PAGE_SIZE = 15

function repairCosText(value: string) {
  return value
    .replaceAll("NÃ£o", "Não")
    .replaceAll("nÃ£o", "não")
    .replaceAll("possÃ­vel", "possível")
    .replaceAll("histÃ³rico", "histórico")
    .replaceAll("operaÃ§Ã£o", "operação")
    .replaceAll("operaÃ§Ãµes", "operações")
    .replaceAll("VocÃª", "Você")
    .replaceAll("vocÃª", "você")
    .replaceAll("Ãšltimos", "Últimos")
    .replaceAll("Ãºltimos", "últimos")
    .replaceAll("tÃ­tulo", "título")
    .replaceAll("interaÃ§Ã£o", "interação")
    .replaceAll("crÃ©ditos", "créditos")
    .replaceAll("crÃ©dito", "crédito")
    .replaceAll("Alteracao", "Alteração")
    .replaceAll("confirmacao", "confirmação")
    .replaceAll("Disponivel", "Disponível")
    .replaceAll("Necessario", "Necessário")
    .replaceAll("pagina", "página")
    .replaceAll("acao", "ação")
    .replaceAll("credito", "crédito")
    .replaceAll("Creditos", "Créditos")
    .replaceAll("Nao", "Não")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã£", "ã")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ã´", "ô")
    .replaceAll("Ãº", "ú")
    .replaceAll("â€¢", "•")
    .replaceAll("âœ”", "✔")
    .replaceAll("âš ", "⚠")
    .replaceAll("â³", "⏳")
    .replaceAll("â¬œ", "⬜")
}

function normalizeConversationSummary(item: CosConversationSummary): CosConversationSummary {
  return {
    ...item,
    title: repairCosText(item.title),
  }
}

function normalizeConversationItem(item: CosConversationItem): CosConversationItem {
  return {
    ...item,
    content: repairCosText(item.content),
    options: item.options?.map((option) => ({
      ...option,
      label: repairCosText(option.label),
      description: option.description ? repairCosText(option.description) : undefined,
    })),
  }
}

function readConversationCache() {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(COS_CONVERSATION_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<CosConversationCache> | null
    if (!parsed || typeof parsed !== "object") return null

    return {
      conversation: Array.isArray(parsed.conversation) ? parsed.conversation : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      activeConversationId: typeof parsed.activeConversationId === "string" ? parsed.activeConversationId : "",
      pendingConfirmation: parsed.pendingConfirmation && typeof parsed.pendingConfirmation === "object"
        ? (parsed.pendingConfirmation as PendingConfirmation)
        : null,
    } satisfies CosConversationCache
  } catch {
    return null
  }
}

function writeConversationCache(cache: CosConversationCache) {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(COS_CONVERSATION_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore cache persistence errors and keep the live conversation state.
  }
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
  const initialCacheRef = useRef<CosConversationCache | null>(null)
  if (initialCacheRef.current === null) {
    initialCacheRef.current = readConversationCache()
  }

  const [conversation, setConversation] = useState<CosConversationItem[]>(() => initialCacheRef.current?.conversation ?? [])
  const [conversations, setConversations] = useState<CosConversationSummary[]>(() => initialCacheRef.current?.conversations ?? [])
  const [activeConversationId, setActiveConversationId] = useState(() => initialCacheRef.current?.activeConversationId ?? "")
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(() => initialCacheRef.current?.pendingConfirmation ?? null)
  const [chatFeedback, setChatFeedback] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [hasMoreConversations, setHasMoreConversations] = useState(false)
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false)
  const [isBootstrappingConversation, setIsBootstrappingConversation] = useState(() => !initialCacheRef.current)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasBootstrappedRef = useRef(false)
  const isMountedRef = useRef(true)
  const conversationListRequestIdRef = useRef(0)
  const openConversationRequestIdRef = useRef(0)
  const loadedConversationCountRef = useRef(initialCacheRef.current?.conversations.length || INITIAL_CONVERSATION_PAGE_SIZE)

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

  const loadConversations = useCallback(async (options?: { append?: boolean; offset?: number; limit?: number }) => {
    const requestId = ++conversationListRequestIdRef.current
    const limit = options?.limit ?? loadedConversationCountRef.current
    const offset = options?.append ? options?.offset ?? conversations.length : options?.offset ?? 0
    const response = await fetch(`/api/assistant/eme/conversations?limit=${limit}&offset=${offset}`, {
      credentials: "include",
      cache: "no-store",
    })

    const data = (await response.json().catch(() => null)) as ConversationListResponse | null
    if (!response.ok) throw new Error(repairCosText(data?.error || "Nao foi possivel carregar o historico do COS."))

    const nextConversations = (data?.conversations ?? []).map(normalizeConversationSummary)
    if (!isMountedRef.current || requestId !== conversationListRequestIdRef.current) {
      return nextConversations
    }

    setConversations((current) => {
      if (!options?.append) return nextConversations

      const merged = [...current]
      for (const item of nextConversations) {
        if (!merged.some((existing) => existing.id === item.id)) {
          merged.push(item)
        }
      }
      return merged
    })
    setHasMoreConversations(Boolean(data?.hasMore))
    loadedConversationCountRef.current = options?.append
      ? Math.max(loadedConversationCountRef.current, offset + nextConversations.length)
      : nextConversations.length
    return nextConversations
  }, [conversations.length])

  const openConversation = useCallback(async (
    conversationId: string,
    options?: {
      preserveVisibleConversation?: boolean
      skipLoadingState?: boolean
    },
  ) => {
    const requestId = ++openConversationRequestIdRef.current
    if (!options?.skipLoadingState) {
      setIsConversationLoading(true)
    }
    setChatFeedback("")
    setActiveConversationId(conversationId)
    if (!options?.preserveVisibleConversation) {
      setConversation([])
      setPendingConfirmation(null)
    }

    try {
      const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationDetailResponse | null
      if (!response.ok) throw new Error(repairCosText(data?.error || "Nao foi possivel abrir a conversa."))

      if (!isMountedRef.current || requestId !== openConversationRequestIdRef.current) {
        return
      }

      setConversation((data?.messages ?? []).map(normalizeConversationItem))
      setPendingConfirmation(data?.pendingConfirmation ?? null)
      setActiveConversationId(conversationId)
    } catch (caughtError) {
      if (!isMountedRef.current || requestId !== openConversationRequestIdRef.current) {
        return
      }
      setChatFeedback(repairCosText(caughtError instanceof Error ? caughtError.message : "Nao foi possivel abrir a conversa."))
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
      throw new Error(repairCosText(data?.error || "Nao foi possivel criar a conversa."))
    }

    if (!isMountedRef.current) {
      return normalizeConversationSummary(data.conversation)
    }

    setIsBootstrappingConversation(false)
    setIsConversationLoading(false)
    const normalizedConversation = normalizeConversationSummary(data.conversation)
    setConversations((current) => [normalizedConversation, ...current.filter((item) => item.id !== normalizedConversation.id)])
    setActiveConversationId(normalizedConversation.id)
    setConversation([])
    setPendingConfirmation(null)
    setChatFeedback("")
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return normalizedConversation
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
    if (!response.ok || !data?.conversation) throw new Error(repairCosText(data?.error || "Nao foi possivel renomear a conversa."))

    const normalizedConversation = normalizeConversationSummary(data.conversation)
    setConversations((current) => current.map((item) => (item.id === conversationId ? normalizedConversation : item)))
    return normalizedConversation
  }, [])

  const deleteConversation = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/assistant/eme/conversations/${conversationId}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    })
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) throw new Error(repairCosText(data?.error || "Nao foi possivel excluir a conversa."))

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
      creditCostPreview?: number
    },
  ) => {
    const normalizedMessage = messageToSend.trim()
    if (!normalizedMessage || isSending) return

    if (!options?.cancel && !assistantEnabled) {
      setChatFeedback("Ative o Assessor EME para conversar com o COS.")
      return
    }

    const previewLabel = options?.visibleMessage ?? normalizedMessage
    const isWorkflowDetailsRequest =
      options?.action === "workflow_details" ||
      previewLabel.toLowerCase().includes("ver detalhes da opera")

    const requestedCreditCost =
      isWorkflowDetailsRequest
        ? 0
        : typeof options?.creditCostPreview === "number"
        ? Math.max(0, Math.trunc(options.creditCostPreview))
        : options?.action
          ? getEmeCreditCost(options.action)
          : 0

    if (!options?.cancel && requestedCreditCost > 0 && assistantCredits.balance < requestedCreditCost) {
      setChatFeedback(
        `Créditos IA insuficientes. Disponível: ${assistantCredits.balance}. Necessário: ${requestedCreditCost}. Abra a página Plano para continuar.`,
      )
      return
    }

    const visibleMessage = previewLabel
    const optimisticUserMessage: CosConversationItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: visibleMessage,
      state: "ready",
      attachments: options?.attachments ?? [],
      createdAt: new Date().toISOString(),
    }

    setConversation((current) => [...current, optimisticUserMessage])
    setIsSending(true)
    setChatFeedback(
      !options?.cancel && requestedCreditCost > 0
        ? `Custo desta ação: ${requestedCreditCost} Créditos IA.`
        : "",
    )

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
      if (!response.ok) {
        if (data?.creditsBlocked) {
          const availableCredits = data.availableCredits ?? assistantCredits.balance
          const requiredCredits = data.requiredCredits ?? requestedCreditCost
          throw new Error(
            repairCosText(
              data.error ||
                `Créditos IA insuficientes. Disponível: ${availableCredits}. Necessário: ${requiredCredits}. Abra a página Plano para continuar.`,
            ),
          )
        }

        throw new Error(repairCosText(data?.error || "Nao foi possivel falar com o COS agora."))
      }

      if (data?.conversation) {
        setActiveConversationId(data.conversation.id)
      }

      // The Clientes list (broker-clients-page.tsx) has its own local fetch + entity-sync
      // subscription with zero visibility into server-side COS capability code — a mutation
      // there is otherwise invisible to it until a manual reload. dispatchEntitySync is the same
      // browser-only pub-sub the list already listens to for edits made from its own "Excluir"
      // button; this just fires it for the COS-driven deletion too, once the turn that actually
      // completed the delete comes back (not the confirmation/ambiguity prompts along the way).
      if (data?.action === "DELETE_LEAD" && data?.actionStatus === "success") {
        const deletedLeadId = typeof data?.metadata?.leadId === "string" ? data.metadata.leadId : undefined
        dispatchEntitySync({ type: "lead", entityId: deletedLeadId })
      }

      const responseOptions =
        parseCosResponseOptions(data?.metadata?.options) ??
        parseCosResponseOptions(data?.metadata?.workflow?.pendingInput?.parsedData?.options)
      const assistantMessage: CosConversationItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: repairCosText(data?.response || "Nao consegui responder agora."),
        state: "ready",
        action: data?.action ?? options?.action ?? null,
        actionStatus: data?.actionStatus ?? "success",
        confirmRequired: Boolean(data?.confirmRequired),
        options: responseOptions,
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
          options: responseOptions,
        })
        setChatFeedback("Aguardando sua confirmação.")
      } else {
        setPendingConfirmation(null)
        setChatFeedback(
          data?.creditsUsed
            ? `${formatCosAction(data?.action || options?.action || "general")} -${data.creditsUsed} crédito IA`
            : options?.cancel
              ? "Alteração cancelada."
              : "",
        )
      }

      await loadConversations({ limit: loadedConversationCountRef.current })
    } catch (caughtError) {
      const messageText = repairCosText(caughtError instanceof Error ? caughtError.message : "Nao foi possivel falar com o COS agora.")

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

  const selectPendingOption = useCallback(async (option: CosResponseOption) => {
    await sendCosMessage(option.label, {
      visibleMessage: option.label,
      attachments: pendingConfirmation?.attachments ?? [],
    })
  }, [pendingConfirmation, sendCosMessage])

  useEffect(() => {
    writeConversationCache({
      conversation,
      conversations,
      activeConversationId,
      pendingConfirmation,
    })
  }, [activeConversationId, conversation, conversations, pendingConfirmation])

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

    const cached = initialCacheRef.current

    setIsBootstrappingConversation(!cached)
    if (!cached) {
      setConversation([])
      setPendingConfirmation(null)
      setActiveConversationId("")
    }
    loadConversations()
      .then((items) => {
        const preferredConversationId =
          cached?.activeConversationId && items.some((item) => item.id === cached.activeConversationId)
            ? cached.activeConversationId
            : autoOpenLatest
              ? (items[0]?.id ?? "")
              : ""

        if (preferredConversationId) {
          return openConversation(preferredConversationId, {
            preserveVisibleConversation: Boolean(cached?.activeConversationId === preferredConversationId),
            skipLoadingState: Boolean(cached?.activeConversationId === preferredConversationId),
          })
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
    selectPendingOption,
    hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations: async () => {
      if (isLoadingMoreConversations || !hasMoreConversations) return
      setIsLoadingMoreConversations(true)
      try {
        await loadConversations({
          append: true,
          offset: conversations.length,
          limit: INITIAL_CONVERSATION_PAGE_SIZE,
        })
      } finally {
        if (isMountedRef.current) {
          setIsLoadingMoreConversations(false)
        }
      }
    },
  }
}

function formatCosAction(action: string | null) {
  return getCosCapabilityLabel(action)
}
