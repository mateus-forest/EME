"use client"

import { useMemo, useState } from "react"
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminAiOperations } from "@/components/use-admin-ai-operations"

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function AdminAiConsumptionPage() {
  const [period, setPeriod] = useState(90)
  const [provider, setProvider] = useState("Todos")
  const [moduleName, setModuleName] = useState("Todos")
  const [query, setQuery] = useState("")
  const { data, loading, error, retry } = useAdminAiOperations(period)

  const providers = useMemo(() => ["Todos", ...new Set(data?.operations.map((item) => item.provider) ?? [])], [data])
  const modules = useMemo(() => ["Todos", ...new Set(data?.operations.map((item) => item.module) ?? [])], [data])
  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (data?.operations ?? []).filter((item) => {
      if (provider !== "Todos" && item.provider !== provider) return false
      if (moduleName !== "Todos" && item.module !== moduleName) return false
      if (!normalizedQuery) return true
      return `${item.operation} ${item.model} ${item.userName} ${item.userEmail ?? ""}`.toLowerCase().includes(normalizedQuery)
    })
  }, [data, moduleName, provider, query])

  return (
    <AdminPageShell
      eyebrow="Inteligência artificial"
      title="Consumo IA"
      description="Operações reais registradas por provider, modelo, módulo e usuário. Custos sem telemetria permanecem identificados como indisponíveis."
    >
      {loading ? <AdminSurface><p className="text-sm text-slate-500">Carregando telemetria de IA...</p></AdminSurface> : null}
      {error ? <AdminSurface><p className="text-sm text-red-700">{error}</p><button type="button" onClick={retry} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Tentar novamente</button></AdminSurface> : null}
      {data ? (
        <>
          <AdminMetricGrid>
            <AdminMetricCard label="Operações" value={data.summary.operations.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Créditos consumidos" value={data.summary.credits.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Custo real registrado" value={formatMoney(data.summary.recordedCostBrl)} />
            <AdminMetricCard label="Usuários com consumo" value={data.summary.activeUsers.toLocaleString("pt-BR")} />
          </AdminMetricGrid>

          <AdminSurface>
            <div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Histórico de operações</h2><p className="mt-1 text-sm text-slate-500">Filtre para entender campanhas, imagens, vídeos, COS e consumo por usuário.</p></div>
            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <select value={period} onChange={(event) => setPeriod(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
                <option value={365}>Últimos 12 meses</option>
              </select>
              <select value={provider} onChange={(event) => setProvider(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                {providers.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={moduleName} onChange={(event) => setModuleName(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                {modules.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Operação, modelo ou usuário" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>

            {data.truncated ? <p className="mb-3 text-xs text-amber-700">O histórico exibido foi limitado aos 3.000 registros mais recentes; os totais preservam a contagem real do período.</p> : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Provider / modelo</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Operação</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Créditos</th><th className="px-4 py-3">Custo</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3"><strong className="block text-slate-900">{item.provider}</strong><span className="text-xs text-slate-500">{item.model}</span></td>
                      <td className="px-4 py-3">{item.module}<span className="mt-1 block text-xs text-slate-500">{item.category}</span></td>
                      <td className="max-w-[240px] break-words px-4 py-3">{item.operation}</td>
                      <td className="max-w-[220px] break-all px-4 py-3">{item.userName}<span className="block text-xs text-slate-500">{item.userEmail}</span></td>
                      <td className="px-4 py-3">{item.credits}</td>
                      <td className="whitespace-nowrap px-4 py-3">{item.costBrl === null ? <span className="text-xs text-amber-700">Não registrado</span> : formatMoney(item.costBrl)}</td>
                      <td className="px-4 py-3">{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminSurface>
        </>
      ) : null}
    </AdminPageShell>
  )
}
