"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, ChevronDown, RefreshCw } from "lucide-react"

type OperationHealth = {
  score: number
  scores: Record<"clients" | "properties" | "documents" | "contracts" | "agenda" | "leads", number>
  pending: Record<string, number>
}

const scoreLabels: Record<keyof OperationHealth["scores"], string> = {
  clients: "Clientes",
  properties: "Imóveis",
  documents: "Documentos",
  contracts: "Contratos",
  agenda: "Agenda",
  leads: "Leads",
}

export function CosLaunchOperationHealth() {
  const [health, setHealth] = useState<OperationHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch("/api/brokers/operation-health", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("health_unavailable")
        return response.json() as Promise<OperationHealth>
      })
      .then(setHealth)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setHealth(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const pendingCount = useMemo(
    () => Object.values(health?.pending ?? {}).reduce((total, value) => total + value, 0),
    [health],
  )

  return (
    <>
      <aside className="absolute bottom-[5.5rem] right-4 z-20 lg:hidden">
        {expanded && health ? (
          <div className="absolute bottom-[calc(100%+8px)] right-0 w-48 rounded-2xl border border-white/90 bg-white/92 p-3 shadow-[0_16px_40px_rgba(15,23,42,.10)] backdrop-blur-2xl">
            <div className="grid gap-1.5">
              {(Object.entries(health.scores) as Array<[keyof OperationHealth["scores"], number]>).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{scoreLabels[key]}</span>
                  <span className="font-semibold text-slate-700">{value}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          disabled={!health}
          onClick={() => setExpanded((current) => !current)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-white/90 bg-white/90 px-3.5 shadow-[0_12px_32px_rgba(15,23,42,.09)] backdrop-blur-2xl disabled:cursor-not-allowed disabled:opacity-70"
          aria-expanded={expanded}
          aria-label={expanded ? "Ocultar detalhes da saúde da operação" : "Ver detalhes da saúde da operação"}
        >
          <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-900">Saúde</span>
          <strong className="text-base font-semibold tracking-tight text-slate-950">
            {loading ? "—" : health ? `${health.score}%` : "—"}
          </strong>
          <span className="grid min-w-8 place-items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            {loading ? "—" : health ? pendingCount : "!"}
          </span>
        </button>
      </aside>

      <aside className="hidden rounded-3xl border border-white/90 bg-white/72 p-3.5 shadow-[0_16px_40px_rgba(15,23,42,.07)] backdrop-blur-2xl lg:absolute lg:right-5 lg:top-4 lg:z-10 lg:block lg:w-56">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 lg:size-8 lg:rounded-xl">
            <Activity className="size-3.5 lg:size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:text-[11px] lg:tracking-[0.14em]">Saúde da operação</p>
            <p className="text-[11px] text-slate-500 lg:mt-0.5 lg:text-xs">{loading ? "Consultando..." : health ? `${pendingCount} pendência${pendingCount === 1 ? "" : "s"}` : "Resumo indisponível"}</p>
          </div>
        </div>
        <strong className="text-lg font-semibold tracking-tight text-slate-900 lg:text-xl">{loading ? "—" : health ? `${health.score}%` : "—"}</strong>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 lg:mt-3 lg:h-1.5" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${health?.score ?? 0}%` }} />
      </div>

      {expanded && health ? (
        <div className="mt-3 grid gap-1.5 border-t border-slate-100 pt-3">
          {(Object.entries(health.scores) as Array<[keyof OperationHealth["scores"], number]>).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{scoreLabels[key]}</span>
              <span className="font-semibold text-slate-700">{value}%</span>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!health}
        onClick={() => setExpanded((current) => !current)}
        className="mt-2 flex min-h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-100 bg-white/70 px-3 text-[10px] font-semibold text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 lg:mt-3 lg:min-h-8 lg:rounded-xl lg:text-[11px]"
        aria-expanded={expanded}
      >
        {!health && !loading ? <RefreshCw className="size-3" /> : null}
        {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        {health ? <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} /> : null}
      </button>
      </aside>
    </>
  )
}
