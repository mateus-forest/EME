"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { CreditCard, Mail, MessageCircleMore, Search, SlidersHorizontal, Sparkles, UserRound, Users } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import {
  deleteAdminBroker,
  deriveInitials,
  type AdminBrokerRecord,
  updateAdminBroker,
  useAdminBrokers,
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

const statusFilters = ["Todos", "Ativo", "Inativo"] as const
export function AdminBrokersPage() {
  const [brokers, setBrokers] = useAdminBrokers()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [selectedBroker, setSelectedBroker] = useState<AdminBrokerRecord | null>(null)
  const [editingBroker, setEditingBroker] = useState<AdminBrokerRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filteredBrokers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return brokers.filter((broker) => {
      const matchesSearch =
        !normalizedSearch ||
        broker.name.toLowerCase().includes(normalizedSearch) ||
        broker.email.toLowerCase().includes(normalizedSearch) ||
        broker.creci.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === "Todos" || broker.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [brokers, search, statusFilter])

  const summary = {
    total: brokers.length,
    active: brokers.filter((broker) => broker.status === "Ativo").length,
    inactive: brokers.filter((broker) => broker.status === "Inativo").length,
    properties: brokers.reduce((sum, broker) => sum + broker.propertyCount, 0),
    aiCredits: brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0),
  }

  async function handleToggleStatus(broker: AdminBrokerRecord) {
    const nextStatus = broker.status === "Ativo" ? "Inativo" : "Ativo"

    try {
      const updated = await updateAdminBroker(broker.id, { status: nextStatus })
      setBrokers(brokers.map((current) => (current.id === broker.id ? updated : current)))
      setSelectedBroker((current) => (current?.id === broker.id ? updated : current))
      setEditingBroker((current) => (current?.id === broker.id ? updated : current))
      setFeedback(`${updated.name} agora est? ${updated.status.toLowerCase()}.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o status do corretor.")
    }
  }

  async function handleDelete(broker: AdminBrokerRecord) {
    if (!window.confirm(`Tem certeza que deseja excluir ${broker.name}?`)) return

    try {
      const result = await deleteAdminBroker(broker.id)

      if (result.deleted) {
        setBrokers(brokers.filter((current) => current.id !== broker.id))
        if (selectedBroker?.id === broker.id) setSelectedBroker(null)
        if (editingBroker?.id === broker.id) setEditingBroker(null)
        setFeedback(`${broker.name} foi removido da lista.`)
        return
      }

      if (result.item) {
        setBrokers(brokers.map((current) => (current.id === broker.id ? result.item! : current)))
        setSelectedBroker((current) => (current?.id === broker.id ? result.item! : current))
        setEditingBroker((current) => (current?.id === broker.id ? result.item! : current))
        setFeedback(`${result.item.name} possui v?nculos e foi inativado.`)
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o corretor.")
    }
  }

  async function handleSave(broker: AdminBrokerRecord) {
    try {
      const updated = await updateAdminBroker(broker.id, {
        name: broker.name,
        email: broker.email,
        whatsApp: broker.whatsApp,
        creci: broker.creci,
        status: broker.status,
      })
      setBrokers(brokers.map((current) => (current.id === broker.id ? updated : current)))
      setEditingBroker(null)
      setSelectedBroker(updated)
      setFeedback("Corretor atualizado com sucesso.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o corretor.")
    }
  }

  return (
    <AdminPageShell
      title="Corretores"
      subtitle="Gerencie os corretores EME da plataforma"
      headerControls={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative w-full max-w-[18rem] lg:max-w-[19rem] xl:max-w-[20rem]">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, email ou CRECI"
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total de corretores" value={String(summary.total)} icon={Users} />
        <SummaryCard label="Corretores ativos" value={String(summary.active)} icon={UserRound} />
        <SummaryCard label="Corretores inativos" value={String(summary.inactive)} icon={UserRound} />
        <SummaryCard label="Imóveis cadastrados" value={String(summary.properties)} icon={CreditCard} />
        <SummaryCard label="Créditos IA usados" value={String(summary.aiCredits)} icon={Sparkles} />
      </section>

      {filtersOpen && (
        <section className="mt-6 rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <div className="grid gap-4 lg:grid-cols-1">
            <FilterGroup title="Status">
              {statusFilters.map((filter) => (
                <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
          </div>
        </section>
      )}

      {filteredBrokers.length === 0 ? (
        <section className="mt-6 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <h3 className="text-2xl font-semibold text-white">Nenhum corretor encontrado</h3>
          <p className="mt-3 text-sm leading-7 text-white/55">Os corretores aparecerão aqui conforme forem cadastrados na plataforma.</p>
        </section>
      ) : (
        <section className="mt-6 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px]">
              <thead className="border-b border-white/[0.08]">
                <tr className="text-left text-sm text-white/45">
                  <th className="px-5 py-4 font-medium">Corretor</th>
                  <th className="px-5 py-4 font-medium">CRECI</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">WhatsApp</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Plano</th>
                  <th className="px-5 py-4 font-medium">Imóveis</th>
                  <th className="px-5 py-4 font-medium">Leads</th>
                  <th className="px-5 py-4 font-medium">Consumo IA</th>
                  <th className="px-5 py-4 font-medium">Corretor EME</th>
                  <th className="px-5 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrokers.map((broker) => (
                  <tr key={broker.id} className="border-b border-white/[0.06] align-top last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-[#00C853]/15 text-sm font-semibold text-[#69F0AE]">
                          {broker.initials}
                        </div>
                        <p className="font-medium text-white">{broker.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.creci}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.email}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.whatsApp}</td>
                    <td className="px-5 py-4"><StatusBadge status={broker.status} /></td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.plan}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.propertyCount}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.leads}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{broker.aiCreditsUsedThisMonth}</td>
                    <td className="px-5 py-4"><IntegrationBadge status={broker.corretorEmeStatus} /></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton label="Ver detalhes" onClick={() => setSelectedBroker(broker)} />
                        <ActionButton label="Editar" onClick={() => setEditingBroker(broker)} />
                        <ActionButton label={broker.status === "Ativo" ? "Desativar" : "Ativar"} onClick={() => void handleToggleStatus(broker)} />
                        <ActionButton label="Excluir" danger onClick={() => void handleDelete(broker)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <BrokerDetailsDialog broker={selectedBroker} onOpenChange={(open) => !open && setSelectedBroker(null)} onEdit={() => {
        if (!selectedBroker) return
        setEditingBroker(selectedBroker)
        setSelectedBroker(null)
      }} />
      <BrokerEditDialog broker={editingBroker} onOpenChange={(open) => !open && setEditingBroker(null)} onSave={handleSave} />
    </AdminPageShell>
  )
}

function BrokerDetailsDialog({
  broker,
  onOpenChange,
  onEdit,
}: {
  broker: AdminBrokerRecord | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
}) {
  return (
    <Dialog open={Boolean(broker)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {broker && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">{broker.name}</DialogTitle>
              <DialogDescription className="text-white/55">Detalhes do corretor EME e indicadores operacionais.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2">
                <DetailItem label="CRECI" value={broker.creci} />
                <DetailItem label="Status" value={broker.status} />
                <DetailItem label="Plano" value={broker.plan} />
                <DetailItem label="Imóveis cadastrados" value={String(broker.propertyCount)} />
                <DetailItem label="Imóveis ativos" value={String(broker.activeProperties)} />
                <DetailItem label="Leads gerados" value={String(broker.leads)} />
                <DetailItem label="Créditos IA usados" value={String(broker.aiCreditsUsedThisMonth)} />
                <DetailItem label="Corretor EME" value={broker.corretorEmeStatus} />
                <DetailItem label="Email" value={broker.email} />
                <DetailItem label="WhatsApp" value={broker.whatsApp} />
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={`mailto:${broker.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/80 hover:bg-white/[0.08] hover:text-white">
                  <Mail className="size-4" />
                  Email
                </a>
                <a href={createWhatsAppUrl(broker.whatsApp, `Olá, ${broker.name}. Estamos revisando seu acesso administrativo na EME.`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 px-4 text-sm text-[#69F0AE] hover:bg-[#00C853]/14">
                  <MessageCircleMore className="size-4" />
                  WhatsApp
                </a>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onEdit} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                Editar corretor
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function BrokerEditDialog({
  broker,
  onOpenChange,
  onSave,
}: {
  broker: AdminBrokerRecord | null
  onOpenChange: (open: boolean) => void
  onSave: (broker: AdminBrokerRecord) => void
}) {
  const [draft, setDraft] = useState<AdminBrokerRecord | null>(broker)

  useEffect(() => {
    setDraft(broker)
  }, [broker])

  return (
    <Dialog open={Boolean(broker)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {draft && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Editar corretor</DialogTitle>
              <DialogDescription className="text-white/55">Atualize os dados individuais sem sair da lista.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value, initials: deriveInitials(value) })} />
              <Field label="CRECI" value={draft.creci} onChange={(value) => setDraft({ ...draft, creci: value })} />
              <Field label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
              <Field label="WhatsApp" value={draft.whatsApp} onChange={(value) => setDraft({ ...draft, whatsApp: value })} />
              <Field label="Leads" value={String(draft.leads)} onChange={(value) => setDraft({ ...draft, leads: Number(value.replace(/\D/g, "")) || 0 })} />
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

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
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

function StatusBadge({ status }: { status: AdminBrokerRecord["status"] }) {
  const tone = status === "Ativo" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-[#ffb74d]/15 bg-[#ffb74d]/8 text-[#ffcc80]"
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>
}

function IntegrationBadge({ status }: { status: AdminBrokerRecord["corretorEmeStatus"] }) {
  const tone =
    status === "Ativo"
      ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
      : status === "Pausado"
        ? "border-[#ffb74d]/15 bg-[#ffb74d]/8 text-[#ffcc80]"
        : "border-white/[0.08] bg-white/[0.04] text-white/70"
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
