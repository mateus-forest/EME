"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Building2, Mail, MessageCircleMore, Search, SlidersHorizontal, Users } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import {
  calculateAgencyMonthlyValue,
  deleteAdminAgency,
  formatCurrencyBRL,
  type AdminAgencyRecord,
  updateAdminAgency,
  useAdminAgencies,
} from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWhatsAppUrl } from "@/lib/whatsapp"

const statusFilters = ["Todas", "Ativa", "Inativa"] as const
const brokerRangeFilters = ["Todas", "Até 3", "4 a 8", "9+"] as const
const planFilters = ["Todos", "Plano Imobiliária"] as const

export function AdminAgenciesPage() {
  const [agencies, setAgencies] = useAdminAgencies()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todas")
  const [brokerRangeFilter, setBrokerRangeFilter] = useState<(typeof brokerRangeFilters)[number]>("Todas")
  const [planFilter, setPlanFilter] = useState<(typeof planFilters)[number]>("Todos")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [selectedAgency, setSelectedAgency] = useState<AdminAgencyRecord | null>(null)
  const [editingAgency, setEditingAgency] = useState<AdminAgencyRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filteredAgencies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return agencies.filter((agency) => {
      const matchesSearch =
        !normalizedSearch ||
        agency.name.toLowerCase().includes(normalizedSearch) ||
        agency.email.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === "Todas" || agency.status === statusFilter
      const matchesPlan = planFilter === "Todos" || agency.plan === planFilter
      const matchesBrokerRange =
        brokerRangeFilter === "Todas" ||
        (brokerRangeFilter === "Até 3" && agency.activeBrokers <= 3) ||
        (brokerRangeFilter === "4 a 8" && agency.activeBrokers >= 4 && agency.activeBrokers <= 8) ||
        (brokerRangeFilter === "9+" && agency.activeBrokers >= 9)

      return matchesSearch && matchesStatus && matchesPlan && matchesBrokerRange
    })
  }, [agencies, brokerRangeFilter, planFilter, search, statusFilter])

  const summary = {
    total: agencies.length,
    active: agencies.filter((agency) => agency.status === "Ativa").length,
    inactive: agencies.filter((agency) => agency.status === "Inativa").length,
    revenue: agencies.reduce((sum, agency) => sum + calculateAgencyMonthlyValue(agency.activeBrokers), 0),
  }

  async function handleToggleStatus(agency: AdminAgencyRecord) {
    const nextStatus = agency.status === "Ativa" ? "Inativa" : "Ativa"

    try {
      const updated = await updateAdminAgency(agency.id, { status: nextStatus })
      setAgencies(agencies.map((current) => (current.id === agency.id ? updated : current)))
      setSelectedAgency((current) => (current?.id === agency.id ? updated : current))
      setEditingAgency((current) => (current?.id === agency.id ? updated : current))
      setFeedback(`${updated.name} agora está ${updated.status.toLowerCase()}.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o status da imobiliária.")
    }
  }

  async function handleDelete(agency: AdminAgencyRecord) {
    if (!window.confirm(`Tem certeza que deseja excluir ${agency.name}?`)) return

    try {
      const result = await deleteAdminAgency(agency.id)

      if (result.deleted) {
        setAgencies(agencies.filter((current) => current.id !== agency.id))
        if (selectedAgency?.id === agency.id) setSelectedAgency(null)
        if (editingAgency?.id === agency.id) setEditingAgency(null)
        setFeedback(`${agency.name} foi removida da lista.`)
        return
      }

      if (result.item) {
        setAgencies(agencies.map((current) => (current.id === agency.id ? result.item! : current)))
        setSelectedAgency((current) => (current?.id === agency.id ? result.item! : current))
        setEditingAgency((current) => (current?.id === agency.id ? result.item! : current))
        setFeedback(`${result.item.name} possui vínculos e foi inativada.`)
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir a imobiliária.")
    }
  }

  async function handleSave(agency: AdminAgencyRecord) {
    try {
      const updated = await updateAdminAgency(agency.id, agency)
      setAgencies(agencies.map((current) => (current.id === agency.id ? updated : current)))
      setEditingAgency(null)
      setSelectedAgency(updated)
      setFeedback("Imobiliária atualizada com sucesso.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar a imobiliária.")
    }
  }

  return (
    <AdminPageShell
      title="Imobiliárias"
      subtitle="Gerencie as contas institucionais da plataforma"
      headerControls={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative w-full max-w-[18rem] lg:max-w-[19rem] xl:max-w-[20rem]">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou email"
              className="h-8.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-10 text-sm text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-[#00C853]/35"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((current) => !current)}
            className={`h-8.5 rounded-xl border px-4 ${filtersOpen ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"}`}
          >
            <SlidersHorizontal className="size-4" />
            Filtros
          </Button>
        </div>
      }
    >
      {feedback && (
        <div className="mb-6 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          {feedback}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total de imobiliárias" value={String(summary.total)} icon={Building2} />
        <SummaryCard label="Imobiliárias ativas" value={String(summary.active)} icon={Users} />
        <SummaryCard label="Imobiliárias inativas" value={String(summary.inactive)} icon={Users} />
        <SummaryCard label="Receita gerada por imobiliárias" value={formatCurrencyBRL(summary.revenue)} icon={Building2} />
      </section>

      {filtersOpen && (
        <section className="mt-6 rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterGroup title="Status">
              {statusFilters.map((filter) => (
                <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)} label={filter} />
              ))}
            </FilterGroup>

            <FilterGroup title="Corretores ativos">
              {brokerRangeFilters.map((filter) => (
                <FilterButton key={filter} active={brokerRangeFilter === filter} onClick={() => setBrokerRangeFilter(filter)} label={filter} />
              ))}
            </FilterGroup>

            <FilterGroup title="Plano">
              {planFilters.map((filter) => (
                <FilterButton key={filter} active={planFilter === filter} onClick={() => setPlanFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
          </div>
        </section>
      )}

      {filteredAgencies.length === 0 ? (
        <section className="mt-6 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <h3 className="text-2xl font-semibold text-white">Nenhuma imobiliária encontrada</h3>
          <p className="mt-3 text-sm leading-7 text-white/55">As contas institucionais aparecerão aqui conforme forem criadas.</p>
        </section>
      ) : (
        <section className="mt-6 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead className="border-b border-white/[0.08]">
                <tr className="text-left text-sm text-white/45">
                  <th className="px-5 py-4 font-medium">Imobiliária</th>
                  <th className="px-5 py-4 font-medium">Responsável</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">WhatsApp</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Corretores ativos</th>
                  <th className="px-5 py-4 font-medium">Imóveis publicados</th>
                  <th className="px-5 py-4 font-medium">Valor mensal</th>
                  <th className="px-5 py-4 font-medium">Criação</th>
                  <th className="px-5 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgencies.map((agency) => (
                  <tr key={agency.id} className="border-b border-white/[0.06] align-top last:border-0">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-white">{agency.name}</p>
                        <p className="mt-1 text-sm text-white/45">{agency.plan}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/72">{agency.owner}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{agency.email}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{agency.whatsApp}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={agency.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-white/72">{agency.activeBrokers}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{agency.publishedProperties}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-white">{formatCurrencyBRL(calculateAgencyMonthlyValue(agency.activeBrokers))}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{agency.createdAt}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton label="Ver detalhes" onClick={() => setSelectedAgency(agency)} />
                        <ActionButton label="Editar" onClick={() => setEditingAgency(agency)} />
                        <ActionButton label={agency.status === "Ativa" ? "Desativar" : "Ativar"} onClick={() => void handleToggleStatus(agency)} />
                        <ActionButton label="Excluir" danger onClick={() => void handleDelete(agency)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AgencyDetailsDialog agency={selectedAgency} onOpenChange={(open) => !open && setSelectedAgency(null)} onEdit={() => {
        if (!selectedAgency) return
        setEditingAgency(selectedAgency)
        setSelectedAgency(null)
      }} />
      <AgencyEditDialog agency={editingAgency} onOpenChange={(open) => !open && setEditingAgency(null)} onSave={handleSave} />
    </AdminPageShell>
  )
}

function AgencyDetailsDialog({
  agency,
  onOpenChange,
  onEdit,
}: {
  agency: AdminAgencyRecord | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
}) {
  return (
    <Dialog open={Boolean(agency)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {agency && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">{agency.name}</DialogTitle>
              <DialogDescription className="text-white/55">Visão completa da conta institucional.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2">
                <DetailItem label="Responsável" value={agency.owner} />
                <DetailItem label="Status" value={agency.status} />
                <DetailItem label="Plano" value={agency.plan} />
                <DetailItem label="Criação" value={agency.createdAt} />
                <DetailItem label="Corretores ativos" value={String(agency.activeBrokers)} />
                <DetailItem label="Valor mensal" value={formatCurrencyBRL(calculateAgencyMonthlyValue(agency.activeBrokers))} />
                <DetailItem label="Imóveis publicados" value={String(agency.publishedProperties)} />
                <DetailItem label="Email" value={agency.email} />
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={`mailto:${agency.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/80 hover:bg-white/[0.08] hover:text-white">
                  <Mail className="size-4" />
                  Email
                </a>
                <a href={createWhatsAppUrl(agency.whatsApp, `Olá, ${agency.owner}. Estamos revisando a conta ${agency.name} na EME.`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 px-4 text-sm text-[#69F0AE] hover:bg-[#00C853]/14">
                  <MessageCircleMore className="size-4" />
                  WhatsApp
                </a>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onEdit} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                Editar imobiliária
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AgencyEditDialog({
  agency,
  onOpenChange,
  onSave,
}: {
  agency: AdminAgencyRecord | null
  onOpenChange: (open: boolean) => void
  onSave: (agency: AdminAgencyRecord) => void
}) {
  const [draft, setDraft] = useState<AdminAgencyRecord | null>(agency)

  useEffect(() => {
    setDraft(agency)
  }, [agency])

  return (
    <Dialog open={Boolean(agency)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {draft && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Editar imobiliária</DialogTitle>
              <DialogDescription className="text-white/55">Atualize a conta institucional.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
              <Field label="Responsável" value={draft.owner} onChange={(value) => setDraft({ ...draft, owner: value })} />
              <Field label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
              <Field label="WhatsApp" value={draft.whatsApp} onChange={(value) => setDraft({ ...draft, whatsApp: value })} />
              <Field label="Corretores ativos" value={String(draft.activeBrokers)} onChange={(value) => setDraft({ ...draft, activeBrokers: Number(value.replace(/\D/g, "")) || 0 })} />
              <Field label="Imóveis publicados" value={String(draft.publishedProperties)} onChange={(value) => setDraft({ ...draft, publishedProperties: Number(value.replace(/\D/g, "")) || 0 })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                Cancelar
              </Button>
              <Button type="button" onClick={() => onSave(draft)} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676]">
                Salvar alterações
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Building2 }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2.5 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-white/65">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
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

function StatusBadge({ status }: { status: AdminAgencyRecord["status"] }) {
  const tone = status === "Ativa" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-[#ffb74d]/15 bg-[#ffb74d]/8 text-[#ffcc80]"
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>
}

function ActionButton({ label, danger = false, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-8 rounded-xl border px-3 text-xs ${danger ? "border-[#ff6b6b]/15 bg-[#ff6b6b]/8 text-[#ff9b9b] hover:bg-[#ff6b6b]/12 hover:text-[#ffc1c1]" : "border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"}`}
    >
      {label}
    </Button>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-sm text-white/78">{value}</p>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-white/70">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/25 focus-visible:ring-[#00C853]/35" />
    </div>
  )
}
