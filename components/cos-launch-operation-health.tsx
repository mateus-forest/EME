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
    <aside className="mx-4 mt-4 rounded-3xl border border-white/90 bg-white/72 p-3.5 shadow-[0_16px_40px_rgba(15,23,42,.07)] backdrop-blur-2xl sm:mx-6 lg:absolute lg:right-5 lg:top-4 lg:z-10 lg:m-0 lg:w-56">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <Activity className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Saúde da operação</p>
            <p className="mt-0.5 text-xs text-slate-500">{loading ? "Consultando..." : health ? `${pendingCount} pendência${pendingCount === 1 ? "" : "s"}` : "Resumo indisponível"}</p>
          </div>
        </div>
        <strong className="text-xl font-semibold tracking-tight text-slate-900">{loading ? "—" : health ? `${health.score}%` : "—"}</strong>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
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
        className="mt-3 flex min-h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-white/70 px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-expanded={expanded}
      >
        {!health && !loading ? <RefreshCw className="size-3" /> : null}
        {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        {health ? <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} /> : null}
      </button>
    </aside>
  )
}
