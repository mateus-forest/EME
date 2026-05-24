"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Clock3, Eye, MessageCircle, Sparkles, Trophy, UsersRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import type { LeadRecord } from "@/lib/lead-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

const leadStages = [
  {
    title: "Leads novos",
    description: "Interessados capturados pelo catálogo e anúncios.",
    icon: UsersRound,
  },
  {
    title: "Em atendimento",
    description: "Contatos que precisam de resposta ou acompanhamento.",
    icon: MessageCircle,
  },
  {
    title: "Convertidos",
    description: "Oportunidades que avançaram para visita, proposta ou venda.",
    icon: Trophy,
  },
  {
    title: "Perdidos",
    description: "Clientes sem aderência ou sem retorno após atendimento.",
    icon: Clock3,
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

export function BrokerLeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [feedback, setFeedback] = useState("")
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadRecord[]; error?: string } | null
        if (!response.ok) throw new Error(data?.error || "Não foi possível carregar seus leads.")
        if (!ignore) setLeads(data?.leads ?? [])
      })
      .catch((error) => {
        if (!ignore) setFeedback(error instanceof Error ? error.message : "Não foi possível carregar seus leads.")
      })

    return () => {
      ignore = true
    }
  }, [])

  const values = useMemo(
    () => [
      leads.filter((lead) => lead.status === "NEW").length,
      leads.filter((lead) => lead.status === "CONTACTED" || lead.status === "NEGOTIATING").length,
      leads.filter((lead) => lead.status === "WON").length,
      leads.filter((lead) => lead.status === "LOST").length,
    ],
    [leads],
  )

  async function updateLeadStatus(lead: LeadRecord, status: LeadRecord["status"]) {
    setIsUpdatingStatus(true)
    setFeedback("")

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ status }),
      })
      const data = (await response.json().catch(() => null)) as { lead?: LeadRecord; error?: string } | null

      if (!response.ok || !data?.lead) {
        throw new Error(data?.error || "Não foi possível atualizar o status do lead.")
      }

      setLeads((current) => current.map((item) => (item.id === data.lead?.id ? data.lead : item)))
      setSelectedLead(data.lead)
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status do lead.")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <BrokerPageShell title="Leads" primaryActionLabel="Novo imóvel" primaryActionHref="/corretor/novo-imovel">
      <div className="grid gap-6">
        <section className="rounded-[1.75rem] border border-[#00C853]/16 bg-[linear-gradient(135deg,rgba(0,200,83,0.14),rgba(17,17,17,0.96)_42%,rgba(14,14,14,0.92))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                <Sparkles className="size-3.5" />
                Pipeline inteligente
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">Leads organizados para vender melhor</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                Aqui ficam os contatos reais capturados pelo catálogo, imóveis e ações inteligentes do EME.
              </p>
            </div>
            <Button asChild className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
              <Link href="/corretor/corretor-m">Analisar com Assessor EME</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {leadStages.map((stage, index) => (
            <Card key={stage.title} className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
              <CardHeader className="px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                    <stage.icon className="size-5" />
                  </div>
                  <p className="text-3xl font-semibold text-white">{values[index]}</p>
                </div>
                <CardTitle className="pt-3 text-lg text-white">{stage.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <p className="text-sm leading-6 text-white/55">{stage.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-6">
          {feedback ? (
            <div className="rounded-[1.25rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {feedback}
            </div>
          ) : leads.length > 0 ? (
            <div className="grid gap-3">
              {leads.map((lead) => (
                <div key={lead.id} className="grid gap-4 rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{lead.name || "Lead sem nome"}</p>
                      <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-2.5 py-1 text-xs text-[#69F0AE]">
                        {lead.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/45">
                      {lead.propertyTitle || "Catálogo"} · {formatLeadSource(lead.source)} · {formatDate(lead.createdAt)}
                    </p>
                    {lead.message ? <p className="mt-2 line-clamp-2 text-sm text-white/60">{lead.message}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedLead(lead)}
                    className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Eye className="size-4" />
                    Ver detalhes
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <UsersRound className="size-6" />
              </div>
              <h3 className="text-xl font-semibold text-white">Nenhum lead recebido ainda.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
                Compartilhe seu catálogo para começar.
              </p>
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-2xl">
          {selectedLead ? (
            <div className="grid gap-5">
              <div>
                <DialogTitle className="text-2xl text-white">{selectedLead.name || "Lead sem nome"}</DialogTitle>
                <DialogDescription className="mt-2 text-white/55">
                  Detalhes do lead capturado no catálogo.
                </DialogDescription>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <LeadInfo label="Telefone" value={selectedLead.phone || "Não informado"} />
                <LeadInfo label="Imóvel de interesse" value={selectedLead.propertyTitle || "Catálogo"} />
                <LeadInfo label="Origem" value={formatLeadSource(selectedLead.source)} />
                <LeadInfo label="Data" value={formatDate(selectedLead.createdAt)} />
                <LeadInfo label="Busca" value={selectedLead.searchTerm || "Sem busca registrada"} />
                <LeadInfo label="Intenção" value={selectedLead.intent || "Sem intenção registrada"} />
              </div>

              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm text-white/50">Mensagem</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{selectedLead.message || "Sem mensagem registrada."}</p>
              </div>

              <label className="grid gap-2 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <span className="text-sm text-white/50">Status atual</span>
                <select
                  value={selectedLead.status === "NEGOTIATING" ? "CONTACTED" : selectedLead.status}
                  disabled={isUpdatingStatus}
                  onChange={(event) => updateLeadStatus(selectedLead, event.target.value as LeadRecord["status"])}
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#00C853]/35"
                >
                  <option value="NEW" className="bg-[#111]">Novo</option>
                  <option value="CONTACTED" className="bg-[#111]">Em atendimento</option>
                  <option value="WON" className="bg-[#111]">Convertido</option>
                  <option value="LOST" className="bg-[#111]">Perdido</option>
                </select>
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

function LeadInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
