"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { CosComposerAttachment } from "@/components/cos-prompt-composer"
import { getCosCapabilityLabel } from "@/lib/cos/capability-catalog"
import { repairLegacyCosText } from "@/lib/cos/localization"
import { parseCosResponseViewModel, type CosResponseViewModel } from "@/lib/cos/response-view-model"
import { resolveFastCosAction } from "@/lib/cos/fast-action-resolver"
import { deriveWorkspaceContextFromPathname } from "@/lib/cos/workspace-context"
import type { CosWorkspaceContext } from "@/lib/cos/types"
import { resolveCosConversationCategory, type CosConversationCategoryId } from "@/lib/cos-conversations"
import { dispatchEntitySync } from "@/lib/entity-sync"
import { getEmeCreditCost } from "@/lib/eme-plans"

export type AssistantCredits = {
  balance: number
  usedThisMonth: number
}

export type CosConversationSummary = {
  id: string
  title: string
  category?: CosConversationCategoryId
  createdAt: string
  updatedAt: string
  lastInteractionAt: string
}

export type CosResponseOption = {
  id: string
  actionId: string
  label: string
  description?: string
  action?: string | null
  message?: string
  selectedOptionId?: string
  href?: string
}

export type CosInteractionType = "confirmation" | "selection" | "navigation" | "wizard" | "preview" | "summary" | "result"

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
  interactionType?: CosInteractionType
  responseView?: CosResponseViewModel
  createdAt?: string
}

export type PendingConfirmation = {
  action: string
  sourceMessage: string
  sourceInteractionId: string
  prompt?: string
  confirmLabel?: string
  cancelLabel?: string
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
  interactionType?: CosInteractionType
  responseView?: unknown
  conversation?: CosConversationSummary | null
  metadata?: {
    interactionType?: unknown
    responseView?: unknown
    confirmationPrompt?: unknown
    confirmationConfirmLabel?: unknown
    confirmationCancelLabel?: unknown
    leadId?: unknown
    options?: unknown
    workflow?: {
      id?: unknown
      status?: unknown
      pendingInput?: {
        action?: unknown
        field?: unknown
        options?: unknown
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
      actionId: typeof item.actionId === "string" ? item.actionId : (item.id as string),
      label: repairLegacyCosText(item.label as string),
      description: typeof item.description === "string" ? repairLegacyCosText(item.description) : undefined,
      action: typeof item.action === "string" ? item.action : null,
      message: typeof item.message === "string" ? repairLegacyCosText(item.message) : undefined,
      selectedOptionId: typeof item.selectedOptionId === "string" ? item.selectedOptionId : undefined,
      href: typeof item.href === "string" ? item.href : undefined,
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
  suppressedPendingConfirmation: {
    conversationId: string
    sourceInteractionId: string
  } | null
}

const COS_CONVERSATION_CACHE_KEY = "eme-cos-conversation-cache"
const INITIAL_CONVERSATION_PAGE_SIZE = 15

function normalizeInteractionType(value: unknown): CosInteractionType | undefined {
  return value === "confirmation" ||
    value === "selection" ||
    value === "navigation" ||
    value === "wizard" ||
    value === "preview" ||
    value === "summary" ||
    value === "result"
    ? value
    : undefined
}

function inferInteractionType(input: {
  action?: string | null
  actionStatus?: string | null
  confirmRequired?: boolean
  options?: CosResponseOption[]
  content?: string
  state?: "ready" | "error"
  metadataType?: unknown
}): CosInteractionType | undefined {
  const explicit = normalizeInteractionType(input.metadataType)
  if (explicit) return explicit
  if (input.confirmRequired) return "confirmation"
  if ((input.options?.length ?? 0) > 0) return "selection"
  if (input.action === "workflow_details") return "summary"
  if (input.actionStatus === "needs_clarification") return "selection"
  if (input.state === "error") return "result"
  if (input.content?.toLowerCase().includes("preview")) return "preview"
  if (input.actionStatus === "success") return "result"
  return "wizard"
}

function buildFriendlyCreditsMessage(input: { availableCredits: number; requiredCredits: number }) {
  const missingCredits = Math.max(0, input.requiredCredits - input.availableCredits)
  return [
    "Você ficou sem Créditos IA para executar esta ação.",
    "",
    `Disponível agora: ${input.availableCredits} crédito${input.availableCredits === 1 ? "" : "s"}.`,
    `Necessário para continuar: ${input.requiredCredits} crédito${input.requiredCredits === 1 ? "" : "s"}.`,
    missingCredits > 0 ? `Faltam ${missingCredits} crédito${missingCredits === 1 ? "" : "s"} na sua conta.` : "",
    "",
    "Faça upgrade do plano ou adquira créditos adicionais para continuar usando os recursos inteligentes do COS.",
  ]
    .filter(Boolean)
    .join("\n")
}

function extractConfirmationSubject(content: string) {
  const normalized = repairLegacyCosText(content)
  const patterns = [/cliente ([^.?\n]+)/i, /im[óo]vel ([^.?\n]+)/i, /contrato ([^.?\n]+)/i, /proposta ([^.?\n]+)/i, /compromisso ([^.?\n]+)/i, /documento ([^.?\n]+)/i]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[0]) return match[0].replace(/\s+/g, " ").trim()
  }

  return ""
}

function buildPendingConfirmationLabels(input: { action: string; content: string }) {
  const subject = extractConfirmationSubject(input.content)

  if (input.action === "DELETE_LEAD") {
    return {
      prompt: subject ? `Confirmar exclusão do ${subject}?` : "Confirmar exclusão deste cliente?",
      confirmLabel: subject ? `Excluir ${subject}` : "Excluir cliente",
      cancelLabel: "Manter cliente",
    }
  }

  if (input.action === "ATTACH_LEAD_DOCUMENT") {
    return {
      prompt: subject ? `Confirmar anexo do documento ao ${subject}?` : "Confirmar anexo do documento?",
      confirmLabel: "Anexar documento",
      cancelLabel: "Cancelar anexo",
    }
  }

  const actionLabel = repairLegacyCosText(getCosCapabilityLabel(input.action)).replace(/^Ação do COS$/i, "ação")
  return {
    prompt: subject ? `Confirmar ${actionLabel.toLowerCase()} para ${subject}?` : `Confirmar ${actionLabel.toLowerCase()}?`,
    confirmLabel: `Confirmar ${actionLabel.toLowerCase()}`,
    cancelLabel: "Cancelar ação",
  }
}

function normalizeConversationSummary(item: CosConversationSummary): CosConversationSummary {
  const title = repairLegacyCosText(item.title)

  return {
    ...item,
    title,
    category: item.category ?? resolveCosConversationCategory({ title }),
  }
}

function normalizeConversationItem(item: CosConversationItem): CosConversationItem {
  const responseView = parseCosResponseViewModel(item.responseView)
  return {
    ...item,
    content: responseView?.text ?? repairLegacyCosText(item.content),
    responseView: responseView ?? undefined,
    interactionType: responseView?.interactionType ?? inferInteractionType({
      action: item.action,
      actionStatus: item.actionStatus,
      confirmRequired: item.confirmRequired,
      options: item.options,
      content: item.content,
      state: item.state,
    }),
    options: item.options?.map((option) => ({
      ...option,
      actionId: option.actionId,
      label: repairLegacyCosText(option.label),
      description: option.description ? repairLegacyCosText(option.description) : undefined,
      message: option.message ? repairLegacyCosText(option.message) : undefined,
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
      pendingConfirmation:
        parsed.pendingConfirmation && typeof parsed.pendingConfirmation === "object"
          ? {
              ...(parsed.pendingConfirmation as PendingConfirmation),
              prompt:
                typeof (parsed.pendingConfirmation as { prompt?: unknown }).prompt === "string"
                  ? repairLegacyCosText((parsed.pendingConfirmation as { prompt: string }).prompt)
                  : undefined,
              confirmLabel:
                typeof (parsed.pendingConfirmation as { confirmLabel?: unknown }).confirmLabel === "string"
                  ? repairLegacyCosText((parsed.pendingConfirmation as { confirmLabel: string }).confirmLabel)
                  : undefined,
              cancelLabel:
                typeof (parsed.pendingConfirmation as { cancelLabel?: unknown }).cancelLabel === "string"
                  ? repairLegacyCosText((parsed.pendingConfirmation as { cancelLabel: string }).cancelLabel)
                  : undefined,
            }
          : null,
      suppressedPendingConfirmation:
        parsed.suppressedPendingConfirmation &&
        typeof parsed.suppressedPendingConfirmation === "object" &&
        typeof (parsed.suppressedPendingConfirmation as { conversationId?: unknown }).conversationId === "string" &&
        typeof (parsed.suppressedPendingConfirmation as { sourceInteractionId?: unknown }).sourceInteractionId === "string"
          ? {
              conversationId: (parsed.suppressedPendingConfirmation as { conversationId: string }).conversationId,
              sourceInteractionId: (parsed.suppressedPendingConfirmation as { sourceInteractionId: string }).sourceInteractionId,
            }
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
  const router = useRouter()
  const initialCacheRef = useRef<CosConversationCache | null>(null)
  if (initialCacheRef.current === null) {
    initialCacheRef.current = readConversationCache()
  }

  const [conversation, setConversation] = useState<CosConversationItem[]>(() => initialCacheRef.current?.conversation ?? [])
  const [conversations, setConversations] = useState<CosConversationSummary[]>(() => initialCacheRef.current?.conversations ?? [])
  const [activeConversationId, setActiveConversationId] = useState(() => initialCacheRef.current?.activeConversationId ?? "")
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(() => initialCacheRef.current?.pendingConfirmation ?? null)
  const [suppressedPendingConfirmation, setSuppressedPendingConfirmation] = useState<{
    conversationId: string
    sourceInteractionId: string
  } | null>(() => initialCacheRef.current?.suppressedPendingConfirmation ?? null)
  const [chatFeedback, setChatFeedback] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [hasMoreConversations, setHasMoreConversations] = useState(false)
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false)
  const [isBootstrappingConversation, setIsBootstrappingConversation] = useState(() => !initialCacheRef.current)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasBootstrappedRef = useRef(false)
  const isMountedRef = useRef(true)
  const queuedNavigationHrefRef = useRef<string | null>(null)
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

  const navigateToFastActionHref = useCallback((href: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(href)
      return
    }

    router.push(href)
  }, [router])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
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
    if (!response.ok) throw new Error(repairLegacyCosText(data?.error || "Não foi possível carregar o histórico do COS."))

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

  const getVisiblePendingConfirmation = useCallback((input: {
    conversationId: string
    pendingConfirmation: PendingConfirmation | null | undefined
  }) => {
    const nextPendingConfirmation = input.pendingConfirmation ?? null
    if (!nextPendingConfirmation) return null

    if (
      suppressedPendingConfirmation?.conversationId === input.conversationId &&
      suppressedPendingConfirmation.sourceInteractionId === nextPendingConfirmation.sourceInteractionId
    ) {
      return null
    }

    return nextPendingConfirmation
  }, [suppressedPendingConfirmation])

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
      if (!response.ok) throw new Error(repairLegacyCosText(data?.error || "Não foi possível abrir a conversa."))

      if (!isMountedRef.current || requestId !== openConversationRequestIdRef.current) {
        return
      }

      setConversation((data?.messages ?? []).map(normalizeConversationItem))
      setPendingConfirmation(getVisiblePendingConfirmation({
        conversationId,
        pendingConfirmation: data?.pendingConfirmation ?? null,
      }))
      setActiveConversationId(conversationId)
    } catch (caughtError) {
      if (!isMountedRef.current || requestId !== openConversationRequestIdRef.current) {
        return
      }
      setChatFeedback(repairLegacyCosText(caughtError instanceof Error ? caughtError.message : "Não foi possível abrir a conversa."))
    } finally {
      if (isMountedRef.current && requestId === openConversationRequestIdRef.current) {
        setIsConversationLoading(false)
        window.setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
  }, [getVisiblePendingConfirmation])

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
      throw new Error(repairLegacyCosText(data?.error || "Não foi possível criar a conversa."))
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
    setSuppressedPendingConfirmation(null)
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
    if (!response.ok || !data?.conversation) throw new Error(repairLegacyCosText(data?.error || "Não foi possível renomear a conversa."))

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
    if (!response.ok) throw new Error(repairLegacyCosText(data?.error || "Não foi possível excluir a conversa."))

    const nextConversations = conversations.filter((item) => item.id !== conversationId)
    setConversations(nextConversations)

    if (activeConversationId === conversationId) {
      setActiveConversationId("")
      setConversation([])
      setPendingConfirmation(null)
      setSuppressedPendingConfirmation(null)

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
      optionActionId?: string
      selectedOptionId?: string
    },
  ) => {
    const normalizedMessage = messageToSend.trim()
    if (!normalizedMessage || isSending) return

    const messageWorkspaceContext = deriveWorkspaceContextFromPathname({
      pathname: pathname || "/corretor",
      surface: source,
      workspace: {
        ...resolvedWorkspaceContext,
        ...(options?.workspaceContext ?? {}),
      },
    })
    const fastAction =
      !options?.action && !options?.confirm && !options?.cancel
        ? resolveFastCosAction({
            message: normalizedMessage,
            workspace: messageWorkspaceContext,
            context: {
              brokerId: "",
              userId: "",
              surface: source,
              message: normalizedMessage,
              workspace: messageWorkspaceContext,
              workflow: null,
              memory: null,
              snapshot: null,
              decision: null,
              knowledge: null,
              attachments: options?.attachments ?? [],
              selectedEntityIds: {},
            },
          })
        : { kind: "none" as const, confidence: 0 }

    const shouldSuppressCurrentPendingConfirmation =
      (fastAction.kind === "navigation" || fastAction.kind === "workflow_details" || fastAction.kind === "workflow_action") &&
      Boolean(pendingConfirmation?.sourceInteractionId) &&
      Boolean(activeConversationId)

    if (fastAction.kind === "navigation") {
      const nextSuppressedPendingConfirmation =
        shouldSuppressCurrentPendingConfirmation && pendingConfirmation?.sourceInteractionId && activeConversationId
          ? {
              conversationId: activeConversationId,
              sourceInteractionId: pendingConfirmation.sourceInteractionId,
            }
          : null

      writeConversationCache({
        conversation,
        conversations,
        activeConversationId,
        pendingConfirmation: null,
        suppressedPendingConfirmation: nextSuppressedPendingConfirmation,
      })

      if (shouldSuppressCurrentPendingConfirmation && pendingConfirmation?.sourceInteractionId && activeConversationId) {
        setSuppressedPendingConfirmation({
          conversationId: activeConversationId,
          sourceInteractionId: pendingConfirmation.sourceInteractionId,
        })
      }
      setPendingConfirmation(null)
      setChatFeedback("")
      if (isBootstrappingConversation || isConversationLoading) {
        queuedNavigationHrefRef.current = fastAction.href
      } else {
        queuedNavigationHrefRef.current = null
        navigateToFastActionHref(fastAction.href)
      }
      return
    }

    const resolvedOptions =
      fastAction.kind === "workflow_details"
        ? {
            ...options,
            action: fastAction.action,
            visibleMessage: options?.visibleMessage ?? "Ver detalhes da operação",
          }
        : fastAction.kind === "workflow_action"
          ? {
              ...options,
              action: fastAction.action,
            }
          : options

    if (!resolvedOptions?.cancel && !assistantEnabled) {
      setChatFeedback("Ative o COS para continuar.")
      return
    }

    const previewLabel = resolvedOptions?.visibleMessage ?? normalizedMessage
    const isWorkflowDetailsRequest =
      resolvedOptions?.action === "workflow_details" ||
      previewLabel.toLowerCase().includes("ver detalhes da opera")

    const requestedCreditCost =
      isWorkflowDetailsRequest
        ? 0
        : typeof resolvedOptions?.creditCostPreview === "number"
          ? Math.max(0, Math.trunc(resolvedOptions.creditCostPreview))
          : resolvedOptions?.action
            ? getEmeCreditCost(resolvedOptions.action)
            : 0

    if (!resolvedOptions?.cancel && requestedCreditCost > 0 && assistantCredits.balance < requestedCreditCost) {
      setChatFeedback(buildFriendlyCreditsMessage({ availableCredits: assistantCredits.balance, requiredCredits: requestedCreditCost }))
      return
    }

    if (!resolvedOptions?.cancel && requestedCreditCost > 0 && assistantCredits.balance < requestedCreditCost) {
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
      attachments: resolvedOptions?.attachments ?? [],
      createdAt: new Date().toISOString(),
    }

    setConversation((current) => [...current, optimisticUserMessage])
    setIsSending(true)
    if (shouldSuppressCurrentPendingConfirmation && pendingConfirmation?.sourceInteractionId && activeConversationId) {
      setSuppressedPendingConfirmation({
        conversationId: activeConversationId,
        sourceInteractionId: pendingConfirmation.sourceInteractionId,
      })
    } else {
      setSuppressedPendingConfirmation(null)
    }
    setChatFeedback(
      !resolvedOptions?.cancel && requestedCreditCost > 0
        ? `Custo desta ação: ${requestedCreditCost} Créditos IA.`
        : "",
    )

    if (!resolvedOptions?.cancel && requestedCreditCost > 0) {
      setChatFeedback(`Esta ação utiliza ${requestedCreditCost} Crédito${requestedCreditCost === 1 ? "" : "s"} IA.`)
    }

    try {
      const response = await fetch("/api/assistant/eme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          message: normalizedMessage,
          displayMessage: visibleMessage,
          action: resolvedOptions?.action,
          optionActionId: resolvedOptions?.optionActionId,
          selectedOptionId: resolvedOptions?.selectedOptionId,
          confirm: Boolean(resolvedOptions?.confirm),
          cancel: Boolean(resolvedOptions?.cancel),
          attachments: resolvedOptions?.attachments ?? [],
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
          const blockedMessage = buildFriendlyCreditsMessage({ availableCredits, requiredCredits })
          const blockedOptions =
            data.ctaHref && data.ctaLabel
              ? [
                  {
                    id: "billing_cta",
                    actionId: "billing:open_plan",
                    label: repairLegacyCosText(data.ctaLabel),
                    href: data.ctaHref,
                    message: repairLegacyCosText(data.ctaLabel),
                  } satisfies CosResponseOption,
                ]
              : undefined

          setConversation((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: blockedMessage,
              state: "error",
              actionStatus: "error",
              options: blockedOptions,
              interactionType: "result",
              sourceMessage: normalizedMessage,
              createdAt: new Date().toISOString(),
            },
          ])
          setChatFeedback(blockedMessage)
          return
          throw new Error(
            repairLegacyCosText(
              data?.error ||
                `Créditos IA insuficientes. Disponível: ${availableCredits}. Necessário: ${requiredCredits}. Abra a página Plano para continuar.`,
            ),
          )
        }

        throw new Error(repairLegacyCosText(data?.error || "Não foi possível falar com o COS agora."))
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

      const responseView = parseCosResponseViewModel(data?.responseView ?? data?.metadata?.responseView)
      const responseOptions =
        parseCosResponseOptions(data?.metadata?.options) ??
        parseCosResponseOptions(data?.metadata?.workflow?.pendingInput?.options) ??
        parseCosResponseOptions(data?.metadata?.workflow?.pendingInput?.parsedData?.options)
      const assistantMessage: CosConversationItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseView?.text ?? data?.response ?? "Não consegui responder agora.",
        state: "ready",
        action: data?.action ?? resolvedOptions?.action ?? null,
        actionStatus: data?.actionStatus ?? "success",
        confirmRequired: Boolean(data?.confirmRequired),
        options: responseOptions,
        sourceMessage: normalizedMessage,
        sourceInteractionId: "",
        interactionType: responseView?.interactionType ?? inferInteractionType({
          action: data?.action ?? resolvedOptions?.action ?? null,
          actionStatus: data?.actionStatus ?? "success",
          confirmRequired: Boolean(data?.confirmRequired),
          options: responseOptions,
          content: data?.response || "",
          state: "ready",
          metadataType: data?.interactionType ?? data?.metadata?.interactionType,
        }),
        responseView: responseView ?? undefined,
        createdAt: new Date().toISOString(),
      }

      setConversation((current) => [...current, assistantMessage])

      const persistedConfirmationAction =
        data?.metadata?.workflow?.pendingInput?.field === "confirmation" &&
        typeof data.metadata.workflow.pendingInput.action === "string"
          ? data.metadata.workflow.pendingInput.action
          : null

      const preservesExistingConfirmation = Boolean(
        data?.confirmRequired &&
        persistedConfirmationAction &&
        pendingConfirmation?.action === persistedConfirmationAction &&
        assistantMessage.action !== persistedConfirmationAction,
      )

      if (preservesExistingConfirmation) {
        setPendingConfirmation(pendingConfirmation)
        setChatFeedback("Revise a ação pendente e confirme quando quiser continuar.")
      } else if (data?.confirmRequired && (persistedConfirmationAction || assistantMessage.action)) {
        const confirmationAction = persistedConfirmationAction ?? assistantMessage.action!
        assistantMessage.sourceInteractionId = assistantMessage.id
        setSuppressedPendingConfirmation(null)
        setPendingConfirmation({
          action: confirmationAction,
          sourceMessage: normalizedMessage,
          sourceInteractionId: assistantMessage.id,
          prompt:
            typeof data?.metadata?.confirmationPrompt === "string"
              ? repairLegacyCosText(data.metadata.confirmationPrompt)
              : responseView?.confirmation?.prompt ?? buildPendingConfirmationLabels({ action: confirmationAction, content: assistantMessage.content }).prompt,
          confirmLabel:
            typeof data?.metadata?.confirmationConfirmLabel === "string"
              ? repairLegacyCosText(data.metadata.confirmationConfirmLabel)
              : responseView?.confirmation?.confirmLabel ?? buildPendingConfirmationLabels({ action: confirmationAction, content: assistantMessage.content }).confirmLabel,
          cancelLabel:
            typeof data?.metadata?.confirmationCancelLabel === "string"
              ? repairLegacyCosText(data.metadata.confirmationCancelLabel)
              : responseView?.confirmation?.cancelLabel ?? buildPendingConfirmationLabels({ action: confirmationAction, content: assistantMessage.content }).cancelLabel,
          attachments: resolvedOptions?.attachments ?? [],
          options: responseOptions,
        })
        setChatFeedback("Aguardando sua confirmação.")
        setChatFeedback("Revise a ação e confirme para continuar.")
      } else if (persistedConfirmationAction && pendingConfirmation?.action === persistedConfirmationAction) {
        // Uma consulta curta pode ser respondida sem encerrar a ação que aguardava confirmação.
        // O workflow persistido é a fonte de verdade; mantenha o card existente enquanto a API
        // informar que a mesma confirmação continua pendente.
        setPendingConfirmation(pendingConfirmation)
        setChatFeedback("Revise a ação pendente e confirme quando quiser continuar.")
      } else {
        setPendingConfirmation(null)
        setChatFeedback(
          data?.creditsUsed
            ? `${formatCosAction(data?.action || resolvedOptions?.action || "general")} -${data.creditsUsed} crédito IA`
            : resolvedOptions?.cancel
              ? "Alteração cancelada."
              : "",
        )
      }

      await loadConversations({ limit: loadedConversationCountRef.current })
    } catch (caughtError) {
      const messageText = repairLegacyCosText(caughtError instanceof Error ? caughtError.message : "Não foi possível falar com o COS agora.")

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
  }, [activeConversationId, assistantCredits.balance, assistantEnabled, conversation, conversations, isBootstrappingConversation, isConversationLoading, isSending, loadConversations, navigateToFastActionHref, pathname, pendingConfirmation, resolvedWorkspaceContext, setAssistantCredits, source])

  useEffect(() => {
    if (isBootstrappingConversation || isConversationLoading) return

    const queuedHref = queuedNavigationHrefRef.current
    if (!queuedHref) return

    queuedNavigationHrefRef.current = null
    navigateToFastActionHref(queuedHref)
  }, [isBootstrappingConversation, isConversationLoading, navigateToFastActionHref])

  const confirmPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      confirm: true,
      action: pendingConfirmation.action,
      visibleMessage: pendingConfirmation.confirmLabel ?? pendingConfirmation.prompt ?? "Confirmar ação",
      attachments: pendingConfirmation.attachments ?? [],
    })
  }, [pendingConfirmation, sendCosMessage])

  const cancelPendingAction = useCallback(async () => {
    if (!pendingConfirmation) return
    // creditCostPreview must be 0 (not omitted): cancelar nunca cobra crédito, e sem isso
    // sendCosMessage cai em getEmeCreditCost(pendingConfirmation.action), que lança em dev para
    // qualquer action ainda não cadastrada em EME_CREDIT_COSTS (ex.: CANCEL_CONTRACT) — o clique
    // em "Cancelar ação" quebrava antes mesmo de enviar a requisição de cancelamento ao servidor.
    await sendCosMessage(pendingConfirmation.sourceMessage, {
      cancel: true,
      action: pendingConfirmation.action,
      visibleMessage: pendingConfirmation.cancelLabel ?? "Cancelar ação",
      attachments: pendingConfirmation.attachments ?? [],
      creditCostPreview: 0,
    })
  }, [pendingConfirmation, sendCosMessage])

  const selectPendingOption = useCallback(async (option: CosResponseOption) => {
    if (option.href) {
      navigateToFastActionHref(option.href)
      return
    }

    const carriesWorkflowAttachment = option.actionId.startsWith("workflow_selection:")
    await sendCosMessage(option.message ?? option.label, {
      action: option.action ?? undefined,
      visibleMessage: option.label,
      optionActionId: option.actionId,
      selectedOptionId: option.selectedOptionId ?? option.id,
      attachments: carriesWorkflowAttachment ? pendingConfirmation?.attachments ?? [] : [],
    })
  }, [navigateToFastActionHref, pendingConfirmation, sendCosMessage])

  useEffect(() => {
    writeConversationCache({
      conversation,
      conversations,
      activeConversationId,
      pendingConfirmation,
      suppressedPendingConfirmation,
    })
  }, [activeConversationId, conversation, conversations, pendingConfirmation, suppressedPendingConfirmation])

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
      setSuppressedPendingConfirmation(null)
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
