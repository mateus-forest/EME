"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clock3, FileText, MessageCircle, Phone, Search, Sparkles, Trash2, Trophy, UsersRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useBrokerProperties } from "@/components/use-broker-properties"
import type { LeadRecord } from "@/lib/lead-contract"

type ClientFilterId =
  | "all"
  | "new"
  | "contacted"
  | "visit"
  | "negotiating"
  | "active"
  | "sold"
  | "archived"

const clientStages: Array<{
  title: string
  description: string
  icon: typeof UsersRound
  match: (client: LeadRecord) => boolean
}> = [
  {
    title: "Novos interessados",
    description: "Contatos que chegaram e ainda precisam do primeiro atendimento.",
    icon: UsersRound,
    match: (client) => client.status === "NEW",
  },
  {
    title: "Em atendimento",
    description: "Clientes com conversa ativa, retorno ou negociacao em andamento.",
    icon: MessageCircle,
    match: (client) => client.status === "CONTACTED" || client.status === "NEGOTIATING",
  },
  {
    title: "Vendidos",
    description: "Clientes que avancaram para fechamento dentro do funil comercial.",
    icon: Trophy,
    match: (client) => client.status === "WON",
  },
  {
    title: "Arquivados",
    description: "Contatos arquivados ou encerrados fora da operacao ativa.",
    icon: Clock3,
    match: (client) => client.status === "ARCHIVED" || client.status === "LOST",
  },
]

const clientFilters: Array<{ id: ClientFilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "new", label: "Novos interessados" },
  { id: "contacted", label: "Em atendimento" },
  { id: "visit", label: "Visita agendada" },
  { id: "negotiating", label: "Negociacao" },
  { id: "active", label: "Clientes ativos" },
  { id: "sold", label: "Vendidos" },
  { id: "archived", label: "Arquivados" },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Data nao disponivel"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

const statusLabelOverrides: Record<LeadRecord["status"], string> = {
  NEW: "Novo interessado",
  CONTACTED: "Em atendimento",
  NEGOTIATING: "Negociacao",
  WON: "Vendido",
  LOST: "Arquivado",
  ARCHIVED: "Arquivado",
}

export function BrokerClientsPage() {
  const { properties } = useBrokerProperties()
  const [clients, setClients] = useState<LeadRecord[]>([])
  const [feedback, setFeedback] = useState("")
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("error")
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<ClientFilterId>("all")
  const [selectedClient, setSelectedClient] = useState<LeadRecord | null>(null)
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeletingClient, setIsDeletingClient] = useState(false)
  const [clientDraft, setClientDraft] = useState({
    name: "",
    email: "",
    phone: "",
    propertyId: "none",
    searchTerm: "",
    intent: "",
    message: "",
  })

  useEffect(() => {
    let ignore = false

      fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[]; error?: string } | null
        if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar seus clientes.")
        if (!ignore) setClients(data?.leads ?? [])
      })
      .catch((error) => {
        if (!ignore) {
          setFeedbackTone("error")
          setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar seus clientes.")
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredBySearch = useMemo(
    () =>
      clients.filter((client) =>
        normalizedSearch
          ? [client.name, client.phone, client.propertyTitle, client.message]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(normalizedSearch))
          : true,
      ),
    [clients, normalizedSearch],
  )

  const filteredClients = useMemo(
    () => filteredBySearch.filter((client) => matchesClientFilter(client, activeFilter)),
    [activeFilter, filteredBySearch],
  )

  const values = useMemo(
    () => clientStages.map((stage) => clients.filter((client) => stage.match(client)).length),
    [clients],
  )

  async function updateClientStatus(client: LeadRecord, status: LeadRecord["status"]) {
    setIsUpdatingStatus(true)
    setFeedback("")

    try {
      const response = await fetch(`/api/leads/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ status }),
      })
      const data = (await response.json().catch(() => null)) as { lead?: LeadRecord; error?: string } | null

      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "Nao foi possivel atualizar o status do cliente.")
      }

      setClients((current) => current.map((item) => (item.id === data.lead?.id ? data.lead : item)))
      setSelectedClient(data.lead)
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel atualizar o status do cliente.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function deleteClient(client: LeadRecord) {
    if (!window.confirm(`Deseja excluir ${client.name || "este cliente"} da sua carteira?`)) return

    setIsDeletingClient(true)
    setFeedback("")

    try {
      const response = await fetch(`/api/leads/${client.id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel excluir o cliente.")
      }

      setClients((current) => current.filter((item) => item.id !== client.id))
      setSelectedClient((current) => (current?.id === client.id ? null : current))
      setFeedbackTone("success")
      setFeedback("Cliente removido da carteira.")
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel excluir o cliente.")
    } finally {
      setIsDeletingClient(false)
    }
  }

  async function createClient() {
    setIsCreatingClient(true)
    setFeedback("")

    try {
      const response = await fetch("/api/brokers/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          ...clientDraft,
          propertyId: clientDraft.propertyId === "none" ? "" : clientDraft.propertyId,
        }),
      })
      const data = (await response.json().catch(() => null)) as { lead?: LeadRecord; error?: string } | null

      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "Nao foi possivel cadastrar o cliente.")
      }

      setClients((current) => {
        const nextClients = current.filter((item) => item.id !== data.lead!.id)
        return [data.lead!, ...nextClients]
      })
      setIsCreateClientOpen(false)
      setClientDraft({
        name: "",
        email: "",
        phone: "",
        propertyId: "none",
        searchTerm: "",
        intent: "",
        message: "",
      })
      setFeedbackTone("success")
      setFeedback("Cliente cadastrado com sucesso.")
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel cadastrar o cliente.")
    } finally {
      setIsCreatingClient(false)
    }
  }

  return (
    <BrokerPageShell title="Clientes" primaryActionLabel="Novo cliente" primaryActionOnClick={() => setIsCreateClientOpen(true)}>
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Sparkles className="size-3.5" />
                Relacionamento ativo
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Clientes</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Acompanhe contatos quentes, priorize retornos e transforme oportunidades em visitas, propostas e fechamento.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setIsCreateClientOpen(true)}
              className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
            >
              + Novo cliente
            </Button>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
            {clientStages.map((stage, index) => (
              <Card key={stage.title} className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
                <CardHeader className="px-4 py-4 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
                      <stage.icon className="size-4.5" />
                    </div>
                    <p className="break-words text-2xl font-semibold text-[#050505] sm:text-3xl">{values[index]}</p>
                  </div>
                  <CardTitle className="pt-3 text-base text-[#050505]">{stage.title}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 sm:px-5">
                  <p className="text-sm leading-6 text-[#6B7280]">{stage.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-[1.5rem] border border-black/[0.06] bg-white/90 p-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Buscar cliente</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98A2B3]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, telefone ou imovel"
                  className="h-11 rounded-xl pl-10"
                />
              </div>
            </label>
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {clientFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${activeFilter === filter.id ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : "border-black/[0.06] bg-white/90 text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
            >
              {filter.label}
            </button>
          ))}
        </section>

        <section className="rounded-[1.75rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
          {feedback ? (
            <div
              className={`rounded-[1.25rem] px-4 py-3 text-sm ${
                feedbackTone === "success"
                  ? "border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#0b7a33]"
                  : "border border-red-500/20 bg-red-500/10 text-red-700"
              }`}
            >
              {feedback}
            </div>
          ) : filteredClients.length > 0 ? (
            <div className="grid gap-3">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="grid gap-4 rounded-[1.25rem] border border-black/[0.06] bg-white/92 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#050505]">{client.name || "Cliente sem nome"}</p>
                      <span className="rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-2.5 py-1 text-xs text-[#009b3a]">
                        {statusLabelOverrides[client.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#7B8491]">
                      {client.propertyTitle || "Catalogo"} · {formatLeadSource(client.source)} · {formatDate(client.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5F6B7A]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-[#009b3a]" />
                        {client.phone || "Telefone nao informado"}
                      </span>
                    </div>
                    {client.message ? <p className="mt-2 line-clamp-2 text-sm text-[#5F6B7A]">{client.message}</p> : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedClient(client)}
                      className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      Ver cliente
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isDeletingClient}
                      onClick={() => void deleteClient(client)}
                      className="h-10 rounded-xl border border-red-200 bg-white px-4 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                    >
                      <Trash2 className="size-4" />
                      Excluir
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      <Link href="/corretor/documentos">
                        <FileText className="size-4" />
                        Propostas
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#eef9f1] text-[#009b3a]">
                <UsersRound className="size-6" />
              </div>
              <h3 className="text-xl font-semibold text-[#050505]">Nenhum cliente encontrado.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7280]">
                {normalizedSearch ? "Ajuste sua busca para localizar o cliente." : "Seus clientes aparecerao aqui conforme o funil comecar a receber contatos."}
              </p>
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white/95 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-2xl">
          {selectedClient ? (
            <div className="grid gap-5">
              <div>
                <DialogTitle className="text-2xl text-[#050505]">{selectedClient.name || "Cliente sem nome"}</DialogTitle>
                <DialogDescription className="mt-2 text-[#6B7280]">
                  Historico e enquadramento do cliente dentro do portal.
                </DialogDescription>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ClientInfo label="Telefone" value={selectedClient.phone || "Nao informado"} />
                <ClientInfo label="Imovel de interesse" value={selectedClient.propertyTitle || "Catalogo"} />
                <ClientInfo label="Origem" value={formatLeadSource(selectedClient.source)} />
                <ClientInfo label="Data" value={formatDate(selectedClient.createdAt)} />
                <ClientInfo label="Busca" value={selectedClient.searchTerm || "Sem busca registrada"} />
                <ClientInfo label="Intencao" value={selectedClient.intent || "Sem intencao registrada"} />
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-sm text-[#6B7280]">Mensagem</p>
                <p className="mt-2 break-words text-sm leading-6 text-[#5F6B7A]">{selectedClient.message || "Sem mensagem registrada."}</p>
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-[#6B7280]">Status atual</span>
                <Select
                  value={selectedClient.status}
                  disabled={isUpdatingStatus}
                  onValueChange={(value) => updateClientStatus(selectedClient, value as LeadRecord["status"])}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Novo interessado</SelectItem>
                    <SelectItem value="CONTACTED">Em atendimento</SelectItem>
                    <SelectItem value="NEGOTIATING">Negociacao</SelectItem>
                    <SelectItem value="WON">Vendido</SelectItem>
                    <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
                  <Link href="/corretor/documentos">
                    <FileText className="size-4" />
                    Abrir propostas
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  <Link href="/corretor/imoveis">Ver imoveis</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isDeletingClient}
                  onClick={() => void deleteClient(selectedClient)}
                  className="h-10 rounded-xl border border-red-200 bg-white px-4 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                  Excluir cliente
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white/95 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-2xl">
          <div className="grid gap-5">
            <div>
              <DialogTitle className="text-2xl text-[#050505]">Novo cliente</DialogTitle>
              <DialogDescription className="mt-2 text-[#6B7280]">
                Cadastre manualmente um cliente na sua carteira e continue o atendimento sem sair da lista.
              </DialogDescription>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome">
                <Input value={clientDraft.name} onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do cliente" className="h-11 rounded-xl" />
              </Field>
              <Field label="Telefone">
                <Input value={clientDraft.phone} onChange={(event) => setClientDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="(00) 00000-0000" className="h-11 rounded-xl" />
              </Field>
              <Field label="Email">
                <Input value={clientDraft.email} onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))} placeholder="cliente@email.com" className="h-11 rounded-xl" />
              </Field>
              <Field label="Imovel de interesse">
                <Select value={clientDraft.propertyId} onValueChange={(value) => setClientDraft((current) => ({ ...current, propertyId: value }))}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecionar imovel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem imovel vinculado</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Busca">
                <Input value={clientDraft.searchTerm} onChange={(event) => setClientDraft((current) => ({ ...current, searchTerm: event.target.value }))} placeholder="Ex.: apartamento com varanda" className="h-11 rounded-xl" />
              </Field>
              <Field label="Intencao">
                <Input value={clientDraft.intent} onChange={(event) => setClientDraft((current) => ({ ...current, intent: event.target.value }))} placeholder="Ex.: compra para morar" className="h-11 rounded-xl" />
              </Field>
            </div>

            <Field label="Observacoes">
              <Textarea
                value={clientDraft.message}
                onChange={(event) => setClientDraft((current) => ({ ...current, message: event.target.value }))}
                placeholder="Contexto da conversa, faixa de interesse, urgencia, origem do contato..."
                className="min-h-28 rounded-[1.25rem]"
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateClientOpen(false)}
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isCreatingClient}
                onClick={() => void createClient()}
                className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:opacity-60"
              >
                {isCreatingClient ? "Salvando..." : "Cadastrar cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-[#6B7280]">{label}</span>
      {children}
    </label>
  )
}

function formatLeadSource(source: string) {
  const normalized = source.toLowerCase()
  if (normalized.includes("catalog")) return "Catalogo"
  if (normalized.includes("assessor")) return "Assessor EME"
  if (normalized.includes("corretor_eme")) return "Corretor EME"
  if (normalized.includes("whatsapp")) return "WhatsApp"
  if (normalized.includes("manual")) return "Manual"
  if (normalized.includes("landing")) return "Landing page"
  return source || "Portal"
}

function matchesClientFilter(client: LeadRecord, filter: ClientFilterId) {
  if (filter === "all") return true
  if (filter === "new") return client.status === "NEW"
  if (filter === "contacted") return client.status === "CONTACTED"
  if (filter === "visit") return hasVisitScheduled(client)
  if (filter === "negotiating") return client.status === "NEGOTIATING"
  if (filter === "active") return ["NEW", "CONTACTED", "NEGOTIATING"].includes(client.status)
  if (filter === "sold") return client.status === "WON"
  return client.status === "ARCHIVED" || client.status === "LOST"
}

function hasVisitScheduled(client: LeadRecord) {
  const content = [client.message, client.intent, client.searchTerm]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return /\b(visita|visitar|agendada|agendar|tour)\b/.test(content)
}

function ClientInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#050505]">{value}</p>
    </div>
  )
}
