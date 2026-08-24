"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Grip,
  FileText,
  Home,
  X,
  UsersRound,
} from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { CosConversationMessageBody, CosMessageAttachments, CosPendingAction } from "@/components/cos-pending-action"
import { CosPromptComposer } from "@/components/cos-prompt-composer"
import type { CosPromptComposerMenuAction, CosPromptComposerMenuGroup } from "@/components/cos-prompt-composer"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import {
  AssistantCredits,
  COS_CONVERSATIONS_REFRESH_EVENT,
  useCosConversations,
} from "@/components/use-cos-conversations"
import { DEFAULT_COS_CONVERSATION_TITLE } from "@/lib/cos-conversations"

type AssistantBootstrapResponse = {
  credits?: AssistantCredits
  aiAssistantEnabled?: boolean
  error?: string
}

type FinancialConfigResponse = {
  config?: {
    commissionPercent?: number
  }
}

type OperationHealthSnapshot = {
  score: number
  scores: {
    clients: number
    properties: number
    documents: number
    contracts: number
    agenda: number
    leads: number
  }
  activePropertiesCount: number
  pending: {
    missingRegistry: number
    missingPropertyDocuments: number
    missingRg: number
    missingLeadInformation: number
    unattendedLeads: number
    awaitingSignature: number
    draftDocuments: number
    draftContracts: number
    pendingAgenda: number
  }
}

let operationHealthRequest: Promise<OperationHealthSnapshot> | null = null
let assistantBootstrapRequest: Promise<AssistantBootstrapResponse> | null = null

function requestOperationHealth() {
  if (!operationHealthRequest) {
    operationHealthRequest = fetch("/api/brokers/operation-health", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as OperationHealthSnapshot | { error?: string } | null
        if (!response.ok || !data || !("scores" in data)) {
          throw new Error(data && "error" in data ? data.error : "Não foi possível carregar a saúde da operação.")
        }
        return data
      })
      .finally(() => {
        operationHealthRequest = null
      })
  }
  return operationHealthRequest
}

function requestAssistantBootstrap() {
  if (!assistantBootstrapRequest) {
    assistantBootstrapRequest = fetch("/api/assistant/eme", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as AssistantBootstrapResponse | null
        if (!response.ok || !data) throw new Error(data?.error || "Não foi possível carregar o COS.")
        return data
      })
      .finally(() => {
        assistantBootstrapRequest = null
      })
  }
  return assistantBootstrapRequest
}

export function BrokerPortal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedConversationId = searchParams.get("conversa")?.trim() || ""
  const { profile, isLoading: isProfileLoading } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const [prompt, setPrompt] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [operationHealthSnapshot, setOperationHealthSnapshot] = useState<OperationHealthSnapshot | null>(null)
  const [commissionPercent, setCommissionPercent] = useState(6)
  const [isMobileOperationHealthOpen, setIsMobileOperationHealthOpen] = useState(false)
  const [isDesktopOperationHealthCollapsed, setIsDesktopOperationHealthCollapsed] = useState(false)
  const [assistantCredits, setAssistantCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [assistantEnabled, setAssistantEnabled] = useState(true)
  const [isAssistantCreditsLoaded, setIsAssistantCreditsLoaded] = useState(false)
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
    loadConversations,
    openConversation,
    sendCosMessage,
    confirmPendingAction,
    cancelPendingAction,
    selectPendingOption,
  } = useCosConversations({
    assistantEnabled,
    assistantCredits,
    setAssistantCredits,
    source: "cos_home",
    initialConversationId: requestedConversationId,
  })

  useEffect(() => {
    if (
      !requestedConversationId ||
      requestedConversationId === activeConversationId ||
      isBootstrappingConversation ||
      isConversationLoading
    ) return
    void openConversation(requestedConversationId)
  }, [activeConversationId, isBootstrappingConversation, isConversationLoading, openConversation, requestedConversationId])

  useEffect(() => {
    if (requestedConversationId || !activeConversationId || isBootstrappingConversation) return
    router.replace(`/corretor?conversa=${encodeURIComponent(activeConversationId)}`, { scroll: false })
  }, [activeConversationId, isBootstrappingConversation, requestedConversationId, router])

  useEffect(() => {
    function refreshConversations() {
      void loadConversations()
    }
    window.addEventListener(COS_CONVERSATIONS_REFRESH_EVENT, refreshConversations)
    return () => window.removeEventListener(COS_CONVERSATIONS_REFRESH_EVENT, refreshConversations)
  }, [loadConversations])

  const activePropertiesCount = operationHealthSnapshot?.activePropertiesCount ?? 0
  const hasReachedLimit =
    subscription.isProfileResolved &&
    !subscription.isUpgraded &&
    activePropertiesCount >= (subscription.propertyLimit ?? 5)

  useEffect(() => {
    let ignore = false

    requestOperationHealth()
      .then((data) => {
        if (!ignore) setOperationHealthSnapshot(data)
      })
      .catch(() => null)

    fetch("/api/brokers/financial", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as FinancialConfigResponse | null
        if (!ignore && response.ok) setCommissionPercent(Number(data?.config?.commissionPercent) || 6)
      })
      .catch(() => null)

    requestAssistantBootstrap()
      .then((data) => {
        if (!ignore) {
          if (data?.credits) setAssistantCredits(data.credits)
          if (typeof data?.aiAssistantEnabled === "boolean") setAssistantEnabled(data.aiAssistantEnabled)
        }
      })
      .catch(() => null)
      .finally(() => {
        if (!ignore) setIsAssistantCreditsLoaded(true)
      })

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
  const greetingLabel = brokerFirstName ? `Olá, ${brokerFirstName}.` : "Olá."

  const hasVisibleConversation = conversation.length > 0
  const isConversationEmpty = !isBootstrappingConversation && !isConversationLoading && !hasVisibleConversation
  const composerMenuGroups = useMemo<CosPromptComposerMenuGroup[]>(
    () =>
      [
      {
        id: "skills",
        label: "Habilidades",
        items: [
          { id: "register_client", label: "Cadastrar cliente" },
          { id: "create_property", label: "Criar imóvel" },
          { id: "attach_contract", label: "Anexar contrato" },
          { id: "create_campaign", label: "Criar campanha" },
          { id: "generate_proposal", label: "Gerar proposta" },
        ],
      },
      {
        id: "queries",
        label: "Consultas",
        items: [
          { id: "search_property", label: "Buscar imóvel" },
          { id: "my_clients", label: "Meus clientes" },
          { id: "today_agenda", label: "Agenda de hoje" },
          { id: "latest_leads", label: "Últimos leads" },
          { id: "latest_properties", label: "Últimos imóveis" },
        ],
      },
      {
        id: "help",
        label: "Ajuda",
        items: [
          { id: "help_first_steps", label: "Primeiros passos" },
          { id: "help_use_cos", label: "Como usar o COS" },
          { id: "help_register_properties", label: "Como cadastrar imóveis" },
          { id: "help_manage_clients", label: "Como gerenciar clientes" },
          { id: "help_contracts_proposals", label: "Contratos e propostas" },
          { id: "help_marketing_studio", label: "Marketing e Studio IA" },
          { id: "help_general_question", label: "Tirar uma dúvida" },
        ],
      },
    ],
    [],
  )

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )
  const showConversationTitle = Boolean(
    activeConversation?.title && activeConversation.title !== DEFAULT_COS_CONVERSATION_TITLE,
  )

  async function handleSubmit(input?: { promptOverride?: string; attachments?: import("@/components/cos-prompt-composer").CosComposerAttachment[] }) {
    const normalizedPrompt = (input?.promptOverride ?? prompt).trim()
    if (!normalizedPrompt) {
      setChatFeedback("Digite uma mensagem para o COS.")
      return
    }

    await sendCosMessage(normalizedPrompt, { attachments: input?.attachments })
    setPrompt("")
  }

  async function handleConversationSuggestion(selection: {
    label: string
    message: string
    action?: string
    creditCostPreview?: number
  }) {
    await sendCosMessage(selection.message, {
      visibleMessage: selection.label,
      action: selection.action,
      creditCostPreview: selection.creditCostPreview,
    })
  }

  async function handleMenuAction(action: CosPromptComposerMenuAction) {
    const actionMap: Record<string, { label: string; message: string; action?: string; creditCostPreview?: number }> = {
      register_client: { label: "Cadastrar cliente", message: "Quero cadastrar um cliente.", action: "createLead", creditCostPreview: 1 },
      create_property: { label: "Criar imóvel", message: "Quero criar um imóvel.", action: "createPropertyDraft", creditCostPreview: 3 },
      attach_contract: { label: "Anexar contrato", message: "Quero anexar um contrato.", creditCostPreview: 2 },
      create_campaign: { label: "Criar campanha", message: "Quero criar uma campanha para Instagram.", action: "STUDIO_GENERATE_INSTAGRAM", creditCostPreview: 10 },
      generate_proposal: { label: "Gerar proposta", message: "Quero gerar uma proposta.", action: "CREATE_PROPOSAL", creditCostPreview: 2 },
      search_property: { label: "Buscar imóvel", message: "Quero buscar um imóvel.", action: "searchProperties", creditCostPreview: 1 },
      my_clients: { label: "Meus clientes", message: "Mostre meus clientes.", action: "getLeadsSummary", creditCostPreview: 1 },
      today_agenda: { label: "Agenda de hoje", message: "Mostre minha agenda de hoje.", action: "LIST_AGENDA_TODAY", creditCostPreview: 1 },
      latest_leads: { label: "Últimos leads", message: "Mostre meus últimos leads.", action: "summarizeLead", creditCostPreview: 1 },
      latest_properties: { label: "Últimos imóveis", message: "Mostre meus últimos imóveis cadastrados.", action: "searchProperties", creditCostPreview: 1 },
      // As 7 entradas de ajuda passam `action` com o próprio id do botão — isso deixa a
      // classificação no backend determinística (casa direto contra o Capability Registry,
      // sem depender da cadeia de regex de inferAssessorAction) e conecta cada botão à sua
      // capability dedicada de ajuda, que responde usando o manual oficial do sistema.
      help_first_steps: {
        label: "Primeiros passos",
        message: "Quais são os primeiros passos para começar a usar o EME?",
        action: "help_first_steps",
        creditCostPreview: 0,
      },
      help_use_cos: {
        label: "Como usar o COS",
        message: "Como posso usar melhor o COS no dia a dia?",
        action: "help_use_cos",
        creditCostPreview: 0,
      },
      help_register_properties: {
        label: "Como cadastrar imóveis",
        message: "Como cadastrar imóveis no EME?",
        action: "help_register_properties",
        creditCostPreview: 0,
      },
      help_manage_clients: {
        label: "Como gerenciar clientes",
        message: "Como gerenciar meus clientes no EME?",
        action: "help_manage_clients",
        creditCostPreview: 0,
      },
      help_contracts_proposals: {
        label: "Contratos e propostas",
        message: "Como funcionam contratos e propostas no EME?",
        action: "help_contracts_proposals",
        creditCostPreview: 0,
      },
      help_marketing_studio: {
        label: "Marketing e Studio IA",
        message: "Como usar o Studio IA e o marketing do EME?",
        action: "help_marketing_studio",
        creditCostPreview: 0,
      },
      help_general_question: {
        label: "Tirar uma dúvida",
        message: "Preciso de ajuda para entender uma funcionalidade do EME.",
        action: "help_general_question",
        creditCostPreview: 0,
      },
    }

    const selection = actionMap[action.id]
    if (!selection) return
    await handleConversationSuggestion(selection)
  }

  async function handleOperationDetails() {
    if (!operationHealthSnapshot) return
    const {
      missingRegistry,
      missingPropertyDocuments,
      draftDocuments,
      draftContracts,
      awaitingSignature,
      missingLeadInformation,
      unattendedLeads,
      pendingAgenda,
    } = operationHealthSnapshot.pending

    const operationalSummary = [
      `Imóveis sem matrícula: ${missingRegistry}`,
      `Imóveis sem documentos anexados: ${missingPropertyDocuments}`,
      `Propostas ou documentos em rascunho: ${draftDocuments}`,
      `Contratos em rascunho: ${draftContracts}`,
      `Contratos aguardando assinatura: ${awaitingSignature}`,
      `Clientes com informações faltantes: ${missingLeadInformation}`,
      `Leads sem atendimento: ${unattendedLeads}`,
      `Compromissos pendentes: ${pendingAgenda}`,
    ].join("\n")

    // action explícita e obrigatória aqui: sem ela, essa mensagem (que menciona "contratos
    // pendentes" entre vários outros tópicos) passa pela classificação de texto livre do
    // intent-resolver e pode vencer por CONTRACT_HISTORY só por mencionar a palavra "contrato" en
    // passant — mesmo com a pontuação incondicional já removida (essa correção só bloqueia quando
    // a mensagem NÃO menciona contrato algum, não quando contrato é só um dos vários assuntos
    // tratados). "createInternalNotification" é a action já usada pela capability operation.summary
    // (lib/cos/entities/operation.ts), que resume as pendências reais da operação a partir do banco.
    await sendCosMessage(
      `Analise minha operação com base nas pendências reais abaixo. Quero prioridades objetivas, agrupadas por categoria, explicando o que resolver primeiro, o que pode esperar e qual próxima ação devo executar em cada frente. Considere especialmente imóveis incompletos, clientes sem dados obrigatórios, propostas em rascunho, contratos pendentes, leads sem atendimento, compromissos próximos ou atrasados e documentos pendentes.\n\n${operationalSummary}`,
      { visibleMessage: "Ver detalhes da operação", creditCostPreview: 3, action: "createInternalNotification" },
    )
    setPrompt("")
  }

  const operationHealthReady = operationHealthSnapshot !== null
  const displayedOperationHealth = operationHealthSnapshot?.score ?? 0

  const operationIndicators = useMemo(
    () =>
      [
        operationHealthSnapshot ? { label: "Clientes", score: operationHealthSnapshot.scores.clients, icon: UsersRound } : null,
        operationHealthSnapshot ? { label: "Imóveis", score: operationHealthSnapshot.scores.properties, icon: Home } : null,
        operationHealthSnapshot ? { label: "Documentos", score: operationHealthSnapshot.scores.documents, icon: FileText } : null,
        operationHealthSnapshot ? { label: "Contratos", score: operationHealthSnapshot.scores.contracts, icon: FileText } : null,
        operationHealthSnapshot ? { label: "Agenda", score: operationHealthSnapshot.scores.agenda, icon: CalendarDays } : null,
        operationHealthSnapshot ? { label: "Leads", score: operationHealthSnapshot.scores.leads, icon: UsersRound } : null,
      ].filter((item): item is { label: string; score: number; icon: typeof UsersRound } => Boolean(item)),
    [operationHealthSnapshot],
  )

  const operationPendingItems = useMemo(() => {
    if (!operationHealthSnapshot) return []
    const { missingRegistry, missingPropertyDocuments, missingRg, unattendedLeads, awaitingSignature, draftDocuments, pendingAgenda } = operationHealthSnapshot.pending

    return [
      missingRegistry > 0 ? `${missingRegistry} ${pluralize("imóvel", "imóveis", missingRegistry)} sem matrícula` : null,
      missingPropertyDocuments > 0
        ? `${missingPropertyDocuments} ${pluralize("imóvel", "imóveis", missingPropertyDocuments)} sem documentos`
        : null,
      missingRg > 0 ? `${missingRg} ${pluralize("cliente", "clientes", missingRg)} sem RG` : null,
      unattendedLeads > 0 ? `${unattendedLeads} ${pluralize("lead", "leads", unattendedLeads)} sem atendimento` : null,
      awaitingSignature > 0
        ? `${awaitingSignature} ${pluralize("contrato", "contratos", awaitingSignature)} aguardando assinatura`
        : null,
      draftDocuments > 0 ? `${draftDocuments} ${pluralize("documento", "documentos", draftDocuments)} em rascunho` : null,
      pendingAgenda > 0 ? `${pendingAgenda} ${pluralize("compromisso", "compromissos", pendingAgenda)} pendente${pendingAgenda > 1 ? "s" : ""}` : null,
    ].filter((item): item is string => Boolean(item))
  }, [operationHealthSnapshot])

  const visiblePendingCount = operationPendingItems.length

  return (
    <>
      <BrokerPageShell title="COS" variant="cos" contentClassName="overflow-hidden">
        <section className="h-full min-h-0 w-full overflow-hidden bg-[#f4f1eb]">
          <div className="mx-auto grid h-full min-h-0 w-full max-w-[86rem] grid-cols-[minmax(0,1fr)] gap-6 overflow-hidden px-4 pb-3 pt-2 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 lg:px-8 lg:py-6">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {isConversationEmpty ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col gap-3 px-1 py-6 sm:py-8 lg:py-10">
                    <div className="mx-auto flex w-full max-w-[52rem] items-start justify-between gap-5 px-1">
                      <div className="min-w-0">
                        {hasResolvedBrokerName ? (
                          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#111111] sm:text-[2.7rem]">
                            {greetingLabel}
                          </h1>
                        ) : isProfileLoading ? (
                          <div className="h-11 w-56 animate-pulse rounded-full bg-[#e9ece6] sm:h-13 sm:w-72" />
                        ) : (
                          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#111111] sm:text-[2.7rem]">
                            {greetingLabel}
                          </h1>
                        )}
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 pt-1 sm:flex">
                        <span className="rounded-full border border-black/[0.06] bg-white/78 px-3 py-1.5 text-[11px] font-medium text-[#667085]">
                          {assistantEnabled ? "COS ativo" : "COS pausado"}
                        </span>
                        <span className="rounded-full border border-black/[0.06] bg-white/78 px-3 py-1.5 text-[11px] font-medium text-[#667085]">
                          {isAssistantCreditsLoaded ? `${assistantCredits.balance} créditos` : "— créditos"}
                        </span>
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
                <div data-testid="cos-conversation-surface" className="flex min-h-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-2">
                    <div className="min-w-0">
                      <div className="mt-1 min-h-[2rem]">
                        {hasResolvedBrokerName ? (
                          <h1 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-[#111111]">
                            {greetingLabel}
                          </h1>
                        ) : isProfileLoading ? (
                          <div className="h-8 w-40 rounded-full bg-[#e9ece6] animate-pulse" />
                        ) : (
                          <h1 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-[#111111]">
                            {greetingLabel}
                          </h1>
                        )}
                      </div>
                      {showConversationTitle ? (
                        <p className="mt-3 truncate text-sm font-medium text-[#111111]">{activeConversation?.title}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7a8798]">
                      <span className="rounded-full border border-black/[0.06] bg-white/84 px-3 py-1.5">
                        {assistantEnabled ? "COS ativo" : "COS pausado"}
                      </span>
                      <span className="rounded-full border border-black/[0.06] bg-white/84 px-3 py-1.5">
                        {isAssistantCreditsLoaded ? `${assistantCredits.balance} créditos` : "— créditos"}
                      </span>
                    </div>
                  </div>

                  <div
                    ref={chatViewportRef}
                    data-testid="cos-conversation-scroll"
                    className="eme-hidden-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-2 pb-2"
                  >
                    {hasVisibleConversation &&
                      conversation.map((item) => (
                        <div
                          key={item.id}
                          className={`flex min-w-0 ${item.role === "user" ? "justify-end" : "justify-start"}`}
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
                        <div className="max-w-[92%] rounded-[1.5rem] border border-black/[0.06] bg-white/82 px-4 py-3 text-sm text-[#6f7f97] shadow-[0_14px_30px_rgba(15,23,42,0.04)] sm:max-w-[85%]">
                          COS analisando...
                        </div>
                      </div>
                    ) : null}
                  </div>

                </div>
              )}

              <div className="mt-2 flex w-full flex-col items-end gap-2 px-1 pb-[env(safe-area-inset-bottom,0px)]">
                <div
                  data-testid="cos-composer-dock"
                  className="mx-auto flex w-full max-w-[48rem] flex-col items-end gap-2 px-1"
                >
                  <MobileOperationHealthTrigger
                    operationHealth={displayedOperationHealth}
                    isReady={operationHealthReady}
                    pendingCount={visiblePendingCount}
                    onClick={() => setIsMobileOperationHealthOpen(true)}
                  />
                  <CosPromptComposer
                    prompt={prompt}
                    setPrompt={setPrompt}
                    onSubmit={handleSubmit}
                    onNewConversation={async () => {
                      setPrompt("")
                      setChatFeedback("")
                      const created = await createConversation()
                      router.replace(`/corretor?conversa=${encodeURIComponent(created.id)}`, { scroll: false })
                    }}
                    disabled={isSending || isConversationLoading}
                    inputRef={inputRef}
                    feedback={chatFeedback}
                    sticky={false}
                    menuGroups={composerMenuGroups}
                    onMenuAction={handleMenuAction}
                  />
                </div>
              </div>
            </div>

            <aside data-testid="cos-operation-health" className="hidden min-h-0 lg:flex lg:flex-col lg:items-end lg:justify-center lg:py-2">
              <div className="flex w-full max-w-[18rem] flex-col rounded-[1.4rem] border border-black/[0.06] bg-white/84 p-3 shadow-[0_12px_24px_rgba(15,23,42,0.045)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setIsDesktopOperationHealthCollapsed((current) => !current)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25"
                  aria-expanded={!isDesktopOperationHealthCollapsed}
                  aria-controls="operation-health-panel"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a97a8]">
                      Saúde da operação
                    </p>
                    <p className="mt-1.5 text-[1.7rem] font-semibold tracking-[-0.05em] text-[#111111]">
                      {operationHealthReady ? `${displayedOperationHealth}%` : "—"}
                    </p>
                  </div>
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-[#fbfbf8] text-[#667085]">
                    <ChevronDown className={`size-4 transition-transform ${isDesktopOperationHealthCollapsed ? "" : "rotate-180"}`} />
                  </span>
                </button>

                <div className="mt-3 h-1.5 rounded-full bg-black/[0.06]">
                  <div
                    className={`h-full rounded-full bg-[#009b3a] ${operationHealthReady ? "" : "opacity-30"}`}
                    style={{ width: `${operationHealthReady ? displayedOperationHealth : 0}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#667085]">
                  <span>{visiblePendingCount} pendência{visiblePendingCount === 1 ? "" : "s"}</span>
                  <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 font-medium text-[#0d7a39]">
                    {commissionPercent}% base
                  </span>
                </div>

                {!isDesktopOperationHealthCollapsed ? (
                  <div id="operation-health-panel" className="mt-3">
                    <OperationHealthDetails
                      operationIndicators={operationIndicators}
                      operationPendingItems={operationPendingItems}
                      onViewDetails={() => void handleOperationDetails()}
                    />
                  </div>
                ) : null}
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
                  Saúde da operação
                </DrawerTitle>
                <DrawerDescription className="mt-1 text-sm text-[#667085]">
                  Indicadores e pendências da sua operação sem sair do COS.
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-full border border-black/[0.06] bg-[#fbfbf8] text-[#667085] hover:bg-white"
                  aria-label="Fechar saúde da operação"
                >
                  <X className="size-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="eme-subtle-scrollbar max-h-[72vh] overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
            <div className="rounded-[1.35rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a97a8]">
                    Panorama geral
                  </p>
                  <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[#111111]">
                    {operationHealthReady ? `${displayedOperationHealth}%` : "—"}
                  </p>
                </div>
                <span className="rounded-full bg-[#edf8f1] px-2.5 py-1 text-xs font-medium text-[#0d7a39]">
                  {visiblePendingCount} pendência{visiblePendingCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-black/[0.06]">
                <div
                  className={`h-full rounded-full bg-[#009b3a] ${operationHealthReady ? "" : "opacity-30"}`}
                  style={{ width: `${operationHealthReady ? displayedOperationHealth : 0}%` }}
                />
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
    </>
  )
}


function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

function pluralize(singular: string, plural: string, count: number) {
  return count === 1 ? singular : plural
}

function MobileOperationHealthTrigger({
  operationHealth,
  isReady,
  pendingCount,
  onClick,
}: {
  operationHealth: number
  isReady: boolean
  pendingCount: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/94 px-3 py-2 text-left shadow-[0_10px_20px_rgba(15,23,42,0.045)] backdrop-blur-sm transition-colors hover:bg-white lg:hidden"
      aria-label={`Abrir saúde da operação. Status atual ${isReady ? `${operationHealth}%` : "indisponível"} com ${pendingCount} pendências.`}
    >
      <span className="flex items-center gap-2">
        <Circle className="size-2.5 fill-[#009b3a] text-[#009b3a]" />
        <span className="text-sm font-medium text-[#111111]">Saúde {isReady ? `${operationHealth}%` : "—"}</span>
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
      <div className="space-y-1.5 border-t border-black/[0.06] pt-3">
        {operationIndicators.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2.5 rounded-xl bg-[#fbfbf8] px-2.5 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#edf8f1] text-[#009b3a]">
                  <Icon className="size-3.5" />
                </span>
                <span className="truncate text-[13px] font-medium text-[#111111]">{item.label}</span>
              </div>
              <span className="text-[13px] font-semibold text-[#111111]">{item.score}%</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 border-t border-black/[0.06] pt-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-3.5 text-[#9a6b00]" />
          <p className="text-[13px] font-semibold text-[#111111]">Pendências</p>
        </div>
        <div className="mt-2 space-y-1.5">
          {operationPendingItems.length > 0 ? (
            operationPendingItems.map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs leading-[1.15rem] text-[#667085]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#c28a00]" />
                <span>{item}</span>
              </div>
            ))
          ) : (
            <div className="flex items-start gap-2 text-xs leading-5 text-[#667085]">
              <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
              <span>Nenhuma pendência crítica detectada agora.</span>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={onViewDetails}
          className="mt-3 h-8 w-full rounded-full border border-black/[0.06] bg-white px-4 text-xs font-medium text-[#111111] hover:bg-white"
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
