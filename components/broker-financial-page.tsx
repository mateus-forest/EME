"use client"

import Link from "next/link"
import { ArrowUpRight, Building2, ChartColumn, CircleDollarSign, Home, MapPin, Percent, SlidersHorizontal } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COMMISSION_RATE = 0.06

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
  const totalProperties = properties.length
  const activeProperties = properties.filter((property) => property.status === "Publicado").length
  const draftProperties = properties.filter((property) => property.status !== "Publicado").length
  const propertyValues = properties.map((property) => Math.max(0, property.priceValue || 0))
  const pricedValues = propertyValues.filter((value) => value > 0)
  const totalPortfolioValue = propertyValues.reduce((sum, value) => sum + value, 0)
  const averageTicket = totalProperties > 0 ? Math.round(totalPortfolioValue / totalProperties) : 0
  const commissions = pricedValues.map((value) => Math.round(value * COMMISSION_RATE))
  const totalPotentialCommission = Math.round(totalPortfolioValue * COMMISSION_RATE)
  const averageCommission = totalProperties > 0 ? Math.round(totalPotentialCommission / totalProperties) : 0
  const highestCommission = commissions.length > 0 ? Math.max(...commissions) : 0
  const lowestCommission = commissions.length > 0 ? Math.min(...commissions) : 0
  const propertiesByType = topEntries(countBy(properties.map((property) => property.type)))
  const propertiesByCity = topEntries(countBy(properties.map((property) => property.city)))
  const hasProperties = totalProperties > 0

  return (
    <BrokerPageShell title="Financeiro">
      <div className="grid gap-6">
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
              <p className="text-sm text-white/50">Cálculo estimado com taxa padrão de 6% sobre o valor dos imóveis.</p>
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
              <InfoBlock label="Taxa de comissão" value="6%" />
              <InfoBlock label="Filtro atual" value="Todos os imóveis do corretor" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <BreakdownCard icon={Home} title="Imóveis por tipo" entries={propertiesByType} />
          <BreakdownCard icon={MapPin} title="Imóveis por cidade" entries={propertiesByCity} />
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">Histórico financeiro</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {hasProperties ? (
              properties.slice(0, 5).map((property) => (
                <div key={property.id} className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                  <p className="truncate text-sm font-medium text-white">{property.title}</p>
                  <span className="text-sm text-white/60">{property.price}</span>
                  <span className="text-sm text-[#69F0AE]">{formatBRLFromCents(Math.round((property.priceValue || 0) * COMMISSION_RATE))}</span>
                </div>
              ))
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
