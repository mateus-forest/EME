"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Building2, ChartColumn, CircleDollarSign, Home, MapPin, Percent, SlidersHorizontal } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StructuredInput } from "@/components/ui/structured-input"
import { formatCurrencyBRLFromCents } from "@/lib/structured-fields"

const COMMISSION_RATE = 0.06
const statusFilters = ["Todos", "Publicado", "Rascunho"] as const
const viewModes = ["Geral", "Por imóvel"] as const
const calculationTypes = ["Todos os imóveis", "Apenas com valor"] as const

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
  const [purposeFilter, setPurposeFilter] = useState("Todos")
  const [calculationType, setCalculationType] = useState<(typeof calculationTypes)[number]>("Todos os imóveis")
  const [viewMode, setViewMode] = useState<(typeof viewModes)[number]>("Geral")
  const [configFeedback, setConfigFeedback] = useState("")
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const propertyTypes = useMemo(() => ["Todos", ...Array.from(new Set(properties.map((property) => property.type)))], [properties])
  const filteredProperties = properties.filter((property) => {
    const matchesStatus = statusFilter === "Todos" || property.status === statusFilter
    const matchesType = typeFilter === "Todos" || property.type === typeFilter
    const matchesPurpose = purposeFilter === "Todos" || property.purpose === purposeFilter
    const matchesCalculation = calculationType === "Todos os imóveis" || property.priceValue > 0

    return matchesStatus && matchesType && matchesPurpose && matchesCalculation
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
          <section className="rounded-[1.75rem] border border-[#009b3a]/20 bg-[#009b3a]/10 p-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
              <CircleDollarSign className="size-6" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-[#050505]">Sua carteira ainda está vazia</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#5F6B7A]">
              Cadastre seus imóveis para acompanhar valor de carteira, comissão potencial, ticket médio e histórico financeiro sem dados artificiais.
            </p>
            <Button asChild className="mt-6 h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
              <Link href="/corretor/novo-imovel">Cadastrar imóvel</Link>
            </Button>
          </section>
        ) : null}

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => <MetricSkeleton key={index} />)
          ) : (
            <>
              <MetricCard icon={Building2} label="Imóveis cadastrados" value={String(totalProperties)} />
              <MetricCard icon={CircleDollarSign} label="Valor da carteira" value={formatCurrencyBRLFromCents(totalPortfolioValue)} />
              <MetricCard icon={ChartColumn} label="Ticket médio" value={formatCurrencyBRLFromCents(averageTicket)} />
              <MetricCard icon={Home} label="Imóveis ativos" value={String(activeProperties)} />
              <MetricCard icon={ArrowUpRight} label="Inativos/rascunhos" value={String(draftProperties)} />
            </>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ResponsiveCollapsibleSection title="Comissão estimada" defaultMobileOpen>
          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <Percent className="size-5 text-[#009b3a]" />
                Comissões estimadas
              </CardTitle>
              <p className="text-sm text-[#6B7280]">Cálculo estimado com a taxa configurada sobre a base filtrada.</p>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 p-4 pt-0 sm:p-6 sm:pt-0 md:grid-cols-2">
              <InfoBlock label="Comissão potencial total" value={formatCurrencyBRLFromCents(totalPotentialCommission)} />
              <InfoBlock label="Comissão média por imóvel" value={formatCurrencyBRLFromCents(averageCommission)} />
              <InfoBlock label="Maior comissão potencial" value={formatCurrencyBRLFromCents(highestCommission)} />
              <InfoBlock label="Menor comissão potencial" value={formatCurrencyBRLFromCents(lowestCommission)} />
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Filtros e base">
          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <SlidersHorizontal className="size-5 text-[#009b3a]" />
                Filtros e base
              </CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
              <InfoBlock label="Imóveis com valor informado" value={`${pricedValues.length} de ${totalProperties}`} />
              <label className="grid gap-2 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <span className="text-sm text-[#6B7280]">Percentual de comissão</span>
                <StructuredInput
                  kind="percent"
                  value={commissionPercent}
                  onValueChange={(_, normalized) => setCommissionPercent(typeof normalized === "number" ? normalized : 0)}
                  aria-label="Percentual de comissão"
                  className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-sm font-semibold text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/35"
                />
              </label>
              <SelectBlock label="Tipo de cálculo" value={calculationType} onChange={(value) => setCalculationType(value as (typeof calculationTypes)[number])} options={calculationTypes} />
              <SelectBlock label="Filtro por status" value={statusFilter} onChange={(value) => setStatusFilter(value as (typeof statusFilters)[number])} options={statusFilters} />
              <SelectBlock label="Filtro por tipo" value={typeFilter} onChange={setTypeFilter} options={propertyTypes} />
              <SelectBlock label="Filtro por finalidade" value={purposeFilter} onChange={setPurposeFilter} options={["Todos", "Venda", "Locação"]} />
              <SelectBlock label="Visualização" value={viewMode} onChange={(value) => setViewMode(value as (typeof viewModes)[number])} options={viewModes} />
              <Button type="button" onClick={saveFinancialConfig} disabled={isSavingConfig} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:opacity-60">
                {isSavingConfig ? "Salvando..." : "Salvar configuração"}
              </Button>
              {configFeedback ? <p className="text-sm text-[#009b3a]">{configFeedback}</p> : null}
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ResponsiveCollapsibleSection title="Imóveis por tipo">
            <BreakdownCard icon={Home} title="Imóveis por tipo" entries={propertiesByType} />
          </ResponsiveCollapsibleSection>
          <ResponsiveCollapsibleSection title="Imóveis por cidade">
            <BreakdownCard icon={MapPin} title="Imóveis por cidade" entries={propertiesByCity} />
          </ResponsiveCollapsibleSection>
        </section>

        <ResponsiveCollapsibleSection title={viewMode === "Por imóvel" ? "Comissão por imóvel" : "Histórico financeiro"}>
        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-[#050505]">{viewMode === "Por imóvel" ? "Comissão por imóvel" : "Histórico financeiro"}</CardTitle>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {filteredProperties.length > 0 ? (
              viewMode === "Por imóvel" ? (
                <div className="overflow-x-auto rounded-[1.25rem] border border-black/[0.06]">
                  <div className="hidden min-w-[680px] gap-3 border-b border-black/[0.06] bg-white/80 px-4 py-3 text-xs uppercase tracking-[0.16em] text-[#7B8491] md:grid md:grid-cols-[minmax(0,1fr)_140px_120px_150px_110px]">
                    <span>Imóvel</span>
                    <span>Valor</span>
                    <span>Percentual</span>
                    <span>Comissão</span>
                    <span>Status</span>
                  </div>
                  {filteredProperties.map((property) => (
                    <div key={property.id} className="grid min-w-0 gap-2 border-b border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm last:border-b-0 md:min-w-[680px] md:grid-cols-[minmax(0,1fr)_140px_120px_150px_110px] md:items-center">
                      <p className="truncate font-medium text-[#050505]">{property.title}</p>
                      <span className="break-words text-[#5F6B7A]">{property.priceValue > 0 ? property.price : "Sem valor"}</span>
                      <span className="text-[#5F6B7A]">{commissionPercent.toLocaleString("pt-BR")}%</span>
                      <span className="break-words font-semibold text-[#009b3a]">{formatCurrencyBRLFromCents(Math.round((property.priceValue || 0) * commissionRate))}</span>
                      <span className="text-[#5F6B7A]">{property.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                filteredProperties.slice(0, 5).map((property) => (
                  <div key={property.id} className="grid min-w-0 gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                    <p className="truncate text-sm font-medium text-[#050505]">{property.title}</p>
                    <span className="break-words text-sm text-[#5F6B7A]">{property.price}</span>
                    <span className="break-words text-sm text-[#009b3a]">{formatCurrencyBRLFromCents(Math.round((property.priceValue || 0) * commissionRate))}</span>
                  </div>
                ))
              )
            ) : (
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">
                Nenhum imóvel cadastrado para compor histórico.
              </div>
            )}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>
      </div>
    </BrokerPageShell>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card className="min-w-0 rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <CardContent className="min-w-0 p-4 sm:p-5">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
          <Icon className="size-4.5" />
        </div>
        <p className="mt-4 text-sm text-[#6B7280]">{label}</p>
        <p className="mt-2 min-w-0 break-words text-xl font-semibold leading-tight text-[#050505] sm:text-2xl">{value}</p>
      </CardContent>
    </Card>
  )
}

function MetricSkeleton() {
  return (
    <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-[#fbfbf8] py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <CardContent className="p-5">
        <div className="eme-shimmer size-10 rounded-2xl bg-white" />
        <div className="eme-shimmer mt-4 h-3 w-2/3 rounded-full bg-[#f6f7f4]" />
        <div className="eme-shimmer mt-3 h-6 w-1/2 rounded-full bg-white" />
      </CardContent>
    </Card>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <p className="mt-2 break-words text-base font-semibold leading-tight text-[#050505]">{value}</p>
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
    <label className="grid gap-2 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-sm font-semibold text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/35"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-white">
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function BreakdownCard({ icon: Icon, title, entries }: { icon: typeof Home; title: string; entries: [string, number][] }) {
  return (
    <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <CardHeader className="px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
          <Icon className="size-5 text-[#009b3a]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-6 pt-0">
        {entries.length > 0 ? entries.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
            <span className="text-sm text-[#5F6B7A]">{label}</span>
            <span className="text-sm font-semibold text-[#050505]">{count}</span>
          </div>
        )) : (
          <p className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">Nenhum dado disponível.</p>
        )}
      </CardContent>
    </Card>
  )
}
