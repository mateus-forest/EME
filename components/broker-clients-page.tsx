"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Clock3,
  FileText,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UsersRound,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { formatCep, lookupCep } from "@/lib/cep"
import { openClientDocumentPreview } from "@/lib/client-document-preview"
import { dispatchEntitySync, subscribeEntitySync } from "@/lib/entity-sync"
import type { EntityDocumentRecord } from "@/lib/legal-entities"
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

type ClientForm = {
  id?: string
  name: string
  email: string
  phone: string
  whatsApp: string
  propertyId: string
  searchTerm: string
  intent: string
  message: string
  identification: {
    cpfCnpj: string
    rg: string
    issuingAuthority: string
    issueDate: string
    nationality: string
    birthPlace: string
    maritalStatus: string
    propertyRegime: string
    profession: string
  }
  address: {
    cep: string
    street: string
    number: string
    complement: string
    district: string
    city: string
    state: string
  }
  legal: {
    legalRepresentative: string
    powerOfAttorney: string
    legalNotes: string
  }
  documents: EntityDocumentRecord[]
}

const emptyClientForm: ClientForm = {
  name: "",
  email: "",
  phone: "",
  whatsApp: "",
  propertyId: "none",
  searchTerm: "",
  intent: "",
  message: "",
  identification: {
    cpfCnpj: "",
    rg: "",
    issuingAuthority: "",
    issueDate: "",
    nationality: "",
    birthPlace: "",
    maritalStatus: "",
    propertyRegime: "",
    profession: "",
  },
  address: {
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  },
  legal: {
    legalRepresentative: "",
    powerOfAttorney: "",
    legalNotes: "",
  },
  documents: [],
}

const documentLabels = ["RG", "CPF", "CNH", "Procuração", "Outros"]

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
    description: "Clientes com conversa ativa, retorno ou negociação em andamento.",
    icon: MessageCircle,
    match: (client) => client.status === "CONTACTED" || client.status === "NEGOTIATING",
  },
  {
    title: "Vendidos",
    description: "Clientes que avançaram para fechamento dentro do funil comercial.",
    icon: Trophy,
    match: (client) => client.status === "WON",
  },
  {
    title: "Arquivados",
    description: "Contatos arquivados ou encerrados fora da operação ativa.",
    icon: Clock3,
    match: (client) => client.status === "ARCHIVED" || client.status === "LOST",
  },
]

const clientFilters: Array<{ id: ClientFilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "new", label: "Novos interessados" },
  { id: "contacted", label: "Em atendimento" },
  { id: "visit", label: "Visita agendada" },
  { id: "negotiating", label: "Negociação" },
  { id: "active", label: "Clientes ativos" },
  { id: "sold", label: "Vendidos" },
  { id: "archived", label: "Arquivados" },
]

const statusLabelOverrides: Record<LeadRecord["status"], string> = {
  NEW: "Novo interessado",
  CONTACTED: "Em atendimento",
  NEGOTIATING: "Negociação",
  WON: "Vendido",
  LOST: "Arquivado",
  ARCHIVED: "Arquivado",
}

export function BrokerClientsPage({ initialClientId }: { initialClientId?: string }) {
  const router = useRouter()
  const { properties } = useBrokerProperties()
  const [clients, setClients] = useState<LeadRecord[]>([])
  const [feedback, setFeedback] = useState("")
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("error")
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<ClientFilterId>("all")
  const [selectedClient, setSelectedClient] = useState<LeadRecord | null>(null)
  const [selectedClientDraft, setSelectedClientDraft] = useState<ClientForm>(emptyClientForm)
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [isSavingClient, setIsSavingClient] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeletingClient, setIsDeletingClient] = useState(false)
  const [isLoadingCep, setIsLoadingCep] = useState(false)
  const [clientDraft, setClientDraft] = useState<ClientForm>(emptyClientForm)

  const openClient = useCallback((client: LeadRecord) => {
    router.push(`/corretor/clientes/${client.id}`)
    setSelectedClient(client)
    setSelectedClientDraft(mapLeadToForm(client))
  }, [router])

  useEffect(() => {
    void loadClients()
    const unsubscribe = subscribeEntitySync((message) => {
      if (message.type === "lead") {
        void loadClients()
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!initialClientId || !clients.length) return
    const client = clients.find((item) => item.id === initialClientId)
    if (client) openClient(client)
  }, [clients, initialClientId, openClient])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredBySearch = useMemo(
    () =>
      clients.filter((client) =>
        normalizedSearch
          ? [
              client.name,
              client.phone,
              client.whatsApp,
              client.propertyTitle,
              client.message,
              client.identification.cpfCnpj,
            ]
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

  async function loadClients() {
    const response = await fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
    const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[]; error?: string } | null
    if (!response.ok) {
      setFeedbackTone("error")
      setFeedback(data?.error || "Não foi possível carregar seus clientes.")
      return
    }
    setClients(data?.leads ?? [])
  }

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
        throw new Error(data?.error || "Não foi possível atualizar o status do cliente.")
      }

      syncClientInState(data.lead)
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status do cliente.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function saveSelectedClient() {
    if (!selectedClient) return
    setIsSavingClient(true)
    setFeedback("")

    try {
      const response = await fetch(`/api/leads/${selectedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(serializeClientForm(selectedClientDraft)),
      })
      const data = (await response.json().catch(() => null)) as { lead?: LeadRecord; error?: string } | null
      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "Não foi possível salvar o cliente.")
      }
      syncClientInState(data.lead)
      setFeedbackTone("success")
      setFeedback("Cliente atualizado com sucesso.")
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o cliente.")
    } finally {
      setIsSavingClient(false)
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
        throw new Error(data?.error || "Não foi possível excluir o cliente.")
      }

      setClients((current) => current.filter((item) => item.id !== client.id))
      setSelectedClient((current) => (current?.id === client.id ? null : current))
      dispatchEntitySync({ type: "lead", entityId: client.id })
      setFeedbackTone("success")
      setFeedback("Cliente removido da carteira.")
      router.push("/corretor/clientes")
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o cliente.")
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
        body: JSON.stringify(serializeClientForm(clientDraft)),
      })
      const data = (await response.json().catch(() => null)) as { lead?: LeadRecord; error?: string } | null

      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "Não foi possível cadastrar o cliente.")
      }

      setClients((current) => [data.lead!, ...current.filter((item) => item.id !== data.lead!.id)])
      dispatchEntitySync({ type: "lead", entityId: data.lead.id })
      setIsCreateClientOpen(false)
      setClientDraft(emptyClientForm)
      setFeedbackTone("success")
      setFeedback("Cliente cadastrado com sucesso.")
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível cadastrar o cliente.")
    } finally {
      setIsCreatingClient(false)
    }
  }

  async function applyCep(target: "create" | "edit") {
    const cep = target === "create" ? clientDraft.address.cep : selectedClientDraft.address.cep
    setIsLoadingCep(true)

    try {
      const result = await lookupCep(cep)
      if (target === "create") {
        setClientDraft((current) => ({
          ...current,
          address: {
            ...current.address,
            cep: result.cep,
            street: result.street,
            complement: current.address.complement || result.complement,
            district: result.district,
            city: result.city,
            state: result.state,
          },
        }))
      } else {
        setSelectedClientDraft((current) => ({
          ...current,
          address: {
            ...current.address,
            cep: result.cep,
            street: result.street,
            complement: current.address.complement || result.complement,
            district: result.district,
            city: result.city,
            state: result.state,
          },
        }))
      }
    } catch (error) {
      setFeedbackTone("error")
      setFeedback(error instanceof Error ? error.message : "Não foi possível localizar o CEP.")
    } finally {
      setIsLoadingCep(false)
    }
  }

  async function appendDocuments(
    target: "create" | "edit",
    label: string,
    files: FileList | null,
  ) {
    if (!files?.length) return
    const uploaded = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: crypto.randomUUID(),
        label,
        name: file.name,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        url: await readFileAsDataUrl(file),
      })),
    )

    if (target === "create") {
      setClientDraft((current) => ({ ...current, documents: [...current.documents, ...uploaded] }))
      return
    }

    setSelectedClientDraft((current) => ({ ...current, documents: [...current.documents, ...uploaded] }))
  }

  async function removeSelectedClientDocument(document: EntityDocumentRecord) {
    if (!selectedClient?.id) return
    if (!window.confirm(`Deseja remover o documento "${document.name}" deste cliente?`)) return

    setFeedback("")

    try {
      const response = await fetch(`/api/leads/${selectedClient.id}/documents/${document.id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { lead?: LeadRecord; error?: string } | null

      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "Não foi possível remover o documento.")
      }

      syncClientInState(data.lead)
      setFeedbackTone("success")
      setFeedback("Documento removido com sucesso.")
    } catch (caughtError) {
      setFeedbackTone("error")
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível remover o documento.")
    }
  }

  function syncClientInState(lead: LeadRecord) {
    setClients((current) => current.map((item) => (item.id === lead.id ? lead : item)))
    setSelectedClient(lead)
    setSelectedClientDraft(mapLeadToForm(lead))
    dispatchEntitySync({ type: "lead", entityId: lead.id })
  }

  const openCreateClientModal = useCallback(() => {
    setClientDraft(emptyClientForm)
    setIsCreateClientOpen(true)
  }, [])

  return (
    <BrokerPageShell title="Clientes" primaryActionLabel="Novo cliente" primaryActionOnClick={openCreateClientModal}>
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[#050505]">Clientes</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Sua carteira de clientes organizada em um único lugar.
              </p>
            </div>
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
                  placeholder="Nome, CPF, telefone ou imóvel"
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
                      <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-2.5 py-1 text-xs text-[#5F6B7A]">
                        Cadastro {client.completion.score}%
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#7B8491]">
                      {client.propertyTitle || "Catálogo"} · {formatLeadSource(client.source)} · {formatDate(client.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5F6B7A]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-[#009b3a]" />
                        {client.whatsApp || client.phone || "Telefone não informado"}
                      </span>
                      <span>{client.identification.cpfCnpj || "CPF pendente"}</span>
                    </div>
                    {client.completion.pending.length ? (
                      <p className="mt-2 text-sm text-[#8B95A1]">Pendências: {client.completion.pending.slice(0, 3).join(", ")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openClient(client)}
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
                    <Button asChild variant="ghost" className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">
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
                {normalizedSearch ? "Ajuste sua busca para localizar o cliente." : "Seus clientes aparecerão aqui conforme o funil começar a receber contatos."}
              </p>
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={!!selectedClient}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClient(null)
            router.push("/corretor/clientes")
          }
        }}
      >
        <DialogContent className="max-h-[94vh] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white/95 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-5xl">
          {selectedClient ? (
            <div className="grid gap-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <DialogTitle className="text-2xl text-[#050505]">{selectedClientDraft.name || "Cliente sem nome"}</DialogTitle>
                  <DialogDescription className="mt-2 text-[#6B7280]">
                    Fonte oficial dos dados jurídicos usados pelos contratos, propostas e futuras automações do COS.
                  </DialogDescription>
                </div>
                <QualityCard score={selectedClient.completion.score} pending={selectedClient.completion.pending} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid gap-5">
                  <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <SectionTitle title="Identificação" subtitle="Dados civis e documentais usados diretamente no contrato." />
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Nome completo"><Input value={selectedClientDraft.name} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-xl" /></Field>
                      <Field label="CPF/CNPJ"><Input value={selectedClientDraft.identification.cpfCnpj} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, cpfCnpj: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="RG"><Input value={selectedClientDraft.identification.rg} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, rg: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Órgão emissor"><Input value={selectedClientDraft.identification.issuingAuthority} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, issuingAuthority: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Data de emissão"><Input value={selectedClientDraft.identification.issueDate} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, issueDate: event.target.value } }))} placeholder="dd/mm/aaaa" className="h-11 rounded-xl" /></Field>
                      <Field label="Nacionalidade"><Input value={selectedClientDraft.identification.nationality} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, nationality: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Naturalidade"><Input value={selectedClientDraft.identification.birthPlace} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, birthPlace: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Estado civil"><Input value={selectedClientDraft.identification.maritalStatus} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, maritalStatus: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Regime de bens"><Input value={selectedClientDraft.identification.propertyRegime} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, propertyRegime: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Profissão"><Input value={selectedClientDraft.identification.profession} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, profession: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <SectionTitle title="Contato" subtitle="WhatsApp, telefone e email para operação e assinatura futura." />
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Telefone"><Input value={selectedClientDraft.phone} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, phone: event.target.value }))} className="h-11 rounded-xl" /></Field>
                      <Field label="WhatsApp"><Input value={selectedClientDraft.whatsApp} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, whatsApp: event.target.value }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Email"><Input value={selectedClientDraft.email} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl" /></Field>
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <SectionTitle title="Endereço" subtitle="Busca automática por CEP para acelerar o preenchimento." />
                    <div className="grid gap-3 md:grid-cols-[180px_auto]">
                      <Field label="CEP">
                        <div className="flex gap-2">
                          <Input value={selectedClientDraft.address.cep} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, cep: formatCep(event.target.value) } }))} className="h-11 rounded-xl" />
                          <Button type="button" variant="ghost" onClick={() => void applyCep("edit")} disabled={isLoadingCep} className="h-11 rounded-xl border border-black/[0.06] bg-white px-4">
                            {isLoadingCep ? "Buscando..." : "Buscar CEP"}
                          </Button>
                        </div>
                      </Field>
                      <Field label="Rua"><Input value={selectedClientDraft.address.street} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, street: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Número"><Input value={selectedClientDraft.address.number} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, number: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Complemento"><Input value={selectedClientDraft.address.complement} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, complement: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Bairro"><Input value={selectedClientDraft.address.district} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, district: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Cidade"><Input value={selectedClientDraft.address.city} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, city: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Estado"><Input value={selectedClientDraft.address.state} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, state: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Imóvel de interesse">
                        <Select value={selectedClientDraft.propertyId} onValueChange={(value) => setSelectedClientDraft((current) => ({ ...current, propertyId: value }))}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Selecionar imóvel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem imóvel vinculado</SelectItem>
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <SectionTitle title="Dados jurídicos" subtitle="Preparado para assinatura, procuração e observações do caso." />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Representante legal"><Input value={selectedClientDraft.legal.legalRepresentative} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, legal: { ...current.legal, legalRepresentative: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Procuração"><Input value={selectedClientDraft.legal.powerOfAttorney} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, legal: { ...current.legal, powerOfAttorney: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                    </div>
                    <Field label="Observações jurídicas">
                      <Textarea value={selectedClientDraft.legal.legalNotes} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, legal: { ...current.legal, legalNotes: event.target.value } }))} className="min-h-24 rounded-[1rem]" />
                    </Field>
                  </section>

                  <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <SectionTitle title="Documentos" subtitle="Arquivos ficam vinculados ao cliente e servem de base para qualquer documento futuro." />
                    <div className="flex flex-wrap gap-2">
                      {documentLabels.map((label) => (
                        <label key={label} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-[#4B5563]">
                          <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => void appendDocuments("edit", label, event.target.files)} />
                          <Upload className="size-4" />
                          {label}
                        </label>
                      ))}
                    </div>
                    <DocumentList
                      leadId={selectedClientDraft.id}
                      documents={selectedClientDraft.documents}
                      onDelete={(document) => void removeSelectedClientDocument(document)}
                    />
                  </section>
                </div>

                <aside className="grid content-start gap-4">
                  <div className="rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#050505]">
                      <ShieldCheck className="size-4 text-[#009b3a]" />
                      Pendências do cadastro
                    </div>
                    <div className="mt-4 grid gap-2">
                      {selectedClient.completion.pending.length ? (
                        selectedClient.completion.pending.map((item) => (
                          <div key={item} className="rounded-xl border border-[#f0dcb1] bg-[#fffaf0] px-3 py-2 text-sm text-[#7a5a12]">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-[#009b3a]/20 bg-[#eef9f1] px-3 py-2 text-sm text-[#0b7a33]">Cadastro completo.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                    <div className="text-sm font-semibold text-[#050505]">Ações</div>
                    <div className="mt-4 grid gap-2">
                      <Button asChild className="h-10 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
                        <Link href="/corretor/documentos/contratos">Abrir contratos</Link>
                      </Button>
                      <Button asChild variant="ghost" className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#4B5563]">
                        <Link href="/corretor/imoveis">Ver imóveis</Link>
                      </Button>
                      <Button type="button" variant="ghost" disabled={isDeletingClient} onClick={() => void deleteClient(selectedClient)} className="h-10 rounded-xl border border-red-200 bg-white text-red-600">
                        Excluir cliente
                      </Button>
                    </div>
                  </div>
                </aside>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setSelectedClient(null)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563]">
                  Fechar
                </Button>
                <Button type="button" disabled={isSavingClient} onClick={() => void saveSelectedClient()} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white">
                  {isSavingClient ? "Salvando..." : "Salvar cliente"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
        <DialogContent className="max-h-[94vh] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white/95 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-5xl">
          <div className="grid gap-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <DialogTitle className="text-2xl text-[#050505]">Novo cliente premium</DialogTitle>
                <DialogDescription className="mt-2 text-[#6B7280]">
                  Cadastre o cliente como entidade jurídica completa para que contratos e automações consumam uma única fonte de verdade.
                </DialogDescription>
              </div>
              <QualityCard score={previewCompletion(clientDraft).score} pending={previewCompletion(clientDraft).pending} />
            </div>

            <div className="grid gap-5">
              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                <SectionTitle title="Identificação" subtitle="Base civil do cadastro." />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Nome completo"><Input value={clientDraft.name} onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-xl" /></Field>
                  <Field label="CPF/CNPJ"><Input value={clientDraft.identification.cpfCnpj} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, cpfCnpj: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="RG"><Input value={clientDraft.identification.rg} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, rg: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Órgão emissor"><Input value={clientDraft.identification.issuingAuthority} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, issuingAuthority: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Data de emissão"><Input value={clientDraft.identification.issueDate} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, issueDate: event.target.value } }))} className="h-11 rounded-xl" placeholder="dd/mm/aaaa" /></Field>
                  <Field label="Nacionalidade"><Input value={clientDraft.identification.nationality} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, nationality: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Naturalidade"><Input value={clientDraft.identification.birthPlace} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, birthPlace: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Estado civil"><Input value={clientDraft.identification.maritalStatus} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, maritalStatus: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Regime de bens"><Input value={clientDraft.identification.propertyRegime} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, propertyRegime: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Profissão"><Input value={clientDraft.identification.profession} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, profession: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                </div>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                <SectionTitle title="Contato e endereço" subtitle="CEP com preenchimento automático." />
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Telefone"><Input value={clientDraft.phone} onChange={(event) => setClientDraft((current) => ({ ...current, phone: event.target.value }))} className="h-11 rounded-xl" /></Field>
                  <Field label="WhatsApp"><Input value={clientDraft.whatsApp} onChange={(event) => setClientDraft((current) => ({ ...current, whatsApp: event.target.value }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Email"><Input value={clientDraft.email} onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl" /></Field>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_auto]">
                  <Field label="CEP">
                    <div className="flex gap-2">
                      <Input value={clientDraft.address.cep} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, cep: formatCep(event.target.value) } }))} className="h-11 rounded-xl" />
                      <Button type="button" variant="ghost" onClick={() => void applyCep("create")} disabled={isLoadingCep} className="h-11 rounded-xl border border-black/[0.06] bg-white px-4">
                        {isLoadingCep ? "Buscando..." : "Buscar CEP"}
                      </Button>
                    </div>
                  </Field>
                  <Field label="Rua"><Input value={clientDraft.address.street} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, street: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Número"><Input value={clientDraft.address.number} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, number: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Complemento"><Input value={clientDraft.address.complement} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, complement: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Bairro"><Input value={clientDraft.address.district} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, district: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Cidade"><Input value={clientDraft.address.city} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, city: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Estado"><Input value={clientDraft.address.state} onChange={(event) => setClientDraft((current) => ({ ...current, address: { ...current.address, state: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Imóvel de interesse">
                    <Select value={clientDraft.propertyId} onValueChange={(value) => setClientDraft((current) => ({ ...current, propertyId: value }))}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Selecionar imóvel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem imóvel vinculado</SelectItem>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                <SectionTitle title="Dados jurídicos e documentos" subtitle="Preparado para assinatura futura." />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Representante legal"><Input value={clientDraft.legal.legalRepresentative} onChange={(event) => setClientDraft((current) => ({ ...current, legal: { ...current.legal, legalRepresentative: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Procuração"><Input value={clientDraft.legal.powerOfAttorney} onChange={(event) => setClientDraft((current) => ({ ...current, legal: { ...current.legal, powerOfAttorney: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                </div>
                <Field label="Observações jurídicas">
                  <Textarea value={clientDraft.legal.legalNotes} onChange={(event) => setClientDraft((current) => ({ ...current, legal: { ...current.legal, legalNotes: event.target.value } }))} className="min-h-24 rounded-[1rem]" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  {documentLabels.map((label) => (
                    <label key={label} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-[#4B5563]">
                      <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => void appendDocuments("create", label, event.target.files)} />
                      <Upload className="size-4" />
                      {label}
                    </label>
                  ))}
                </div>
                <DocumentList leadId={clientDraft.id} documents={clientDraft.documents} />
              </section>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateClientOpen(false)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563]">
                Cancelar
              </Button>
              <Button type="button" disabled={isCreatingClient} onClick={() => void createClient()} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white">
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

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#050505]">{title}</p>
      <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
    </div>
  )
}

function QualityCard({ score, pending }: { score: number; pending: string[] }) {
  return (
    <div className="rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#8B95A1]">Cadastro</p>
      <p className="mt-2 text-3xl font-semibold text-[#050505]">{score}%</p>
      <p className="mt-2 text-sm text-[#6B7280]">
        {pending.length ? `Pendências: ${pending.slice(0, 3).join(", ")}` : "Pronto para alimentar contratos."}
      </p>
    </div>
  )
}

function DocumentList({
  documents,
  leadId,
  onDelete,
}: {
  documents: EntityDocumentRecord[]
  leadId?: string
  onDelete?: (document: EntityDocumentRecord) => void
}) {
  if (!documents.length) {
    return <p className="text-sm text-[#8B95A1]">Nenhum documento anexado ainda.</p>
  }

  return (
    <div className="grid gap-2">
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-[#4B5563]"
        >
          <button
            type="button"
            onClick={() => void openClientDocumentPreview(document, leadId)}
            className="min-w-0 flex-1 truncate text-left"
          >
            {document.label}: {document.name}
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(document)}
              className="shrink-0 rounded-full p-1 text-[#8B95A1] transition-colors hover:bg-[#f5f5f1] hover:text-[#b42318]"
              aria-label={`Remover documento ${document.name}`}
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function mapLeadToForm(lead: LeadRecord): ClientForm {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    whatsApp: lead.whatsApp,
    propertyId: lead.propertyId ?? "none",
    searchTerm: lead.searchTerm,
    intent: lead.intent,
    message: lead.message,
    identification: lead.identification,
    address: lead.address,
    legal: lead.legal,
    documents: lead.documents,
  }
}

function serializeClientForm(form: ClientForm) {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    whatsApp: form.whatsApp,
    propertyId: form.propertyId === "none" ? "" : form.propertyId,
    searchTerm: form.searchTerm,
    intent: form.intent,
    message: form.message,
    identification: form.identification,
    address: form.address,
    legal: form.legal,
    documents: form.documents,
  }
}

function previewCompletion(form: ClientForm) {
  const pending = [
    !form.identification.rg && "RG",
    !form.identification.maritalStatus && "Estado civil",
    !form.identification.propertyRegime && "Regime de bens",
    !form.identification.nationality && "Nacionalidade",
    !form.address.cep && "CEP",
  ].filter(Boolean) as string[]

  return {
    score: Math.max(0, 100 - pending.length * 8),
    pending,
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Data não disponível"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatLeadSource(source: string) {
  const normalized = source.toLowerCase()
  if (normalized.includes("catalog")) return "Catálogo"
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."))
    reader.readAsDataURL(file)
  })
}
