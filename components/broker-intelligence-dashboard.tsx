"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bot, CalendarDays, CheckCircle2, FileText, Lightbulb, Search, UsersRound } from "lucide-react"

import type { BrokerProperty } from "@/components/use-broker-properties"
import type { BrokerSubscription } from "@/components/use-broker-subscription"
import type { LeadRecord } from "@/lib/lead-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type AssistantCredits = {
  balance: number
  usedThisMonth: number
}

type BrokerIntelligenceDashboardProps = {
  properties: BrokerProperty[]
  subscription: BrokerSubscription
}

type SearchEventItem = {
  id: string
  query: string
  resultCount: number
  source: string
  createdAt: string
}

type AgendaEventItem = {
  id: string
  title: string
  date: string
  time: string
  status: string
}

type DocumentItem = {
  id: string
  title: string
  type: string
  status: string
  createdAt: string
}

export function BrokerIntelligenceDashboard({ properties }: BrokerIntelligenceDashboardProps) {
  const [credits, setCredits] = useState<AssistantCredits>({ balance: 0, usedThisMonth: 0 })
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true)
  const [recentSearches, setRecentSearches] = useState<SearchEventItem[]>([])
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])

  useEffect(() => {
    let ignore = false

    fetch("/api/ai/broker-assistant", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { credits?: AssistantCredits } | null
        if (!ignore && response.ok && data?.credits) setCredits(data.credits)
      })
      .catch(() => null)

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[] } | null
        if (!ignore && response.ok && data?.leads) setLeads(data.leads)
      })
      .catch(() => null)

    fetch("/api/brokers/analytics", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { recentSearches?: SearchEventItem[] } | null
        if (!ignore && response.ok && data?.recentSearches) setRecentSearches(data.recentSearches)
      })
      .catch(() => null)

    fetch("/api/brokers/agenda?filter=all", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { events?: AgendaEventItem[] } | null
        if (!ignore && response.ok) setAgendaEvents(data?.events ?? [])
      })
      .catch(() => null)

    fetch("/api/brokers/documents?status=all", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { documents?: DocumentItem[] } | null
        if (!ignore && response.ok) setDocuments(data?.documents ?? [])
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  const leadMetrics = useMemo(
    () => ({
      received: leads.length,
      new: leads.filter((lead) => lead.status === "NEW").length,
      pending: leads.filter((lead) => lead.status === "NEW" || lead.status === "CONTACTED").length,
      converted: leads.filter((lead) => lead.status === "WON").length,
    }),
    [leads],
  )
  const recentLeads = leads.slice(0, 3)
  const actionsCount = credits.usedThisMonth
  const recommendedActions = [
    properties.length === 0 ? "Publique seu primeiro imóvel no catálogo inteligente." : "",
    leads.length === 0 ? "Compartilhe seu catálogo para começar a capturar leads." : "",
    credits.balance === 0 ? "Adicione créditos IA para usar o Assessor EME." : "",
  ].filter(Boolean)
  const todayKey = new Date().toISOString().slice(0, 10)
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowKey = tomorrowDate.toISOString().slice(0, 10)
  const agendaMetrics = {
    today: agendaEvents.filter((event) => event.date === todayKey).length,
    tomorrow: agendaEvents.filter((event) => event.date === tomorrowKey).length,
    pending: agendaEvents.filter((event) => event.status === "pending").length,
  }
  const nextAgendaEvents = agendaEvents
    .filter((event) => event.status !== "cancelled")
    .slice(0, 2)
  const documentMetrics = {
    proposals: documents.filter((document) => document.type === "proposal").length,
    drafts: documents.filter((document) => document.status === "draft").length,
    signed: documents.filter((document) => document.status === "signed").length,
  }
  const recentDocuments = documents.slice(0, 2)

  return (
    <section className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                  <Bot className="size-3.5" />
                  IA viva
                </div>
                <CardTitle className="mt-4 text-2xl text-[#050505]">Assessor EME</CardTitle>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#5F6B7A]">
                  Canal oficial do EME para criar anúncios, analisar leads, melhorar catálogo e pedir apoio operacional.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAiAssistantEnabled((current) => !current)}
                className="h-10 rounded-xl border border-black/[0.06] bg-white/85 px-4 text-[#050505]/80 hover:bg-white hover:text-[#050505]"
              >
                {aiAssistantEnabled ? "Desativar" : "Ativar"} Assessor EME
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-6 pt-0 xl:grid-cols-4">
            <Metric label="Status" value={aiAssistantEnabled ? "Ativo" : "Pausado"} tone={aiAssistantEnabled ? "green" : "muted"} />
            <Metric label="Créditos IA" value={String(credits.balance)} />
            <Metric label="Uso no mês" value={String(credits.usedThisMonth)} />
            <Metric label="Ações IA" value={actionsCount > 0 ? String(actionsCount) : "Aguardando uso"} />
            <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">Última interação</p>
              <p className="mt-2 text-sm text-[#050505]/68">
                {actionsCount > 0 ? "Ação registrada neste mês." : "O Assessor EME ainda não realizou ações."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/12 text-[#009b3a]">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-[#050505]">Agenda</CardTitle>
                <p className="mt-1 text-sm text-[#009b3a]">Próximos compromissos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Hoje" value={String(agendaMetrics.today)} />
              <Metric label="Amanhã" value={String(agendaMetrics.tomorrow)} />
              <Metric label="Pendentes" value={String(agendaMetrics.pending)} />
            </div>
            {nextAgendaEvents.length > 0 ? (
              nextAgendaEvents.map((event) => (
                <div key={event.id} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                  <p className="truncate text-sm font-medium text-[#050505]">{event.title}</p>
                  <p className="mt-1 text-xs text-[#7B8491]">{formatAgendaDate(event.date, event.time)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="Os próximos compromissos aparecerão aqui." />
            )}
            <Button asChild variant="ghost" className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/agenda">Ver agenda</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <UsersRound className="size-5 text-[#009b3a]" />
              Leads recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {leadMetrics.received > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Recebidos" value={String(leadMetrics.received)} />
                  <Metric label="Novos" value={String(leadMetrics.new)} />
                  <Metric label="Aguardando resposta" value={String(leadMetrics.pending)} />
                  <Metric label="Convertidos" value={String(leadMetrics.converted)} />
                </div>
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                    <p className="text-sm font-medium text-[#050505]">{lead.name || "Lead sem nome"}</p>
                    <p className="mt-1 text-xs text-[#7B8491]">{lead.propertyTitle || "Catálogo"} · {lead.statusLabel}</p>
                  </div>
                ))}
              </>
            ) : (
              <EmptyState text="Nenhum lead recebido ainda. Compartilhe seu catálogo para começar." />
            )}
            <Button asChild variant="ghost" className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/leads">Ver leads</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <Search className="size-5 text-[#009b3a]" />
              Buscas dos clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {recentSearches.length > 0 ? (
              recentSearches.slice(0, 4).map((search) => (
                <div key={search.id} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-[#050505]">{search.query}</p>
                    <span className="shrink-0 rounded-full border border-[#009b3a]/16 bg-[#009b3a]/10 px-2 py-0.5 text-[10px] text-[#009b3a]">
                      {formatSearchOrigin(search.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7B8491]">
                    {formatSearchTime(search.createdAt)} · {search.resultCount} resultado{search.resultCount === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState text="Nenhuma busca registrada ainda." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <FileText className="size-5 text-[#009b3a]" />
              Propostas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Propostas" value={String(documentMetrics.proposals)} />
              <Metric label="Rascunhos" value={String(documentMetrics.drafts)} />
              <Metric label="Assinados" value={String(documentMetrics.signed)} />
            </div>
            {recentDocuments.length > 0 ? (
              recentDocuments.map((document) => (
                <div key={document.id} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                  <p className="truncate text-sm font-medium text-[#050505]">{document.title}</p>
                  <p className="mt-1 text-xs text-[#7B8491]">{formatDocumentStatus(document.status)} · {formatSearchTime(document.createdAt)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="As propostas geradas aparecerão aqui." />
            )}
            <Button asChild variant="ghost" className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white hover:text-[#050505]">
              <Link href="/corretor/documentos">Ver documentos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem] border-black/[0.06] bg-[#fbfbf8] py-0">
        <CardHeader className="px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
            <Lightbulb className="size-5 text-[#009b3a]" />
            Ações recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-6 pt-0">
          {recommendedActions.length > 0 ? (
            recommendedActions.map((action) => (
              <div key={action} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
                {action}
              </div>
            ))
          ) : (
            <EmptyState text="Sua operação está pronta. Continue acompanhando leads, catálogo e créditos IA." />
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function formatAgendaDate(dateValue: string, time: string) {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return time || "Data não informada"
  const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `${dateLabel}${time ? ` às ${time}` : ""}`
}

function formatDocumentStatus(status: string) {
  if (status === "signed") return "Assinado"
  if (status === "generated") return "Gerado"
  if (status === "draft") return "Rascunho"
  return "Documento"
}

function Metric({ label, value, tone = "muted" }: { label: string; value: string; tone?: "green" | "muted" }) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">{label}</p>
      <p className={`mt-2 text-base font-semibold ${tone === "green" ? "text-[#009b3a]" : "text-[#050505]"}`}>{value}</p>
    </div>
  )
}

function formatSearchOrigin(source: string) {
  const normalized = source.toLowerCase()
  if (normalized.includes("whatsapp") || normalized.includes("assessor") || normalized.includes("corretor_eme")) return "WhatsApp"
  if (normalized.includes("catalog")) return "Catálogo"
  if (normalized.includes("dashboard")) return "Dashboard"
  return source || "Dashboard"
}

function formatSearchTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Horário não informado"

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (date.toDateString() === new Date().toDateString()) return `Hoje às ${time}`
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[#009b3a]/16 bg-[#009b3a]/[0.06] p-4 text-sm leading-6 text-[#009b3a]">
      <CheckCircle2 className="mb-3 size-5" />
      {text}
    </div>
  )
}
