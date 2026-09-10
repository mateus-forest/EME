"use client"

import { useEffect, useState } from "react"
import { AlertCircle, ArrowUpRight, RefreshCw, X } from "lucide-react"
import { AdminPageShell } from "@/components/admin-page-shell"
import { OverviewBadge, OverviewEmpty, OverviewMetric, OverviewRanking, OverviewSection, OverviewTrafficChart, overviewNumber as number } from "@/components/admin-journey-overview-ui"
import { TrafficTable, type TrafficColumn } from "@/components/admin-traffic-table"
import { OVERVIEW_TIME_ZONE, overviewLocalDay, type OverviewPeriodKey } from "@/lib/admin-journey-contract"
import { TRAFFIC_SURFACES, type AdminTraffic, type TrafficCatalog, type TrafficData, type TrafficRoute, type TrafficSurface } from "@/lib/admin-traffic-contract"

const periods = [{ key: "today", label: "Hoje" }, { key: "7d", label: "7 dias" }, { key: "30d", label: "30 dias" }, { key: "custom", label: "Personalizado" }] as const
const deviceLabels = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet", unknown: "Não identificado" }
const percent = (value: number | null | undefined) => value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
const date = (value: string) => value.split("-").reverse().join("/")
const linkClass = "inline-flex items-center gap-1 text-left font-medium text-[#176a3d] underline decoration-[#b9d5c3] underline-offset-4 hover:text-[#0e4529]"
const buttonClass = "rounded-lg border border-[#dce5dd] bg-white px-3 py-2 text-xs text-[#365541]"

function MiniStats({ items }: { items: Array<{ label: string; value: number | null | undefined }> }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map(item => <div key={item.label} className="rounded-lg bg-[#f7faf7] px-3 py-2.5"><dt className="text-[10px] text-[#77877c]">{item.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[#254833]">{number(item.value)}</dd></div>)}</dl>
}

export function AdminTrafficPage() {
  const [period, setPeriod] = useState<OverviewPeriodKey>("7d")
  const [surface, setSurface] = useState<TrafficSurface>("all")
  const [route, setRoute] = useState<string | null>(null)
  const [dates, setDates] = useState({ from: "", to: "" })
  const [custom, setCustom] = useState({ from: "", to: "" })
  const [revision, setRevision] = useState(0)
  const [chart, setChart] = useState<"views" | "visitors" | "sessions">("views")
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null)
  const [result, setResult] = useState<{ key: string; data: AdminTraffic | null; error: string }>({ key: "", data: null, error: "" })
  const query = new URLSearchParams({ period, surface, ...(route ? { route } : {}), ...(period === "custom" ? custom : {}) }).toString()
  const requestKey = `${query}:${revision}`
  const waiting = period === "custom" && (!custom.from || !custom.to)
  const loading = !waiting && result.key !== requestKey
  const response = result.key === requestKey ? result.data : null
  const error = result.key === requestKey ? result.error : ""
  useEffect(() => {
    if (waiting) return
    const controller = new AbortController()
    void fetch(`/api/admin/journey-traffic?${query}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async res => { const body = await res.json(); if (!res.ok || !body.traffic) throw new Error(body.error || "Não foi possível consultar o tráfego."); return body.traffic as AdminTraffic })
      .then(data => { if (!controller.signal.aborted) setResult({ key: requestKey, data, error: "" }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error: error instanceof Error ? error.message : "Fonte indisponível." }) })
    return () => controller.abort()
  }, [query, requestKey, waiting])
  const data = response?.data
  const totals = data?.totals
  const unavailable = !data
  const status = unavailable ? "Indisponível" : response?.state.status === "partial" ? "Parcial • no período" : "No período"
  const selected = data?.catalogs.find(item => item.label === selectedCatalog)
  const routeColumns: TrafficColumn<TrafficRoute>[] = [
    { key: "label", label: "Rota", value: row => row.label, render: row => <button className={linkClass} onClick={() => setRoute(row.label)} title="Filtrar toda a análise por esta rota">{row.label}<ArrowUpRight className="size-3 shrink-0" /></button> },
    ...(["views", "visitors", "sessions", "entries", "exits"] as const).map((key, i) => ({ key, label: ["Page views", "Visitantes", "Sessões", "Entradas", "Saídas estimadas"][i], value: (row: TrafficRoute) => row[key], numeric: true })),
  ]
  const catalogColumns: TrafficColumn<TrafficCatalog>[] = [
    { key: "label", label: "Catálogo / proprietário", value: row => row.label, render: row => <div><button className={linkClass} onClick={() => setSelectedCatalog(selectedCatalog === row.label ? null : row.label)} aria-expanded={selectedCatalog === row.label}>{row.label}<ArrowUpRight className="size-3 shrink-0" /></button><p className="mt-1 text-[10px] text-[#849087]">{row.owner ?? "Proprietário não identificado"}{row.ownerType === "AGENCY" ? " · Imobiliária" : row.ownerType === "BROKER" ? " · Corretor" : ""}</p></div> },
    ...(["views", "visitors", "sessions", "opened", "leads"] as const).map((key, i) => ({ key, label: ["Acessos", "Visitantes", "Sessões", "Imóveis abertos", "Leads"][i], value: (row: TrafficCatalog) => row[key], numeric: true })),
  ]
  const acquisitionColumns: TrafficColumn<TrafficData["acquisition"][number]>[] = [
    { key: "source", label: "Source", value: row => row.source }, { key: "medium", label: "Medium", value: row => row.medium },
    { key: "referrer", label: "Referrer", value: row => row.referrer }, { key: "sessions", label: "Sessões", value: row => row.sessions, numeric: true },
  ]

  return <AdminPageShell title="Tráfego" subtitle="Aquisição e navegação · Journey Analytics">
    <div className="space-y-4" aria-busy={loading} data-testid="journey-traffic">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-medium text-[#314d3c]">{response ? `${date(response.filters.period.from)} — ${date(response.filters.period.to)}` : "Análise do período"}</p><p className="mt-1 text-[10px] text-[#849087]">America/Sao_Paulo{response ? ` · Atualizado ${new Intl.DateTimeFormat("pt-BR", { timeZone: OVERVIEW_TIME_ZONE, dateStyle: "short", timeStyle: "short" }).format(new Date(response.generatedAt))}` : ""}</p></div>
        <div className="flex flex-wrap items-center gap-2"><div role="group" aria-label="Período" className="flex rounded-xl border border-[#e0e7e1] bg-[#f6f8f6] p-1">{periods.map(item => <button key={item.key} type="button" aria-pressed={period === item.key} onClick={() => setPeriod(item.key)} className={`rounded-lg px-3 py-2 text-xs font-medium ${period === item.key ? "bg-white text-[#176a3d] shadow-sm" : "text-[#7b877e]"}`}>{item.label}</button>)}</div><button type="button" aria-label="Atualizar tráfego" disabled={loading || waiting} onClick={() => setRevision(v => v + 1)} className="rounded-xl border border-[#e0e7e1] p-2.5 text-[#617569] disabled:opacity-40"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      </div>
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs text-[#718278]">Superfície<select aria-label="Superfície" value={surface} onChange={event => { setSurface(event.target.value as TrafficSurface); setRoute(null) }} className={buttonClass}>{Object.entries(TRAFFIC_SURFACES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{route && <button type="button" className="flex max-w-full items-center gap-2 rounded-lg bg-[#eaf5ef] px-3 py-2 text-xs text-[#176a3d]" onClick={() => setRoute(null)} aria-label="Remover filtro de rota"><span className="truncate">Rota: {route}</span><X className="size-3 shrink-0" /></button>}<span className="text-[10px] text-[#89968d]">Filtros aplicados a todos os blocos</span></div>
      {period === "custom" && <form className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e4e9e5] bg-[#f8faf8] p-3" onSubmit={event => { event.preventDefault(); setCustom(dates); setRevision(v => v + 1) }}>
        <label className="grid gap-1 text-xs text-[#617569]">De<input aria-label="Data inicial" type="date" required max={overviewLocalDay(new Date())} value={dates.from} onChange={event => setDates({ ...dates, from: event.target.value })} className={buttonClass} /></label>
        <label className="grid gap-1 text-xs text-[#617569]">Até<input aria-label="Data final" type="date" required min={dates.from} max={overviewLocalDay(new Date())} value={dates.to} onChange={event => setDates({ ...dates, to: event.target.value })} className={buttonClass} /></label>
        <button type="submit" className="rounded-lg bg-[#176a3d] px-4 py-2.5 text-xs font-medium text-white">Aplicar intervalo</button><span className="pb-2 text-[10px] text-[#849087]">Até 366 dias, datas inclusivas</span>
      </form>}
      {waiting && <p className="py-12 text-center text-sm text-[#78827b]">Escolha as datas e aplique o intervalo.</p>}
      {loading && <div role="status" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[104px] animate-pulse rounded-xl bg-[#f0f4f0]" />)}<span className="sr-only">Consultando Journey Analytics...</span></div>}
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error} Totais indisponíveis. Use Atualizar para tentar novamente.</div>}
      {response && <>
        {response.state.status !== "available" && <div role="status" className="flex items-start gap-2 rounded-xl border border-[#eadfc3] bg-[#fffcf4] px-3 py-2.5 text-xs leading-5 text-[#8b703e]"><AlertCircle className="mt-0.5 size-3.5 shrink-0" /><span><strong>{data ? "Dados parciais. " : "Fonte indisponível. "}</strong>{response.state.note}</span></div>}
        <section aria-label="Métricas principais" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <OverviewMetric id="visitors" label="Visitantes únicos" value={number(totals?.visitors)} detail="AnonymousId distintos em page_view no intervalo inteiro. Mesmo navegador após login; dispositivos diferentes não são fundidos." status={data ? "Estimado por navegador" : status} />
          <OverviewMetric id="sessions" label="Sessões" value={number(totals?.sessions)} detail="SessionId distintos em page_view. Uma sessão pode visitar várias superfícies." status={status} />
          <OverviewMetric id="pageViews" label="Page views" value={number(totals?.views)} detail="Somente eventos page_view do browser. Não soma eventos de acesso específicos nem legados." status={status} />
          <OverviewMetric id="pagesPerSession" label="Páginas por sessão" value={number(totals?.pagesPerSession)} detail="Page views com sessionId divididos pelas sessões distintas, no recorte selecionado." status={data && totals?.pagesPerSession == null ? "Sem sessões identificadas" : status} />
          <OverviewMetric id="newVisitors" label="Novos visitantes" value={number(totals?.newVisitors)} detail="Visitantes sem page_view anterior ao início do período em todo o histórico Journey disponível, independentemente da superfície selecionada." status={data ? "Parcial • primeiro registro" : status} />
          <OverviewMetric id="returningVisitors" label="Recorrentes" value={number(totals?.returningVisitors)} detail="Visitantes com page_view anterior ao início do intervalo. Retornos dentro do mesmo intervalo não mudam a categoria." status={data ? "Parcial • histórico observado" : status} />
        </section>
        <OverviewSection title="Evolução do tráfego" description={response.filters.period.from === response.filters.period.to ? "Por hora em São Paulo. O período atual está em andamento." : "Por dia em São Paulo. Únicos do período não são a soma dos únicos diários."} aside={<div className="flex gap-1">{([{ key: "views", label: "Views" }, { key: "visitors", label: "Únicos" }, { key: "sessions", label: "Sessões" }] as const).map(item => <button type="button" key={item.key} aria-pressed={chart === item.key} onClick={() => setChart(item.key)} className={`rounded-md px-2 py-1 text-[10px] ${chart === item.key ? "bg-[#eaf5ef] text-[#176a3d]" : "text-[#849087]"}`}>{item.label}</button>)}</div>}>
          {data ? <OverviewTrafficChart data={data} hourly={response.filters.period.from === response.filters.period.to} metric={chart} /> : <OverviewEmpty unavailable />}
        </OverviewSection>
        <OverviewSection title="Superfícies" description="Volume e participação em page views. Clique para filtrar. Visitantes e sessões podem aparecer em mais de uma superfície." aside={<OverviewBadge>{number(totals?.entries)} entradas observadas</OverviewBadge>}>
          <TrafficTable key={`surfaces:${query}`} label="Superfícies" initialSort="views" unavailable={unavailable} rows={data?.surfaces ?? []} columns={[
            { key: "label", label: "Superfície", value: row => TRAFFIC_SURFACES[row.label as TrafficSurface] ?? row.label, render: row => <button className={linkClass} onClick={() => { setSurface(row.label as TrafficSurface); setRoute(null) }}>{TRAFFIC_SURFACES[row.label as TrafficSurface] ?? row.label}<ArrowUpRight className="size-3 shrink-0" /></button> },
            { key: "views", label: "Page views", value: row => row.views, numeric: true }, { key: "share", label: "Participação", value: row => row.views, numeric: true, render: row => percent(totals?.views ? row.views / totals.views * 100 : null) },
            { key: "visitors", label: "Visitantes", value: row => row.visitors, numeric: true }, { key: "sessions", label: "Sessões", value: row => row.sessions, numeric: true }, { key: "entries", label: "Entradas", value: row => row.entries, numeric: true },
          ]} />
          <p className="mt-3 text-[10px] leading-relaxed text-[#89968d]">Landing: página inicial. Marketplace: /imoveis. Catálogos: /catalogo. Portal: /corretor e /imobiliaria com usuário autenticado. Login, cadastro e rotas restantes ficam em Outras. Admin e bots identificados são excluídos.</p>
        </OverviewSection>
        <OverviewSection title="Rotas mais acessadas" description="Clique em uma rota para detalhar o recorte. Caminhos estão normalizados, sem slugs, parâmetros ou dados pessoais." aside={<OverviewBadge tone="warning">Saídas estimadas</OverviewBadge>}>
          <TrafficTable key={`routes:${query}`} label="Rotas" initialSort="views" unavailable={unavailable} rows={data?.routes ?? []} columns={routeColumns} />
          <p className="mt-3 text-[10px] leading-relaxed text-[#89968d]">Entrada = primeira página observada da sessão em todo o histórico, se estiver no recorte. Saída estimada = última página conhecida, sem página posterior e com ao menos 30 minutos até o fim do intervalo. Não comprova o fechamento do site. {data && data.quality.routes > 200 ? `Parcial: 200 de ${number(data.quality.routes)} rotas, selecionadas por page views.` : ""}</p>
        </OverviewSection>
        <div className="grid gap-4 xl:grid-cols-2">
          <OverviewSection title="Marketplace" description="Eventos específicos do Marketplace; acessos são marketplace_view, separados dos page views.">
            <MiniStats items={[{ label: "Acessos", value: data?.marketplace.views }, { label: "Buscas", value: data?.marketplace.searches }, { label: "Imóveis abertos", value: data?.marketplace.opened }, { label: "Leads originados", value: data?.marketplace.leads }]} />
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-[#e5eee7] px-3 py-3"><div><p className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#41624c]">Busca → imóvel{data && (data.marketplace.unlinkedOpens > 0 || data.quality.missingSearchIdentity > 0) && <OverviewBadge tone="warning">Parcial</OverviewBadge>}</p><p className="mt-1 text-[10px] text-[#849087]">{data ? `${number(data.marketplace.convertedSearches)} de ${number(data.marketplace.linkedSearches)} buscas vinculadas` : "Indisponível"}</p></div><strong data-testid="search-rate" className="text-2xl font-semibold tabular-nums text-[#176a3d]">{percent(data?.marketplace.searchRate)}</strong></div>
            <p className="mt-3 text-[10px] leading-relaxed text-[#89968d]">Mesmo searchId, navegador e sessão; abertura posterior à busca, ambos dentro dos filtros. Cada busca converte uma vez. {data ? `${number(data.marketplace.unlinkedOpens)} aberturas sem busca correspondente ficam fora da taxa. ${number(data.quality.missingSearchIdentity)} buscas sem vínculo completo.` : ""} Taxa parcial quando há vínculos ausentes. Leads: confirmação no servidor com channel=marketplace.</p>
          </OverviewSection>
          <OverviewSection title="Dispositivos" description="Dispositivo da primeira página conhecida de cada sessão que visitou o recorte.">
            <OverviewRanking rows={data?.devices ?? []} labels={deviceLabels} unavailable={unavailable} unit="sessões" />
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#edf1ed] pt-3"><span className="text-xs text-[#718278]">Navegador</span><OverviewBadge>Indisponível · não capturado</OverviewBadge></div>
          </OverviewSection>
        </div>
        <OverviewSection title="Catálogos" description="Ranking por catalog_view. Visitantes e sessões de cada catálogo são calculados nesses acessos. Clique no catálogo para detalhar." aside={<OverviewBadge>Proprietário ≠ visitante</OverviewBadge>}>
          <MiniStats items={[{ label: "Acessos", value: data?.catalogTotals.views }, { label: "Catálogos observados", value: data?.quality.catalogs }, { label: "Imóveis abertos", value: data?.catalogTotals.opened }, { label: "Leads originados", value: data?.catalogTotals.leads }]} />
          <div className="mt-3"><TrafficTable key={`catalogs:${query}`} label="Catálogos" initialSort="views" unavailable={unavailable} rows={data?.catalogs ?? []} columns={catalogColumns} /></div>
          {selected && <div role="region" aria-label="Detalhe do catálogo" className="mt-3 rounded-xl border border-[#cee3d4] bg-[#f4f9f5] p-3"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="break-all text-sm font-medium text-[#245438]">{selected.label}</h3><p className="mt-1 text-xs text-[#74857a]">{selected.owner ?? "Proprietário não identificado"} · identificação atual, sem atribuição de atividade</p></div><button aria-label="Fechar detalhe do catálogo" onClick={() => setSelectedCatalog(null)}><X className="size-4 text-[#74857a]" /></button></div><MiniStats items={[{ label: "Visitantes", value: selected.visitors }, { label: "Sessões", value: selected.sessions }, { label: "Imóveis abertos", value: selected.opened }, { label: "Leads", value: selected.leads }]} /></div>}
          <p className="mt-3 text-[10px] leading-relaxed text-[#89968d]">Leads apenas com channel=catalog e catalogId explícito. Slugs identificam os catálogos; o page_view genérico não permite separar cada catálogo. {response.ownersState.note} {data && data.quality.catalogs > 200 ? `Parcial: 200 de ${number(data.quality.catalogs)} catálogos, selecionados por acessos.` : ""}</p>
        </OverviewSection>
        <OverviewSection title="Aquisição" description="Source, medium e hostname de referrer da primeira página conhecida da sessão, inclusive se a entrada foi anterior ao intervalo." aside={<OverviewBadge tone="warning">Atribuição observada</OverviewBadge>}>
          <TrafficTable key={`acquisition:${query}`} label="Aquisição" initialSort="sessions" unavailable={unavailable} rows={data?.acquisition ?? []} columns={acquisitionColumns} />
          <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-[#718278]">UTM campaign</span><OverviewBadge>Indisponível · não capturada</OverviewBadge></div>
          <p className="mt-3 text-[10px] leading-relaxed text-[#89968d]">Source/medium refletem os valores normalizados capturados: direct indica ausência de referrer na coleta; other é genérico. UTMs não reconhecidas podem ficar sem informação. Referrers internos permanecem visíveis; não há atribuição multicanal nem identificação de campanha. {data && data.quality.acquisition > 200 ? `Parcial: 200 de ${number(data.quality.acquisition)} combinações, selecionadas por sessões.` : ""}</p>
        </OverviewSection>
        <p className="px-1 text-[10px] leading-relaxed text-[#89968d]">Fonte exclusiva das métricas: Journey Analytics. Unicidade no intervalo inteiro, sem soma de únicos diários e sem eventos legados. Novos/recorrentes dependem do histórico disponível e dos cookies; não equivalem a pessoas físicas. Todos os horários em America/Sao_Paulo.</p>
      </>}
    </div>
  </AdminPageShell>
}
