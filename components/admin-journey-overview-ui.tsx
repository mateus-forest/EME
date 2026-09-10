"use client"

import type { ReactNode } from "react"
import { Info } from "lucide-react"
import { OVERVIEW_TIME_ZONE, type CountRow, type JourneyOverviewData } from "@/lib/admin-journey-contract"

export const overviewNumber = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("pt-BR")
export function OverviewBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "success" }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-[#eaf5ef] text-[#137142]" : "bg-[#f0f2f1] text-[#66736b]"}`}>{children}</span>
}
export function OverviewSection({ title, description, children, aside, className = "" }: { title: string; description: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-[#e4e9e5] bg-white p-4 ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold tracking-tight text-[#19382a]">{title}</h2><p className="mt-1 text-[11px] leading-relaxed text-[#78827b]">{description}</p></div>{aside}</div>{children}
  </section>
}
export function OverviewEmpty({ unavailable = false }: { unavailable?: boolean }) {
  return <p className="flex min-h-20 items-center justify-center rounded-xl bg-[#f8faf8] px-4 text-center text-xs text-[#78827b]">{unavailable ? "Fonte indisponível. Tente atualizar." : "Nenhum evento registrado neste período."}</p>
}
export function OverviewMetric({ id, label, value, detail, status, warning = false }: { id: string; label: string; value: string; detail: string; status?: string; warning?: boolean }) {
  return <article data-testid={`metric-${id}`} className="min-w-0 rounded-xl border border-[#e4e9e5] bg-white px-3.5 py-3">
    <div className="flex items-start justify-between gap-2"><h2 className="text-[11px] font-medium leading-4 text-[#66736b]">{label}</h2><span tabIndex={0} title={detail} aria-label={detail} className="shrink-0 text-[#99a49c]"><Info className="size-3" /></span></div>
    <p data-testid="metric-value" className={`mt-2 text-[25px] font-semibold leading-none tracking-tight tabular-nums ${warning ? "text-[#a26022]" : "text-[#19382a]"}`}>{value}</p>
    <div className="mt-2 min-h-4 text-[10px] text-[#7b857e]">{status ?? "No período"}</div>
  </article>
}
export function OverviewRanking({ rows, unavailable, labels = {}, unit = "eventos" }: { rows: CountRow[]; unavailable?: boolean; labels?: Record<string, string>; unit?: string }) {
  if (!rows.length) return <OverviewEmpty unavailable={unavailable} />
  const max = Math.max(...rows.map(row => row.count), 1)
  return <ul className="space-y-3">{rows.map(row => <li key={row.label}>
    <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-[#526158]" title={row.label}>{labels[row.label] ?? row.label}</span><span className="shrink-0 tabular-nums text-[#253f31]">{overviewNumber(row.count)} <span className="text-[10px] text-[#8d978f]">{unit}</span></span></div>
    <div className="h-1 overflow-hidden rounded-full bg-[#eef2ee]" aria-hidden="true"><div className="h-full rounded-full bg-[#6c9a7d]" style={{ width: `${row.count / max * 100}%` }} /></div>
  </li>)}</ul>
}
export function OverviewTrafficChart({ data, hourly, metric }: { data: Pick<JourneyOverviewData, "series"> & { quality: Pick<JourneyOverviewData["quality"], "firstReceivedAt"> }; hourly: boolean; metric: "views" | "visitors" | "sessions" }) {
  const points = data.series
  if (!points.length) return <OverviewEmpty />
  const maximum = Math.max(...points.map(point => point[metric]), 1)
  const width = 720, top = 8, plotHeight = 100
  const bar = width / points.length
  const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: OVERVIEW_TIME_ZONE, ...(hourly ? { hour: "2-digit" as const } : { day: "2-digit" as const, month: "2-digit" as const }) }).format(new Date(date))
  const fullLabel = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: OVERVIEW_TIME_ZONE, dateStyle: "short", ...(hourly ? { timeStyle: "short" as const } : {}) }).format(new Date(date))
  const coverageStart = data.quality.firstReceivedAt ? Date.parse(data.quality.firstReceivedAt) : Infinity
  const ticks = points.filter((_, index) => index % Math.max(1, Math.ceil(points.length / 5)) === 0 || index === points.length - 1)
  return <figure>
    <div className="flex gap-2"><div className="flex h-28 w-7 shrink-0 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-[#8a958d]" aria-hidden="true"><span>{overviewNumber(maximum)}</span><span>0</span></div><div className="min-w-0 flex-1">
    <svg viewBox={`0 0 ${width} 114`} preserveAspectRatio="none" role="img" aria-label={`${metric === "views" ? "Page views" : metric === "visitors" ? "Visitantes únicos" : "Sessões"} ${hourly ? "por hora" : "por dia"}, horário de São Paulo`} className="h-28 w-full">
      {[0, 0.5, 1].map(part => <line key={part} x1={0} x2={width} y1={top + plotHeight * part} y2={top + plotHeight * part} stroke="#edf1ed" />)}
      {points.map((point, index) => {
        const beforeCoverage = point[metric] === 0 && Date.parse(point.bucket) + (hourly ? 3_600_000 : 86_400_000) <= coverageStart
        const x = index * bar + bar * 0.16, h = point[metric] / maximum * plotHeight
        return <g key={point.bucket}><rect x={x} y={top + plotHeight - (beforeCoverage ? 2 : h)} width={Math.max(1, bar * 0.68)} height={beforeCoverage ? 2 : h} rx={Math.min(3, bar / 5)} fill={beforeCoverage ? "#cbd3cd" : "#2e8051"}><title>{fullLabel(point.bucket)}: {beforeCoverage ? "sem cobertura" : overviewNumber(point[metric])}</title></rect>
          </g>
      })}
    </svg>
    <div className="mt-1 flex justify-between gap-1 text-[10px] text-[#7d8981]" aria-hidden="true">{ticks.map(point => <span key={point.bucket}>{dateLabel(point.bucket)}</span>)}</div>
    </div></div>
    <figcaption className="mt-1 text-[10px] leading-relaxed text-[#8a958d]">{metric === "views" ? "Uma visualização por evento page_view." : "Únicos calculados em cada faixa; o total do período é recalculado, nunca somado."} Traços cinza indicam faixas anteriores à coleta.</figcaption>
  </figure>
}
