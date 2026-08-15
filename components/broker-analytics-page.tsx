"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BarChart3, Eye, MessageCircle, MousePointerClick, Search, SlidersHorizontal, TrendingUp, UsersRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerStatItem, BrokerStatStrip } from "@/components/broker-portal-ui"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type BrokerAnalytics = {
  totalViews: number
  catalogViews: number
  marketplaceViews: number
  propertyViews: number
  whatsappClicks: number
  leads: number
  monitoredProperties: number
  mostAccessed: Array<{ id: string; title: string; views: number; leads: number }>
  leadOrigins: Array<{ source: string; count: number }>
  sources: string[]
  recentSearches: Array<{ id: string; query: string; resultCount: number; source: string; createdAt: string }>
}

const periodOptions = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
  { label: "Todo período", value: "all" },
] as const

export function BrokerAnalyticsPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [analytics, setAnalytics] = useState<BrokerAnalytics | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true)
  const [period, setPeriod] = useState<(typeof periodOptions)[number]["value"]>("30d")
  const [propertyId, setPropertyId] = useState("all")
  const [source, setSource] = useState("all")
  const totalViews = analytics?.totalViews ?? properties.reduce((sum, property) => sum + toNumber(property.views), 0)
  const totalLeads = analytics?.leads ?? properties.reduce((sum, property) => sum + toNumber(property.leads), 0)
  const whatsappClicks = analytics?.whatsappClicks ?? 0
  const mostAccessed = analytics?.mostAccessed ?? [...properties].sort((first, second) => toNumber(second.views) - toNumber(first.views)).slice(0, 5)
  const hasProperties = properties.length > 0

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    let ignore = false
    const params = new URLSearchParams()
    params.set("period", period)
    if (propertyId !== "all") params.set("propertyId", propertyId)
    if (source !== "all") params.set("source", source)
    if (debouncedSearch) params.set("search", debouncedSearch)

    setIsAnalyticsLoading(true)
    fetch(`/api/brokers/analytics?${params.toString()}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as BrokerAnalytics | null
        if (!ignore && response.ok && data) setAnalytics(data)
      })
      .catch(() => null)
      .finally(() => {
        if (!ignore) setIsAnalyticsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [debouncedSearch, period, propertyId, source])

  return (
    <BrokerPageShell
      title="Desempenho"
      searchPlaceholder="Buscar imóvel ou bairro"
      searchValue={search}
      onSearchChange={setSearch}
    >
      <div className="grid gap-4">
        {!hasProperties && !isLoading ? (
          <section className="rounded-[1.75rem] border border-[#009b3a]/20 bg-[#009b3a]/10 p-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
              <BarChart3 className="size-6" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-[#050505]">Desempenho pronto para acompanhar</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#5F6B7A]">
              Cadastre imóveis para acompanhar visualizações do Catálogo e Marketplace, cliques no WhatsApp, leads recebidos e imóveis mais acessados.
            </p>
            <Button asChild className="mt-6 h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
              <Link href="/corretor/novo-imovel">Cadastrar imóvel</Link>
            </Button>
          </section>
        ) : null}

        <BrokerStatStrip>
          {isAnalyticsLoading && !analytics ? (
            Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
          ) : (
            <>
              <MetricCard icon={Eye} label="Visualizações totais" value={totalViews.toLocaleString("pt-BR")} />
              <MetricCard icon={MousePointerClick} label="Cliques no WhatsApp" value={String(whatsappClicks)} />
              <MetricCard icon={UsersRound} label="Leads recebidos" value={totalLeads.toLocaleString("pt-BR")} />
              <MetricCard icon={TrendingUp} label="Imóveis monitorados" value={String(analytics?.monitoredProperties ?? properties.length)} />
            </>
          )}
        </BrokerStatStrip>

        <ResponsiveCollapsibleSection title="Período" defaultMobileOpen variant="broker">
        <section className="grid gap-3 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] p-3 md:grid-cols-3">
          <SelectFilter label="Período" value={period} onChange={(value) => setPeriod(value as (typeof periodOptions)[number]["value"])} options={periodOptions.map((item) => item)} />
          <SelectFilter
            label="Imóvel"
            value={propertyId}
            onChange={setPropertyId}
            options={[{ label: "Todos os imóveis", value: "all" }, ...properties.map((property) => ({ label: property.title, value: property.id }))]}
          />
          <SelectFilter
            label="Origem"
            value={source}
            onChange={setSource}
            options={[{ label: "Todas as origens", value: "all" }, ...(analytics?.sources ?? []).map((item) => ({ label: formatSourceLabel(item), value: item }))]}
          />
        </section>
        </ResponsiveCollapsibleSection>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <ResponsiveCollapsibleSection title="Imóveis mais acessados" defaultMobileOpen variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
            <CardHeader className="px-4 py-4 sm:px-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
                <BarChart3 className="size-5 text-[#009b3a]" />
                Imóveis mais acessados
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-5">
              {mostAccessed.length > 0 ? (
                <div className="divide-y divide-[var(--broker-border)] overflow-hidden rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)]">
                  {mostAccessed.map((property, index) => (
                    <div key={property.id} className="grid gap-2 px-3.5 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-center">
                      <span className="hidden size-7 items-center justify-center rounded-full bg-[var(--broker-accent-soft)] text-xs font-semibold text-[var(--broker-accent)] sm:flex">{index + 1}</span>
                      <p className="truncate text-sm font-medium text-[#050505]">{property.title}</p>
                      <span className="text-xs text-[#5F6B7A] sm:text-sm">{typeof property.views === "number" ? property.views : toNumber(property.views)} visualizações</span>
                      <span className="text-xs font-medium text-[#009b3a] sm:text-sm">{typeof property.leads === "number" ? property.leads : toNumber(property.leads)} leads</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">
                  Nenhum imóvel cadastrado para ranquear.
                </div>
              )}
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Filtros e origem" variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
            <CardHeader className="px-4 py-4 sm:px-5">
              <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
                <SlidersHorizontal className="size-5 text-[#009b3a]" />
                Filtros e origem
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 px-4 pb-4 pt-0 sm:px-5">
              <InfoBlock label="Filtro atual" value="Todos os imóveis" />
              <InfoBlock label="Origem dos leads" value={analytics?.leadOrigins.length ? analytics.leadOrigins.map((item) => `${formatSourceLabel(item.source)}: ${item.count}`).join(" · ") : "Sem origem registrada"} />
              <InfoBlock label="WhatsApp" value={`${whatsappClicks} cliques registrados`} />
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        <ResponsiveCollapsibleSection title="Origem dos resultados" variant="broker">
        <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
          <CardHeader className="px-4 py-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
              <MessageCircle className="size-5 text-[#009b3a]" />
              Origem dos resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 pb-4 pt-0 sm:px-5 md:grid-cols-4">
            <InfoBlock label="Catálogo" value={`${analytics?.catalogViews ?? 0} visualizações`} progress={percentage(analytics?.catalogViews ?? 0, totalViews)} />
            <InfoBlock label="Marketplace" value={`${analytics?.marketplaceViews ?? 0} visualizações`} progress={percentage(analytics?.marketplaceViews ?? 0, totalViews)} />
            <InfoBlock label="WhatsApp" value={`${whatsappClicks} cliques registrados`} progress={percentage(whatsappClicks, Math.max(totalViews, whatsappClicks))} />
            <InfoBlock label="Leads" value={totalLeads > 0 ? `${totalLeads} leads` : "0 leads"} progress={percentage(totalLeads, Math.max(totalViews, totalLeads))} />
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <ResponsiveCollapsibleSection title="Buscas recentes" variant="broker">
        <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
          <CardHeader className="px-4 py-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
              <Search className="size-5 text-[#009b3a]" />
              Buscas recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-5">
            {analytics?.recentSearches?.length ? (
              <div className="divide-y divide-[var(--broker-border)] overflow-hidden rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)]">
                {analytics.recentSearches.map((item) => (
                  <div key={item.id} className="grid gap-2 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#050505]">{item.query}</p>
                      <p className="mt-0.5 text-xs text-[#7B8491]">{formatSearchTime(item.createdAt)} · {formatSourceLabel(item.source)}</p>
                    </div>
                    <span className="rounded-full border border-[#009b3a]/16 bg-[#009b3a]/10 px-3 py-1 text-xs text-[#009b3a]">
                      {item.resultCount} resultado{item.resultCount === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">
                As buscas feitas no catálogo público aparecerão aqui.
              </div>
            )}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>
      </div>
    </BrokerPageShell>
  )
}

function formatSourceLabel(source: string) {
  const normalized = source.toLowerCase()
  if (normalized.includes("catalog")) return "Catálogo"
  if (normalized.includes("marketplace")) return "Marketplace"
  if (normalized.includes("assessor") || normalized.includes("whatsapp")) return "WhatsApp"
  if (normalized.includes("dashboard")) return "Dashboard"
  if (normalized.includes("manual")) return "Manual"
  return source || "Portal"
}

function formatSearchTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Horário não informado"
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (date.toDateString() === new Date().toDateString()) return `Hoje às ${time}`
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-[#6B7280]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-sm font-semibold text-[#050505] outline-none focus:ring-2 focus:ring-[#009b3a]/35">
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <BrokerStatItem icon={<Icon className="size-4" />} label={label} value={value} />
  )
}

function MetricSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-3 border-r border-b border-[var(--broker-border)] px-4 py-3.5">
      <div className="eme-shimmer size-9 shrink-0 rounded-xl bg-[var(--broker-surface-inset)]" />
      <div className="min-w-0 flex-1"><div className="eme-shimmer h-3 w-2/3 rounded-full bg-[var(--broker-surface-inset)]" /><div className="eme-shimmer mt-2 h-5 w-1/2 rounded-full bg-[var(--broker-surface-inset)]" /></div>
    </div>
  )
}

function InfoBlock({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className="rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] p-3.5">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-[#050505]">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)))
}
