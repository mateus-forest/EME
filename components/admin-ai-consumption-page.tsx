"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, CreditCard, History, Search, Sparkles, UserRound } from "lucide-react"

import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminBrokers, type AdminBrokerRecord } from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const ESTIMATED_COST_PER_CREDIT = 0.08
const BONUS_REASON_OPTIONS = [
  "Bonificacao comercial",
  "Campanha promocional",
  "Suporte operacional",
  "Recuperacao de experiencia",
  "Teste acompanhado",
  "Outro",
] as const

type BonusHistoryItem = {
  id: string
  brokerId: string
  userId: string
  userName: string
  userEmail: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  reason: string
  adminUserId: string
  adminName: string
  createdAt: string
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
}

export function AdminAiConsumptionPage() {
  const [brokers, setBrokers] = useAdminBrokers()
  const [brokerSearch, setBrokerSearch] = useState("")
  const [historySearch, setHistorySearch] = useState("")
  const [selectedBrokerId, setSelectedBrokerId] = useState("")
  const [creditAmount, setCreditAmount] = useState("10")
  const [reasonPreset, setReasonPreset] = useState<(typeof BONUS_REASON_OPTIONS)[number]>("Bonificacao comercial")
  const [customReason, setCustomReason] = useState("")
  const [history, setHistory] = useState<BonusHistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const summary = useMemo(
    () => ({
      balance: brokers.reduce((sum, broker) => sum + broker.aiCreditsBalance, 0),
      used: brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0),
      estimatedCost: brokers.reduce((sum, broker) => sum + broker.aiCreditsUsedThisMonth, 0) * ESTIMATED_COST_PER_CREDIT,
      users: brokers.filter((broker) => broker.aiCreditsUsedThisMonth > 0 || broker.aiCreditsBalance > 0).length,
    }),
    [brokers],
  )

  const filteredBrokers = useMemo(() => {
    const normalized = brokerSearch.trim().toLowerCase()
    if (!normalized) return brokers
    return brokers.filter((broker) =>
      [broker.id, broker.name, broker.email].some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [brokerSearch, brokers])

  const selectedBroker =
    filteredBrokers.find((broker) => broker.id === selectedBrokerId) ??
    brokers.find((broker) => broker.id === selectedBrokerId) ??
    filteredBrokers[0] ??
    brokers[0] ??
    null

  const normalizedHistorySearch = historySearch.trim().toLowerCase()
  const filteredHistory = useMemo(() => {
    if (!normalizedHistorySearch) return history
    return history.filter((item) =>
      [item.id, item.brokerId, item.userName, item.userEmail, item.reason, item.adminName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedHistorySearch)),
    )
  }, [history, normalizedHistorySearch])

  const resolvedReason =
    reasonPreset === "Outro" ? customReason.trim() : reasonPreset

  const numericAmount = Math.trunc(Number(creditAmount))
  const canSubmit = Boolean(selectedBroker && Number.isFinite(numericAmount) && numericAmount > 0 && resolvedReason)

  const loadHistory = useCallback(async (searchValue?: string) => {
    setIsLoadingHistory(true)

    try {
      const params = new URLSearchParams()
      const normalized = (searchValue ?? historySearch).trim()
      if (normalized) params.set("q", normalized)

      const response = await fetch(`/api/admin/credits/bonuses${params.toString() ? `?${params.toString()}` : ""}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { bonuses?: BonusHistoryItem[]; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar o historico.")
      setHistory(data?.bonuses ?? [])
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar o historico.")
    } finally {
      setIsLoadingHistory(false)
    }
  }, [historySearch])

  useEffect(() => {
    if (!selectedBrokerId && filteredBrokers[0]) {
      setSelectedBrokerId(filteredBrokers[0].id)
    }
  }, [filteredBrokers, selectedBrokerId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  async function applyBonus() {
    if (!selectedBroker || !canSubmit) return

    setIsSubmitting(true)
    setFeedback("")

    try {
      const response = await fetch(`/api/admin/brokers/${selectedBroker.id}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ amount: numericAmount, reason: resolvedReason }),
      })

      const data = (await response.json().catch(() => null)) as
        | { error?: string; broker?: { id: string; aiCreditsBalance: number; aiCreditsUsedThisMonth: number } }
        | null

      if (!response.ok || !data?.broker) {
        throw new Error(data?.error || "Nao foi possivel bonificar creditos.")
      }

      setBrokers((current) =>
        current.map((item) =>
          item.id === data.broker?.id
            ? {
                ...item,
                aiCreditsBalance: data.broker.aiCreditsBalance,
                aiCreditsUsedThisMonth: data.broker.aiCreditsUsedThisMonth,
              }
            : item,
        ),
      )

      await loadHistory()
      setFeedback("Bonificacao aplicada com sucesso.")
      setIsConfirmOpen(false)
      setCreditAmount("10")
      setReasonPreset("Bonificacao comercial")
      setCustomReason("")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel bonificar creditos.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminPageShell title="Consumo IA" subtitle="Bonificacoes, saldos e historico operacional de creditos">
      <div className="grid gap-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Creditos usados no mes" value={String(summary.used)} icon={Sparkles} />
          <Metric label="Creditos disponiveis" value={String(summary.balance)} icon={CreditCard} />
          <Metric label="Usuarios com saldo ou uso" value={String(summary.users)} icon={UserRound} />
          <Metric label="Custo estimado" value={formatBRL(summary.estimatedCost)} icon={Bot} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Bonificar creditos IA</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Busque um usuario, valide o saldo atual e aplique a bonificacao diretamente na carteira real.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 px-6 pb-6 pt-0">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#4B5563]">Buscar usuario</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98A2B3]" />
                  <Input
                    value={brokerSearch}
                    onChange={(event) => setBrokerSearch(event.target.value)}
                    placeholder="Nome, email ou ID"
                    className="h-11 rounded-xl pl-10"
                  />
                </div>
              </label>

              <div className="grid gap-3">
                {filteredBrokers.length > 0 ? (
                  filteredBrokers.slice(0, 8).map((broker) => {
                    const isActive = broker.id === selectedBroker?.id
                    return (
                      <button
                        key={broker.id}
                        type="button"
                        onClick={() => setSelectedBrokerId(broker.id)}
                        className={`rounded-[1.25rem] border p-4 text-left transition-colors ${
                          isActive
                            ? "border-[#009b3a]/22 bg-[#eef9f1]"
                            : "border-black/[0.06] bg-[#fbfbf8] hover:bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#050505]">{broker.name}</p>
                            <p className="mt-1 text-sm text-[#6B7280]">{broker.email}</p>
                          </div>
                          <span className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs text-[#4B5563]">
                            {broker.plan}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#5F6B7A]">
                          <InfoBadge label={`ID ${broker.id}`} />
                          <InfoBadge label={`${broker.aiCreditsBalance} creditos`} />
                          <InfoBadge label={`${broker.aiCreditsUsedThisMonth} usados no mes`} />
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-4 py-5 text-sm text-[#6B7280]">
                    Nenhum usuario encontrado para esta busca.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Aplicar bonificacao</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 px-6 pb-6 pt-0">
              {selectedBroker ? (
                <>
                  <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">{selectedBroker.name}</p>
                    <p className="mt-1 text-sm text-[#6B7280]">{selectedBroker.email}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <InfoBlock label="Plano" value={selectedBroker.plan} />
                      <InfoBlock label="Saldo atual" value={`${selectedBroker.aiCreditsBalance} creditos`} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-[#4B5563]">Quantidade</span>
                      <Input
                        type="number"
                        min={1}
                        value={creditAmount}
                        onChange={(event) => setCreditAmount(event.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-[#4B5563]">Motivo</span>
                      <Select value={reasonPreset} onValueChange={(value) => setReasonPreset(value as (typeof BONUS_REASON_OPTIONS)[number])}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BONUS_REASON_OPTIONS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>

                  {reasonPreset === "Outro" ? (
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-[#4B5563]">Descreva o motivo</span>
                      <Textarea
                        value={customReason}
                        onChange={(event) => setCustomReason(event.target.value)}
                        maxLength={180}
                        className="min-h-24 rounded-[1.25rem]"
                        placeholder="Explique a bonificacao aplicada."
                      />
                    </label>
                  ) : null}

                  <div className="rounded-[1.25rem] border border-[#dce9df] bg-[#f7fbf8] p-4 text-sm leading-6 text-[#4B5563]">
                    A operacao registra usuario, administrador responsavel, saldo anterior, saldo posterior, motivo e data da bonificacao.
                  </div>

                  <Button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => setIsConfirmOpen(true)}
                    className="h-11 rounded-xl bg-[#009b3a] text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
                  >
                    Confirmar bonificacao
                  </Button>
                </>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] px-4 py-5 text-sm text-[#6B7280]">
                  Selecione um usuario para visualizar plano, saldo atual e aplicar a bonificacao.
                </div>
              )}

              {feedback ? (
                <div className="rounded-[1rem] border border-[#dce9df] bg-[#eef9f1] px-4 py-3 text-sm text-[#0f7a35]">
                  {feedback}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardHeader className="px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-xl text-[#050505]">Historico de bonificacoes</CardTitle>
                <p className="text-sm leading-6 text-[#6B7280]">
                  Consulte as ultimas bonificacoes aplicadas e filtre por usuario, email, ID, motivo ou administrador.
                </p>
              </div>
              <div className="flex w-full max-w-sm gap-2">
                <Input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Buscar no historico"
                  className="h-11 rounded-xl"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void loadHistory(historySearch)}
                  className="h-11 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  Buscar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 px-6 pb-6 pt-0">
            {isLoadingHistory ? (
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-5 text-sm text-[#6B7280]">
                Carregando historico...
              </div>
            ) : filteredHistory.length > 0 ? (
              filteredHistory.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-[#050505]">{item.userName}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">{item.userEmail}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <InfoBadge label={`+${item.amount} creditos`} />
                      <InfoBadge label={`Antes ${item.balanceBefore}`} />
                      <InfoBadge label={`Depois ${item.balanceAfter}`} />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[#4B5563]">
                    <p><span className="font-medium text-[#111111]">Motivo:</span> {item.reason}</p>
                    <p><span className="font-medium text-[#111111]">Administrador:</span> {item.adminName || item.adminUserId}</p>
                    <p><span className="font-medium text-[#111111]">Data:</span> {formatDateTime(item.createdAt)}</p>
                    <p><span className="font-medium text-[#111111]">Broker ID:</span> {item.brokerId}</p>
                  </div>
                </div>
              ))
            ) : (
              <AdminEmptyState
                icon={History}
                title="Nenhuma bonificacao encontrada"
                description="As bonificacoes aplicadas pelo portal master aparecerao aqui com usuario, motivo, administrador e saldos."
              >
                <AdminStructureCards items={["Saldo anterior e posterior", "Administrador responsavel", "Motivo e data da bonificacao"]} />
              </AdminEmptyState>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-lg border-black/[0.06] bg-white text-[#050505]">
          <DialogHeader>
            <DialogTitle>Confirmar bonificacao</DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Confira os dados antes de aplicar os creditos na carteira real do usuario.
            </DialogDescription>
          </DialogHeader>

          {selectedBroker ? (
            <div className="grid gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
              <InfoBlock label="Usuario" value={selectedBroker.name} />
              <InfoBlock label="Plano" value={selectedBroker.plan} />
              <InfoBlock label="Saldo atual" value={`${selectedBroker.aiCreditsBalance} creditos`} />
              <InfoBlock label="Bonificacao" value={`+${numericAmount} creditos`} />
              <InfoBlock label="Motivo" value={resolvedReason || "-"} />
            </div>
          ) : null}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmOpen(false)}
              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || !canSubmit}
              onClick={() => void applyBonus()}
              className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60"
            >
              {isSubmitting ? "Aplicando..." : "Aplicar bonificacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Bot }) {
  return (
    <Card className="rounded-[1.5rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-[#6B7280]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[#050505]">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function InfoBadge({ label }: { label: string }) {
  return <span className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-[#5F6B7A]">{label}</span>
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[#98A2B3]">{label}</p>
      <p className="mt-2 text-sm text-[#111111]">{value}</p>
    </div>
  )
}
