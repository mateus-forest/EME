"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Mail, MessageCircleMore, Search, SlidersHorizontal, UserRound, Users } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import {
  deleteAdminUser,
  type AdminUserRecord,
  updateAdminUser,
  useAdminUsers,
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

const typeFilters = ["Todos", "Corretor", "Admin"] as const
const statusFilters = ["Todos", "Ativo", "Inativo"] as const
const planFilters = ["Todos", "Corretor", "Sem plano", "Admin"] as const

export function AdminUsersPage() {
  const [users, setUsers] = useAdminUsers()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("Todos")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [planFilter, setPlanFilter] = useState<(typeof planFilters)[number]>("Todos")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)
      const matchesType = typeFilter === "Todos" || user.type === typeFilter
      const matchesStatus = statusFilter === "Todos" || user.status === statusFilter
      const matchesPlan = planFilter === "Todos" || user.plan === planFilter

      return matchesSearch && matchesType && matchesStatus && matchesPlan
    })
  }, [planFilter, search, statusFilter, typeFilter, users])

  const summary = {
    total: users.length,
    brokers: users.filter((user) => user.type === "Corretor").length,
    admins: users.filter((user) => user.type === "Admin").length,
    active: users.filter((user) => user.status === "Ativo").length,
    inactive: users.filter((user) => user.status === "Inativo").length,
  }

  async function handleToggleStatus(user: AdminUserRecord) {
    const nextStatus = user.status === "Ativo" ? "Inativo" : "Ativo"

    try {
      const updated = await updateAdminUser(user.id, { status: nextStatus })
      setUsers(users.map((current) => (current.id === user.id ? updated : current)))
      setSelectedUser((current) => (current?.id === user.id ? updated : current))
      setEditingUser((current) => (current?.id === user.id ? updated : current))
      setFeedback(`${updated.name} agora est? ${updated.status.toLowerCase()}.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o status do usuário.")
    }
  }

  async function handleDelete(user: AdminUserRecord) {
    if (!window.confirm(`Tem certeza que deseja excluir ${user.name}?`)) return

    try {
      const result = await deleteAdminUser(user.id)

      if (result.deleted) {
        setUsers(users.filter((current) => current.id !== user.id))
        if (selectedUser?.id === user.id) setSelectedUser(null)
        if (editingUser?.id === user.id) setEditingUser(null)
        setFeedback(`${user.name} foi removido da lista.`)
        return
      }

      if (result.item) {
        setUsers(users.map((current) => (current.id === user.id ? result.item! : current)))
        setSelectedUser((current) => (current?.id === user.id ? result.item! : current))
        setEditingUser((current) => (current?.id === user.id ? result.item! : current))
        setFeedback(`${result.item.name} possui v?nculos e foi inativado.`)
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o usuário.")
    }
  }

  async function handleSave(user: AdminUserRecord) {
    try {
      const updated = await updateAdminUser(user.id, user)
      setUsers(users.map((current) => (current.id === user.id ? updated : current)))
      setEditingUser(null)
      setSelectedUser(updated)
      setFeedback("Usu?rio atualizado com sucesso.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o usuário.")
    }
  }

  return (
    <AdminPageShell
      title="Usuários"
      subtitle="Gerencie todos os usuários da plataforma"
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total de usuários" value={String(summary.total)} icon={Users} />
        <SummaryCard label="Corretores" value={String(summary.brokers)} icon={UserRound} />
        <SummaryCard label="Admins" value={String(summary.admins)} icon={Users} />
        <SummaryCard label="Usuários ativos" value={String(summary.active)} icon={Users} />
        <SummaryCard label="Usuários inativos" value={String(summary.inactive)} icon={Users} />
      </section>

      {filtersOpen && (
        <section className="mt-6 rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterGroup title="Tipo">
              {typeFilters.map((filter) => (
                <FilterButton key={filter} active={typeFilter === filter} onClick={() => setTypeFilter(filter)} label={filter} />
              ))}
            </FilterGroup>

            <FilterGroup title="Status">
              {statusFilters.map((filter) => (
                <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)} label={filter} />
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

      {filteredUsers.length === 0 ? (
        <section className="mt-6 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <h3 className="text-2xl font-semibold text-white">Nenhum usuário encontrado</h3>
          <p className="mt-3 text-sm leading-7 text-white/55">Os usuários aparecerão aqui conforme se cadastrarem.</p>
        </section>
      ) : (
        <section className="mt-6 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-white/[0.08]">
                <tr className="text-left text-sm text-white/45">
                  <th className="px-5 py-4 font-medium">Nome</th>
                  <th className="px-5 py-4 font-medium">Tipo</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">WhatsApp</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Criação</th>
                  <th className="px-5 py-4 font-medium">Plano</th>
                  <th className="px-5 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/[0.06] align-top last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{user.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <TypeBadge type={user.type} />
                    </td>
                    <td className="px-5 py-4 text-sm text-white/72">{user.email}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{user.whatsApp}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-white/72">{user.createdAt}</td>
                    <td className="px-5 py-4 text-sm text-white/72">{user.plan}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton label="Ver detalhes" onClick={() => setSelectedUser(user)} />
                        <ActionButton label="Editar" onClick={() => setEditingUser(user)} />
                        <ActionButton label={user.status === "Ativo" ? "Desativar" : "Ativar"} onClick={() => void handleToggleStatus(user)} />
                        <ActionButton label="Excluir" danger onClick={() => void handleDelete(user)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <UserDetailsDialog user={selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)} onEdit={() => {
        if (!selectedUser) return
        setEditingUser(selectedUser)
        setSelectedUser(null)
      }} />
      <UserEditDialog user={editingUser} onOpenChange={(open) => !open && setEditingUser(null)} onSave={handleSave} />
    </AdminPageShell>
  )
}

function UserDetailsDialog({
  user,
  onOpenChange,
  onEdit,
}: {
  user: AdminUserRecord | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
}) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">{user.name}</DialogTitle>
              <DialogDescription className="text-white/55">Dados completos do usuário na plataforma.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2">
                <DetailItem label="Tipo" value={user.type} />
                <DetailItem label="Status" value={user.status} />
                <DetailItem label="Plano" value={user.plan} />
                <DetailItem label="Criação" value={user.createdAt} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="WhatsApp" value={user.whatsApp} />
              </div>

              <div className="flex flex-wrap gap-3">
                <a href={`mailto:${user.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/80 hover:bg-white/[0.08] hover:text-white">
                  <Mail className="size-4" />
                  Email
                </a>
                <a href={createWhatsAppUrl(user.whatsApp, `Olá, ${user.name}. Estamos revisando seu cadastro na EME.`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 px-4 text-sm text-[#69F0AE] hover:bg-[#00C853]/14">
                  <MessageCircleMore className="size-4" />
                  WhatsApp
                </a>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onEdit} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                Editar usuário
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UserEditDialog({
  user,
  onOpenChange,
  onSave,
}: {
  user: AdminUserRecord | null
  onOpenChange: (open: boolean) => void
  onSave: (user: AdminUserRecord) => void
}) {
  const [draft, setDraft] = useState<AdminUserRecord | null>(user)

  useEffect(() => {
    setDraft(user)
  }, [user])

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/[0.08] bg-[#111111] text-white">
        {draft && (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Editar usuário</DialogTitle>
              <DialogDescription className="text-white/55">Ajuste os dados do usuário sem sair da lista.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
              <Field label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
              <Field label="WhatsApp" value={draft.whatsApp} onChange={(value) => setDraft({ ...draft, whatsApp: value })} />
              <Field label="Plano" value={draft.plan} onChange={(value) => setDraft({ ...draft, plan: value })} />
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

function TypeBadge({ type }: { type: AdminUserRecord["type"] }) {
  const tone = type === "Corretor" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.04] text-white/70"
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{type}</span>
}

function StatusBadge({ status }: { status: AdminUserRecord["status"] }) {
  const tone = status === "Ativo" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-[#ffb74d]/15 bg-[#ffb74d]/8 text-[#ffcc80]"
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>
}

function ActionButton({
  label,
  danger = false,
  onClick,
}: {
  label: string
  danger?: boolean
  onClick: () => void
}) {
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
