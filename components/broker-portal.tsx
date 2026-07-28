"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Home,
  Sparkles,
  UsersRound,
  WalletCards,
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
  const { profile } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const [prompt, setPrompt] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [isNextStepModalOpen, setIsNextStepModalOpen] = useState(false)
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>([])
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [commissionPercent, setCommissionPercent] = useState(6)
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
  const primaryCosSuggestions = [
    { label: "Proximos compromissos", message: "Me mostre meus proximos compromissos" },
    { label: "Revisar clientes", message: "Revisar clientes" },
    { label: "Analisar carteira", message: "Analisar carteira" },
  ] satisfies NextStepSuggestion[]
  const isConversationEmpty = !isConversationLoading && conversation.length === 0

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
  const financialScore = useMemo(() => {
    if (properties.length === 0) return 100
    const priced = properties.filter((property) => property.priceValue > 0).length
    return Math.round((priced / properties.length) * 100)
  }, [properties])

  const operationHealth = useMemo(
    () =>
      clampScore(
        Math.round((leadScore + propertyScore + documentScore + contractScore + agendaScore + financialScore) / 6),
      ),
    [agendaScore, contractScore, documentScore, financialScore, leadScore, propertyScore],
  )

  const operationIndicators = useMemo(
    () => [
      { label: "Clientes", score: leadScore, icon: UsersRound },
      { label: "Imoveis", score: propertyScore, icon: Home },
      { label: "Documentos", score: documentScore, icon: FileText },
      { label: "Contratos", score: contractScore, icon: FileText },
      { label: "Agenda", score: agendaScore, icon: CalendarDays },
      { label: "Financeiro", score: financialScore, icon: WalletCards },
    ],
    [agendaScore, contractScore, documentScore, financialScore, leadScore, propertyScore],
  )

  const operationPendingItems = useMemo(() => {
    const missingRegistry = properties.filter((property) => !property.legal.registryNumber).length
    const missingRg = leads.filter((lead) => !lead.identification.rg).length
    const awaitingSignature = contracts.filter((contract) => contract.status === "awaiting_signature").length
    const draftDocuments = documents.filter((document) => document.status === "draft").length
    const pendingAgenda = agendaEvents.filter((event) => event.status === "pending" && event.date <= todayKey).length

    return [
      missingRegistry > 0 ? `${missingRegistry} ${pluralize("imovel", "imoveis", missingRegistry)} sem matricula` : null,
      missingRg > 0 ? `${missingRg} ${pluralize("cliente", "clientes", missingRg)} sem RG` : null,
      awaitingSignature > 0
        ? `${awaitingSignature} ${pluralize("contrato", "contratos", awaitingSignature)} aguardando assinatura`
        : null,
      draftDocuments > 0 ? `${draftDocuments} ${pluralize("documento", "documentos", draftDocuments)} em rascunho` : null,
      pendingAgenda > 0 ? `${pendingAgenda} ${pluralize("compromisso", "compromissos", pendingAgenda)} pendente${pendingAgenda > 1 ? "s" : ""}` : null,
    ].filter((item): item is string => Boolean(item))
  }, [agendaEvents, contracts, documents, leads, properties, todayKey])

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
                      <h1 className="mt-6 text-[2rem] font-semibold tracking-[-0.04em] text-[#111111] sm:text-[3rem]">
                        Ola, {brokerFirstName}.
                      </h1>
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
                      <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.03em] text-[#111111]">
                        Ola, {brokerFirstName}.
                      </h1>
                      <p className="mt-1 text-sm text-[#667085]">
                        Continue a conversa e mantenha a operacao sincronizada em tempo real.
                      </p>
                      {showConversationTitle ? (
                        <p className="mt-3 truncate text-sm font-medium text-[#111111]">{activeConversation?.title}</p>
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
              )}
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-6 rounded-[2rem] border border-black/[0.06] bg-white/82 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8a97a8]">Painel contextual</p>
                <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#111111]">
                  Saude da operacao
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  Este painel ja nasce preparado para trocar de contexto conforme a conversa com o COS.
                </p>

                <div className="mt-6 rounded-[1.5rem] border border-black/[0.05] bg-[#fbfbf8] p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm text-[#667085]">Sua operacao</p>
                      <p className="mt-1 text-[2.1rem] font-semibold tracking-[-0.05em] text-[#111111]">
                        {operationHealth}%
                      </p>
                    </div>
                    <span className="rounded-full bg-[#edf8f1] px-3 py-1 text-xs font-medium text-[#0d7a39]">
                      {commissionPercent}% comissao base
                    </span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-[#009b3a]"
                      style={{ width: `${operationHealth}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {operationIndicators.map((item) => {
                    const Icon = item.icon

                    return (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-black/[0.05] bg-white/72 px-3.5 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#f5fbf7] text-[#009b3a]">
                            <Icon className="size-4" />
                          </span>
                          <span className="truncate text-sm font-medium text-[#111111]">{item.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#111111]">{item.score}%</span>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 border-t border-black/[0.06] pt-5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-[#9a6b00]" />
                    <p className="text-sm font-semibold text-[#111111]">Pendencias</p>
                  </div>
                  <div className="mt-3 space-y-2.5">
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
                    onClick={() => void handleSubmit("Me mostre as pendencias da operacao")}
                    className="mt-4 h-10 rounded-full border border-black/[0.06] bg-white px-4 text-sm text-[#111111] hover:bg-white"
                  >
                    Ver detalhes
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
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
