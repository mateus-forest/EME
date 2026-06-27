"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Bot, CheckCircle2, Clock3, MessageCircle, ShieldCheck, UserRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
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
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <MessageCircle className="size-6" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#050505]">Corretor EME</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5F6B7A]">
                Integre seu WhatsApp para pré-atender, qualificar e organizar leads automaticamente.
              </p>
            </div>
            <Button type="button" onClick={() => void saveConfig(true)} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
              Solicitar ativação
            </Button>
          </div>
          {feedback ? <p className="mt-4 text-sm text-[#009b3a]">{feedback}</p> : null}
        </section>

        <ResponsiveCollapsibleSection title="Configuração desejada" defaultMobileOpen>
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-[#050505]">Configuração desejada</CardTitle>
            <p className="text-sm text-[#6B7280]">O Corretor EME usa o seu próprio WhatsApp para pré-atender e qualificar leads.</p>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0 md:grid-cols-2">
            <Field label="Número do WhatsApp">
              <Input value={request.whatsApp} onChange={(event) => setRequest({ ...request, whatsApp: event.target.value })} placeholder="Informe o número que deseja integrar" className="border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Nome de exibição">
              <Input value={request.displayName} onChange={(event) => setRequest({ ...request, displayName: event.target.value })} placeholder="Ex: Mateus Corretor" className="border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Status da integração">
              <Input value={request.status} readOnly className="border-black/[0.06] bg-white/80 text-[#050505]" />
            </Field>
            <Field label="Mensagem inicial padrão">
              <Textarea value={request.initialMessage} onChange={(event) => setRequest({ ...request, initialMessage: event.target.value })} placeholder="Mensagem de abertura para novos leads" className="min-h-24 border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Observações">
              <Textarea value={request.notes} onChange={(event) => setRequest({ ...request, notes: event.target.value })} placeholder="Preferências de atendimento e qualificação" className="min-h-24 border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Provider futuro">
              <Input value={request.provider} onChange={(event) => setRequest({ ...request, provider: event.target.value })} placeholder="Meta/WhatsApp Cloud API" className="border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Phone Number ID futuro">
              <Input value={request.phoneNumberId} onChange={(event) => setRequest({ ...request, phoneNumberId: event.target.value })} placeholder="Configurado futuramente" className="border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Webhook Verify Token futuro">
              <Input value={request.webhookVerifyToken} onChange={(event) => setRequest({ ...request, webhookVerifyToken: event.target.value })} placeholder="Token de verificação futuro" className="border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
            </Field>
            <Field label="Status do webhook">
              <Input value={request.webhookStatus} readOnly className="border-black/[0.06] bg-white/80 text-[#050505]" />
            </Field>
            <div className="md:col-span-2">
              <Button type="button" onClick={() => void saveConfig(false)} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
                Salvar configuração
              </Button>
            </div>
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ResponsiveCollapsibleSection title="Como funciona">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <ShieldCheck className="size-5 text-[#009b3a]" />
                Como funciona
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {howItWorks.map((item) => <ListItem key={item} text={item} />)}
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <Card className="rounded-[1.75rem] border-[#25D366]/20 bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <Clock3 className="size-5 text-[#25D366]" />
                Status da integração
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="rounded-[1.25rem] border border-[#25D366]/20 bg-[#25D366]/10 p-4">
                <p className="text-sm text-[#25D366]">{request.status}</p>
                <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                  A conexão real com WhatsApp ainda não está ativa. Esta área prepara a ativação futura sem criar webhook ou promessa de uso imediato.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ResponsiveCollapsibleSection title="O que ele faz">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <UserRound className="size-5 text-[#009b3a]" />
                O que ele faz
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {capabilities.map((item) => <ListItem key={item} text={item} />)}
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Corretor EME ou Assessor EME?">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Corretor EME ou Assessor EME?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <ChannelBlock icon={MessageCircle} title="Corretor EME" text="WhatsApp do corretor para atender clientes e leads, fazer pré-atendimento e apoiar o funil comercial." />
              <ChannelBlock icon={Bot} title="Assessor EME" text="Canal oficial do EME para o corretor conversar com a IA e pedir tarefas operacionais ao sistema." />
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        {history.length > 0 ? (
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Últimas ações</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              {history.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-sm font-medium text-[#050505]">{item.detectedIntent || "Atendimento"}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">{item.message}</p>
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
      <span className="text-sm text-[#6B7280]">{label}</span>
      {children}
    </label>
  )
}

function ListItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
      <p className="text-sm leading-6 text-[#5F6B7A]">{text}</p>
    </div>
  )
}

function ChannelBlock({ icon: Icon, title, text }: { icon: typeof MessageCircle; title: string; text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
          <Icon className="size-4.5" />
        </div>
        <p className="text-base font-semibold text-[#050505]">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">{text}</p>
    </div>
  )
}
