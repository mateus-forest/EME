"use client"

import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminAiOperations } from "@/components/use-admin-ai-operations"

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function AdminCostsPage() {
  const { data, loading, error, retry } = useAdminAiOperations(365)
  const imageCost = data?.categories.find((item) => item.label === "Imagem")?.costBrl ?? 0
  const videoCost = data?.categories.find((item) => item.label === "Vídeo")?.costBrl ?? 0
  const textCost = data?.categories.find((item) => item.label === "Texto")?.costBrl ?? 0

  return (
    <AdminPageShell
      eyebrow="Operação"
      title="Custos"
      description="Custos efetivamente registrados na telemetria dos providers. Ausência de custo não é convertida em estimativa silenciosa."
    >
      {loading ? <AdminSurface><p className="text-sm text-slate-500">Carregando custos registrados...</p></AdminSurface> : null}
      {error ? <AdminSurface><p className="text-sm text-red-700">{error}</p><button type="button" onClick={retry} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Tentar novamente</button></AdminSurface> : null}
      {data ? (
        <>
          <AdminMetricGrid>
            <AdminMetricCard label="Custo IA registrado" value={money(data.summary.recordedCostBrl)} />
            <AdminMetricCard label="Texto / COS" value={money(textCost)} />
            <AdminMetricCard label="Imagens" value={money(imageCost)} />
            <AdminMetricCard label="Vídeos" value={money(videoCost)} />
          </AdminMetricGrid>

          <AdminSurface>
            <div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Custos por provider e modelo</h2><p className="mt-1 text-sm text-slate-500">OpenAI, Grok/xAI, Pedra, Luma e demais providers aparecem quando há operação registrada.</p></div>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.providers.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><strong className="text-sm text-slate-900">{item.label}</strong><p className="mt-1 text-xs text-slate-500">{item.operations} operações · {item.credits} créditos</p></div>
                    <strong className="text-sm text-emerald-700">{money(item.costBrl)}</strong>
                  </div>
                  {item.unpricedOperations > 0 ? <p className="mt-3 text-xs text-amber-700">{item.unpricedOperations} operações sem custo registrado pelo provider.</p> : null}
                </div>
              ))}
            </div>
          </AdminSurface>

          <AdminSurface>
            <div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Critério de consolidação</h2><p className="mt-1 text-sm text-slate-500">Somente valores persistidos como custo real entram nos totais.</p></div>
            <div className="grid gap-3 md:grid-cols-3">
              {data.categories.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                  <span className="text-xs uppercase tracking-wide text-slate-500">{item.label}</span>
                  <strong className="mt-2 block text-xl text-slate-900">{money(item.costBrl)}</strong>
                  <span className="mt-1 block text-xs text-slate-500">{item.operations} operações</span>
                </div>
              ))}
            </div>
            {data.summary.unpricedOperations > 0 ? <p className="mt-4 text-sm text-amber-700">{data.summary.unpricedOperations} operações não possuem custo persistido e não foram estimadas como reais.</p> : null}
          </AdminSurface>
        </>
      ) : null}
    </AdminPageShell>
  )
}
