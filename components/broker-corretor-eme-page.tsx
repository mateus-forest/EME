"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Bot, CheckCircle2, Clock3, MessageCircle, ShieldCheck, UserRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const howItWorks = [
  "O Corretor EME usa o WhatsApp do próprio corretor.",
  "O objetivo é atender leads recebidos pelo corretor.",
  "A IA ajuda a identificar intenção de compra, venda ou aluguel.",
  "A IA pode qualificar o lead e registrar no CRM.",
  "O corretor continua no controle do atendimento.",
]

const capabilities = [
  "Pré-atendimento de novos leads",
  "Qualificação automática",
  "Registro no CRM",
  "Organização do histórico",
  "Apoio ao funil de atendimento",
  "Encaminhamento para atendimento humano quando necessário",
]

type CorretorEmeRequest = {
  whatsApp: string
  displayName: string
  status: string
  initialMessage: string
  notes: string
  provider: string
  phoneNumberId: string
  webhookVerifyToken: string
  webhookStatus: string
}

type CorretorEmeHistory = {
  id: string
  message: string
  response: string | null
  detectedIntent: string | null
  actionStatus: string | null
}

const initialRequest: CorretorEmeRequest = {
  whatsApp: "",
  displayName: "",
  status: "Integração em preparação",
  initialMessage: "",
  notes: "",
  provider: "",
  phoneNumberId: "",
  webhookVerifyToken: "",
  webhookStatus: "Não configurado",
}

export function BrokerCorretorEmePage() {
  const [request, setRequest] = useState<CorretorEmeRequest>(initialRequest)
  const [history, setHistory] = useState<CorretorEmeHistory[]>([])
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    let ignore = false

    fetch("/api/corretor-eme/config", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | {
              config?: Omit<CorretorEmeRequest, "status" | "webhookStatus"> & {
                status: string
                webhookStatus: string
              }
              history?: CorretorEmeHistory[]
            }
          | null

        if (!ignore && response.ok && data?.config) {
          setRequest({
            whatsApp: data.config.whatsApp,
            displayName: data.config.displayName,
            status: statusLabel(data.config.status),
            initialMessage: data.config.initialMessage,
            notes: data.config.notes,
            provider: data.config.provider,
            phoneNumberId: data.config.phoneNumberId,
            webhookVerifyToken: data.config.webhookVerifyToken,
            webhookStatus: statusLabel(data.config.webhookStatus),
          })
          setHistory(data.history ?? [])
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  async function saveConfig(requestActivation = false) {
    setFeedback("")

    try {
      const response = await fetch("/api/corretor-eme/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ ...request, requestActivation }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar a configuração.")
      setFeedback(requestActivation ? "Solicitação de ativação registrada." : "Configuração salva.")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a configuração.")
    }
  }

  return (
    <BrokerPageShell title="Corretor EME">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-[#00C853]/18 bg-[linear-gradient(135deg,rgba(0,200,83,0.14),rgba(17,17,17,0.96)_42%,rgba(14,14,14,0.92))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <MessageCircle className="size-6" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">Corretor EME</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                Integre seu WhatsApp para pré-atender, qualificar e organizar leads automaticamente.
              </p>
            </div>
            <Button type="button" onClick={() => void saveConfig(true)} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
              Solicitar ativação
            </Button>
          </div>
          {feedback ? <p className="mt-4 text-sm text-[#69F0AE]">{feedback}</p> : null}
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">Configuração desejada</CardTitle>
            <p className="text-sm text-white/50">O Corretor EME usa o seu próprio WhatsApp para pré-atender e qualificar leads.</p>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0 md:grid-cols-2">
            <Field label="Número do WhatsApp">
              <Input value={request.whatsApp} onChange={(event) => setRequest({ ...request, whatsApp: event.target.value })} placeholder="Informe o número que deseja integrar" className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Nome de exibição">
              <Input value={request.displayName} onChange={(event) => setRequest({ ...request, displayName: event.target.value })} placeholder="Ex: Mateus Corretor" className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Status da integração">
              <Input value={request.status} readOnly className="border-white/[0.08] bg-white/[0.04] text-white" />
            </Field>
            <Field label="Mensagem inicial padrão">
              <Textarea value={request.initialMessage} onChange={(event) => setRequest({ ...request, initialMessage: event.target.value })} placeholder="Mensagem de abertura para novos leads" className="min-h-24 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Observações">
              <Textarea value={request.notes} onChange={(event) => setRequest({ ...request, notes: event.target.value })} placeholder="Preferências de atendimento e qualificação" className="min-h-24 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Provider futuro">
              <Input value={request.provider} onChange={(event) => setRequest({ ...request, provider: event.target.value })} placeholder="Meta/WhatsApp Cloud API" className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Phone Number ID futuro">
              <Input value={request.phoneNumberId} onChange={(event) => setRequest({ ...request, phoneNumberId: event.target.value })} placeholder="Configurado futuramente" className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Webhook Verify Token futuro">
              <Input value={request.webhookVerifyToken} onChange={(event) => setRequest({ ...request, webhookVerifyToken: event.target.value })} placeholder="Token de verificação futuro" className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Status do webhook">
              <Input value={request.webhookStatus} readOnly className="border-white/[0.08] bg-white/[0.04] text-white" />
            </Field>
            <div className="md:col-span-2">
              <Button type="button" onClick={() => void saveConfig(false)} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                Salvar configuração
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <ShieldCheck className="size-5 text-[#69F0AE]" />
                Como funciona
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {howItWorks.map((item) => <ListItem key={item} text={item} />)}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-[#25D366]/20 bg-[linear-gradient(180deg,rgba(18,28,22,0.9),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <Clock3 className="size-5 text-[#25D366]" />
                Status da integração
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="rounded-[1.25rem] border border-[#25D366]/20 bg-[#25D366]/10 p-4">
                <p className="text-sm text-[#25D366]">{request.status}</p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  A conexão real com WhatsApp ainda não está ativa. Esta área prepara a ativação futura sem criar webhook ou promessa de uso imediato.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <UserRound className="size-5 text-[#69F0AE]" />
                O que ele faz
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {capabilities.map((item) => <ListItem key={item} text={item} />)}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Corretor EME ou Assessor EME?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <ChannelBlock icon={MessageCircle} title="Corretor EME" text="WhatsApp do corretor para atender clientes e leads, fazer pré-atendimento e apoiar o funil comercial." />
              <ChannelBlock icon={Bot} title="Assessor EME" text="Canal oficial do EME para o corretor conversar com a IA e pedir tarefas operacionais ao sistema." />
            </CardContent>
          </Card>
        </section>

        {history.length > 0 ? (
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Últimas ações</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {history.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">{item.detectedIntent || "Atendimento"}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-white/55">{item.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </BrokerPageShell>
  )
}

function statusLabel(status: string) {
  if (status === "REQUESTED") return "Ativação solicitada"
  if (status === "ACTIVE") return "Ativo"
  if (status === "PAUSED") return "Pausado"
  if (status === "NOT_CONFIGURED") return "Não configurado"
  return "Integração em preparação"
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-white/55">{label}</span>
      {children}
    </label>
  )
}

function ListItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#69F0AE]" />
      <p className="text-sm leading-6 text-white/65">{text}</p>
    </div>
  )
}

function ChannelBlock({ icon: Icon, title, text }: { icon: typeof MessageCircle; title: string; text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-4.5" />
        </div>
        <p className="text-base font-semibold text-white">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/58">{text}</p>
    </div>
  )
}
