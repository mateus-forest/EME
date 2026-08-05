"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Gift, History, PlusCircle, Sparkles, Warehouse } from "lucide-react"

import {
  AdminActivityFeed,
  AdminDefinitionGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { useAdminUsers } from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmeLoading } from "@/components/ui/eme-loading"

type BonusType = "credit" | "property"

const bonusTypeOptions: Array<{ value: BonusType; label: string }> = [
  { value: "credit", label: "Créditos IA" },
  { value: "property", label: "Expansão da carteira" },
]

export function AdminBonusesPage() {
  const { insights, isLoading, error, refresh } = useAdminInsights()
  const [users] = useAdminUsers()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [form, setForm] = useState({
    userId: "",
    bonusType: "credit" as BonusType,
    quantity: "",
    reason: "",
  })

  const eligibleUsers = useMemo(
    () => users.filter((user) => user.type === "Corretor").sort((first, second) => first.name.localeCompare(second.name)),
    [users],
  )

  async function handleSubmit() {
    setSubmitting(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/admin/credits/bonuses", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: form.userId,
          bonusType: form.bonusType,
          quantity: Number(form.quantity),
          reason: form.reason,
        }),
      })

      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível aplicar a bonificação.")
      }

      await refresh()
      setOpen(false)
      setForm({
        userId: "",
        bonusType: "credit",
        quantity: "",
        reason: "",
      })
      setFeedback("Bonificação aplicada com sucesso.")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível aplicar a bonificação.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminPageShell
      title="Bonificações"
      subtitle="Aplique Créditos IA ou Expansão da Carteira com registro imediato no histórico"
      primaryActionLabel="Nova Bonificação"
      primaryActionOnClick={() => setOpen(true)}
    >
      {isLoading && !insights ? <EmeLoading message="Carregando bonificações..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}
      {feedback ? <div className="mb-5 rounded-[1.1rem] border border-[#d7ebdd] bg-[#eef9f1] px-4 py-3 text-sm text-[#0f7a35]">{feedback}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Bonificações totais" value={String(insights.bonuses.totalBonuses)} icon={<Gift className="size-5" />} />
            <AdminMetricCard label="Últimos 30 dias" value={String(insights.bonuses.last30Days)} icon={<History className="size-5" />} />
            <AdminMetricCard label="Créditos IA" value={String(insights.bonuses.manual)} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Base elegível" value={String(eligibleUsers.length)} icon={<Warehouse className="size-5" />} />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Fluxo de bonificação" subtitle="Tudo integrado à camada nova de planos, créditos e expansão da carteira.">
              <AdminDefinitionGrid
                columns={2}
                items={[
                  { label: "Selecionar usuário", value: "Escolha uma conta real da base ativa." },
                  { label: "Selecionar tipo", value: "Créditos IA ou Expansão da Carteira." },
                  { label: "Definir quantidade", value: "Ajuste o volume aplicado imediatamente." },
                  { label: "Registrar motivo", value: "Toda concessão fica salva com contexto administrativo." },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Resumo operacional" subtitle="Visão rápida do que já foi concedido na arquitetura atual.">
              <AdminDefinitionGrid
                items={[
                  { label: "Histórico", value: `${insights.bonuses.totalBonuses} registros` },
                  { label: "Promocionais", value: String(insights.bonuses.campaigns) },
                  { label: "Indicações", value: String(insights.bonuses.indications) },
                  { label: "Assinaturas", value: String(insights.bonuses.subscriptions) },
                ]}
              />
            </AdminSurface>
          </section>

          <AdminSurface title="Histórico recente" subtitle="Últimas bonificações registradas com dados persistidos no sistema.">
            <AdminActivityFeed items={insights.bonuses.history} />
          </AdminSurface>

          <AdminMetricGrid>
            <AdminMetricCard label="Promoções" value={`${insights.bonuses.campaigns}`} icon={<Gift className="size-5" />} tone="success" />
            <AdminMetricCard label="Assinatura" value={`${insights.bonuses.subscriptions}`} icon={<PlusCircle className="size-5" />} />
            <AdminMetricCard label="Manuais" value={`${insights.bonuses.manual}`} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Histórico" value={`${insights.bonuses.totalBonuses}`} icon={<History className="size-5" />} />
          </AdminMetricGrid>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl border-black/[0.06] bg-white text-[#050505]">
          <DialogHeader>
            <DialogTitle>Nova Bonificação</DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              A bonificação é aplicada imediatamente e registrada no histórico administrativo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Usuário">
              <select
                value={form.userId}
                onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#009b3a]/20"
              >
                <option value="">Selecione um usuário</option>
                {eligibleUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.plan}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipo">
              <div className="grid gap-2 sm:grid-cols-2">
                {bonusTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, bonusType: option.value }))}
                    className={`rounded-[1rem] border px-4 py-3 text-sm text-left transition-colors ${
                      form.bonusType === option.value
                        ? "border-[#d7ebdd] bg-[#eef9f1] text-[#0f7a35]"
                        : "border-black/[0.06] bg-white text-[#4B5563] hover:border-black/[0.12] hover:text-[#111827]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Quantidade">
              <Input
                value={form.quantity}
                onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                placeholder={form.bonusType === "credit" ? "Ex.: 250" : "Ex.: 500"}
                className="h-11 rounded-xl"
                inputMode="numeric"
              />
            </Field>

            <Field label="Motivo">
              <textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Descreva por que esta bonificação está sendo aplicada."
                className="min-h-[112px] rounded-xl border border-black/[0.08] bg-white px-3 py-3 text-sm text-[#111827] outline-none focus:ring-2 focus:ring-[#009b3a]/20"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#111827]">
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]">
              {submitting ? "Aplicando..." : "Confirmar bonificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-[#4B5563]">{label}</Label>
      {children}
    </div>
  )
}
