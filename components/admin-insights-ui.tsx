"use client"

import type { ReactNode } from "react"
import { AlertCircle, ArrowRight, BarChart3, Clock3, Sparkles } from "lucide-react"

import type { AdminActivityItem, AdminAlertItem, AdminMetricPoint, AdminTrendRow } from "@/lib/admin-insights-contract"
import { cn } from "@/lib/utils"

export function AdminSurface({
  title,
  subtitle,
  aside,
  children,
  className,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-[1.75rem] border border-black/[0.06] bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.07)] sm:p-6", className)}>
      <div className="flex flex-col gap-3 border-b border-black/[0.05] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#050505]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-[#6B7280]">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  )
}

export function AdminMetricGrid({ children }: { children: ReactNode }) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</section>
}

export function AdminMetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
  tone?: "default" | "success" | "warning"
}) {
  const tones = {
    default: "bg-[#eef5ef] text-[#0f7a35] border-[#d9eadc]",
    success: "bg-[#eef9f1] text-[#009b3a] border-[#d7ebdd]",
    warning: "bg-[#fff7ed] text-[#b45309] border-[#f5dfc2]",
  }

  return (
    <article className="rounded-[1.5rem] border border-black/[0.06] bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#6B7280]">{label}</p>
          <p className="mt-2 text-[1.7rem] font-semibold tracking-tight text-[#050505]">{value}</p>
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>
          {icon || <Sparkles className="size-5" />}
        </div>
      </div>
      {hint ? <p className="mt-3 text-xs leading-5 text-[#8B95A1]">{hint}</p> : null}
    </article>
  )
}

export function AdminKpiList({ rows }: { rows: AdminTrendRow[] }) {
  if (!rows.length) {
    return <AdminEmpty title="Sem dados suficientes" description="Os indicadores desta seção aparecerão aqui conforme a operação ganhar volume." />
  }

  const maxValue = Math.max(...rows.map((row) => row.value), 1)

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={`${row.label}-${row.detail || ""}`} className="rounded-[1.2rem] border border-black/[0.05] bg-[#fbfbf8] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{row.label}</p>
              {row.detail ? <p className="mt-1 text-xs leading-5 text-[#6B7280]">{row.detail}</p> : null}
            </div>
            <span className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-medium text-[#4B5563]">{row.value}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#edf1ed]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#009b3a,#44c36d)]"
              style={{ width: `${Math.max(10, (row.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminMiniChart({
  title,
  subtitle,
  points,
}: {
  title: string
  subtitle?: string
  points: AdminMetricPoint[]
}) {
  if (!points.length) {
    return <AdminEmpty title={title} description={subtitle || "Ainda não há dados suficientes para gerar este gráfico."} compact />
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1)

  return (
    <div className="rounded-[1.3rem] border border-black/[0.05] bg-[#fbfbf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-[#6B7280]">{subtitle}</p> : null}
        </div>
        <BarChart3 className="mt-0.5 size-4 text-[#8B95A1]" />
      </div>
      <div className="mt-4 flex items-end gap-2">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-[1rem] bg-white p-1.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]">
              <div
                className="w-full rounded-[0.85rem] bg-[linear-gradient(180deg,rgba(0,155,58,0.26),rgba(0,155,58,0.85))]"
                style={{ height: `${Math.max(8, (point.value / maxValue) * 100)}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium text-[#4B5563]">{point.label}</p>
              <p className="text-[11px] text-[#8B95A1]">{point.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminActivityFeed({ items }: { items: AdminActivityItem[] }) {
  if (!items.length) {
    return <AdminEmpty title="Sem movimentação recente" description="Assim que a operação começar a registrar eventos, a timeline aparecerá aqui." compact />
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-[1.2rem] border border-black/[0.05] bg-[#fbfbf8] p-4">
          <div className={cn("mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl border",
            item.tone === "success"
              ? "border-[#d7ebdd] bg-[#eef9f1] text-[#009b3a]"
              : item.tone === "warning"
                ? "border-[#f5dfc2] bg-[#fff7ed] text-[#b45309]"
                : item.tone === "danger"
                  ? "border-[#f3d4d4] bg-[#fff3f3] text-[#b42318]"
                  : "border-black/[0.06] bg-white text-[#7B8491]")}
          >
            <Clock3 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
              <span className="text-xs text-[#8B95A1]">{item.timestamp}</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#6B7280]">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminAlertsList({ items }: { items: AdminAlertItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-[1.2rem] border border-black/[0.05] bg-[#fbfbf8] p-4">
          <div className={cn("mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl border",
            item.severity === "high"
              ? "border-[#f3d4d4] bg-[#fff3f3] text-[#b42318]"
              : item.severity === "medium"
                ? "border-[#f5dfc2] bg-[#fff7ed] text-[#b45309]"
                : "border-[#d7ebdd] bg-[#eef9f1] text-[#009b3a]")}
          >
            <AlertCircle className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-[#6B7280]">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminDefinitionGrid({
  items,
  columns = 2,
}: {
  items: { label: string; value: string }[]
  columns?: 2 | 3 | 4
}) {
  return (
    <div className={cn(
      "grid gap-3",
      columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4",
    )}>
      {items.map((item) => (
        <div key={item.label} className="rounded-[1.15rem] border border-black/[0.05] bg-[#fbfbf8] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98A2B3]">{item.label}</p>
          <p className="mt-2 text-sm leading-6 text-[#111827]">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

export function AdminDataTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-[1.3rem] border border-black/[0.06] bg-white">
      <table className="min-w-full">
        <thead className="border-b border-black/[0.06] bg-[#f9faf9]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#8B95A1]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-black/[0.05] last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top text-sm text-[#4B5563]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
      tone === "success"
        ? "border-[#d7ebdd] bg-[#eef9f1] text-[#009b3a]"
        : tone === "warning"
          ? "border-[#f5dfc2] bg-[#fff7ed] text-[#b45309]"
          : tone === "danger"
            ? "border-[#f3d4d4] bg-[#fff3f3] text-[#b42318]"
            : "border-black/[0.06] bg-white text-[#5F6B7A]",
    )}>
      {children}
    </span>
  )
}

export function AdminEmpty({
  title,
  description,
  compact = false,
}: {
  title: string
  description: string
  compact?: boolean
}) {
  return (
    <div className={cn("rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] text-center", compact ? "px-4 py-6" : "px-6 py-10")}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-black/[0.06] bg-white text-[#8B95A1]">
        <ArrowRight className="size-4" />
      </div>
      <p className="mt-4 text-base font-semibold text-[#111827]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  )
}
