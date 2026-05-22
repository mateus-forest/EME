"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Building2, ChartColumn, CircleDollarSign, Home, MapPin, Percent, SlidersHorizontal } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COMMISSION_RATE = 0.06
const statusFilters = ["Todos", "Publicado", "Rascunho"] as const
const viewModes = ["Geral", "Por imóvel"] as const
const calculationTypes = ["Todos os imóveis", "Apenas com valor"] as const

function formatBRLFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100)
}

function countBy(items: string[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item.trim() || "Não informado"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function topEntries(entries: Record<string, number>) {
  return Object.entries(entries).sort((first, second) => second[1] - first[1]).slice(0, 5)
}

export function BrokerFinancialPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [commissionPercent, setCommissionPercent] = useState(6)
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [typeFilter, setTypeFilter] = useState("Todos")
  const [calculationType, setCalculationType] = useState<(typeof calculationTypes)[number]>("Todos os imóveis")
  const [viewMode, setViewMode] = useState<(typeof viewModes)[number]>("Geral")
  const [configFeedback, setConfigFeedback] = useState("")
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const propertyTypes = useMemo(() => ["Todos", ...Array.from(new Set(properties.map((property) => property.type)))], [properties])
  const filteredProperties = properties.filter((property) => {
    const matchesStatus = statusFilter === "Todos" || property.status === statusFilter
    const matchesType = typeFilter === "Todos" || property.type === typeFilter
    const matchesCalculation = calculationType === "Todos os imóveis" || property.priceValue > 0

    return matchesStatus && matchesType && matchesCalculation
  })
  const commissionRate = Math.max(0, commissionPercent) / 100
  const totalProperties = filteredProperties.length
  const activeProperties = filteredProperties.filter((property) => property.status === "Publicado").length
  const draftProperties = filteredProperties.filter((property) => property.status !== "Publicado").length
  const propertyValues = filteredProperties.map((property) => Math.max(0, property.priceValue || 0))
  const pricedValues = propertyValues.filter((value) => value > 0)
  const totalPortfolioValue = propertyValues.reduce((sum, value) => sum + value, 0)
  const averageTicket = totalProperties > 0 ? Math.round(totalPortfolioValue / totalProperties) : 0
  const commissions = pricedValues.map((value) => Math.round(value * commissionRate))
  const totalPotentialCommission = Math.round(totalPortfolioValue * commissionRate)
  const averageCommission = totalProperties > 0 ? Math.round(totalPotentialCommission / totalProperties) : 0
  const highestCommission = commissions.length > 0 ? Math.max(...commissions) : 0
  const lowestCommission = commissions.length > 0 ? Math.min(...commissions) : 0
  const propertiesByType = topEntries(countBy(filteredProperties.map((property) => property.type)))
  const propertiesByCity = topEntries(countBy(filteredProperties.map((property) => property.city)))
  const hasProperties = properties.length > 0

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/financial", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { config?: { commissionPercent: number; calculationType: string; statusFilter: string; typeFilter: string; viewMode: string } }
          | null
        if (!response.ok || !data?.config || ignore) return
        setCommissionPercent(data.config.commissionPercent)
        if (calculationTypes.includes(data.config.calculationType as (typeof calculationTypes)[number])) {
          setCalculationType(data.config.calculationType as (typeof calculationTypes)[number])
        }
        if (statusFilters.includes(data.config.statusFilter as (typeof statusFilters)[number])) {
          setStatusFilter(data.config.statusFilter as (typeof statusFilters)[number])
        }
        setTypeFilter(data.config.typeFilter || "Todos")
        if (viewModes.includes(data.config.viewMode as (typeof viewModes)[number])) {
          setViewMode(data.config.viewMode as (typeof viewModes)[number])
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  async function saveFinancialConfig() {
    setIsSavingConfig(true)
    setConfigFeedback("")

    try {
      const response = await fetch("/api/brokers/financial", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          commissionPercent,
          calculationType,
          statusFilter,
          typeFilter,
          viewMode,
        }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar a configuração.")
      setConfigFeedback("Configuração financeira salva.")
    } catch (caughtError) {
      setConfigFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a configuração.")
    } finally {
      setIsSavingConfig(false)
    }
  }

  return (
    <BrokerPageShell title="Financeiro">
      <div className="grid gap-5">
        {!hasProperties && !isLoading ? (
          <section className="rounded-[1.75rem] border border-[#00C853]/20 bg-[#00C853]/10 p-6 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
              <CircleDollarSign className="size-6" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-white">Sua carteira ainda está vazia</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/60">
              Cadastre seus imóveis para acompanhar valor de carteira, comissão potencial, ticket médio e histórico financeiro sem dados artificiais.
            </p>
            <Button asChild className="mt-6 h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
              <Link href="/corretor/novo-imovel">Cadastrar imóvel</Link>
            </Button>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Building2} label="Imóveis cadastrados" value={String(totalProperties)} />
          <MetricCard icon={CircleDollarSign} label="Valor da carteira" value={formatBRLFromCents(totalPortfolioValue)} />
          <MetricCard icon={ChartColumn} label="Ticket médio" value={formatBRLFromCents(averageTicket)} />
          <MetricCard icon={Home} label="Imóveis ativos" value={String(activeProperties)} />
          <MetricCard icon={ArrowUpRight} label="Inativos/rascunhos" value={String(draftProperties)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <Percent className="size-5 text-[#69F0AE]" />
                Comissões estimadas
              </CardTitle>
              <p className="text-sm text-white/50">Cálculo estimado com a taxa configurada sobre a base filtrada.</p>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0 md:grid-cols-2">
              <InfoBlock label="Comissão potencial total" value={formatBRLFromCents(totalPotentialCommission)} />
              <InfoBlock label="Comissão média por imóvel" value={formatBRLFromCents(averageCommission)} />
              <InfoBlock label="Maior comissão potencial" value={formatBRLFromCents(highestCommission)} />
              <InfoBlock label="Menor comissão potencial" value={formatBRLFromCents(lowestCommission)} />
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <SlidersHorizontal className="size-5 text-[#69F0AE]" />
                Filtros e base
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Imóveis com valor informado" value={`${pricedValues.length} de ${totalProperties}`} />
              <label className="grid gap-2 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <span className="text-sm text-white/50">Percentual de comissão</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={commissionPercent}
                  onChange={(event) => setCommissionPercent(Number(event.target.value) || 0)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#00C853]/35"
                />
              </label>
              <SelectBlock label="Tipo de cálculo" value={calculationType} onChange={(value) => setCalculationType(value as (typeof calculationTypes)[number])} options={calculationTypes} />
              <SelectBlock label="Filtro por status" value={statusFilter} onChange={(value) => setStatusFilter(value as (typeof statusFilters)[number])} options={statusFilters} />
              <SelectBlock label="Filtro por tipo" value={typeFilter} onChange={setTypeFilter} options={propertyTypes} />
              <SelectBlock label="Visualização" value={viewMode} onChange={(value) => setViewMode(value as (typeof viewModes)[number])} options={viewModes} />
              <Button type="button" onClick={saveFinancialConfig} disabled={isSavingConfig} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30 disabled:opacity-60">
                {isSavingConfig ? "Salvando..." : "Salvar configuração"}
              </Button>
              {configFeedback ? <p className="text-sm text-[#69F0AE]">{configFeedback}</p> : null}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <BreakdownCard icon={Home} title="Imóveis por tipo" entries={propertiesByType} />
          <BreakdownCard icon={MapPin} title="Imóveis por cidade" entries={propertiesByCity} />
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">{viewMode === "Por imóvel" ? "Comissão por imóvel" : "Histórico financeiro"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {filteredProperties.length > 0 ? (
              viewMode === "Por imóvel" ? (
                <div className="overflow-hidden rounded-[1.25rem] border border-white/[0.08]">
                  <div className="grid gap-3 border-b border-white/[0.08] bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/40 md:grid-cols-[minmax(0,1fr)_140px_120px_150px_110px]">
                    <span>Imóvel</span>
                    <span>Valor</span>
                    <span>Percentual</span>
                    <span>Comissão</span>
                    <span>Status</span>
                  </div>
                  {filteredProperties.map((property) => (
                    <div key={property.id} className="grid gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_140px_120px_150px_110px] md:items-center">
                      <p className="truncate font-medium text-white">{property.title}</p>
                      <span className="text-white/60">{property.priceValue > 0 ? property.price : "Sem valor"}</span>
                      <span className="text-white/60">{commissionPercent.toLocaleString("pt-BR")}%</span>
                      <span className="font-semibold text-[#69F0AE]">{formatBRLFromCents(Math.round((property.priceValue || 0) * commissionRate))}</span>
                      <span className="text-white/60">{property.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                filteredProperties.slice(0, 5).map((property) => (
                  <div key={property.id} className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                    <p className="truncate text-sm font-medium text-white">{property.title}</p>
                    <span className="text-sm text-white/60">{property.price}</span>
                    <span className="text-sm text-[#69F0AE]">{formatBRLFromCents(Math.round((property.priceValue || 0) * commissionRate))}</span>
                  </div>
                ))
              )
            ) : (
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">
                Nenhum imóvel cadastrado para compor histórico.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BrokerPageShell>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="p-5">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-4.5" />
        </div>
        <p className="mt-4 text-sm text-white/50">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

function SelectBlock({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
}) {
  return (
    <label className="grid gap-2 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <span className="text-sm text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#00C853]/35"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#111]">
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function BreakdownCard({ icon: Icon, title, entries }: { icon: typeof Home; title: string; entries: [string, number][] }) {
  return (
    <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardHeader className="px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-xl text-white">
          <Icon className="size-5 text-[#69F0AE]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-6 pt-0">
        {entries.length > 0 ? entries.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="text-sm text-white/65">{label}</span>
            <span className="text-sm font-semibold text-white">{count}</span>
          </div>
        )) : (
          <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Nenhum dado disponível.</p>
        )}
      </CardContent>
    </Card>
  )
}
