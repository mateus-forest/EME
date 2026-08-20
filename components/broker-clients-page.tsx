"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Clock3,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UsersRound,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerEmptyState, BrokerStatItem, BrokerStatStrip } from "@/components/broker-portal-ui"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { formatCep, lookupCep } from "@/lib/cep"
import {
  formatCpfCnpj,
  formatDateBR,
  formatPhone,
  formatRg,
  normalizeCep,
  normalizeCpfCnpj,
  normalizePhone,
  parseBrazilianDateToIso,
} from "@/lib/structured-fields"
import { openClientDocumentPreview } from "@/lib/client-document-preview"
import { dispatchEntitySync, subscribeEntitySync } from "@/lib/entity-sync"
import type { EntityDocumentRecord } from "@/lib/legal-entities"
import { leadStatusLabels, leadStatusOptions, type LeadRecord } from "@/lib/lead-contract"

type ClientFilterId =
  | "all"
  | "new"
  | "contacted"
  | "negotiating"
  | "sold"
  | "lost"
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
  status: LeadRecord["status"]
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

type FeedbackTone = "success" | "error" | "warning"

type FloatingToast = {
  message: string
  tone: FeedbackTone
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
  status: "NEW",
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
    title: leadStatusLabels.NEW,
    description: "Contatos que chegaram e ainda precisam do primeiro atendimento.",
    icon: UsersRound,
    match: (client) => client.status === "NEW",
  },
  {
    title: leadStatusLabels.CONTACTED,
    description: "Clientes com conversa ativa ou aguardando retorno.",
    icon: MessageCircle,
    match: (client) => client.status === "CONTACTED",
  },
  {
    title: leadStatusLabels.NEGOTIATING,
    description: "Clientes com negociação comercial em andamento.",
    icon: MessageCircle,
    match: (client) => client.status === "NEGOTIATING",
  },
  {
    title: leadStatusLabels.WON,
    description: "Clientes que avançaram para fechamento dentro do funil comercial.",
    icon: Trophy,
    match: (client) => client.status === "WON",
  },
  {
    title: leadStatusLabels.LOST,
    description: "Oportunidades encerradas sem venda.",
    icon: Clock3,
    match: (client) => client.status === "LOST",
  },
  {
    title: leadStatusLabels.ARCHIVED,
    description: "Contatos retirados da operação ativa.",
    icon: Clock3,
    match: (client) => client.status === "ARCHIVED",
  },
]

const clientFilters: Array<{ id: ClientFilterId; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "new", label: leadStatusLabels.NEW },
  { id: "contacted", label: leadStatusLabels.CONTACTED },
  { id: "negotiating", label: leadStatusLabels.NEGOTIATING },
  { id: "sold", label: leadStatusLabels.WON },
  { id: "lost", label: leadStatusLabels.LOST },
  { id: "archived", label: leadStatusLabels.ARCHIVED },
]

export function BrokerClientsPage() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const routeClientId = typeof params?.id === "string" ? params.id : undefined
  const { properties } = useBrokerProperties()
  const [clients, setClients] = useState<LeadRecord[]>([])
  const [hasLoadedClients, setHasLoadedClients] = useState(false)
  const [toast, setToast] = useState<FloatingToast | null>(null)
  const [isToastVisible, setIsToastVisible] = useState(false)
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<ClientFilterId>("all")
  const [selectedClient, setSelectedClient] = useState<LeadRecord | null>(null)
  const [selectedClientDraft, setSelectedClientDraft] = useState<ClientForm>(emptyClientForm)
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [isSavingClient, setIsSavingClient] = useState(false)
  const [isDeletingClient, setIsDeletingClient] = useState(false)
  const [isLoadingCep, setIsLoadingCep] = useState(false)
  const [clientDraft, setClientDraft] = useState<ClientForm>(emptyClientForm)
  const clientsRequestIdRef = useRef(0)
  const leadSyncSourceIdRef = useRef("")
  const dismissedRouteClientIdRef = useRef<string | null>(null)
  const pendingRouteClientIdRef = useRef<string | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openClient = useCallback((client: LeadRecord) => {
    dismissedRouteClientIdRef.current = null
    setSelectedClient(client)
    setSelectedClientDraft(mapLeadToForm(client))
    if (routeClientId !== client.id) {
      pendingRouteClientIdRef.current = client.id
      router.push(`/corretor/clientes/${client.id}`, { scroll: false })
    } else {
      pendingRouteClientIdRef.current = null
    }
  }, [routeClientId, router])

  const closeClient = useCallback(() => {
    dismissedRouteClientIdRef.current = selectedClient?.id ?? routeClientId ?? null
    pendingRouteClientIdRef.current = null
    setSelectedClient(null)
    setSelectedClientDraft(emptyClientForm)
    if (routeClientId || selectedClient) {
      router.replace("/corretor/clientes", { scroll: false })
    }
  }, [routeClientId, router, selectedClient])

  const getLeadSyncSourceId = useCallback(() => {
    if (!leadSyncSourceIdRef.current) {
      leadSyncSourceIdRef.current = `broker-clients:${crypto.randomUUID()}`
    }
    return leadSyncSourceIdRef.current
  }, [])

  const broadcastLeadSync = useCallback((entityId: string) => {
    dispatchEntitySync({ type: "lead", entityId, sourceId: getLeadSyncSourceId() })
  }, [getLeadSyncSourceId])

  const showToast = useCallback((message: string, tone: FeedbackTone) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    if (toastDismissTimeoutRef.current) clearTimeout(toastDismissTimeoutRef.current)

    setToast({ message, tone })
    setIsToastVisible(true)

    toastTimeoutRef.current = setTimeout(() => {
      setIsToastVisible(false)
      toastDismissTimeoutRef.current = setTimeout(() => {
        setToast(null)
      }, 220)
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (toastDismissTimeoutRef.current) clearTimeout(toastDismissTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!routeClientId) {
      if (pendingRouteClientIdRef.current && pendingRouteClientIdRef.current === selectedClient?.id) return
      dismissedRouteClientIdRef.current = null
      if (selectedClient) {
        setSelectedClient(null)
        setSelectedClientDraft(emptyClientForm)
      }
      return
    }

    if (pendingRouteClientIdRef.current === routeClientId) pendingRouteClientIdRef.current = null
    if (dismissedRouteClientIdRef.current === routeClientId) return
    if (!clients.length) {
      if (hasLoadedClients) router.replace("/corretor/clientes", { scroll: false })
      return
    }

    const routeClient = clients.find((item) => item.id === routeClientId) ?? null
    if (!routeClient) {
      if (hasLoadedClients) router.replace("/corretor/clientes", { scroll: false })
      return
    }

    if (selectedClient?.id !== routeClientId) {
      setSelectedClient(routeClient)
      setSelectedClientDraft(mapLeadToForm(routeClient))
      return
    }

    if (selectedClient !== routeClient) {
      setSelectedClient(routeClient)
    }
  }, [clients, hasLoadedClients, routeClientId, router, selectedClient])

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

  const loadClients = useCallback(async (options?: { suppressErrorFeedback?: boolean }) => {
    const requestId = ++clientsRequestIdRef.current
    const response = await fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
    const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[]; error?: string } | null
    if (requestId !== clientsRequestIdRef.current) {
      return null
    }
    if (!response.ok) {
      if (!options?.suppressErrorFeedback) {
        showToast(data?.error || "Não foi possível carregar seus clientes.", "error")
      }
      setHasLoadedClients(true)
      return null
    }
    const nextClients = data?.leads ?? []
    setClients(nextClients)
    setHasLoadedClients(true)
    return nextClients
  }, [showToast])

  useEffect(() => {
    void loadClients()
    const syncSourceId = getLeadSyncSourceId()
    const unsubscribe = subscribeEntitySync((message) => {
      if (message.type === "lead") {
        if (message.sourceId === syncSourceId) return
        void loadClients()
      }
    })

    return unsubscribe
  }, [getLeadSyncSourceId, loadClients])

  async function saveSelectedClient() {
    if (!selectedClient) return
    setIsSavingClient(true)

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
      showToast("Cliente atualizado com sucesso.", "success")
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o cliente.", "error")
    } finally {
      setIsSavingClient(false)
    }
  }

  async function deleteClient(client: LeadRecord) {
    if (!window.confirm(`Deseja excluir ${client.name || "este cliente"} da sua carteira?`)) return

    setIsDeletingClient(true)

    try {
      const response = await fetch(`/api/leads/${client.id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { deleted?: boolean; id?: string; error?: string } | null

      if (!response.ok || !data?.deleted) {
        throw new Error(data?.error || "Não foi possível excluir o cliente.")
      }

      const deletedClientId = data.id || client.id
      const deletedOpenClient = selectedClient?.id === deletedClientId || routeClientId === deletedClientId
      if (deletedOpenClient) dismissedRouteClientIdRef.current = deletedClientId

      const nextClients = await loadClients({ suppressErrorFeedback: true })
      if (!nextClients || nextClients.some((item) => item.id === deletedClientId)) {
        throw new Error("Não foi possível excluir o cliente.")
      }

      if (deletedOpenClient) {
        setSelectedClient(null)
        setSelectedClientDraft(emptyClientForm)
        router.replace("/corretor/clientes", { scroll: false })
      }
      broadcastLeadSync(deletedClientId)
      showToast("Cliente removido da carteira.", "success")
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o cliente.", "error")
    } finally {
      setIsDeletingClient(false)
    }
  }

  async function createClient() {
    setIsCreatingClient(true)

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

      const nextClients = await loadClients({ suppressErrorFeedback: true })
      if (!nextClients || !nextClients.some((item) => item.id === data.lead!.id)) {
        throw new Error("Não foi possível cadastrar o cliente.")
      }

      broadcastLeadSync(data.lead.id)
      setIsCreateClientOpen(false)
      setClientDraft(emptyClientForm)
      showToast("Cliente cadastrado com sucesso.", "success")
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : "Não foi possível cadastrar o cliente.", "error")
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
      showToast(error instanceof Error ? error.message : "Não foi possível localizar o CEP.", "error")
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
      showToast("Documento removido com sucesso.", "success")
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : "Não foi possível remover o documento.", "error")
    }
  }

  function syncClientInState(lead: LeadRecord) {
    setClients((current) => current.map((item) => (item.id === lead.id ? lead : item)))
    setSelectedClient(lead)
    setSelectedClientDraft(mapLeadToForm(lead))
    broadcastLeadSync(lead.id)
  }

  const openCreateClientModal = useCallback(() => {
    setClientDraft(emptyClientForm)
    setIsCreateClientOpen(true)
  }, [])

  return (
    <BrokerPageShell title="Clientes" primaryActionLabel="Novo cliente" primaryActionOnClick={openCreateClientModal}>
      <div className="grid gap-4">
        {toast ? (
          <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4">
            <div
              className={`w-fit max-w-[calc(100vw-2rem)] rounded-full border px-4 py-2.5 text-sm shadow-[0_20px_40px_rgba(15,23,42,0.10)] backdrop-blur-md transition-all duration-200 ${
                isToastVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
              } ${
                toast.tone === "success"
                  ? "border-[#009b3a]/15 bg-[#eef9f1]/95 text-[#0b7a33]"
                  : toast.tone === "warning"
                    ? "border-[#f2c94c]/30 bg-[#fff9e7]/95 text-[#946200]"
                    : "border-red-500/15 bg-[#fff1f1]/95 text-red-700"
              }`}
            >
              {toast.message}
            </div>
          </div>
        ) : null}
        <BrokerStatStrip className="w-full md:grid-cols-3">
            {clientStages.map((stage, index) => (
              <BrokerStatItem
                key={stage.title}
                title={stage.description}
                icon={<stage.icon className="size-4.5" />}
                label={stage.title}
                value={hasLoadedClients ? values[index] : <span className="block h-5 w-8 animate-pulse rounded-full bg-[#eef1ec]" />}
              />
            ))}
        </BrokerStatStrip>

        <section className="rounded-[1.35rem] border border-black/[0.06] bg-white/92 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.035)]">
          <div className="grid min-w-0 gap-3 lg:flex lg:items-center lg:justify-between lg:gap-2 xl:flex-row xl:items-center">
            <label className="relative block min-w-0 w-full lg:max-w-[21rem]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98A2B3]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, CPF, telefone ou imóvel"
                  aria-label="Buscar cliente"
                  className="h-10 w-full rounded-xl border-black/[0.07] bg-[#fcfcfb] pl-10"
                />
            </label>

            <div className="min-w-0 w-full overflow-x-auto overflow-y-hidden pb-1.5 lg:w-auto lg:flex-1 lg:overflow-visible lg:pb-0 eme-hidden-scrollbar">
              {clientFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  aria-pressed={activeFilter === filter.id}
                  className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${activeFilter === filter.id ? "border-[#009b3a]/20 bg-[#eef9f1] text-[#008633]" : "border-transparent bg-transparent text-[#667085] hover:border-black/[0.06] hover:bg-[#f7f8f5] hover:text-[#050505]"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white/92 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          {!hasLoadedClients ? (
            <div className="grid divide-y divide-black/[0.05]">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[5.25rem] animate-pulse bg-[#fbfbf8]"
                />
              ))}
            </div>
          ) : filteredClients.length > 0 ? (
            <div className="grid divide-y divide-black/[0.055]">
              {filteredClients.map((client) => (
                <div key={client.id} className="grid gap-2">
                  <article className="grid min-w-0 gap-3 rounded-[1.15rem] border border-black/[0.06] bg-white px-3 py-3 transition-colors hover:bg-[#fbfcfa] sm:px-4 lg:hidden">
                    <div className="grid min-w-0 gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eaf7ee] text-sm font-semibold text-[#008633]">
                          {(client.name || "C").trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#111827]">{client.name || "Cliente sem nome"}</p>
                          <p className="mt-1 truncate text-[11px] text-[#7B8491]">
                            Origem {formatLeadSource(client.source)} · {formatDateBR(client.createdAt, "—")}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#009b3a]/14 bg-[#eef9f1] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#008633]">
                          {leadStatusLabels[client.status]}
                        </span>
                      </div>

                      <div className="grid gap-1 text-xs text-[#667085]">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <Phone className="size-3.5 shrink-0 text-[#009b3a]" />
                          <span className="truncate">{formatPhone(client.whatsApp || client.phone) || "Não informado"}</span>
                        </p>
                        <p className="truncate">
                          <span className="font-medium text-[#344054]">CPF:</span> {formatCpfCnpj(client.identification.cpfCnpj) || "CPF pendente"}
                        </p>
                        <p className="truncate">
                          <span className="font-medium text-[#344054]">Imóvel:</span> {client.propertyTitle || "Sem imóvel vinculado"}
                        </p>
                        <p className="truncate text-[#008633]">
                          <span className="font-medium text-[#344054]">Observação:</span>{" "}
                          {client.searchTerm || client.message || "Interesse em qualificação"}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#667085]">
                          <span>Perfil</span>
                          <span>{client.completion.score}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e8ece8]">
                          <div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${client.completion.score}%` }} />
                        </div>
                        {client.completion.pending.length ? (
                          <p className="mt-1 truncate text-[10px] text-[#b26a00]">
                            {client.completion.pending.length} pendência{client.completion.pending.length === 1 ? "" : "s"}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => openClient(client)}
                          className="h-8.5 rounded-lg border border-black/[0.07] bg-white px-3 text-xs font-semibold text-[#008633] hover:bg-[#f7fbf8] hover:text-[#006b2b]"
                        >
                          Ver cliente
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8.5 rounded-lg border border-black/[0.07] bg-white text-[#667085] hover:bg-[#f7f8f5] hover:text-[#050505]"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Mais ações para {client.name || "cliente"}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl border-black/[0.07] bg-white p-1.5 text-[#344054]">
                            <DropdownMenuItem asChild className="rounded-lg">
                              <Link href="/corretor/documentos"><FileText className="size-4" />Propostas</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isDeletingClient}
                              onSelect={() => void deleteClient(client)}
                              className="rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700"
                            >
                              <Trash2 className="size-4" />Excluir cliente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </article>

                  <div
                    className="hidden lg:grid min-w-0 gap-3 px-3 py-3 transition-colors hover:bg-[#fbfcfa] sm:px-4 md:grid-cols-[minmax(13rem,1.35fr)_10rem_minmax(10rem,1fr)_auto] md:items-center md:gap-3 xl:grid-cols-[minmax(12rem,1.35fr)_7.5rem_10.5rem_minmax(10rem,1fr)_8rem_auto] xl:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eaf7ee] text-sm font-semibold text-[#008633]">
                        {(client.name || "C").trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate font-semibold text-[#111827]">{client.name || "Cliente sem nome"}</p>
                          <span className="rounded-full border border-[#009b3a]/14 bg-[#eef9f1] px-2 py-0.5 text-[11px] font-medium text-[#008633]">
                            {leadStatusLabels[client.status]}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#7B8491]">
                          {client.propertyTitle || "Catálogo"} · {formatLeadSource(client.source)} · {formatDateBR(client.createdAt, "—")}
                        </p>
                      </div>
                    </div>

                    <div className="hidden min-w-0 text-xs text-[#667085] xl:block">
                      <p className="font-medium text-[#344054]">{formatDateBR(client.createdAt, "—")}</p>
                      <p className="mt-1">Cadastro</p>
                    </div>

                    <div className="min-w-0 text-xs text-[#667085]">
                      <p className="flex items-center gap-1.5 truncate font-medium text-[#344054]">
                        <Phone className="size-3.5 shrink-0 text-[#009b3a]" />
                        {formatPhone(client.whatsApp || client.phone) || "Não informado"}
                      </p>
                      <p className="mt-1 truncate">{formatCpfCnpj(client.identification.cpfCnpj) || "CPF pendente"}</p>
                    </div>

                    <div className="min-w-0 text-xs text-[#667085]">
                      <p className="truncate font-medium text-[#344054]">{client.propertyTitle || "Sem imóvel vinculado"}</p>
                      <p className="mt-1 truncate text-[#008633]">{client.searchTerm || client.message || "Interesse em qualificação"}</p>
                    </div>

                    <div className="hidden min-w-0 xl:block">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#667085]">
                        <span>Perfil</span>
                        <span>{client.completion.score}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e8ece8]">
                        <div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${client.completion.score}%` }} />
                      </div>
                      {client.completion.pending.length ? (
                        <p className="mt-1 truncate text-[10px] text-[#b26a00]">
                          {client.completion.pending.length} pendência{client.completion.pending.length === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openClient(client)}
                        className="h-8.5 rounded-lg border border-black/[0.07] bg-white px-3 text-xs font-semibold text-[#008633] hover:bg-[#f7fbf8] hover:text-[#006b2b]"
                      >
                        Ver cliente
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8.5 rounded-lg border border-black/[0.07] bg-white text-[#667085] hover:bg-[#f7f8f5] hover:text-[#050505]"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Mais ações para {client.name || "cliente"}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-black/[0.07] bg-white p-1.5 text-[#344054]">
                          <DropdownMenuItem asChild className="rounded-lg">
                            <Link href="/corretor/documentos"><FileText className="size-4" />Propostas</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isDeletingClient}
                            onSelect={() => void deleteClient(client)}
                            className="rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="size-4" />Excluir cliente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BrokerEmptyState
              className="rounded-none border-0 bg-transparent py-12"
              icon={<UsersRound className="size-5" />}
              title="Nenhum cliente encontrado."
              description={normalizedSearch ? "Ajuste sua busca para localizar o cliente." : "Seus clientes aparecerão aqui conforme o funil começar a receber contatos."}
            />
          )}
        </section>
      </div>

      <Dialog
        open={!!selectedClient}
        onOpenChange={(open) => {
          if (!open) closeClient()
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
                      <Field label="Status comercial">
                        <LeadStatusSelect
                          value={selectedClientDraft.status}
                          onValueChange={(status) => setSelectedClientDraft((current) => ({ ...current, status }))}
                        />
                      </Field>
                      <Field label="Nome completo"><Input value={selectedClientDraft.name} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-xl" /></Field>
                      <Field label="CPF/CNPJ"><StructuredInput kind="cpf-cnpj" value={selectedClientDraft.identification.cpfCnpj} onValueChange={(value) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, cpfCnpj: value } }))} className="h-11 rounded-xl" aria-label="CPF ou CNPJ" /></Field>
                      <Field label="RG"><Input value={selectedClientDraft.identification.rg} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, rg: formatRg(event.target.value) } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Órgão emissor"><Input value={selectedClientDraft.identification.issuingAuthority} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, issuingAuthority: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                      <Field label="Data de emissão"><StructuredInput kind="date" value={selectedClientDraft.identification.issueDate} onValueChange={(value) => setSelectedClientDraft((current) => ({ ...current, identification: { ...current.identification, issueDate: value } }))} placeholder="DD/MM/AAAA" className="h-11 rounded-xl" aria-label="Data de emissão" /></Field>
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
                      <Field label="Telefone"><StructuredInput kind="phone" value={selectedClientDraft.phone} onValueChange={(value) => setSelectedClientDraft((current) => ({ ...current, phone: value }))} className="h-11 rounded-xl" aria-label="Telefone" /></Field>
                      <Field label="WhatsApp"><StructuredInput kind="phone" value={selectedClientDraft.whatsApp} onValueChange={(value) => setSelectedClientDraft((current) => ({ ...current, whatsApp: value }))} className="h-11 rounded-xl" aria-label="WhatsApp" /></Field>
                      <Field label="Email"><Input value={selectedClientDraft.email} onChange={(event) => setSelectedClientDraft((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl" /></Field>
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <SectionTitle title="Endereço" subtitle="Busca automática por CEP para acelerar o preenchimento." />
                    <div className="grid gap-3 md:grid-cols-[180px_auto]">
                      <Field label="CEP">
                        <div className="flex gap-2">
                          <StructuredInput kind="cep" value={selectedClientDraft.address.cep} onValueChange={(value) => setSelectedClientDraft((current) => ({ ...current, address: { ...current.address, cep: value } }))} className="h-11 rounded-xl" aria-label="CEP" />
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedClient(null)
                    router.push("/corretor/clientes")
                  }}
                  className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563]"
                >
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
                  <Field label="Status comercial">
                    <LeadStatusSelect
                      value={clientDraft.status}
                      onValueChange={(status) => setClientDraft((current) => ({ ...current, status }))}
                    />
                  </Field>
                  <Field label="Nome completo"><Input value={clientDraft.name} onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-xl" /></Field>
                  <Field label="CPF/CNPJ"><StructuredInput kind="cpf-cnpj" value={clientDraft.identification.cpfCnpj} onValueChange={(value) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, cpfCnpj: value } }))} className="h-11 rounded-xl" aria-label="CPF ou CNPJ" /></Field>
                  <Field label="RG"><Input value={clientDraft.identification.rg} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, rg: formatRg(event.target.value) } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Órgão emissor"><Input value={clientDraft.identification.issuingAuthority} onChange={(event) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, issuingAuthority: event.target.value } }))} className="h-11 rounded-xl" /></Field>
                  <Field label="Data de emissão"><StructuredInput kind="date" value={clientDraft.identification.issueDate} onValueChange={(value) => setClientDraft((current) => ({ ...current, identification: { ...current.identification, issueDate: value } }))} className="h-11 rounded-xl" placeholder="DD/MM/AAAA" aria-label="Data de emissão" /></Field>
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
                  <Field label="Telefone"><StructuredInput kind="phone" value={clientDraft.phone} onValueChange={(value) => setClientDraft((current) => ({ ...current, phone: value }))} className="h-11 rounded-xl" aria-label="Telefone" /></Field>
                  <Field label="WhatsApp"><StructuredInput kind="phone" value={clientDraft.whatsApp} onValueChange={(value) => setClientDraft((current) => ({ ...current, whatsApp: value }))} className="h-11 rounded-xl" aria-label="WhatsApp" /></Field>
                  <Field label="Email"><Input value={clientDraft.email} onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl" /></Field>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_auto]">
                  <Field label="CEP">
                    <div className="flex gap-2">
                      <StructuredInput kind="cep" value={clientDraft.address.cep} onValueChange={(value) => setClientDraft((current) => ({ ...current, address: { ...current.address, cep: value } }))} className="h-11 rounded-xl" aria-label="CEP" />
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

function LeadStatusSelect({
  value,
  onValueChange,
}: {
  value: LeadRecord["status"]
  onValueChange: (status: LeadRecord["status"]) => void
}) {
  return (
    <Select value={value} onValueChange={(status) => onValueChange(status as LeadRecord["status"])}>
      <SelectTrigger aria-label="Status comercial" className="h-11 rounded-xl bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {leadStatusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    phone: formatPhone(lead.phone),
    whatsApp: formatPhone(lead.whatsApp),
    propertyId: lead.propertyId ?? "none",
    searchTerm: lead.searchTerm,
    intent: lead.intent,
    message: lead.message,
    status: lead.status,
    identification: {
      ...lead.identification,
      cpfCnpj: formatCpfCnpj(lead.identification.cpfCnpj),
      issueDate: formatDateBR(lead.identification.issueDate, lead.identification.issueDate),
    },
    address: { ...lead.address, cep: formatCep(lead.address.cep) },
    legal: lead.legal,
    documents: lead.documents,
  }
}

function serializeClientForm(form: ClientForm) {
  return {
    name: form.name,
    email: form.email,
    phone: normalizePhone(form.phone),
    whatsApp: normalizePhone(form.whatsApp),
    propertyId: form.propertyId === "none" ? "" : form.propertyId,
    searchTerm: form.searchTerm,
    intent: form.intent,
    message: form.message,
    status: form.status,
    identification: {
      ...form.identification,
      cpfCnpj: normalizeCpfCnpj(form.identification.cpfCnpj),
      issueDate: parseBrazilianDateToIso(form.identification.issueDate) ?? form.identification.issueDate,
    },
    address: { ...form.address, cep: normalizeCep(form.address.cep) },
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

function formatLeadSource(source: string) {
  const normalized = source.toLowerCase()
  if (normalized.includes("catalog")) return "Catálogo"
  if (normalized.includes("assessor") || normalized === "cos") return "COS"
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
  if (filter === "negotiating") return client.status === "NEGOTIATING"
  if (filter === "sold") return client.status === "WON"
  if (filter === "lost") return client.status === "LOST"
  return client.status === "ARCHIVED"
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."))
    reader.readAsDataURL(file)
  })
}
