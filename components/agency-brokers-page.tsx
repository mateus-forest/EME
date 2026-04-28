"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { SlidersHorizontal } from "lucide-react"

import type { AgencyBroker } from "@/components/agency-brokers-data"
import { AgencyBrokerManagementModal } from "@/components/agency-broker-management-modal"
import { AgencyInviteBrokerModal } from "@/components/agency-invite-broker-modal"
import { AgencyPageShell } from "@/components/agency-page-shell"
import { useAgencyBrokers } from "@/components/use-agency-brokers"
import { useAgencySubscription } from "@/components/use-agency-subscription"
import { isBillingBypassEnabled } from "@/lib/billing-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const statusFilters = ["Todos", "Ativo", "Inativo", "Pendente"]
const performanceFilters = ["Mais leads", "Mais imóveis"]

export function AgencyBrokersPage() {
  const { brokers, addBroker, updateBroker, deleteBroker } = useAgencyBrokers()
  const { subscription } = useAgencySubscription()
  const [selectedBroker, setSelectedBroker] = useState<AgencyBroker | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [performanceFilter, setPerformanceFilter] = useState("Mais leads")
  const [search, setSearch] = useState("")
  const [actionFeedback, setActionFeedback] = useState("")

  const filteredBrokers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    let nextBrokers = brokers.filter((broker) => {
      const matchesStatus = statusFilter === "Todos" || broker.status === statusFilter
      const matchesSearch = normalizedSearch
        ? broker.name.toLowerCase().includes(normalizedSearch) ||
          broker.email.toLowerCase().includes(normalizedSearch) ||
          broker.creci.toLowerCase().includes(normalizedSearch)
        : true

      return matchesStatus && matchesSearch
    })
    nextBrokers = [...nextBrokers].sort((a, b) => performanceFilter === "Mais imóveis" ? b.properties - a.properties : b.leads - a.leads)
    return nextBrokers
  }, [brokers, performanceFilter, search, statusFilter])

  const summary = {
    active: brokers.filter((broker) => broker.status === "Ativo").length,
    totalProperties: brokers.reduce((acc, broker) => acc + broker.properties, 0),
    totalLeads: brokers.reduce((acc, broker) => acc + broker.leads, 0),
    topBroker: [...brokers].sort((a, b) => b.leads - a.leads)[0]?.name ?? "Sem dados",
  }
  const billingBypassEnabled = isBillingBypassEnabled()
  const isPlanBlocked = !billingBypassEnabled && !subscription.isActive

  function requireActiveAgencyPlan() {
    if (!isPlanBlocked) return true

    setActionFeedback("Seu plano da imobiliária não está ativo para convidar ou ativar corretores. Ative ou regularize sua assinatura para continuar.")
    return false
  }

  function handleToggleStatus(broker: AgencyBroker) {
    if (!requireActiveAgencyPlan()) return

    const nextStatus = broker.status === "Ativo" ? "Inativo" : "Ativo"
    updateBroker(broker.id, { status: nextStatus })
      .then((updatedBroker) => {
        setSelectedBroker((current) => (current?.id === broker.id ? updatedBroker : current))
        setActionFeedback(`Corretor ${nextStatus === "Ativo" ? "ativado" : "desativado"} com sucesso.`)
      })
      .catch((caughtError) => {
        setActionFeedback(
          caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o corretor.",
        )
      })
  }

  function handleDelete(broker: AgencyBroker) {
    if (!window.confirm(`Tem certeza que deseja excluir ${broker.name}?`)) return
    deleteBroker(broker.id)
      .then(() => {
        setSelectedBroker((current) => (current?.id === broker.id ? null : current))
        setActionFeedback("Corretor excluído com sucesso.")
      })
      .catch((caughtError) => {
        setActionFeedback(
          caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o corretor.",
        )
      })
  }

  function openCatalog(broker: AgencyBroker) {
    const slug = broker.catalogLink.split("/").pop() || "marina-costa"
    window.open(`/catalogo/${slug}`, "_blank", "noopener,noreferrer")
  }

  function handleOpenInvite() {
    if (!requireActiveAgencyPlan()) return
    setInviteOpen(true)
  }

  async function handleInviteBroker(broker: {
    fullName: string
    email: string
    whatsApp: string
    creci: string
    note: string
  }) {
    if (!requireActiveAgencyPlan()) return
    await addBroker(broker)
    setActionFeedback("Convite enviado com sucesso.")
  }

  return (
    <AgencyPageShell
      title="Corretores"
      subtitle="Gerencie sua equipe e acompanhe o desempenho de cada corretor"
      searchPlaceholder="Buscar por nome ou CRECI"
      searchValue={search}
      onSearchChange={setSearch}
      primaryActionLabel="Convidar corretor"
      primaryActionOnClick={handleOpenInvite}
      headerControls={
        <Button
          type="button"
          variant="ghost"
          onClick={() => setFiltersOpen((current) => !current)}
          className="h-8.5 rounded-xl border border-white/10 bg-white/5 px-4 text-white/75 hover:bg-white/10 hover:text-white"
        >
          <SlidersHorizontal className="size-4" />
          {filtersOpen ? "Ocultar filtros" : "Filtro"}
        </Button>
      }
    >
      {billingBypassEnabled ? (
        <section className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          Ambiente local com billing em modo de teste. Convites e gestão de corretores estão liberados.
        </section>
      ) : null}

      {isPlanBlocked ? (
        <section className="flex flex-col gap-3 rounded-[1.25rem] border border-[#ffb74d]/20 bg-[#ffb74d]/10 px-4 py-4 text-sm text-[#ffd180]">
          <p>Seu plano da imobiliária não está ativo para convidar ou ativar corretores. Ative ou regularize sua assinatura para continuar.</p>
          <div>
            <Button
              asChild
              className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
            >
              <Link href="/imobiliaria/plano">Ativar assinatura</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {actionFeedback ? (
        <section className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          {actionFeedback}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Corretores ativos" value={String(summary.active)} />
        <SummaryCard label="Total de imóveis da equipe" value={String(summary.totalProperties)} />
        <SummaryCard label="Leads totais" value={String(summary.totalLeads)} />
        <SummaryCard label="Melhor corretor do mês" value={summary.topBroker} />
      </section>

      {filtersOpen && <section className="rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)} label={filter} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {performanceFilters.map((filter) => (
              <FilterButton key={filter} active={performanceFilter === filter} onClick={() => setPerformanceFilter(filter)} label={filter} />
            ))}
          </div>
        </div>
      </section>}

      {filteredBrokers.length === 0 ? (
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <h3 className="text-2xl font-semibold text-white">Você ainda não cadastrou corretores</h3>
          <p className="mt-3 text-sm leading-7 text-white/55">Convide sua equipe para começar a publicar e acompanhar resultados.</p>
          <Button type="button" onClick={handleOpenInvite} className="mt-6 h-10 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
            Convidar primeiro corretor
          </Button>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredBrokers.map((broker) => (
            <Card key={broker.id} className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardContent className="grid gap-5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex size-14 items-center justify-center rounded-full bg-[#00C853]/15 text-base font-semibold text-[#69F0AE]">{broker.initials}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">{broker.name}</p>
                        <span className={`rounded-full border px-3 py-1 text-xs ${broker.status === "Ativo" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : broker.status === "Pendente" ? "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]" : "border-white/[0.08] bg-white/[0.04] text-white/65"}`}>{broker.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-white/50">CRECI {broker.creci}</p>
                    </div>
                  </div>
                  {broker.highlight && <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs text-[#69F0AE]">{broker.highlight}</span>}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniMetric label="Imóveis" value={String(broker.properties)} />
                  <MiniMetric label="Leads" value={String(broker.leads)} />
                  <MiniMetric label="Cliques no WhatsApp" value={broker.clicks} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setSelectedBroker(broker)} className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">Ver detalhes</Button>
                  <Button type="button" variant="ghost" onClick={() => setSelectedBroker(broker)} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">Editar</Button>
                  <Button type="button" variant="ghost" onClick={() => handleToggleStatus(broker)} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">{broker.actionLabel}</Button>
                  <Button type="button" variant="ghost" onClick={() => openCatalog(broker)} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">Abrir catálogo</Button>
                  <Button type="button" variant="ghost" onClick={() => handleDelete(broker)} className="h-9 rounded-xl border border-[#ff6b6b]/15 bg-[#ff6b6b]/8 px-4 text-[#ff9b9b] hover:bg-[#ff6b6b]/12 hover:text-[#ffc1c1]">Excluir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <AgencyBrokerManagementModal
        broker={selectedBroker}
        open={!!selectedBroker}
        onOpenChange={(open) => !open && setSelectedBroker(null)}
        onEdit={(broker) => setSelectedBroker(broker)}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
      />
      <AgencyInviteBrokerModal open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInviteBroker} />
    </AgencyPageShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="p-4">
        <p className="text-sm text-white/55">{label}</p>
        <p className="mt-2.5 text-2xl font-semibold tracking-tight text-white">{value}</p>
      </CardContent>
    </Card>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/[0.08] bg-black/20 px-3 py-2.5">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-9 rounded-full border px-4 text-sm ${active ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE] hover:bg-[#00C853]/14" : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"}`}
    >
      {label}
    </Button>
  )
}
