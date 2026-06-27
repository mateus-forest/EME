"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, CreditCard, Lightbulb, MessageCircle, Send, Sparkles } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useBrokerSubscription } from "@/components/use-broker-subscription"

type AssistantCredits = {
  balance: number
  usedThisMonth: number
}

type AssessorConfig = {
  officialNumber: string
  displayName: string
  status: string
  internalInstructions: string
  webhookStatus: string
}

type AssessorHistoryItem = {
  id: string
  message: string
  response: string | null
  detectedIntent: string | null
  actionType: string | null
  actionStatus: string | null
  creditsUsed?: number | null
  createdAt: string
}

const quickActions = [
  { label: "Criar anúncio com IA", actionType: "create_ad" },
  { label: "Melhorar descrição de imóvel", actionType: "improve_description" },
  { label: "Responder cliente", actionType: "reply_client" },
  { label: "Buscar imóveis para um cliente", actionType: "match_properties" },
  { label: "Analisar meu catálogo", actionType: "analyze_catalog" },
  { label: "Ideias para captar mais leads", actionType: "lead_ideas" },
] as const

export function BrokerMPage() {
  const [credits, setCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [prompt, setPrompt] = useState("")
  const [actionType, setActionType] = useState<(typeof quickActions)[number]["actionType"] | "general">("general")
  const [response, setResponse] = useState("")
  const [feedback, setFeedback] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [assessorConfig, setAssessorConfig] = useState<AssessorConfig | null>(null)
  const [history, setHistory] = useState<AssessorHistoryItem[]>([])
  const { subscription } = useBrokerSubscription()
  const selectedAction = useMemo(
    () => quickActions.find((action) => action.actionType === actionType),
    [actionType],
  )

  useEffect(() => {
    fetch("/api/assistant/eme", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (result) => {
        const data = (await result.json().catch(() => null)) as
          | { credits?: AssistantCredits; aiAssistantEnabled?: boolean; assessorConfig?: AssessorConfig; history?: AssessorHistoryItem[]; error?: string }
          | null
        if (!result.ok) throw new Error(data?.error || "Não foi possível carregar os créditos.")
        if (data?.credits) setCredits(data.credits)
        if (typeof data?.aiAssistantEnabled === "boolean") setIsActive(data.aiAssistantEnabled)
        if (data?.assessorConfig) setAssessorConfig(data.assessorConfig)
        if (data?.history) setHistory(data.history)
      })
      .catch((caughtError) => {
        setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar o Assessor EME.")
      })
  }, [])

  async function sendPrompt() {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setFeedback("Digite uma mensagem para o Assessor EME.")
      return
    }

    if (!isActive) {
      setFeedback("Ative o Assessor EME para enviar comandos.")
      return
    }

    if (credits.balance <= 0) {
      setFeedback("Créditos insuficientes para usar o Assessor EME.")
      return
    }

    setIsSending(true)
    setFeedback("")
    setResponse("")

    try {
      const result = await fetch("/api/assistant/eme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          message: normalizedPrompt,
          actionType,
        }),
      })
      const data = (await result.json().catch(() => null)) as
        | { response?: string; action?: string; actionStatus?: string; credits?: AssistantCredits; creditsUsed?: number; error?: string }
        | null

      if (!result.ok) {
        throw new Error(data?.error || "Não foi possível acionar o Assessor EME.")
      }

      setResponse(data?.response || "")
      if (data?.credits) setCredits(data.credits)
      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          message: normalizedPrompt,
          response: data?.response || "",
          detectedIntent: data?.action || actionType,
          actionType: data?.action || actionType,
          actionStatus: data?.actionStatus || "success",
          creditsUsed: data?.creditsUsed ?? 1,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 5))
      setFeedback(data?.creditsUsed ? `${formatAssistantAction(data?.action || actionType)} · -${data.creditsUsed} crédito IA` : "")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível acionar o Assessor EME.")
    } finally {
      setIsSending(false)
    }
  }

  function selectAction(action: (typeof quickActions)[number]) {
    setActionType(action.actionType)
    if (!prompt.trim()) {
      setPrompt(`Me ajude com: ${action.label.toLowerCase()}.`)
    }
  }

  async function toggleAssistantEnabled() {
    const nextEnabled = !isActive
    setIsActive(nextEnabled)
    setFeedback("")

    try {
      const result = await fetch("/api/assistant/eme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ aiAssistantEnabled: nextEnabled }),
      })
      const data = (await result.json().catch(() => null)) as { aiAssistantEnabled?: boolean; error?: string } | null
      if (!result.ok) throw new Error(data?.error || "Não foi possível atualizar o Assessor EME.")
      if (typeof data?.aiAssistantEnabled === "boolean") setIsActive(data.aiAssistantEnabled)
      setFeedback(nextEnabled ? "Assessor EME ativado." : "Assessor EME desativado.")
    } catch (caughtError) {
      setIsActive(!nextEnabled)
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o Assessor EME.")
    }
  }

  const hasOfficialAssessorNumber = Boolean(assessorConfig?.officialNumber?.trim())
  const assessorDisplayName = assessorConfig?.displayName?.trim() || "Assessor EME"
  const assessorStatus =
    assessorConfig?.status === "ACTIVE" ? "Ativo" : assessorConfig?.status === "PAUSED" ? "Pausado" : "Em preparação"

  async function requestMoreCredits() {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          title: "Solicitação de créditos IA",
          message: "Corretor solicitou mais créditos IA pelo Assessor EME.",
        }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível registrar a solicitação.")
      setFeedback("Solicitação de créditos registrada.")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível registrar a solicitação.")
    }
  }

  return (
    <BrokerPageShell title="Assessor EME">
      <div className="grid min-w-0 gap-5">
        <section className="min-w-0 rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <Bot className="size-6" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#050505] sm:text-3xl">Assistente do corretor</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6B7280]">
                Use o Assessor EME para criar anúncios, analisar leads, melhorar seu catálogo e pedir tarefas operacionais.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="ghost"
                onClick={toggleAssistantEnabled}
                className="h-10 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] sm:w-auto"
              >
                {isActive ? "Desativar" : "Ativar"} Assessor EME
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={requestMoreCredits}
                className="h-10 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] sm:w-auto"
              >
                <CreditCard className="size-4" />
                Solicitar mais créditos
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[#009b3a]/16 bg-[#009b3a]/10 p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-1 size-5 shrink-0 text-[#009b3a]" />
            <div className="min-w-0 text-sm leading-7 text-[#5F6B7A]">
              <p className="font-semibold text-[#050505]">O que posso fazer:</p>
              <p className="mt-1">• cadastrar leads • cadastrar imóveis em rascunho • buscar imóveis • agendar compromissos • gerar propostas • analisar leads, analytics e financeiro</p>
              <p className="mt-3 font-semibold text-[#050505]">Exemplos:</p>
              <p className="mt-1 break-words">Cadastrar imóvel: apartamento 3 quartos, Centro, Vacaria, R$ 790 mil, venda<br />Buscar imóvel: apartamento até 790 mil<br />Criar proposta: João imóvel 2<br />Minhas notificações</p>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ResponsiveCollapsibleSection title="Créditos disponíveis" defaultMobileOpen>
          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-[#050505]">Créditos disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3">
                <p className="text-sm text-[#009b3a]">Status</p>
                <p className="mt-1 text-xl font-semibold text-[#050505]">{isActive ? "Ativo" : "Pausado"}</p>
              </div>
              <div>
                <p className="break-words text-3xl font-semibold text-[#050505] sm:text-4xl">{credits.balance}</p>
                <p className="mt-2 text-sm text-[#6B7280]">créditos atuais</p>
                {credits.balance <= 3 ? <p className="mt-2 text-sm text-[#009b3a]">Créditos baixos. Solicite mais créditos para continuar testando o Assessor EME.</p> : null}
              </div>
              <div className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                <p className="text-sm text-[#7B8491]">Usados no mês</p>
                <p className="mt-1 text-xl font-semibold text-[#050505]">{credits.usedThisMonth}</p>
              </div>
              <div className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                <p className="text-sm text-[#7B8491]">Pacote/plano atual</p>
                <p className="mt-1 text-xl font-semibold text-[#050505]">{subscription.isUpgraded ? subscription.planName : "Modo avaliação"}</p>
              </div>
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Ações rápidas">
          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-[#050505]">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0 sm:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => (
                <Button
                  key={action.actionType}
                  type="button"
                  variant="ghost"
                  onClick={() => selectAction(action)}
                  className={`min-h-12 justify-start rounded-xl border px-4 text-left text-sm ${actionType === action.actionType ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#009b3a]" : "border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white hover:text-[#050505]"}`}
                >
                  <Sparkles className="size-4 shrink-0" />
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        <ResponsiveCollapsibleSection title="Comando rápido">
        <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-5 py-5">
            <CardTitle className="text-lg text-[#050505]">Enviar comando</CardTitle>
            <p className="text-sm text-[#6B7280]">
              {selectedAction ? `Ação selecionada: ${selectedAction.label}` : "Faça um pedido livre ao assistente."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-0">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ex: Me ajude a responder um cliente procurando apartamento até 700 mil..."
              className="min-h-32 resize-none rounded-[1.25rem] border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={sendPrompt}
                disabled={isSending}
                className="h-10 w-full rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:opacity-60 sm:w-auto"
              >
                <Send className="size-4" />
                {isSending ? "Enviando..." : "Enviar para o Assessor EME"}
              </Button>
              {feedback ? <p className="text-sm text-[#009b3a]">{feedback}</p> : null}
            </div>
            {response ? (
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm leading-7 text-[#5F6B7A]">
                {response}
              </div>
            ) : null}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <ResponsiveCollapsibleSection title="Histórico operacional">
        <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardContent className="grid gap-3 p-5">
            {history.length > 0 ? (
              history.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#050505]">{formatAssistantAction(item.actionType || item.detectedIntent)}</p>
                      <p className="mt-1 text-xs text-[#7B8491]">{formatAssistantTime(item.createdAt)}</p>
                    </div>
                    <span className={item.actionStatus === "error" ? "rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200" : item.actionStatus === "processing" ? "rounded-full border border-[#ffd54f]/20 bg-[#ffd54f]/10 px-2 py-0.5 text-[10px] text-[#ffe082]" : "rounded-full border border-[#009b3a]/16 bg-[#009b3a]/10 px-2 py-0.5 text-[10px] text-[#009b3a]"}>
                      {item.actionStatus === "error" ? "Atenção" : item.actionStatus === "processing" ? "Em andamento" : "Concluído"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#009b3a]">-{item.creditsUsed ?? 1} crédito IA</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">
                Nenhuma ação operacional registrada ainda.
              </div>
            )}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <section className="rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#050505]">Assessor EME no WhatsApp</h3>
              <p className="mt-2 text-xl font-semibold text-[#050505]">
                {hasOfficialAssessorNumber ? assessorConfig?.officialNumber : "Canal em preparação"}
              </p>
              <p className="mt-1 text-sm text-[#009b3a]">
                {hasOfficialAssessorNumber ? `${assessorDisplayName} - ${assessorStatus}` : assessorStatus}
              </p>
              <p className="mt-2 text-sm leading-7 text-[#6B7280]">
                Use o Assessor EME para pedir tarefas ao sistema, como cadastrar imóvel, procurar imóvel, cadastrar lead, gerar resumo e criar anúncio. O número oficial será exibido quando a configuração administrativa estiver disponível.
              </p>
              {assessorConfig?.internalInstructions ? (
                <p className="mt-2 text-sm leading-7 text-[#7B8491]">{assessorConfig.internalInstructions}</p>
              ) : null}
              {hasOfficialAssessorNumber ? (
                <Button
                  type="button"
                  asChild
                  className="mt-4 h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633]"
                >
                  <a href={`https://wa.me/${assessorConfig?.officialNumber.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    Abrir WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-1 size-5 shrink-0 text-[#009b3a]" />
            <p className="text-sm leading-7 text-[#6B7280]">
              O Assessor EME usa créditos por ação. A compra de créditos ficará conectada ao billing em uma etapa futura.
            </p>
          </div>
        </section>

      </div>
    </BrokerPageShell>
  )
}

function formatAssistantAction(action: string | null) {
  if (!action) return "Ação do Assessor"
  const normalized = action.toLowerCase()
  if (normalized.includes("createlead") || normalized.includes("create_lead")) return "Lead cadastrado"
  if (normalized.includes("searchproperties") || normalized.includes("search_properties")) return "Busca de imóveis"
  if (normalized.includes("create_agenda_event")) return "Compromisso criado"
  if (normalized.includes("list_agenda_events")) return "Consulta de agenda"
  if (normalized.includes("mark_agenda_done")) return "Compromisso concluído"
  if (normalized.includes("create_proposal")) return "Proposta gerada"
  if (normalized.includes("list_documents")) return "Consulta de documentos"
  if (normalized.includes("get_document")) return "Documento consultado"
  if (normalized.includes("getfinancialsummary") || normalized.includes("financial")) return "Consulta financeira"
  if (normalized.includes("improve")) return "Descrição melhorada"
  if (normalized.includes("create_ad")) return "Anúncio criado"
  if (normalized.includes("analyze")) return "Catálogo analisado"
  return action.replace(/_/g, " ")
}

function formatAssistantTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Horário não informado"
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (date.toDateString() === new Date().toDateString()) return `Hoje às ${time}`
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`
}
