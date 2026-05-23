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
          actionStatus: data?.actionStatus || "completed",
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 5))
      setFeedback(data?.creditsUsed ? `${data.creditsUsed} crédito(s) consumido(s).` : "")
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
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <Bot className="size-6" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">Assistente do corretor</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                Use o Assessor EME para criar anúncios, analisar leads, melhorar seu catálogo e pedir tarefas operacionais.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={toggleAssistantEnabled}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white"
              >
                {isActive ? "Desativar" : "Ativar"} Assessor EME
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={requestMoreCredits}
                className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white"
              >
                <CreditCard className="size-4" />
                Solicitar mais créditos
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ResponsiveCollapsibleSection title="Créditos disponíveis" defaultMobileOpen>
          <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-white">Créditos disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              <div className="rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3">
                <p className="text-sm text-[#69F0AE]">Status</p>
                <p className="mt-1 text-xl font-semibold text-white">{isActive ? "Ativo" : "Pausado"}</p>
              </div>
              <div>
                <p className="text-4xl font-semibold text-white">{credits.balance}</p>
                <p className="mt-2 text-sm text-white/50">créditos atuais</p>
                {credits.balance <= 3 ? <p className="mt-2 text-sm text-[#69F0AE]">Créditos baixos. Solicite mais créditos para continuar testando o Assessor EME.</p> : null}
              </div>
              <div className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-white/45">Usados no mês</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.usedThisMonth}</p>
              </div>
              <div className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-sm text-white/45">Pacote/plano atual</p>
                <p className="mt-1 text-xl font-semibold text-white">{subscription.isUpgraded ? subscription.planName : "Modo avaliação"}</p>
              </div>
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Ações rápidas">
          <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-white">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0 sm:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((action) => (
                <Button
                  key={action.actionType}
                  type="button"
                  variant="ghost"
                  onClick={() => selectAction(action)}
                  className={`min-h-12 justify-start rounded-xl border px-4 text-left text-sm ${actionType === action.actionType ? "border-[#00C853]/25 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"}`}
                >
                  <Sparkles className="size-4 shrink-0" />
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        <ResponsiveCollapsibleSection title="Histórico recente">
        <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <CardHeader className="px-5 py-5">
            <CardTitle className="text-lg text-white">Fale com o Assessor EME</CardTitle>
            <p className="text-sm text-white/50">
              {selectedAction ? `Ação selecionada: ${selectedAction.label}` : "Faça um pedido livre ao assistente."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-0">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ex: Me ajude a responder um cliente procurando apartamento até 700 mil..."
              className="min-h-32 rounded-[1.25rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={sendPrompt}
                disabled={isSending}
                className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30 disabled:opacity-60"
              >
                <Send className="size-4" />
                {isSending ? "Enviando..." : "Enviar para o Assessor EME"}
              </Button>
              {feedback ? <p className="text-sm text-[#69F0AE]">{feedback}</p> : null}
            </div>
            {response ? (
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-7 text-white/70">
                {response}
              </div>
            ) : null}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <section className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Assessor EME no WhatsApp</h3>
              <p className="mt-2 text-xl font-semibold text-white">
                {hasOfficialAssessorNumber ? assessorConfig?.officialNumber : "Canal em preparação"}
              </p>
              <p className="mt-1 text-sm text-[#69F0AE]">
                {hasOfficialAssessorNumber ? `${assessorDisplayName} - ${assessorStatus}` : assessorStatus}
              </p>
              <p className="mt-2 text-sm leading-7 text-white/55">
                Use o Assessor EME para pedir tarefas ao sistema, como cadastrar imóvel, procurar imóvel, cadastrar lead, gerar resumo e criar anúncio. O número oficial será exibido quando a configuração administrativa estiver disponível.
              </p>
              {assessorConfig?.internalInstructions ? (
                <p className="mt-2 text-sm leading-7 text-white/45">{assessorConfig.internalInstructions}</p>
              ) : null}
              {hasOfficialAssessorNumber ? (
                <Button
                  type="button"
                  asChild
                  className="mt-4 h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676]"
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

        <section className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-1 size-5 shrink-0 text-[#69F0AE]" />
            <p className="text-sm leading-7 text-white/55">
              O Assessor EME usa créditos por ação. A compra de créditos ficará conectada ao billing em uma etapa futura.
            </p>
          </div>
        </section>

        <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <CardHeader className="px-5 py-5">
            <CardTitle className="text-lg text-white">Histórico recente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0">
            {history.length > 0 ? history.map((item) => (
              <div key={item.id} className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{item.actionType || "general"}</p>
                  <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs text-[#69F0AE]">
                    {item.actionStatus || "registrado"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/65">{item.message}</p>
                {item.response ? <p className="mt-2 text-sm leading-6 text-white/45">{item.response}</p> : null}
              </div>
            )) : (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">
                Nenhuma interação registrada ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </BrokerPageShell>
  )
}
