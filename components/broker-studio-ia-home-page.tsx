"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clapperboard,
  ImagePlus,
  Megaphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerPageIntro, BrokerSurface } from "@/components/broker-portal-ui"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"
import {
  formatStudioCampaignDate,
  formatStudioCampaignKind,
  resolveStudioLibraryThumbnail,
} from "@/lib/studio-campaigns-ui"
import { isProjectVisualization } from "@/lib/studio-asset-context"

type StudioAction = {
  title: string
  description: string
  icon: LucideIcon
  href: string
}

type StudioPeriod = 7 | 30 | 90
type StudioMetricKey = "campaigns" | "projects" | "videos" | "materials"

const studioActions: StudioAction[] = [
  {
    title: "Criar campanha",
    description: "Crie conteúdo completo para divulgar seus imóveis nas redes sociais.",
    icon: Megaphone,
    href: "/corretor/studio-ia/criar-campanha-instagram",
  },
  {
    title: "Preparar imóvel",
    description: "Organize e prepare as fotografias do imóvel para uma apresentação mais atraente.",
    icon: ImagePlus,
    href: "/corretor/studio-ia/preparar-imovel",
  },
  {
    title: "Visualizar projeto",
    description: "Área reservada para representações arquitetônicas em validação.",
    icon: Building2,
    href: "/corretor/studio-ia/visualizar-projeto",
  },
  {
    title: "Criar vídeo",
    description: "Transforme as melhores imagens do imóvel em uma apresentação em vídeo.",
    icon: Clapperboard,
    href: "/corretor/studio-ia/criar-video-do-imovel",
  },
  {
    title: "Criar anúncio",
    description: "Crie materiais e mensagens focados em promover um imóvel e gerar oportunidades.",
    icon: Sparkles,
    href: "/corretor/studio-ia/atrair-compradores",
  },
]

const periodOptions: Array<{ value: StudioPeriod; label: string }> = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
]

const metricLabels: Record<StudioMetricKey, string> = {
  campaigns: "Campanhas",
  projects: "Projetos",
  videos: "Vídeos",
  materials: "Materiais",
}

export function BrokerStudioIaHomePage() {
  const [campaigns, setCampaigns] = useState<StudioCampaignRecord[]>([])
  const [period, setPeriod] = useState<StudioPeriod>(30)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadStudioActivity() {
      setIsLoading(true)
      setError("")

      try {
        const firstPage = await studioCampaignsClient.list({ page: 1, limit: 100 })
        const remainingPages = Array.from(
          { length: Math.max(0, firstPage.pagination.totalPages - 1) },
          (_, index) => index + 2,
        )
        const remainingResults = await Promise.all(
          remainingPages.map((page) => studioCampaignsClient.list({ page, limit: 100 })),
        )
        if (!active) return
        setCampaigns([
          ...firstPage.campaigns,
          ...remainingResults.flatMap((result) => result.campaigns),
        ])
      } catch (caughtError) {
        if (!active) return
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a atividade do Studio.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadStudioActivity()
    return () => {
      active = false
    }
  }, [])

  const activity = useMemo(() => buildStudioActivity(campaigns, period), [campaigns, period])
  const recentCampaigns = useMemo(
    () => [...campaigns]
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .slice(0, 4),
    [campaigns],
  )

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-3.5">
        <BrokerPageIntro
          eyebrow="Studio IA"
          title="Estúdio"
          description="Crie o material comercial dos seus imóveis."
          actions={
            <Link
              href="/corretor/studio-ia/biblioteca"
              className="inline-flex h-9 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white px-3 text-xs font-semibold text-[#344054] transition-colors hover:bg-[#f7f8f5] hover:text-[#008633] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25"
            >
              Biblioteca
              <ArrowUpRight className="size-4" />
            </Link>
          }
        />

        <section data-testid="studio-actions" className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {studioActions.map((action) => {
            const Icon = action.icon

            return (
              <Link key={action.title} href={action.href} className="group min-w-0 rounded-[var(--broker-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009b3a]/25">
                <BrokerSurface as="article" padding="compact" className="flex h-full min-h-[8.25rem] flex-col transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[#009b3a]/16 group-hover:shadow-[0_16px_38px_rgba(15,23,42,0.07)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-8 items-center justify-center rounded-[0.7rem] border border-[#009b3a]/12 bg-[#eef9f1] text-[#009b3a]">
                      <Icon className="size-4" />
                    </div>
                    <ArrowRight className="mt-1 size-4 text-[#B0B7C0] transition group-hover:translate-x-0.5 group-hover:text-[#009b3a]" />
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold leading-tight text-[#111827]">{action.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-[1.15rem] text-[#667085]">{action.description}</p>
                </BrokerSurface>
              </Link>
            )
          })}
        </section>

        <section className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,.75fr)]">
          <BrokerSurface padding="compact" className="min-w-0 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-[#111827]">Atividade do Estúdio</p>
                <p className="mt-1 text-xs text-[#667085]">Produção real registrada no período selecionado.</p>
              </div>
              <label className="sr-only" htmlFor="studio-activity-period">Período da atividade</label>
              <select
                id="studio-activity-period"
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value) as StudioPeriod)}
                className="h-9 rounded-lg border border-black/[0.07] bg-white px-3 text-xs font-medium text-[#344054] outline-none focus:border-[#009b3a]/35 focus:ring-2 focus:ring-[#009b3a]/10"
              >
                {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {(Object.keys(metricLabels) as StudioMetricKey[]).map((key) => (
                <StudioMetric
                  key={key}
                  label={metricLabels[key]}
                  value={activity.current[key]}
                  previousValue={activity.previous[key]}
                  loading={isLoading}
                />
              ))}
            </div>

            <div className="mt-4 h-56 min-w-0 rounded-[1.15rem] border border-black/[0.055] bg-[#fbfcfa] px-2 pb-2 pt-4">
              {isLoading ? (
                <div className="h-full animate-pulse rounded-xl bg-[#f1f4f1]" />
              ) : error ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#667085]">{error}</div>
              ) : activity.hasActivity ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activity.chart} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studioMaterialsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#009b3a" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#009b3a" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e8ece8" strokeDasharray="3 4" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8B95A1", fontSize: 10 }} interval={period === 7 ? 0 : period === 30 ? 4 : 14} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8B95A1", fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "rgba(0,0,0,.07)", boxShadow: "0 12px 30px rgba(15,23,42,.08)", fontSize: 12 }} />
                    <Area type="monotone" dataKey="materials" name="Materiais" stroke="#009b3a" strokeWidth={2} fill="url(#studioMaterialsFill)" />
                    <Area type="monotone" dataKey="campaigns" name="Campanhas" stroke="#344054" strokeWidth={1.5} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-medium text-[#344054]">Nenhuma atividade neste período</p>
                  <p className="mt-1 text-xs text-[#8B95A1]">As próximas criações aparecerão aqui automaticamente.</p>
                </div>
              )}
            </div>
          </BrokerSurface>

          <BrokerSurface padding="compact" className="min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[#111827]">Recentes</p>
                <p className="mt-1 text-xs text-[#667085]">Últimos materiais criados.</p>
              </div>
              <Link href="/corretor/studio-ia/biblioteca" className="text-xs font-semibold text-[#008633] hover:text-[#006f2b]">Ver biblioteca</Link>
            </div>

            <div className="mt-3 grid gap-1.5">
              {isLoading ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex animate-pulse gap-3 rounded-xl p-2">
                  <div className="h-12 w-14 rounded-lg bg-[#eef1ee]" />
                  <div className="flex-1 space-y-2 py-1"><div className="h-3 w-3/4 rounded bg-[#eef1ee]" /><div className="h-2.5 w-1/2 rounded bg-[#f2f4f2]" /></div>
                </div>
              )) : error ? (
                <p className="rounded-xl border border-black/[0.055] bg-[#fbfbf8] p-4 text-sm text-[#667085]">Não foi possível carregar os itens recentes.</p>
              ) : recentCampaigns.length ? (
                recentCampaigns.map((campaign) => <RecentStudioItem key={campaign.id} campaign={campaign} />)
              ) : (
                <p className="rounded-xl border border-dashed border-black/[0.08] bg-[#fbfbf8] p-4 text-sm leading-5 text-[#667085]">Nenhum material foi criado ainda.</p>
              )}
            </div>
          </BrokerSurface>
        </section>
      </div>
    </BrokerPageShell>
  )
}

function StudioMetric({ label, value, previousValue, loading }: { label: string; value: number; previousValue: number; loading: boolean }) {
  const comparison = previousValue > 0
    ? Math.round(((value - previousValue) / previousValue) * 100)
    : null

  return (
    <div className="min-w-0 rounded-[1rem] border border-black/[0.055] bg-[#fbfbf8] px-3 py-3">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-[#8B95A1]">{label}</p>
      {loading ? <div className="mt-2 h-7 w-12 animate-pulse rounded-lg bg-[#e9ede9]" /> : <p className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">{value}</p>}
      {!loading && comparison !== null ? (
        <p className={`mt-1 text-[10px] ${comparison >= 0 ? "text-[#0a8f3d]" : "text-[#b54708]"}`}>
          {comparison > 0 ? "+" : ""}{comparison}% vs. período anterior
        </p>
      ) : null}
    </div>
  )
}

function RecentStudioItem({ campaign }: { campaign: StudioCampaignRecord }) {
  const thumbnail = useMemo(() => resolveStudioLibraryThumbnail(campaign), [campaign])
  const initialCandidates = useMemo(
    () => [thumbnail.src, ...thumbnail.fallbacks].filter((candidate) => !candidate.startsWith("data:image/svg+xml")),
    [thumbnail],
  )
  const [candidates, setCandidates] = useState(initialCandidates)

  useEffect(() => setCandidates(initialCandidates), [initialCandidates])

  return (
    <Link href={`/corretor/studio-ia/biblioteca/${campaign.id}`} className="group flex min-w-0 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#f7f9f7]">
      <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg border border-black/[0.055] bg-[#eef3ef]">
        {candidates[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidates[0]} alt="" className="h-full w-full object-cover" onError={() => setCandidates((current) => current.slice(1))} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#8B95A1]"><ImagePlus className="size-4" /></span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#111827] group-hover:text-[#008633]">{campaign.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-[#667085]">{formatStudioCampaignKind(campaign.kind)} · {formatStudioCampaignDate(campaign.createdAt)}</p>
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-[#B0B7C0] transition-colors group-hover:text-[#009b3a]" />
    </Link>
  )
}

function buildStudioActivity(campaigns: StudioCampaignRecord[], period: StudioPeriod) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentStart = new Date(today)
  currentStart.setDate(currentStart.getDate() - (period - 1))
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - period)

  const currentCampaigns = campaigns.filter((campaign) => new Date(campaign.createdAt) >= currentStart)
  const previousCampaigns = campaigns.filter((campaign) => {
    const createdAt = new Date(campaign.createdAt)
    return createdAt >= previousStart && createdAt < currentStart
  })

  const chart = Array.from({ length: period }, (_, index) => {
    const date = new Date(currentStart)
    date.setDate(date.getDate() + index)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)
    const campaignsForDay = currentCampaigns.filter((campaign) => {
      const createdAt = new Date(campaign.createdAt)
      return createdAt >= date && createdAt < nextDate
    })
    const materials = currentCampaigns.reduce((total, campaign) => total + campaign.assets.filter((asset) => {
      const createdAt = new Date(asset.createdAt)
      return createdAt >= date && createdAt < nextDate
    }).length, 0)

    return {
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date),
      campaigns: campaignsForDay.length,
      materials,
    }
  })

  return {
    current: studioMetrics(currentCampaigns),
    previous: studioMetrics(previousCampaigns),
    chart,
    hasActivity: chart.some((item) => item.campaigns > 0 || item.materials > 0),
  }
}

function studioMetrics(campaigns: StudioCampaignRecord[]) {
  return {
    campaigns: campaigns.length,
    projects: campaigns.filter((campaign) => campaign.kind === "CONSTRUCTION" || isProjectVisualization(campaign)).length,
    videos: campaigns.reduce((total, campaign) => total + campaign.assets.filter((asset) => asset.type === "VIDEO").length, 0),
    materials: campaigns.reduce((total, campaign) => total + campaign.assets.length, 0),
  }
}
