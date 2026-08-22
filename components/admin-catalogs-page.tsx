"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Search, Send } from "lucide-react"

import { AdminMetricCard, AdminMetricGrid, AdminSurface } from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminCatalogs } from "@/components/use-admin-catalogs"

export function AdminCatalogsPage() {
  const { data, loading, error, retry } = useAdminCatalogs()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("Todos")
  const [feedback, setFeedback] = useState<string | null>(null)
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return (data?.catalogs ?? []).filter((catalog) => {
      if (status !== "Todos" && catalog.status !== status) return false
      if (!normalized) return true
      return `${catalog.brokerName} ${catalog.brokerEmail} ${catalog.slug} ${catalog.creci}`.toLowerCase().includes(normalized)
    })
  }, [data, query, status])

  async function notifyBroker(brokerId: string, brokerName: string) {
    setFeedback(null)
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notify", brokerId }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Não foi possível enviar a notificação."
        throw new Error(message)
      }
      setFeedback(`Notificação administrativa enviada para ${brokerName}.`)
    } catch (notifyError) {
      setFeedback(notifyError instanceof Error ? notifyError.message : "Falha ao enviar notificação.")
    }
  }

  return (
    <AdminPageShell
      eyebrow="Operação pública"
      title="Catálogos"
      description="Disponibilidade, publicação e performance dos catálogos reais dos corretores."
    >
      {loading ? <AdminSurface><p className="text-sm text-slate-500">Carregando catálogos...</p></AdminSurface> : null}
      {error ? <AdminSurface><p className="text-sm text-red-700">{error}</p><button type="button" onClick={retry} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Tentar novamente</button></AdminSurface> : null}
      {data ? (
        <>
          <AdminMetricGrid>
            <AdminMetricCard label="Total de catálogos" value={data.overview.total.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Ativos" value={data.overview.active.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Precisam de atenção" value={data.overview.attention.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Acessos registrados" value={data.overview.views.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Contatos / leads" value={data.overview.contacts.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Compartilhamentos" value={data.overview.shares === null ? "Sem telemetria" : data.overview.shares.toLocaleString("pt-BR")} />
          </AdminMetricGrid>

          {feedback ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</div> : null}

          <AdminSurface>
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="text-lg font-semibold text-slate-900">Gestão de catálogos</h2><p className="mt-1 text-sm text-slate-500">Abra a superfície pública, o usuário responsável ou envie uma orientação administrativa.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Corretor, e-mail, slug ou CRECI" className="h-10 min-w-0 bg-transparent text-sm outline-none sm:w-64" /></label>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option>Todos</option><option>Ativo</option><option>Inativo</option><option>Atenção</option></select>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Corretor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">CRECI</th><th className="px-4 py-3">Imóveis</th><th className="px-4 py-3">Acessos</th><th className="px-4 py-3">Leads</th><th className="px-4 py-3">Conversão</th><th className="px-4 py-3">Atualização</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map((catalog) => <tr key={catalog.brokerId} className="align-top"><td className="px-4 py-3"><strong className="block text-slate-900">{catalog.brokerName}</strong><span className="block max-w-[220px] break-all text-xs text-slate-500">{catalog.brokerEmail}</span><span className="text-xs text-slate-400">/{catalog.slug}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${catalog.status === "Ativo" ? "bg-emerald-50 text-emerald-700" : catalog.status === "Atenção" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{catalog.status}</span>{catalog.issue ? <span className="mt-2 block max-w-[160px] text-xs text-amber-700">{catalog.issue}</span> : null}</td><td className="px-4 py-3">{catalog.creci}<span className="block text-xs text-slate-500">{catalog.creciStatus}</span></td><td className="px-4 py-3">{catalog.publishedProperties}</td><td className="px-4 py-3">{catalog.views}</td><td className="px-4 py-3">{catalog.contacts}</td><td className="px-4 py-3">{catalog.conversion === null ? "Sem base" : `${catalog.conversion}%`}</td><td className="whitespace-nowrap px-4 py-3">{new Date(catalog.updatedAt).toLocaleDateString("pt-BR")}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Link href={catalog.publicPath} target="_blank" aria-label="Abrir catálogo público" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-emerald-700"><ExternalLink className="size-4" /></Link><Link href={`/admin/usuarios?user=${catalog.userId}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">Usuário</Link><button type="button" onClick={() => void notifyBroker(catalog.brokerId, catalog.brokerName)} aria-label="Enviar notificação" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-emerald-700"><Send className="size-4" /></button></div></td></tr>)}</tbody>
              </table>
            </div>
          </AdminSurface>

          <div className="grid gap-5 xl:grid-cols-2">
            <AdminSurface><h2 className="text-lg font-semibold text-slate-900">Catálogos mais acessados</h2><div className="mt-4 space-y-3">{data.topAccessed.map((catalog, index) => <div key={catalog.brokerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span><strong className="mr-2 text-slate-400">{index + 1}</strong>{catalog.brokerName}</span><strong>{catalog.views} acessos</strong></div>)}</div></AdminSurface>
            <AdminSurface><h2 className="text-lg font-semibold text-slate-900">Melhor conversão</h2><div className="mt-4 space-y-3">{data.topConversion.map((catalog, index) => <div key={catalog.brokerId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span><strong className="mr-2 text-slate-400">{index + 1}</strong>{catalog.brokerName}</span><strong>{catalog.conversion}%</strong></div>)}</div></AdminSurface>
          </div>

          <AdminSurface>
            <h2 className="text-lg font-semibold text-slate-900">Cobertura Admin x Portal do Corretor</h2><p className="mt-1 text-sm text-slate-500">Lacunas objetivas encontradas na leitura das rotas atuais, sem alterar o Portal.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">{data.coverage.map((item) => <div key={item.domain} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{item.domain}</strong><span className={`rounded-full px-2 py-1 text-xs ${item.status === "Coberto" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p></div>)}</div>
          </AdminSurface>
        </>
      ) : null}
    </AdminPageShell>
  )
}
