"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, CalendarDays, ChevronDown, CircleAlert, FileText, House, RefreshCw, Users, WalletCards } from "lucide-react"

type OperationHealth = {
  score: number
  scores: Record<"clients" | "properties" | "documents" | "contracts" | "agenda" | "leads" | "finance", number>
  pending: Record<string, number>
  financial: {
    trackedRecords: number
    expectedReceipts: number
    overdueReceipts: number
    pendingExpenses: number
    incompleteRecords: number
  }
}

const scoreLabels: Record<keyof OperationHealth["scores"], string> = {
  clients: "Clientes",
  properties: "Imóveis",
  documents: "Documentos",
  contracts: "Contratos",
  agenda: "Agenda",
  leads: "Leads",
  finance: "Financeiro",
}

const pendingLabels: Record<string, { singular: string; plural: string }> = {
  missingLeadInformation: { singular: "cliente sem dados", plural: "clientes sem dados" },
  missingRg: { singular: "cliente sem RG", plural: "clientes sem RG" },
  missingRegistry: { singular: "imóvel sem matrícula", plural: "imóveis sem matrícula" },
  missingPropertyDocuments: { singular: "imóvel sem documentos", plural: "imóveis sem documentos" },
  draftDocuments: { singular: "documento em rascunho", plural: "documentos em rascunho" },
  draftContracts: { singular: "contrato em rascunho", plural: "contratos em rascunho" },
  awaitingSignature: { singular: "contrato aguardando assinatura", plural: "contratos aguardando assinatura" },
  pendingAgenda: { singular: "compromisso pendente", plural: "compromissos pendentes" },
  unattendedLeads: { singular: "lead sem atendimento", plural: "leads sem atendimento" },
  overdueFinancialReceipts: { singular: "recebimento atrasado", plural: "recebimentos atrasados" },
  pendingFinancialExpenses: { singular: "despesa pendente", plural: "despesas pendentes" },
  incompleteFinancialRecords: { singular: "registro financeiro incompleto", plural: "registros financeiros incompletos" },
}

type PendingItem = { key: string; label: string; count: number }

function PendingBreakdown({ items, showAll, onToggleAll }: { items: PendingItem[]; showAll: boolean; onToggleAll: () => void }) {
  const visibleItems = showAll ? items : items.slice(0, 6)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
        <CircleAlert className="size-3.5 text-amber-600" />
        <span>Pendências</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500">Nenhuma pendência encontrada.</p>
      ) : (
        <div className="space-y-1.5">
          {visibleItems.map((item) => (
            <div key={item.key} className="flex min-w-0 items-start gap-2 text-[11px] leading-4 text-slate-500">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              <span>{item.count} {item.label}</span>
            </div>
          ))}
        </div>
      )}
      {items.length > 6 ? (
        <button type="button" onClick={onToggleAll} className="text-[11px] font-medium text-emerald-700 transition hover:text-emerald-800">
          {showAll ? "Mostrar principais" : "Ver todas as pendências"}
        </button>
      ) : null}
    </div>
  )
}

function ScoreIcon({ section }: { section: keyof OperationHealth["scores"] }) {
  const className = "size-3.5"
  if (section === "clients" || section === "leads") return <Users className={className} />
  if (section === "properties") return <House className={className} />
  if (section === "agenda") return <CalendarDays className={className} />
  if (section === "finance") return <WalletCards className={className} />
  return <FileText className={className} />
}

function HealthDetails({ scores, financial, pendingItems, showAllPending, onToggleAllPending }: {
  scores: OperationHealth["scores"]
  financial: OperationHealth["financial"]
  pendingItems: PendingItem[]
  showAllPending: boolean
  onToggleAllPending: () => void
}) {
  return (
    <div>
      <div className="grid gap-1.5">
        {(Object.entries(scores) as Array<[keyof OperationHealth["scores"], number]>).map(([section, value]) => (
          <div key={section} className="flex min-h-8 items-center gap-2 rounded-xl bg-white/58 px-2 text-[11px] text-slate-700">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <ScoreIcon section={section} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{scoreLabels[section]}</span>
              {section === "finance" ? (
                <span className="block truncate text-[9px] text-slate-400">
                  {financial.expectedReceipts} previsto{financial.expectedReceipts === 1 ? "" : "s"}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-semibold text-slate-900">{value}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <PendingBreakdown items={pendingItems} showAll={showAllPending} onToggleAll={onToggleAllPending} />
      </div>
    </div>
  )
}

export function CosLaunchOperationHealth() {
  const [health, setHealth] = useState<OperationHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [showAllPending, setShowAllPending] = useState(false)

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
  const pendingItems = useMemo<PendingItem[]>(
    () => Object.entries(health?.pending ?? {}).filter(([, count]) => count > 0).map(([key, count]) => {
      const labels = pendingLabels[key]
      return { key, count, label: labels ? (count === 1 ? labels.singular : labels.plural) : key }
    }).sort((left, right) => right.count - left.count),
    [health],
  )

  return (
    <>
      <aside className="absolute bottom-[5.5rem] right-4 z-20 lg:hidden">
        {expanded && health ? (
          <div className="absolute bottom-[calc(100%+8px)] right-0 max-h-[min(31rem,calc(100dvh-9rem))] w-60 overflow-y-auto rounded-2xl border border-white/90 bg-white/92 p-3 shadow-[0_16px_40px_rgba(15,23,42,.10)] backdrop-blur-2xl [scrollbar-width:thin]">
            <HealthDetails scores={health.scores} financial={health.financial} pendingItems={pendingItems} showAllPending={showAllPending} onToggleAllPending={() => setShowAllPending((current) => !current)} />
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

      <aside className="hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/90 bg-white/72 p-3.5 shadow-[0_16px_40px_rgba(15,23,42,.07)] backdrop-blur-2xl [scrollbar-width:thin] lg:absolute lg:right-5 lg:top-4 lg:z-10 lg:block lg:w-56">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 lg:size-8 lg:rounded-xl">
            <Activity className="size-3.5 lg:size-4" />
          </span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.07em] text-slate-500 lg:text-[9px] lg:tracking-[0.09em]">Saúde da operação</p>
            <p className="text-[11px] text-slate-500 lg:mt-0.5 lg:text-xs">{loading ? "Consultando..." : health ? `${pendingCount} pendência${pendingCount === 1 ? "" : "s"}` : "Resumo indisponível"}</p>
          </div>
        </div>
        <strong className="text-lg font-semibold tracking-tight text-slate-900 lg:text-xl">{loading ? "—" : health ? `${health.score}%` : "—"}</strong>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 lg:mt-3 lg:h-1.5" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${health?.score ?? 0}%` }} />
      </div>

      {expanded && health ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <HealthDetails scores={health.scores} financial={health.financial} pendingItems={pendingItems} showAllPending={showAllPending} onToggleAllPending={() => setShowAllPending((current) => !current)} />
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
