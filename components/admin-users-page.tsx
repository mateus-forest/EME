"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Mail, MessageCircleMore, Search, ShieldCheck, Sparkles, Users } from "lucide-react"

import {
  AdminBadge,
  AdminDataTable,
  AdminDefinitionGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { deleteAdminUser, type AdminUserRecord, updateAdminUser, useAdminUsers } from "@/components/use-admin-data"
import { useAdminInsights } from "@/components/use-admin-insights"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWhatsAppUrl } from "@/lib/whatsapp"

const typeFilters = ["Todos", "Corretor", "Admin"] as const
const statusFilters = ["Todos", "Ativo", "Inativo"] as const
const planFilters = ["Todos", "Corretor", "Sem plano", "Admin"] as const

export function AdminUsersPage() {
  const [users, setUsers] = useAdminUsers()
  const { insights } = useAdminInsights()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("Todos")
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [planFilter, setPlanFilter] = useState<(typeof planFilters)[number]>("Todos")
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

  const selectedInsight = insights?.users.items.find((item) => item.id === selectedUser?.id)

  async function handleToggleStatus(user: AdminUserRecord) {
    const nextStatus = user.status === "Ativo" ? "Inativo" : "Ativo"

    try {
      const updated = await updateAdminUser(user.id, { status: nextStatus })
      setUsers(users.map((current) => (current.id === user.id ? updated : current)))
      setSelectedUser((current) => (current?.id === user.id ? updated : current))
      setEditingUser((current) => (current?.id === user.id ? updated : current))
      setFeedback(`${updated.name} agora está ${updated.status.toLowerCase()}.`)
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
        setSelectedUser((current) => (current?.id === user.id ? null : current))
        setFeedback(`${user.name} foi removido da lista.`)
        return
      }

      if (result.item) {
        setUsers(users.map((current) => (current.id === user.id ? result.item! : current)))
        setSelectedUser((current) => (current?.id === user.id ? result.item! : current))
        setFeedback(`${result.item.name} possui vínculos importantes e foi inativado.`)
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
      setFeedback("Usuário atualizado com sucesso.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o usuário.")
    }
  }

  return (
    <AdminPageShell
      title="Usuarios"
      subtitle="Central administrativa com contexto de plano, uso de IA e saúde de cada conta"
      headerControls={
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-[22rem]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98A2B3]" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou email" className="h-10 rounded-xl pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {typeFilters.map((filter) => (
              <FilterChip key={filter} active={typeFilter === filter} onClick={() => setTypeFilter(filter)}>
                {filter}
              </FilterChip>
            ))}
          </div>
        </div>
      }
    >
      {feedback ? <div className="mb-5 rounded-[1.1rem] border border-[#d7ebdd] bg-[#eef9f1] px-4 py-3 text-sm text-[#0f7a35]">{feedback}</div> : null}

      <div className="grid gap-5">
        <AdminMetricGrid>
          <AdminMetricCard label="Total de usuarios" value={String(insights?.users.total ?? users.length)} icon={<Users className="size-5" />} />
          <AdminMetricCard label="Novos em 7 dias" value={String(insights?.users.newLast7Days ?? 0)} icon={<Sparkles className="size-5" />} />
          <AdminMetricCard label="Ativos hoje" value={String(insights?.users.activeToday ?? users.filter((item) => item.status === "Ativo").length)} icon={<ShieldCheck className="size-5" />} />
          <AdminMetricCard label="Em avaliacao" value={String(insights?.users.trial ?? users.filter((item) => item.plan === "Sem plano").length)} icon={<Users className="size-5" />} />
        </AdminMetricGrid>

        <AdminSurface title="Filtros operacionais" subtitle="Refine por tipo, status, plano e texto para chegar rapidamente na conta certa.">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterGroup title="Status">
              {statusFilters.map((filter) => (
                <FilterChip key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
                  {filter}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup title="Plano">
              {planFilters.map((filter) => (
                <FilterChip key={filter} active={planFilter === filter} onClick={() => setPlanFilter(filter)}>
                  {filter}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup title="Periodo">
              <div className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#6B7280]">
                Novos usuários nos últimos 7 dias: <span className="font-semibold text-[#111827]">{insights?.users.newLast7Days ?? 0}</span>
              </div>
            </FilterGroup>
          </div>
        </AdminSurface>

        <AdminSurface title="Base de usuarios" subtitle="Dados de conta, plano e ações rápidas sem sair da listagem.">
          <AdminDataTable
            columns={["Nome", "Tipo", "Status", "Plano", "Email", "Criacao", "Acoes"]}
            rows={filteredUsers.map((user) => [
              <div key={`${user.id}-name`}>
                <p className="font-semibold text-[#111827]">{user.name}</p>
                <p className="mt-1 text-xs text-[#8B95A1]">{user.whatsApp}</p>
              </div>,
              <AdminBadge key={`${user.id}-type`}>{user.type}</AdminBadge>,
              <AdminBadge key={`${user.id}-status`} tone={user.status === "Ativo" ? "success" : "warning"}>
                {user.status}
              </AdminBadge>,
              <span key={`${user.id}-plan`} className="text-[#111827]">{user.plan}</span>,
              <span key={`${user.id}-mail`} className="text-[#111827]">{user.email}</span>,
              <span key={`${user.id}-created`}>{user.createdAt}</span>,
              <div key={`${user.id}-actions`} className="flex flex-wrap justify-end gap-2">
                <ActionButton label="Detalhes" onClick={() => setSelectedUser(user)} />
                <ActionButton label="Editar" onClick={() => setEditingUser(user)} />
                <ActionButton label={user.status === "Ativo" ? "Desativar" : "Ativar"} onClick={() => void handleToggleStatus(user)} />
                <ActionButton label="Excluir" tone="danger" onClick={() => void handleDelete(user)} />
              </div>,
            ])}
          />
        </AdminSurface>
      </div>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl border-black/[0.06] bg-white text-[#050505]">
          {selectedUser ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedUser.name}</DialogTitle>
                <DialogDescription className="text-[#6B7280]">
                  Visão completa de plano, uso de IA, última atividade e contexto comercial da conta.
                </DialogDescription>
              </DialogHeader>

              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Tipo", value: selectedUser.type },
                  { label: "Status", value: selectedUser.status },
                  { label: "Plano", value: selectedUser.plan },
                  { label: "Email", value: selectedUser.email },
                  { label: "WhatsApp", value: selectedUser.whatsApp },
                  { label: "Criacao", value: selectedUser.createdAt },
                  { label: "Creditos atuais", value: String(selectedInsight?.creditsBalance ?? 0) },
                  { label: "Consumo IA", value: String(selectedInsight?.creditsUsed ?? 0) },
                  { label: "Studio IA", value: `${selectedInsight?.studioActions ?? 0} ações` },
                  { label: "Imagens", value: String(selectedInsight?.imageGenerations ?? 0) },
                  { label: "Videos", value: String(selectedInsight?.videoGenerations ?? 0) },
                  { label: "COS", value: `${selectedInsight?.cosActions ?? 0} ações` },
                  { label: "Ultimo acesso", value: selectedInsight?.lastAccess ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(selectedInsight.lastAccess)) : "Sem atividade recente" },
                  { label: "Dispositivos", value: selectedInsight?.devicesLabel || "Sem telemetria" },
                  { label: "Historico", value: selectedInsight?.historyLabel || "Sem histórico adicional" },
                  { label: "Assinatura", value: selectedInsight?.subscriptionLabel || "Sem assinatura ativa" },
                  { label: "Financeiro", value: selectedInsight?.financeLabel || "Sem dados financeiros" },
                ]}
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <a href={`mailto:${selectedUser.email}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.06] bg-[#fbfbf8] px-4 text-sm text-[#4B5563] hover:bg-white hover:text-[#111827]">
                  <Mail className="size-4" />
                  Email
                </a>
                <a href={createWhatsAppUrl(selectedUser.whatsApp, `Olá, ${selectedUser.name}. Estamos revisando seu cadastro no Admin EME.`)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d7ebdd] bg-[#eef9f1] px-4 text-sm text-[#0f7a35] hover:bg-[#e6f6eb]">
                  <MessageCircleMore className="size-4" />
                  WhatsApp
                </a>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setEditingUser(selectedUser); setSelectedUser(null) }} className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#111827]">
                  Editar usuario
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <UserEditDialog user={editingUser} onOpenChange={(open) => !open && setEditingUser(null)} onSave={handleSave} />
    </AdminPageShell>
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
      <DialogContent className="max-w-xl border-black/[0.06] bg-white text-[#050505]">
        {draft ? (
          <>
            <DialogHeader>
              <DialogTitle>Editar usuario</DialogTitle>
              <DialogDescription className="text-[#6B7280]">Ajuste os dados principais sem sair da central de usuários.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
              <Field label="Email" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} />
              <Field label="WhatsApp" value={draft.whatsApp} onChange={(value) => setDraft({ ...draft, whatsApp: value })} />
              <Field label="Plano" value={draft.plan} onChange={(value) => setDraft({ ...draft, plan: value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#111827]">
                Cancelar
              </Button>
              <Button type="button" onClick={() => onSave(draft)} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
                Salvar alteracoes
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#98A2B3]">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-[#d7ebdd] bg-[#eef9f1] text-[#0f7a35]"
          : "border-black/[0.06] bg-white text-[#5F6B7A] hover:border-black/[0.12] hover:text-[#111827]"
      }`}
    >
      {children}
    </button>
  )
}

function ActionButton({
  label,
  onClick,
  tone = "default",
}: {
  label: string
  onClick: () => void
  tone?: "default" | "danger"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
        tone === "danger"
          ? "border-[#f3d4d4] bg-[#fff3f3] text-[#b42318] hover:bg-[#fee9e9]"
          : "border-black/[0.06] bg-white text-[#4B5563] hover:border-black/[0.12] hover:text-[#111827]"
      }`}
    >
      {label}
    </button>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-[#4B5563]">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl" />
    </div>
  )
}
