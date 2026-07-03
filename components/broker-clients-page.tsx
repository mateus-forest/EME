"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clock3, MessageCircle, Phone, Search, Sparkles, Trophy, UsersRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import type { LeadRecord } from "@/lib/lead-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const clientStages: Array<{
  title: string
  description: string
  icon: typeof UsersRound
  statuses: LeadRecord["status"][]
}> = [
  {
    title: "Novos clientes",
    description: "Contatos que chegaram e ainda precisam do primeiro atendimento.",
    icon: UsersRound,
    statuses: ["NEW"],
  },
  {
    title: "Em contato",
    description: "Clientes com conversa ativa, retorno ou negociação em andamento.",
    icon: MessageCircle,
    statuses: ["CONTACTED", "NEGOTIATING"],
  },
  {
    title: "Convertidos",
    description: "Clientes que avançaram para visita, proposta ou fechamento.",
    icon: Trophy,
    statuses: ["WON"],
  },
  {
    title: "Inativos",
    description: "Contatos perdidos, sem aderência ou sem resposta recente.",
    icon: Clock3,
    statuses: ["LOST"],
  },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Data não disponível"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function BrokerClientsPage() {
  const [clients, setClients] = useState<LeadRecord[]>([])
  const [feedback, setFeedback] = useState("")
  const [search, setSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<LeadRecord | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[]; error?: string } | null
        if (!response.ok) throw new Error(data?.error || "Não foi possível carregar seus clientes.")
        if (!ignore) setClients(data?.leads ?? [])
      })
      .catch((error) => {
        if (!ignore) setFeedback(error instanceof Error ? error.message : "Não foi possível carregar seus clientes.")
      })

    return () => {
      ignore = true
    }
  }, [])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredClients = useMemo(
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

  const values = useMemo(
    () =>
      clientStages.map((stage) =>
        filteredClients.filter((client) => stage.statuses.includes(client.status)).length,
      ),
    [filteredClients],
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
        throw new Error(data?.error || "Não foi possível atualizar o status do cliente.")
      }

      setClients((current) => current.map((item) => (item.id === data.lead?.id ? data.lead : item)))
      setSelectedClient(data.lead)
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status do cliente.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <BrokerPageShell title="Clientes" primaryActionLabel="Novo imóvel" primaryActionHref="/corretor/novo-imovel">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Sparkles className="size-3.5" />
                Relacionamento ativo
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Clientes em uma visão própria</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Acompanhe quem já entrou no seu funil com contexto, status e próximos passos, sem misturar com a tela de leads.
              </p>
            </div>
            <Button asChild className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
              <Link href="/corretor/corretor-m">Priorizar com COS</Link>
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
                  placeholder="Nome, telefone ou imóvel"
                  className="h-11 rounded-xl pl-10"
                />
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
          {feedback ? (
            <div className="rounded-[1.25rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
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
                        {client.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#7B8491]">
                      {client.propertyTitle || "Catálogo"} · {formatLeadSource(client.source)} · {formatDate(client.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5F6B7A]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-[#009b3a]" />
                        {client.phone || "Telefone não informado"}
                      </span>
                    </div>
                    {client.message ? <p className="mt-2 line-clamp-2 text-sm text-[#5F6B7A]">{client.message}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedClient(client)}
                    className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                  >
                    Ver cliente
                  </Button>
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

      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white/95 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-2xl">
          {selectedClient ? (
            <div className="grid gap-5">
              <div>
                <DialogTitle className="text-2xl text-[#050505]">{selectedClient.name || "Cliente sem nome"}</DialogTitle>
                <DialogDescription className="mt-2 text-[#6B7280]">
                  Histórico e enquadramento do cliente dentro do portal.
                </DialogDescription>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ClientInfo label="Telefone" value={selectedClient.phone || "Não informado"} />
                <ClientInfo label="Imóvel de interesse" value={selectedClient.propertyTitle || "Catálogo"} />
                <ClientInfo label="Origem" value={formatLeadSource(selectedClient.source)} />
                <ClientInfo label="Data" value={formatDate(selectedClient.createdAt)} />
                <ClientInfo label="Busca" value={selectedClient.searchTerm || "Sem busca registrada"} />
                <ClientInfo label="Intenção" value={selectedClient.intent || "Sem intenção registrada"} />
              </div>

              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-sm text-[#6B7280]">Mensagem</p>
                <p className="mt-2 break-words text-sm leading-6 text-[#5F6B7A]">{selectedClient.message || "Sem mensagem registrada."}</p>
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-[#6B7280]">Status atual</span>
                <Select
                  value={selectedClient.status === "NEGOTIATING" ? "CONTACTED" : selectedClient.status}
                  disabled={isUpdatingStatus}
                  onValueChange={(value) => updateClientStatus(selectedClient, value as LeadRecord["status"])}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Novo</SelectItem>
                    <SelectItem value="CONTACTED">Em atendimento</SelectItem>
                    <SelectItem value="WON">Convertido</SelectItem>
                    <SelectItem value="LOST">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  )
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

function ClientInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#050505]">{value}</p>
    </div>
  )
}
