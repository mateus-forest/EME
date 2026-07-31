"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Grip,
  FileText,
  Home,
  X,
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
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { AssistantCredits, useCosConversations } from "@/components/use-cos-conversations"
import { DEFAULT_COS_CONVERSATION_TITLE } from "@/lib/cos-conversations"
import { COS_QUICK_ACTIONS } from "@/lib/cos-quick-actions"
import type { ContractRecord } from "@/lib/contracts-client"
import type { LeadRecord } from "@/lib/lead-contract"

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

type DocumentItem = {
  id: string
  title: string
  type: string
  status: string
  createdAt: string
}

type FinancialConfigResponse = {
  config?: {
    commissionPercent?: number
  }
}

type NextStepSuggestion =
  | { label: string; message: string; focusOnly?: false }
  | { label: string; focusOnly: true; message?: never }

export function BrokerPortal() {
  const { properties } = useBrokerProperties()
  const { profile, isLoading: isProfileLoading } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const [prompt, setPrompt] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [isNextStepModalOpen, setIsNextStepModalOpen] = useState(false)
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>([])
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [commissionPercent, setCommissionPercent] = useState(6)
  const [isOperationHealthExpanded, setIsOperationHealthExpanded] = useState(false)
  const [isMobileOperationHealthOpen, setIsMobileOperationHealthOpen] = useState(false)
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
    isBootstrappingConversation,
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
    bootstrapEnabled: !isProfileLoading,
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

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[] } | null
        if (!ignore && response.ok) setLeads(data?.leads ?? [])
      })
      .catch(() => null)

    fetch("/api/brokers/documents?status=all", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { documents?: DocumentItem[] } | null
        if (!ignore && response.ok) setDocuments(data?.documents ?? [])
      })
      .catch(() => null)

    fetch("/api/brokers/contracts", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { contracts?: ContractRecord[] } | null
        if (!ignore && response.ok) setContracts(data?.contracts ?? [])
      })
      .catch(() => null)

    fetch("/api/brokers/financial", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as FinancialConfigResponse | null
        if (!ignore && response.ok) setCommissionPercent(Number(data?.config?.commissionPercent) || 6)
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
    return firstName || ""
  }, [profile.fullName])
  const hasResolvedBrokerName = profile.fullName.trim().length > 0
  const greetingLabel = brokerFirstName ? `Ola, ${brokerFirstName}.` : "Ola."

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
  const primaryCosSuggestions = [
    { label: "Proximos compromissos", message: "Me mostre meus proximos compromissos" },
    { label: "Revisar clientes", message: "Revisar clientes" },
    { label: "Analisar carteira", message: "Analisar carteira" },
  ] satisfies NextStepSuggestion[]
  const isBootstrapPending = isProfileLoading || isBootstrappingConversation
  const isConversationEmpty = !isBootstrapPending && !isConversationLoading && conversation.length === 0

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )
  const showConversationTitle = Boolean(
    activeConversation?.title && activeConversation.title !== DEFAULT_COS_CONVERSATION_TITLE,
  )

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

  async function handleOperationDetails() {
    const missingRegistry = properties.filter((property) => !property.legal.registryNumber).length
    const missingPropertyDocuments = properties.filter((property) => property.documents.length === 0).length
    const draftDocuments = documents.filter((document) => document.status === "draft").length
    const draftContracts = contracts.filter((contract) => contract.status === "draft").length
    const awaitingSignature = contracts.filter((contract) => contract.status === "awaiting_signature").length
    const missingLeadInfo = leads.filter(
      (lead) => !lead.identification.rg || !lead.identification.cpfCnpj || !lead.address.city,
    ).length
    const unattendedLeads = leads.filter((lead) => lead.status === "NEW").length
    const pendingAgenda = agendaEvents.filter((event) => event.status === "pending" && event.date <= todayKey).length

    const operationalSummary = [
      `Imoveis sem matricula: ${missingRegistry}`,
      `Imoveis sem documentos anexados: ${missingPropertyDocuments}`,
      `Propostas ou documentos em rascunho: ${draftDocuments}`,
      `Contratos em rascunho: ${draftContracts}`,
      `Contratos aguardando assinatura: ${awaitingSignature}`,
      `Clientes com informacoes faltantes: ${missingLeadInfo}`,
      `Leads sem atendimento: ${unattendedLeads}`,
      `Compromissos pendentes: ${pendingAgenda}`,
    ].join("\n")

    await sendCosMessage(
      `Analise minha operacao e conduza um workflow pratico com base nas pendencias reais abaixo. Priorize o que exige acao imediata, agrupe por categoria e me diga por onde comecar.\n\n${operationalSummary}`,
      { visibleMessage: "Ver detalhes da operacao" },
    )
    setPrompt("")
  }

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const leadScore = useMemo(() => averageScore(leads.map((lead) => lead.completion.score)), [leads])
  const propertyScore = useMemo(() => averageScore(properties.map((property) => property.completion.score)), [properties])
  const documentScore = useMemo(() => {
    if (documents.length === 0) return 100
    const healthy = documents.filter((document) => document.status !== "draft").length
    return Math.round((healthy / documents.length) * 100)
  }, [documents])
  const contractScore = useMemo(() => {
    if (contracts.length === 0) return 100
    const healthy = contracts.filter((contract) => contract.status !== "cancelled").length
    return Math.round((healthy / contracts.length) * 100)
  }, [contracts])
  const agendaScore = useMemo(() => {
    if (agendaEvents.length === 0) return 100
    const overdue = agendaEvents.filter((event) => event.status === "pending" && event.date < todayKey).length
    return clampScore(100 - overdue * 12)
  }, [agendaEvents, todayKey])
  const leadsScore = useMemo(() => {
    if (leads.length === 0) return 100
    const unattended = leads.filter((lead) => lead.status === "NEW").length
    return clampScore(Math.round(((leads.length - unattended) / leads.length) * 100))
  }, [leads])

  const operationHealth = useMemo(
    () =>
      clampScore(
        Math.round((leadScore + propertyScore + documentScore + contractScore + agendaScore + leadsScore) / 6),
      ),
    [agendaScore, contractScore, documentScore, leadScore, leadsScore, propertyScore],
  )

  const operationIndicators = useMemo(
    () => [
      { label: "Clientes", score: leadScore, icon: UsersRound },
      { label: "Imoveis", score: propertyScore, icon: Home },
      { label: "Documentos", score: documentScore, icon: FileText },
      { label: "Contratos", score: contractScore, icon: FileText },
      { label: "Agenda", score: agendaScore, icon: CalendarDays },
      { label: "Leads", score: leadsScore, icon: UsersRound },
    ],
    [agendaScore, contractScore, documentScore, leadScore, leadsScore, propertyScore],
  )

  const operationPendingItems = useMemo(() => {
    const missingRegistry = properties.filter((property) => !property.legal.registryNumber).length
    const missingPropertyDocuments = properties.filter((property) => property.documents.length === 0).length
    const missingRg = leads.filter((lead) => !lead.identification.rg).length
    const unattendedLeads = leads.filter((lead) => lead.status === "NEW").length
    const awaitingSignature = contracts.filter((contract) => contract.status === "awaiting_signature").length
    const draftDocuments = documents.filter((document) => document.status === "draft").length
    const pendingAgenda = agendaEvents.filter((event) => event.status === "pending" && event.date <= todayKey).length

    return [
      missingRegistry > 0 ? `${missingRegistry} ${pluralize("imovel", "imoveis", missingRegistry)} sem matricula` : null,
      missingPropertyDocuments > 0
        ? `${missingPropertyDocuments} ${pluralize("imovel", "imoveis", missingPropertyDocuments)} sem documentos`
        : null,
      missingRg > 0 ? `${missingRg} ${pluralize("cliente", "clientes", missingRg)} sem RG` : null,
      unattendedLeads > 0 ? `${unattendedLeads} ${pluralize("lead", "leads", unattendedLeads)} sem atendimento` : null,
      awaitingSignature > 0
        ? `${awaitingSignature} ${pluralize("contrato", "contratos", awaitingSignature)} aguardando assinatura`
        : null,
      draftDocuments > 0 ? `${draftDocuments} ${pluralize("documento", "documentos", draftDocuments)} em rascunho` : null,
      pendingAgenda > 0 ? `${pendingAgenda} ${pluralize("compromisso", "compromissos", pendingAgenda)} pendente${pendingAgenda > 1 ? "s" : ""}` : null,
    ].filter((item): item is string => Boolean(item))
  }, [agendaEvents, contracts, documents, leads, properties, todayKey])

  const visiblePendingCount = operationPendingItems.length

  return (
    <>
      <BrokerPageShell title="COS" variant="cos" contentClassName="overflow-hidden">
        <section className="min-h-full w-full bg-[#f4f1eb]">
          <div className="mx-auto grid min-h-[calc(100svh_-_env(safe-area-inset-top,0px))] w-full max-w-[86rem] gap-6 px-4 pb-5 pt-2 sm:px-6 lg:min-h-[calc(100dvh_-_1.5rem)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 lg:px-8 lg:py-6">
            <div className="min-h-0">
              {isConversationEmpty ? (
                <div className="flex min-h-full flex-col">
                  <div className="flex flex-1 flex-col justify-center">
                    <div className="mx-auto flex w-full max-w-[48rem] flex-col items-center text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/12 bg-white/75 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#0d7a39]">
                        <Sparkles className="size-3.5" />
                        Centro operacional EME
                      </div>
                      <div className="mt-6 min-h-[2.75rem] sm:min-h-[3.75rem]">
                        <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#111111] sm:text-[3rem]">
                          {greetingLabel}
                        </h1>
                      </div>
                      <p className="mt-3 max-w-[38rem] text-sm leading-7 text-[#667085] sm:text-[1rem]">
                        O COS esta no centro da sua operacao para destravar clientes, catalogo, documentos,
                        contratos e agenda sem trocar de tela.
                      </p>

                      <div className="mt-7 flex w-full flex-wrap items-center justify-center gap-2.5">
                        {primaryCosSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.label}
                            type="button"
                            onClick={() => void handleNextStepSuggestion(suggestion)}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/[0.06] bg-white/88 px-4 py-2 text-sm font-medium text-[#273444] transition-colors hover:bg-white"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-10 w-full">
                        <div className="flex flex-col items-end gap-2">
                          <MobileOperationHealthTrigger
                            operationHealth={operationHealth}
                            pendingCount={visiblePendingCount}
                            onClick={() => setIsMobileOperationHealthOpen(true)}
                          />
                          <CosPromptComposer
                            prompt={prompt}
                            setPrompt={setPrompt}
                            onSubmit={handleSubmit}
                            onNewConversation={async () => {
                              await createConversation()
                            }}
                            quickActions={COS_QUICK_ACTIONS}
                            disabled={isSending || isConversationLoading}
                            inputRef={inputRef}
                            feedback={chatFeedback}
                          />
                        </div>
                      </div>
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
              ) : (
                <div className="flex h-full min-h-0 flex-col rounded-[2rem] border border-black/[0.05] bg-white/58 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8a97a8]">COS</p>
                      <div className="mt-1 min-h-[2rem]">
                        {hasResolvedBrokerName ? (
                          <h1 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-[#111111]">
                            {greetingLabel}
                          </h1>
                        ) : (
                          <div className="h-8 w-40 rounded-full bg-[#e9ece6] animate-pulse" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[#667085]">
                        Continue a conversa e mantenha a operacao sincronizada em tempo real.
                      </p>
                      {showConversationTitle ? (
                        <p className="mt-3 truncate text-sm font-medium text-[#111111]">{activeConversation?.title}</p>
                      ) : isBootstrapPending ? (
                        <div className="mt-3 h-5 w-56 rounded-full bg-[#eef1ec] animate-pulse" />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7a8798]">
                      <span className="rounded-full border border-black/[0.06] bg-white/84 px-3 py-1.5">
                        {assistantEnabled ? "COS ativo" : "COS pausado"}
                      </span>
                      <span className="rounded-full border border-black/[0.06] bg-white/84 px-3 py-1.5">
                        {assistantCredits.balance} creditos
                      </span>
                    </div>
                  </div>

                  <div ref={chatViewportRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-2">
                    {isBootstrapPending ? (
                      <CosConversationSkeleton />
                    ) : isConversationLoading ? (
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
                                  : "border border-black/[0.06] bg-white/88 text-[#334155] shadow-[0_14px_30px_rgba(15,23,42,0.04)]"
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

                  <div className="mt-auto px-1 pb-1 pt-2">
                    <div className="flex flex-col items-end gap-2">
                      <MobileOperationHealthTrigger
                        operationHealth={operationHealth}
                        pendingCount={visiblePendingCount}
                        onClick={() => setIsMobileOperationHealthOpen(true)}
                      />
                      <CosPromptComposer
                        prompt={prompt}
                        setPrompt={setPrompt}
                        onSubmit={handleSubmit}
                        onNewConversation={async () => {
                          await createConversation()
                        }}
                        quickActions={COS_QUICK_ACTIONS}
                        disabled={isSending || isConversationLoading}
                        inputRef={inputRef}
                        feedback={chatFeedback}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="hidden lg:flex lg:min-h-full lg:flex-col lg:justify-end">
              <div className="sticky bottom-6 ml-auto w-full max-w-[17rem] rounded-[1.6rem] border border-black/[0.06] bg-white/82 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.045)] backdrop-blur-xl transition-all duration-200">
                <button
                  type="button"
                  onClick={() => setIsOperationHealthExpanded((current) => !current)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                  aria-expanded={isOperationHealthExpanded}
                  aria-controls="operation-health-panel"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a97a8]">
                      Saude da operacao
                    </p>
                    <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] text-[#111111]">
                      {operationHealth}%
                    </p>
                  </div>
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#fbfbf8] text-[#667085]">
                    {isOperationHealthExpanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                  </span>
                </button>

                <div className="mt-3 h-1.5 rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full bg-[#009b3a] transition-all duration-300" style={{ width: `${operationHealth}%` }} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#667085]">
                  <span>{visiblePendingCount} pendencia{visiblePendingCount === 1 ? "" : "s"}</span>
                  <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 font-medium text-[#0d7a39]">
                    {commissionPercent}% base
                  </span>
                </div>

                <div
                  id="operation-health-panel"
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    isOperationHealthExpanded ? "mt-4 max-h-[36rem] overflow-y-auto pr-1 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <OperationHealthDetails
                    operationIndicators={operationIndicators}
                    operationPendingItems={operationPendingItems}
                    onViewDetails={() => void handleOperationDetails()}
                  />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
      <Drawer open={isMobileOperationHealthOpen} onOpenChange={setIsMobileOperationHealthOpen} repositionInputs={false}>
        <DrawerContent className="border-black/[0.06] bg-white text-[#111111] lg:hidden">
          <DrawerHeader className="gap-0 px-4 pb-0 pt-3 text-left">
            <div className="mx-auto mb-2 flex items-center justify-center">
              <Grip className="size-5 text-[#c7ced8]" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DrawerTitle className="text-base font-semibold tracking-[-0.02em] text-[#111111]">
                  Saude da operacao
                </DrawerTitle>
                <DrawerDescription className="mt-1 text-sm text-[#667085]">
                  Indicadores e pendencias da sua operacao sem sair do COS.
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-full border border-black/[0.06] bg-[#fbfbf8] text-[#667085] hover:bg-white"
                  aria-label="Fechar saude da operacao"
                >
                  <X className="size-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="max-h-[72vh] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
            <div className="rounded-[1.35rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a97a8]">
                    Panorama geral
                  </p>
                  <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[#111111]">
                    {operationHealth}%
                  </p>
                </div>
                <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 text-xs font-medium text-[#0d7a39]">
                  {visiblePendingCount} pendencia{visiblePendingCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-[#009b3a] transition-all duration-300" style={{ width: `${operationHealth}%` }} />
              </div>
            </div>

            <div className="mt-4">
              <OperationHealthDetails
                operationIndicators={operationIndicators}
                operationPendingItems={operationPendingItems}
                onViewDetails={() => {
                  setIsMobileOperationHealthOpen(false)
                  void handleOperationDetails()
                }}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
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

function formatCosStatus(status: string) {
  if (status === "needs_confirmation") return "Aguardando confirmacao"
  if (status === "processing") return "Em processamento"
  if (status === "unsupported") return "Fora do escopo da Home"
  if (status === "error") return "Erro"
  if (status === "cancelled") return "Cancelado"
  return "Concluido"
}

function averageScore(scores: number[]) {
  if (scores.length === 0) return 100
  return clampScore(Math.round(scores.reduce((total, score) => total + score, 0) / scores.length))
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

function pluralize(singular: string, plural: string, count: number) {
  return count === 1 ? singular : plural
}

function MobileOperationHealthTrigger({
  operationHealth,
  pendingCount,
  onClick,
}: {
  operationHealth: number
  pendingCount: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/94 px-3 py-2 text-left shadow-[0_10px_20px_rgba(15,23,42,0.045)] backdrop-blur-sm transition-colors hover:bg-white lg:hidden"
      aria-label={`Abrir saude da operacao. Status atual ${operationHealth}% com ${pendingCount} pendencias.`}
    >
      <span className="flex items-center gap-2">
        <Circle className="size-2.5 fill-[#009b3a] text-[#009b3a]" />
        <span className="text-sm font-medium text-[#111111]">Saude {operationHealth}%</span>
      </span>
      <span className="rounded-full bg-[#edf8f1] px-2 py-0.5 text-[11px] font-medium text-[#0d7a39]">
        {pendingCount}
      </span>
    </button>
  )
}

function OperationHealthDetails({
  operationIndicators,
  operationPendingItems,
  onViewDetails,
}: {
  operationIndicators: Array<{ label: string; score: number; icon: typeof UsersRound }>
  operationPendingItems: string[]
  onViewDetails: () => void
}) {
  return (
    <>
      <div className="space-y-2 border-t border-black/[0.06] pt-4">
        {operationIndicators.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-[1rem] bg-[#fbfbf8] px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-[#f5fbf7] text-[#009b3a]">
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate text-sm font-medium text-[#111111]">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-[#111111]">{item.score}%</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-black/[0.06] pt-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-[#9a6b00]" />
          <p className="text-sm font-semibold text-[#111111]">Pendencias</p>
        </div>
        <div className="mt-3 space-y-2">
          {operationPendingItems.length > 0 ? (
            operationPendingItems.slice(0, 5).map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm leading-6 text-[#667085]">
                <span className="mt-2 size-1.5 rounded-full bg-[#c28a00]" />
                <span>{item}</span>
              </div>
            ))
          ) : (
            <div className="flex items-start gap-2 text-sm leading-6 text-[#667085]">
              <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
              <span>Nenhuma pendencia critica detectada agora.</span>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={onViewDetails}
          className="mt-4 h-9 w-full rounded-full border border-black/[0.06] bg-white px-4 text-sm text-[#111111] hover:bg-white"
        >
          Ver detalhes
        </Button>
      </div>
    </>
  )
}

function CosConversationSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-3 pt-1">
      <div className="flex justify-start">
        <div className="w-[78%] rounded-[1.5rem] border border-black/[0.05] bg-white/82 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.035)]">
          <div className="h-4 w-28 rounded-full bg-[#eef1ec] animate-pulse" />
          <div className="mt-3 h-3.5 w-full rounded-full bg-[#f1f4ef] animate-pulse" />
          <div className="mt-2 h-3.5 w-[82%] rounded-full bg-[#f1f4ef] animate-pulse" />
          <div className="mt-2 h-3.5 w-[58%] rounded-full bg-[#f1f4ef] animate-pulse" />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-[64%] rounded-[1.5rem] bg-[#1f1f1f] px-4 py-4">
          <div className="h-3.5 w-full rounded-full bg-white/15 animate-pulse" />
          <div className="mt-2 h-3.5 w-[76%] rounded-full bg-white/15 animate-pulse" />
        </div>
      </div>

      <div className="flex justify-start">
        <div className="w-[86%] rounded-[1.5rem] border border-black/[0.05] bg-white/82 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.035)]">
          <div className="h-3.5 w-[92%] rounded-full bg-[#f1f4ef] animate-pulse" />
          <div className="mt-2 h-3.5 w-full rounded-full bg-[#f1f4ef] animate-pulse" />
          <div className="mt-2 h-3.5 w-[74%] rounded-full bg-[#f1f4ef] animate-pulse" />
          <div className="mt-3 h-3 w-24 rounded-full bg-[#eef1ec] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
